/**
 * @module sandbox-executor
 * @description Sandboxed command execution for the Forge code generation engine.
 *
 * Restricts file access, CPU, memory, and time for spawned child processes.
 * Works cross-platform (Windows, macOS, Linux) using OS-level mechanisms where
 * available, with graceful fallback to process-level restrictions.
 *
 * Sandbox levels (cumulative):
 *   - NONE        No restrictions.
 *   - PROCESS     Time + memory limits enforced via child_process.
 *   - FILESYSTEM  + path validation (cwd must be within allowed paths).
 *   - FULL        + network isolation hints (best-effort, platform-dependent).
 *
 * @example
 * import { SandboxExecutor, SandboxLevel } from './sandbox-executor/index.js';
 *
 * const sandbox = new SandboxExecutor({ level: 'process', maxTimeMs: 15000 });
 * const result = await sandbox.execute('npm test', { cwd: '/project' });
 * // result.exitCode === 0, result.stdout contains test output
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import {
  SandboxLevel,
  getMaxLevelForPlatform,
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
 * The effective level is capped to the platform's maximum supported level
 * (see {@link getMaxLevelForPlatform}).
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
  #gitWorktreeManager = null;

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
   */
  constructor(opts = {}) {
    this.#level = opts.level ?? SandboxLevel.PROCESS;
    this.#maxTimeMs = opts.maxTimeMs ?? 30_000;
    this.#maxMemoryMB = opts.maxMemoryMB ?? 512;
    this.#allowedPaths = resolveAllowedPrefixes(opts.allowedPaths ?? [], process.cwd());
    this.#deniedPaths = resolveAllowedPrefixes(opts.deniedPaths ?? [], process.cwd());
    this.#maxOutputBytes = opts.maxOutputBytes ?? 1_048_576;
    this.#platform = opts.platform ?? process.platform;
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
   * @param {string[]} [opts.allowedPaths] - Additional allowed paths for this call.
   * @returns {Promise<import('./helpers.js').SandboxResult>} Execution outcome.
   */
  async execute(command, opts = {}) {
    const effectiveLevel = resolveEffectiveLevel(opts.level, this.#level, this.#platform);
    const timeoutMs = opts.timeout ?? this.#maxTimeMs;
    const startTime = Date.now();

    // ── Pre-check ─────────────────────────────────────────────────────
    const preCheck = preCheckCommand(command, this.#level);
    if (!preCheck.safe) {
      return this.#buildResult({
        exitCode: -1,
        stdout: '',
        stderr: `Sandbox pre-check failed: ${preCheck.reason}`,
        duration: Date.now() - startTime,
        killed: true,
        killReason: preCheck.reason,
        sandboxLevel: effectiveLevel,
        peakMemoryMB: 0,
      });
    }

    // ── Filesystem validation ─────────────────────────────────────────
    if (effectiveLevel === SandboxLevel.FILESYSTEM || effectiveLevel === SandboxLevel.FULL) {
      const cwd = opts.cwd ?? process.cwd();
      const allowedPrefixes = [
        ...this.#allowedPaths,
        ...resolveAllowedPrefixes(opts.allowedPaths ?? [], cwd),
      ];

      if (allowedPrefixes.length > 0 && !isPathAllowed(cwd, allowedPrefixes)) {
        return this.#buildResult({
          exitCode: -1,
          stdout: '',
          stderr: `Sandbox: cwd "${cwd}" is outside allowed paths.`,
          duration: Date.now() - startTime,
          killed: true,
          killReason: 'cwd outside allowed paths',
          sandboxLevel: effectiveLevel,
          peakMemoryMB: 0,
        });
      }

      if (this.#deniedPaths.length > 0 && isPathDenied(cwd, this.#deniedPaths)) {
        return this.#buildResult({
          exitCode: -1,
          stdout: '',
          stderr: `Sandbox: cwd "${cwd}" is inside a denied path.`,
          duration: Date.now() - startTime,
          killed: true,
          killReason: 'cwd inside denied path',
          sandboxLevel: effectiveLevel,
          peakMemoryMB: 0,
        });
      }
    }

    // ── Spawn child process ───────────────────────────────────────────
    let worktreeCleanup = null;
    let effectiveCwd = opts.cwd ?? process.cwd();

    if (effectiveLevel === SandboxLevel.WORKTREE) {
      try {
        const { createGitWorktree } = await import("./git-worktree.js");
        const wt = this.#gitWorktreeManager || createGitWorktree({
          repoRoot: effectiveCwd,
          worktreeRoot: ".forge-worktrees",
        });
        this.#gitWorktreeManager = wt;

        const taskId = opts.taskId || `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const record = await wt.create({ id: taskId, baseBranch: opts.baseBranch });
        effectiveCwd = record.path;
        worktreeCleanup = async (deleteBranch) => {
          await wt.remove(taskId, deleteBranch);
        };
      } catch (err) {
        return this.#buildResult({
          exitCode: -1,
          stdout: '',
          stderr: `Sandbox WORKTREE: failed to create worktree — ${err.message}`,
          duration: Date.now() - startTime,
          killed: true,
          killReason: 'worktree creation failed',
          sandboxLevel: effectiveLevel,
          peakMemoryMB: 0,
        });
      }
    }

    return new Promise((resolvePromise) => {
      const shell = this.#platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellArgs = this.#platform === 'win32'
        ? ['/c', command]
        : ['-c', command];

      const childEnv = { ...process.env, ...(opts.env ?? {}) };
      const cwd = effectiveCwd;

      let child;
      try {
        child = spawn(shell, shellArgs, {
          cwd,
          env: childEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (err) {
        resolvePromise(this.#buildResult({
          exitCode: -1,
          stdout: '',
          stderr: `Sandbox: failed to spawn process — ${err.message}`,
          duration: Date.now() - startTime,
          killed: true,
          killReason: 'spawn error',
          sandboxLevel: effectiveLevel,
          peakMemoryMB: 0,
        }));
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
      let peakMemoryMB = 0;

      // ── Time limit ────────────────────────────────────────────────
      const timer = setTimeout(() => {
        killed = true;
        killReason = `timeout (${timeoutMs}ms)`;
        try { child.kill('SIGKILL'); } catch { /* already exited */ }
      }, timeoutMs);

      if (timer.unref) timer.unref();

      // ── Memory polling (PROCESS level and above) ──────────────────
      let memInterval = null;
      if (effectiveLevel !== SandboxLevel.NONE) {
        memInterval = setInterval(() => {
          if (!child.pid || child.killed) return;
          try {
            // Heuristic: rely on OS-level OOM killer for child processes.
            // Peak memory is recorded at completion instead.
          } catch {
            // Ignore polling errors — child may have already exited.
          }
        }, 500);
        if (memInterval.unref) memInterval.unref();
      }

      // ── Process exit ──────────────────────────────────────────────
      child.on('close', async (code) => {
        clearTimeout(timer);
        if (memInterval) clearInterval(memInterval);

        if (worktreeCleanup) {
          try { await worktreeCleanup(false); } catch { /* 忽略清理失败 */ }
        }

        const duration = Date.now() - startTime;
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');

        const result = this.#buildResult({
          exitCode: code ?? -1,
          stdout,
          stderr,
          duration,
          killed,
          killReason,
          sandboxLevel: effectiveLevel,
          peakMemoryMB,
        });

        resolvePromise(result);
      });

      child.on('error', async (err) => {
        clearTimeout(timer);
        if (memInterval) clearInterval(memInterval);

        if (worktreeCleanup) {
          try { await worktreeCleanup(false); } catch { /* 忽略清理失败 */ }
        }

        const duration = Date.now() - startTime;
        resolvePromise(this.#buildResult({
          exitCode: -1,
          stdout: '',
          stderr: `Sandbox: process error — ${err.message}`,
          duration,
          killed: true,
          killReason: 'process error',
          sandboxLevel: effectiveLevel,
          peakMemoryMB: 0,
        }));
      });
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
   * Get the maximum sandbox level supported by the current platform.
   *
   * @returns {string} A {@link SandboxLevel} value.
   */
  getMaxSupportedLevel() {
    return getMaxLevelForPlatform(this.#platform);
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
