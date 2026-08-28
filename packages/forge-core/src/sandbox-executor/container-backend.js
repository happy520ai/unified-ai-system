/**
 * Docker-backed isolation for untrusted Forge commands.
 *
 * The backend deliberately has no host-process fallback. It uses a pinned,
 * already-present Linux image and creates a new, locked-down container for
 * every command. Callers must provide an allowlisted workspace root.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';

const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;
const DEFAULT_CONTAINER_ENV = Object.freeze({
  PATH: '/usr/local/bin:/usr/bin:/bin',
  HOME: '/scratch',
  TMPDIR: '/tmp',
  LANG: 'C.UTF-8',
  NODE_ENV: 'test',
  FORGE_SANDBOX: '1',
});

const DEFAULT_ALLOWED_ENV_KEYS = new Set([
  'CI',
  'FORGE_TASK_TYPE',
  'NODE_ENV',
  'PORT',
]);

const DEFAULT_SENSITIVE_ENTRIES = Object.freeze([
  '.env',
  '.env.local',
  '.env.production',
  '.mcp.json',
  '.netrc',
  '.npmrc',
  '.pypirc',
  '.ssh',
  '.yarnrc',
  '.yarnrc.yml',
  'credentials',
  '.git-credentials',
  'credential',
  'credentials.json',
  'secrets.json',
  'service-account.json',
]);
const MAX_WORKSPACE_SCAN_ENTRIES = 250_000;

const FORBIDDEN_ENV_KEY = /(?:^|_)(?:API_?KEY|AUTH|BEARER|CREDENTIAL|DATABASE|DB|GH|GITHUB|PASSWORD|PRIVATE|PROVIDER|SECRET|TOKEN)(?:_|$)|^(?:AWS|AZURE|GCP|GOOGLE|OPENAI|ANTHROPIC|NODE_OPTIONS|NODE_PATH|LD_PRELOAD|DYLD_.*|DOCKER_HOST|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY)$/i;

function makeError(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  return error;
}

function isWithin(target, root) {
  const targetPath = process.platform === 'win32' ? target.toLowerCase() : target;
  const rootPath = process.platform === 'win32' ? root.toLowerCase() : root;
  return targetPath === rootPath || targetPath.startsWith(rootPath + sep);
}

function buildHostToolEnvironment() {
  const env = Object.create(null);
  for (const key of [
    'PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT',
    'TEMP', 'TMP', 'LANG', 'LC_ALL',
  ]) {
    if (typeof process.env[key] === 'string' && process.env[key]) env[key] = process.env[key];
  }
  return env;
}

function appendBounded(chunks, state, chunk, limit) {
  if (state.length >= limit) {
    state.truncated = true;
    return;
  }
  const remaining = limit - state.length;
  const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
  chunks.push(slice);
  state.length += slice.length;
  if (slice.length !== chunk.length) state.truncated = true;
}

/**
 * Run a fixed executable with an argv array. This helper is used only for the
 * container engine itself; untrusted commands remain arguments to /bin/sh
 * inside the container.
 */
export function runContainerEngineProcess(executable, args, options = {}) {
  const {
    timeoutMs = 30_000,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    signal,
    env = buildHostToolEnvironment(),
  } = options;

  return new Promise((resolvePromise) => {
    let settled = false;
    let timedOut = false;
    let aborted = false;
    const stdoutChunks = [];
    const stderrChunks = [];
    const stdoutState = { length: 0, truncated: false };
    const stderrState = { length: 0, truncated: false };

    let child;
    try {
      child = spawn(executable, args, {
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolvePromise({
        exitCode: -1,
        stdout: '',
        stderr: error.message,
        timedOut: false,
        aborted: false,
        truncated: false,
      });
      return;
    }

    child.stdout.on('data', (chunk) => appendBounded(stdoutChunks, stdoutState, chunk, maxOutputBytes));
    child.stderr.on('data', (chunk) => appendBounded(stderrChunks, stderrState, chunk, maxOutputBytes));

    const stopCli = () => {
      try { child.kill('SIGKILL'); } catch { /* process already exited */ }
    };
    const onAbort = () => {
      aborted = true;
      stopCli();
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      stopCli();
    }, timeoutMs);
    timer.unref?.();

    const finish = (exitCode, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      resolvePromise({
        exitCode: exitCode ?? -1,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: error ? `${stderr}${stderr ? '\n' : ''}${error.message}` : stderr,
        timedOut,
        aborted,
        truncated: stdoutState.truncated || stderrState.truncated,
      });
    };

    child.once('close', (code) => finish(code, null));
    child.once('error', (error) => finish(-1, error));
  });
}

function sanitizeContainerEnvironment(explicit, allowedKeys) {
  const env = { ...DEFAULT_CONTAINER_ENV };
  for (const [key, rawValue] of Object.entries(explicit ?? {})) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      throw makeError('SANDBOX_ENV_REJECTED', `invalid environment key "${key}"`);
    }
    if (FORBIDDEN_ENV_KEY.test(key) || !allowedKeys.has(key)) {
      throw makeError('SANDBOX_ENV_REJECTED', `environment key "${key}" is not allowlisted`);
    }
    if (typeof rawValue !== 'string' && typeof rawValue !== 'number' && typeof rawValue !== 'boolean') {
      throw makeError('SANDBOX_ENV_REJECTED', `environment value for "${key}" must be scalar`);
    }
    const value = String(rawValue);
    if (value.includes('\0') || value.includes('\n') || value.includes('\r')) {
      throw makeError('SANDBOX_ENV_REJECTED', `environment value for "${key}" contains control characters`);
    }
    env[key] = value;
  }
  return env;
}

/**
 * Fail-closed Docker/Podman backend for Forge filesystem/full isolation.
 */
export class ContainerSandboxBackend {
  #enginePath;
  #image;
  #workspaceRoots;
  #allowedEnvKeys;
  #sensitiveEntries;
  #allowNetwork;
  #runProcess;
  #attestation = null;

  constructor(options = {}) {
    this.#enginePath = options.enginePath;
    this.#image = options.image;
    this.#workspaceRoots = (options.workspaceRoots ?? []).map((entry) => resolve(entry));
    this.#allowedEnvKeys = new Set([
      ...DEFAULT_ALLOWED_ENV_KEYS,
      ...(options.allowedEnvKeys ?? []),
    ]);
    this.#sensitiveEntries = new Set([
      ...DEFAULT_SENSITIVE_ENTRIES,
      ...(options.sensitiveEntries ?? []),
    ].map((entry) => String(entry).toLowerCase()));
    this.#allowNetwork = options.allowNetwork === true;
    this.#runProcess = options.runProcess ?? runContainerEngineProcess;

    if (!this.#enginePath || !isAbsolute(this.#enginePath)) {
      throw makeError('SANDBOX_CONFIGURATION_INVALID', 'container enginePath must be an absolute path');
    }
    if (typeof this.#image !== 'string' || !/@sha256:[a-f0-9]{64}$/i.test(this.#image)) {
      throw makeError('SANDBOX_CONFIGURATION_INVALID', 'container image must be pinned by sha256 digest');
    }
    if (this.#workspaceRoots.length === 0) {
      throw makeError('SANDBOX_CONFIGURATION_INVALID', 'at least one workspace root is required');
    }
  }

  get type() { return 'container'; }

  async #cli(args, options = {}) {
    return this.#runProcess(this.#enginePath, args, {
      timeoutMs: options.timeoutMs,
      maxOutputBytes: options.maxOutputBytes,
      signal: options.signal,
      env: buildHostToolEnvironment(),
    });
  }

  async attest() {
    if (this.#attestation) return { ...this.#attestation };

    const daemon = await this.#cli(['version', '--format', '{{.Server.Os}}'], { timeoutMs: 10_000 });
    if (daemon.exitCode !== 0 || daemon.stdout.trim() !== 'linux') {
      throw makeError('SANDBOX_BACKEND_UNAVAILABLE', `Linux container daemon unavailable: ${daemon.stderr || daemon.stdout}`);
    }

    const image = await this.#cli(
      ['image', 'inspect', '--format', '{{json .RepoDigests}}', this.#image],
      { timeoutMs: 10_000 },
    );
    if (image.exitCode !== 0) {
      throw makeError('SANDBOX_IMAGE_UNAVAILABLE', 'pinned sandbox image is not already present; automatic pull is disabled');
    }
    let repoDigests;
    try { repoDigests = JSON.parse(image.stdout.trim()); } catch { repoDigests = []; }
    if (!Array.isArray(repoDigests) || !repoDigests.includes(this.#image)) {
      throw makeError('SANDBOX_IMAGE_MISMATCH', 'local image digest does not match the configured immutable reference');
    }

    this.#attestation = Object.freeze({
      backend: 'container',
      imageDigest: this.#image.slice(this.#image.lastIndexOf('@') + 1),
      networkIsolation: true,
      readOnlyRoot: true,
      nonRootUser: true,
      noNewPrivileges: true,
      capabilitiesDropped: true,
      processTreeKill: true,
      resourceLimits: true,
      seccompProfile: 'docker-default',
    });
    return { ...this.#attestation };
  }

  async #resolveWorkspace(workspace) {
    const canonical = await realpath(workspace).catch(() => null);
    if (!canonical) throw makeError('SANDBOX_WORKSPACE_INVALID', 'workspace does not exist');
    const workspaceStat = await stat(canonical);
    if (!workspaceStat.isDirectory()) throw makeError('SANDBOX_WORKSPACE_INVALID', 'workspace must be a directory');
    if (/[\0\r\n,]/.test(canonical)) {
      throw makeError('SANDBOX_WORKSPACE_INVALID', 'workspace path contains unsupported characters');
    }

    const roots = await Promise.all(this.#workspaceRoots.map(async (root) => realpath(root).catch(() => null)));
    if (!roots.filter(Boolean).some((root) => isWithin(canonical, root))) {
      throw makeError('SANDBOX_WORKSPACE_DENIED', 'workspace is outside configured roots');
    }

    const queue = [canonical];
    let scannedEntries = 0;
    for (let directoryIndex = 0; directoryIndex < queue.length; directoryIndex += 1) {
      const directory = queue[directoryIndex];
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        scannedEntries += 1;
        if (scannedEntries > MAX_WORKSPACE_SCAN_ENTRIES) {
          throw makeError('SANDBOX_WORKSPACE_SCAN_LIMIT', `workspace exceeds ${MAX_WORKSPACE_SCAN_ENTRIES} entries`);
        }
        const normalizedName = entry.name.toLowerCase();
        if (this.#sensitiveEntries.has(normalizedName) || /^\.env(?:\.|$)/i.test(entry.name)) {
          const relativeEntry = resolve(directory, entry.name).slice(canonical.length + 1);
          throw makeError('SANDBOX_SENSITIVE_WORKSPACE', `refusing to mount workspace containing ${relativeEntry}`);
        }
        if (entry.isDirectory() && normalizedName !== '.git') {
          queue.push(resolve(directory, entry.name));
        }
      }
    }

    const gitMetadata = await lstat(resolve(canonical, '.git')).catch((error) => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    });
    return { path: canonical, hideGitDirectory: gitMetadata?.isDirectory() === true };
  }

  async run(options) {
    const startTime = Date.now();
    const command = options.command;
    if (typeof command !== 'string' || !command.trim()) {
      throw makeError('SANDBOX_COMMAND_INVALID', 'command must be a non-empty string');
    }
    if (command.includes('\0')) throw makeError('SANDBOX_COMMAND_INVALID', 'command contains a null byte');

    await this.attest();
    const workspaceInfo = await this.#resolveWorkspace(options.workspace);
    const workspace = workspaceInfo.path;
    const networkAccess = options.networkAccess === true;
    if (networkAccess && !this.#allowNetwork) {
      throw makeError('SANDBOX_NETWORK_DENIED', 'network access was not enabled by backend policy');
    }

    const workspaceMode = options.workspaceMode === 'rw' ? 'rw' : 'ro';
    const memoryMB = Math.max(64, Math.min(Number(options.maxMemoryMB) || 512, 4096));
    const pidsLimit = Math.max(16, Math.min(Number(options.pidsLimit) || 64, 256));
    const cpus = Math.max(0.1, Math.min(Number(options.cpus) || 1, 4));
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || 30_000);
    const maxOutputBytes = Math.max(1024, Number(options.maxOutputBytes) || DEFAULT_MAX_OUTPUT_BYTES);
    const env = sanitizeContainerEnvironment(options.env, this.#allowedEnvKeys);
    const name = `forge-sandbox-${randomUUID()}`;
    const mount = `type=bind,src=${workspace},dst=/workspace${workspaceMode === 'ro' ? ',readonly' : ''}`;

    const createArgs = [
      'create', '--pull', 'never', '--name', name,
      '--label', 'forge.sandbox.managed=true',
      '--label', `forge.sandbox.lease=${name}`,
      '--network', networkAccess ? 'bridge' : 'none',
      '--read-only', '--user', '65532:65532',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '--pids-limit', String(pidsLimit),
      '--memory', `${memoryMB}m`, '--memory-swap', `${memoryMB}m`,
      '--cpus', String(cpus),
      '--ulimit', 'nofile=256:256', '--ulimit', `nproc=${pidsLimit}:${pidsLimit}`,
      '--ipc', 'none', '--init', '--workdir', '/workspace',
      '--mount', mount,
      '--tmpfs', '/scratch:rw,nosuid,nodev,noexec,size=64m,uid=65532,gid=65532,mode=0700',
      '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=32m,mode=1777',
    ];
    if (workspaceInfo.hideGitDirectory) {
      createArgs.push('--tmpfs', '/workspace/.git:rw,nosuid,nodev,noexec,size=1m,uid=65532,gid=65532,mode=0700');
    }
    for (const [key, value] of Object.entries(env)) createArgs.push('--env', `${key}=${value}`);
    createArgs.push(this.#image, '/bin/sh', '-c', command);

    let created = false;
    let cleanupUncertain = false;
    let startResult = null;
    let state = null;
    try {
      const createResult = await this.#cli(createArgs, { timeoutMs: 30_000, maxOutputBytes });
      if (createResult.exitCode !== 0 || !/^[a-f0-9]{12,64}$/i.test(createResult.stdout.trim())) {
        throw makeError('SANDBOX_CREATE_FAILED', (createResult.stderr || createResult.stdout || 'container create failed').trim());
      }
      created = true;

      startResult = await this.#cli(['start', '--attach', name], {
        timeoutMs,
        maxOutputBytes,
        signal: options.signal,
      });
      if (startResult.timedOut || startResult.aborted) {
        await this.#cli(['kill', name], { timeoutMs: 10_000, maxOutputBytes: 64_000 });
      }

      const inspectResult = await this.#cli(
        ['inspect', '--format', '{{json .State}}', name],
        { timeoutMs: 10_000, maxOutputBytes: 64_000 },
      );
      if (inspectResult.exitCode === 0) {
        try { state = JSON.parse(inspectResult.stdout.trim()); } catch { state = null; }
      }
    } finally {
      if (created) {
        const removeResult = await this.#cli(['rm', '--force', name], {
          timeoutMs: 10_000,
          maxOutputBytes: 64_000,
        });
        cleanupUncertain = removeResult.exitCode !== 0;
      }
    }

    const timedOut = startResult?.timedOut === true;
    const aborted = startResult?.aborted === true;
    const oomKilled = state?.OOMKilled === true;
    const killed = timedOut || aborted || oomKilled || cleanupUncertain;
    const killReason = timedOut ? `timeout (${timeoutMs}ms)`
      : aborted ? 'aborted'
        : oomKilled ? 'memory limit exceeded'
          : cleanupUncertain ? 'container cleanup uncertain'
            : null;

    const observedExitCode = Number.isInteger(state?.ExitCode) ? state.ExitCode : (startResult?.exitCode ?? -1);
    return {
      exitCode: killed && observedExitCode === 0 ? -1 : observedExitCode,
      stdout: startResult?.stdout ?? '',
      stderr: startResult?.stderr ?? '',
      duration: Date.now() - startTime,
      killed,
      killReason,
      peakMemoryMB: 0,
      oomKilled,
      cleanupUncertain,
      backend: 'container',
      isolation: await this.attest(),
    };
  }
}
