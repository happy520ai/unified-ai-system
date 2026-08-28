/**
 * @module sandbox-executor
 * @description Sandboxed command execution for the Forge code generation engine.
 *
 * Security levels use an attested container backend and fail closed when that
 * backend is unavailable. Host-process execution is an explicit development
 * mode and is never used as a fallback for filesystem/full isolation.
 *
 * Sandbox levels:
 *   - NONE        Explicit unrestricted host execution.
 *   - PROCESS     Explicit host execution with minimal env/time/output bounds.
 *   - FILESYSTEM  Attested container filesystem isolation.
 *   - FULL        Filesystem isolation plus mandatory network isolation.
 *   - WORKTREE    Git collision isolation plus the attested container backend.
 *
 * @example
 * import { SandboxExecutor, SandboxLevel } from './sandbox-executor/index.js';
 *
 * const sandbox = new SandboxExecutor({ level: 'process', maxTimeMs: 15000 });
 * const result = await sandbox.execute('npm test', { cwd: '/project' });
 * // result.exitCode === 0, result.stdout contains test output
 */

import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { delimiter, dirname, resolve } from 'node:path';
import { ContainerSandboxBackend } from './container-backend.js';
import {
  SandboxLevel,
  resolveAllowedPrefixes,
  isPathAllowed,
  isPathDenied,
  resolveEffectiveLevel,
  preCheckCommand,
  buildSandboxResult,
  createSandboxProfile,
  aggregateResourceStats,
  validateSandboxProfile,
} from './helpers.js';

export { SandboxLevel } from './helpers.js';
export { ContainerSandboxBackend } from './container-backend.js';

const HOST_ENV_KEYS = Object.freeze([
  'PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT',
  'TEMP', 'TMP', 'LANG', 'LC_ALL',
]);
const SAFE_EXPLICIT_ENV_KEYS = new Set(['CI', 'NODE_ENV', 'FORGE_TASK_TYPE', 'PORT']);

function createMinimalHostEnvironment(explicit = {}) {
  const env = Object.create(null);
  for (const key of HOST_ENV_KEYS) {
    if (typeof process.env[key] === 'string' && process.env[key]) env[key] = process.env[key];
  }
  for (const [key, rawValue] of Object.entries(explicit)) {
    if (!SAFE_EXPLICIT_ENV_KEYS.has(key)) continue;
    env[key] = String(rawValue);
  }
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  env[pathKey] = [dirname(process.execPath), env[pathKey]].filter(Boolean).join(delimiter);
  return env;
}

function failResult(executor, startTime, sandboxLevel, code, message) {
  return executor({
    exitCode: -1,
    stdout: '',
    stderr: `${code}: ${message}`,
    duration: Date.now() - startTime,
    killed: true,
    killReason: code,
    sandboxLevel,
    peakMemoryMB: 0,
  });
}

// ---------------------------------------------------------------------------
// SandboxExecutor class
// ---------------------------------------------------------------------------

/**
 * Sandboxed command executor with configurable restriction levels.
 *
 * Resolution order for sandbox level on each {@link SandboxExecutor#execute}
 * call:
 * 1. Per-call `opts.level` override.
 * 2. Constructor-level default (`opts.level`).
 * 3. Fallback: `SandboxLevel.PROCESS`.
 *
 * Requested isolation is never silently downgraded.
 *
 * @example
 * const sandbox = new SandboxExecutor({
 *   level: 'filesystem',
 *   maxTimeMs: 30000,
 *   maxMemoryMB: 256,
 *   allowedPaths: ['/project'],
 * });
 *
 * const result = await sandbox.execute('npm test', { cwd: '/project' });
 */
export class SandboxExecutor {
  /** @type {string} Default sandbox level. */
  #level;

  /** @type {number} Maximum execution time in ms. */
  #maxTimeMs;

  /** @type {number} Maximum memory in MB. */
  #maxMemoryMB;

  /** @type {string[]} Allowed path prefixes (resolved). */
  #allowedPaths;

  /** @type {string[]} Denied path prefixes (resolved). */
  #deniedPaths;

  /** @type {number} Maximum bytes captured for stdout/stderr each. */
  #maxOutputBytes;

  /** @type {string} Detected platform identifier. */
  #platform;

  /** @type {ContainerSandboxBackend|Object|null} */
  #backend;

  /** @type {boolean} Whether explicit PROCESS host execution is enabled. */
  #hostExecutionEnabled;

  /**
   * Execution history ring buffer.
   * @type {Array<{ duration: number, killed: boolean, killReason: string|null, peakMemoryMB: number }>}
   */
  #history;

  /** @type {number} Maximum history entries. */
  #maxHistory;

  /**
   * Git Worktree 管理器实例(WORKTREE 级别时使用)。
   * 懒加载:首次 WORKTREE 执行时创建。
   * @type {Object|null}
   */
  #gitWorktreeManagers = new Map();

  /**
   * Creates a new `SandboxExecutor`.
   *
   * @param {Object}   [opts]
   * @param {string}   [opts.level='process']      - Default {@link SandboxLevel}.
   * @param {number}   [opts.maxTimeMs=30000]      - Default time limit (ms).
   * @param {number}   [opts.maxMemoryMB=512]       - Default memory limit (MB).
   * @param {string[]} [opts.allowedPaths=[]]       - Allowed path prefixes.
   * @param {string[]} [opts.deniedPaths=[]]        - Denied path prefixes.
   * @param {number}   [opts.maxOutputBytes=1048576] - Output capture limit per stream.
   * @param {string}   [opts.platform]              - Override platform detection.
   * @param {Object}   [opts.backend]               - Injected attested backend.
   * @param {Object}   [opts.container]             - Container backend options.
   * @param {boolean}  [opts.hostExecutionEnabled=false] - Explicit PROCESS opt-in.
   */
  constructor(opts = {}) {
    this.#level = opts.level ?? SandboxLevel.PROCESS;
    this.#maxTimeMs = opts.maxTimeMs ?? 30_000;
    this.#maxMemoryMB = opts.maxMemoryMB ?? 512;
    this.#allowedPaths = resolveAllowedPrefixes(opts.allowedPaths ?? [], process.cwd());
    this.#deniedPaths = resolveAllowedPrefixes(opts.deniedPaths ?? [], process.cwd());
    this.#maxOutputBytes = opts.maxOutputBytes ?? 1_048_576;
    this.#platform = opts.platform ?? process.platform;
    this.#backend = opts.backend ?? (opts.container ? new ContainerSandboxBackend(opts.container) : null);
    this.#hostExecutionEnabled = opts.hostExecutionEnabled === true;
    this.#history = [];
    this.#maxHistory = 500;
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Execute a command inside the sandbox.
   *
   * @param {string} command  - Shell command to execute.
   * @param {Object} [opts]   - Per-call overrides.
   * @param {string} [opts.cwd]          - Working directory for the child process.
   * @param {Object} [opts.env]          - Additional environment variables.
   * @param {number} [opts.timeout]      - Override time limit (ms).
   * @param {string} [opts.level]        - Override {@link SandboxLevel}.
   * @param {'ro'|'rw'} [opts.workspaceMode] - Container workspace mount mode.
   * @param {AbortSignal} [opts.signal] - Cancellation signal.
   * @returns {Promise<import('./helpers.js').SandboxResult>} Execution outcome.
   */
  async execute(command, opts = {}) {
    const startTime = Date.now();
    let effectiveLevel = opts.level ?? this.#level;
    const fail = (code, message) => failResult(
      (raw) => this.#buildResult(raw),
      startTime,
      effectiveLevel,
      code,
      message,
    );

    try {
      effectiveLevel = resolveEffectiveLevel(opts.level, this.#level, this.#platform);
    } catch (error) {
      return fail(error.code ?? 'SANDBOX_LEVEL_INVALID', error.message);
    }

    const timeoutMs = Number(opts.timeout ?? this.#maxTimeMs);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return fail('SANDBOX_LIMIT_INVALID', 'timeout must be a positive finite number');
    }

    // ── Pre-check ─────────────────────────────────────────────────────
    const preCheck = preCheckCommand(command, effectiveLevel);
    if (!preCheck.safe) {
      return fail('SANDBOX_PRECHECK_REJECTED', preCheck.reason);
    }

    // ── Filesystem validation ─────────────────────────────────────────
    const requiresBackend = effectiveLevel === SandboxLevel.FILESYSTEM
      || effectiveLevel === SandboxLevel.FULL
      || effectiveLevel === SandboxLevel.WORKTREE;
    if (requiresBackend) {
      const cwd = opts.cwd ?? process.cwd();
      const allowedPrefixes = [...this.#allowedPaths];

      if (allowedPrefixes.length === 0) {
        return fail('SANDBOX_WORKSPACE_UNCONFIGURED', 'security levels require constructor-level allowedPaths');
      }
      if (!isPathAllowed(cwd, allowedPrefixes)) {
        return fail('SANDBOX_WORKSPACE_DENIED', `cwd "${cwd}" is outside allowed paths`);
      }

      if (this.#deniedPaths.length > 0 && isPathDenied(cwd, this.#deniedPaths)) {
        return fail('SANDBOX_WORKSPACE_DENIED', `cwd "${cwd}" is inside a denied path`);
      }
    }

    // ── Optional worktree collision boundary ─────────────────────────
    let worktreeCleanup = null;
    let effectiveCwd = opts.cwd ?? process.cwd();

    if (effectiveLevel === SandboxLevel.WORKTREE) {
      try {
        const { createGitWorktree } = await import("./git-worktree.js");
        const canonicalRepoRoot = await realpath(effectiveCwd);
        let wt = this.#gitWorktreeManagers.get(canonicalRepoRoot);
        if (!wt) {
          wt = createGitWorktree({
            repoRoot: canonicalRepoRoot,
            worktreeRoot: ".forge-worktrees",
          });
          this.#gitWorktreeManagers.set(canonicalRepoRoot, wt);
        }

        const taskId = opts.taskId || `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const record = await wt.create({ id: taskId, baseBranch: opts.baseBranch });
        effectiveCwd = record.path;
        worktreeCleanup = async () => {
          await wt.remove(taskId);
        };
      } catch (err) {
        return fail('SANDBOX_WORKTREE_CREATE_FAILED', err.message);
      }
    }

    // ── Security levels: attested backend only, never host fallback ───
    if (requiresBackend) {
      let rawResult;
      let cleanupError = null;
      let backendRunStarted = false;
      try {
        if (!this.#backend || typeof this.#backend.attest !== 'function' || typeof this.#backend.run !== 'function') {
          throw Object.assign(new Error('an attested container backend is required'), {
            code: 'SANDBOX_BACKEND_UNAVAILABLE',
          });
        }
        const attestation = await this.#backend.attest();
        const requiredCapabilities = [
          'readOnlyRoot', 'nonRootUser', 'noNewPrivileges',
          'capabilitiesDropped', 'processTreeKill', 'resourceLimits',
        ];
        if (requiredCapabilities.some((key) => attestation?.[key] !== true)) {
          throw Object.assign(new Error('backend attestation is missing mandatory isolation capabilities'), {
            code: 'SANDBOX_ATTESTATION_FAILED',
          });
        }
        if ((effectiveLevel === SandboxLevel.FULL || effectiveLevel === SandboxLevel.WORKTREE)
            && attestation.networkIsolation !== true) {
          throw Object.assign(new Error('network isolation was requested but not attested'), {
            code: 'SANDBOX_ATTESTATION_FAILED',
          });
        }

        backendRunStarted = true;
        rawResult = await this.#backend.run({
          command,
          workspace: effectiveCwd,
          workspaceMode: opts.workspaceMode ?? (effectiveLevel === SandboxLevel.WORKTREE ? 'rw' : 'ro'),
          networkAccess: effectiveLevel === SandboxLevel.FILESYSTEM && opts.networkAccess === true,
          env: opts.env ?? {},
          timeoutMs,
          maxMemoryMB: opts.maxMemoryMB ?? this.#maxMemoryMB,
          maxOutputBytes: this.#maxOutputBytes,
          pidsLimit: opts.pidsLimit,
          cpus: opts.cpus,
          signal: opts.signal,
        });
        rawResult.sandboxLevel = effectiveLevel;
        rawResult.isolation = rawResult.isolation ?? attestation;
      } catch (error) {
        rawResult = {
          exitCode: -1,
          stdout: '',
          stderr: `${error.code ?? 'SANDBOX_BACKEND_ERROR'}: ${error.message}`,
          duration: Date.now() - startTime,
          killed: true,
          killReason: error.code ?? 'SANDBOX_BACKEND_ERROR',
          sandboxLevel: effectiveLevel,
          peakMemoryMB: 0,
          backend: this.#backend?.type ?? 'unavailable',
          cleanupUncertain: backendRunStarted,
        };
      }

      if (worktreeCleanup && !rawResult.cleanupUncertain) {
        try { await worktreeCleanup(); } catch (error) { cleanupError = error; }
      } else if (worktreeCleanup && rawResult.cleanupUncertain) {
        rawResult.stderr = `${rawResult.stderr ? `${rawResult.stderr}\n` : ''}SANDBOX_WORKTREE_RETAINED: container quiescence was not proven; worktree cleanup was refused.`;
      }
      if (cleanupError) {
        rawResult.exitCode = -1;
        rawResult.killed = true;
        rawResult.cleanupUncertain = true;
        rawResult.killReason = 'worktree cleanup uncertain';
        rawResult.stderr = `${rawResult.stderr ? `${rawResult.stderr}\n` : ''}SANDBOX_WORKTREE_CLEANUP_FAILED: ${cleanupError.message}`;
      }
      return this.#buildResult(rawResult);
    }

    // ── Explicit host modes ───────────────────────────────────────────
    if (effectiveLevel === SandboxLevel.PROCESS && !this.#hostExecutionEnabled) {
      return fail('SANDBOX_HOST_EXECUTION_DISABLED', 'PROCESS mode requires explicit hostExecutionEnabled=true');
    }

    return new Promise((resolvePromise) => {
      const shell = this.#platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellArgs = this.#platform === 'win32'
        ? ['/c', command]
        : ['-c', command];

      const childEnv = effectiveLevel === SandboxLevel.NONE
        ? { ...process.env, ...(opts.env ?? {}) }
        : createMinimalHostEnvironment(opts.env ?? {});
      const cwd = effectiveCwd;

      let child;
      try {
        child = spawn(shell, shellArgs, {
          cwd,
          env: childEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          windowsVerbatimArguments: this.#platform === 'win32',
          detached: this.#platform !== 'win32',
        });
      } catch (err) {
        resolvePromise(fail('SANDBOX_SPAWN_FAILED', err.message));
        return;
      }

      // ── Capture output (with truncation) ──────────────────────────
      let stdoutChunks = [];
      let stdoutLen = 0;
      let stderrChunks = [];
      let stderrLen = 0;

      child.stdout.on('data', (chunk) => {
        if (stdoutLen < this.#maxOutputBytes) {
          const remaining = this.#maxOutputBytes - stdoutLen;
          const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          stdoutChunks.push(slice);
          stdoutLen += slice.length;
        }
      });

      child.stderr.on('data', (chunk) => {
        if (stderrLen < this.#maxOutputBytes) {
          const remaining = this.#maxOutputBytes - stderrLen;
          const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
          stderrChunks.push(slice);
          stderrLen += slice.length;
        }
      });

      let killed = false;
      let killReason = null;
      let settled = false;

      const terminateTree = () => {
        if (!child.pid) return;
        if (this.#platform === 'win32') {
          try {
            spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
              env: createMinimalHostEnvironment(),
              shell: false,
              windowsHide: true,
              stdio: 'ignore',
            });
          } catch { /* best effort in explicitly unsafe host mode */ }
          try { child.kill('SIGKILL'); } catch { /* already exited */ }
        } else {
          try { process.kill(-child.pid, 'SIGKILL'); } catch {
            try { child.kill('SIGKILL'); } catch { /* already exited */ }
          }
        }
      };

      // ── Time limit ────────────────────────────────────────────────
      const timer = setTimeout(() => {
        killed = true;
        killReason = `timeout (${timeoutMs}ms)`;
        terminateTree();
      }, timeoutMs);

      if (timer.unref) timer.unref();

      const onAbort = () => {
        killed = true;
        killReason = 'aborted';
        terminateTree();
      };
      if (opts.signal) {
        if (opts.signal.aborted) onAbort();
        else opts.signal.addEventListener('abort', onAbort, { once: true });
      }

      // ── Process exit ──────────────────────────────────────────────
      const finish = (code, processError = null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        opts.signal?.removeEventListener?.('abort', onAbort);

        const duration = Date.now() - startTime;
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
        const capturedStderr = Buffer.concat(stderrChunks).toString('utf-8');
        const stderr = processError
          ? `${capturedStderr}${capturedStderr ? '\n' : ''}Sandbox: process error — ${processError.message}`
          : capturedStderr;

        const result = this.#buildResult({
          exitCode: processError ? -1 : (code ?? -1),
          stdout,
          stderr,
          duration,
          killed: killed || Boolean(processError),
          killReason: processError ? 'process error' : killReason,
          sandboxLevel: effectiveLevel,
          peakMemoryMB: 0,
          backend: 'host',
        });

        resolvePromise(result);
      };

      child.on('close', (code) => finish(code));
      child.on('error', (err) => finish(-1, err));
    });
  }

  /**
   * Pre-check whether a command is safe to execute in the sandbox.
   *
   * @param {string} command - The raw command string.
   * @returns {import('./helpers.js').PreCheckResult} Safety assessment.
   */
  preCheck(command) {
    return preCheckCommand(command, this.#level);
  }

  /**
   * Create a sandbox profile tailored to a specific task context.
   *
   * @param {Object}   taskContext
   * @param {string}   taskContext.projectRoot  - Absolute path to the project root.
   * @param {string}   [taskContext.taskType]    - Task type identifier.
   * @param {string[]} [taskContext.allowedGlobs] - Additional allowed path globs.
   * @returns {import('./helpers.js').SandboxProfile} The generated sandbox profile.
   */
  createProfile(taskContext) {
    return createSandboxProfile(taskContext, {
      level: this.#level,
      maxTimeMs: this.#maxTimeMs,
      maxMemoryMB: this.#maxMemoryMB,
    });
  }

  /**
   * Aggregate resource usage statistics across all recorded executions.
   *
   * @returns {{ totalExecutions: number, avgDuration: number, maxMemoryUsed: number, killsByReason: Record<string, number> }}
   */
  getResourceStats() {
    return aggregateResourceStats(this.#history);
  }

  /**
   * Validate a sandbox profile for correctness.
   *
   * @param {import('./helpers.js').SandboxProfile} profile - The profile to validate.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateProfile(profile) {
    return validateSandboxProfile(profile);
  }

  /**
   * Get the maximum configured level. This reports configuration only; every
   * security-level execution still requires a fresh backend attestation.
   *
   * @returns {string} A {@link SandboxLevel} value.
   */
  getMaxSupportedLevel() {
    if (this.#backend) return SandboxLevel.FULL;
    if (this.#hostExecutionEnabled) return SandboxLevel.PROCESS;
    return SandboxLevel.NONE;
  }

  /**
   * Get a snapshot of the executor's current configuration and statistics.
   *
   * @returns {{ level: string, platform: string, maxTime: number, maxMemory: number, executions: number, profiles: number }}
   */
  getStatus() {
    return {
      level: this.#level,
      platform: this.#platform,
      maxTime: this.#maxTimeMs,
      maxMemory: this.#maxMemoryMB,
      executions: this.#history.length,
      profiles: this.#allowedPaths.length,
      backend: this.#backend?.type ?? null,
      hostExecutionEnabled: this.#hostExecutionEnabled,
      failClosed: true,
      maxSupportedLevel: this.getMaxSupportedLevel(),
    };
  }

  /**
   * Clear all recorded execution history.
   */
  clear() {
    this.#history = [];
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Build a standardised result and record it in history.
   * Delegates to the standalone {@link buildSandboxResult} helper.
   *
   * @param {Object} raw - Raw result fields.
   * @returns {import('./helpers.js').SandboxResult}
   */
  #buildResult(raw) {
    return buildSandboxResult(raw, this.#history, this.#maxHistory);
  }
}
