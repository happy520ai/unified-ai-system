/**
 * @module sandbox-executor/helpers
 * @description Pure functions, constants, and type definitions extracted from
 *              the sandbox-executor module for reuse and testability.
 */

import { resolve, sep } from 'node:path';

// ---------------------------------------------------------------------------
// SandboxLevel enum
// ---------------------------------------------------------------------------

/**
 * Immutable set of sandbox restriction levels.
 *
 * Levels are cumulative: FILESYSTEM includes all PROCESS restrictions, and
 * FULL includes all FILESYSTEM restrictions.
 *
 * @readonly
 * @enum {string}
 */
export const SandboxLevel = Object.freeze({
  /** No restrictions — pass-through execution. */
  NONE: 'none',
  /** Process-level limits: time, memory, output truncation. */
  PROCESS: 'process',
  /** + filesystem path validation (cwd within allowed paths). */
  FILESYSTEM: 'filesystem',
  /** + network isolation hints (best-effort, platform-dependent). */
  FULL: 'full',
  /**
   * Git Worktree isolation — execute in a dedicated git worktree.
   * Each task gets its own working directory, preventing concurrent
   * file conflicts. The command runs inside the worktree path.
   * Requires git-worktree.js to be available.
   */
  WORKTREE: 'worktree',
});

// ---------------------------------------------------------------------------
// Dangerous command patterns (extends BashSafety concepts)
// ---------------------------------------------------------------------------

/**
 * Patterns considered too dangerous to execute even inside a sandbox.
 * Each entry is a RegExp tested against the normalised (lowercased) command.
 *
 * @type {Array<{ pattern: RegExp, reason: string }>}
 */
export const DANGEROUS_PATTERNS = [
  // ── Destructive filesystem ──────────────────────────────────────────────
  { pattern: /\brm\s+(-[a-z]*\s+)*-?[a-z]*r[a-z]*f[a-z]*\s+(-[a-z]*\s+)*(\/|~|\.\.)/, reason: 'Recursive forced deletion of root/home/parent' },
  { pattern: /\bmkfs\b/, reason: 'Filesystem format' },
  { pattern: /\bdd\s+if=/, reason: 'Raw disk write' },
  { pattern: /\bformat\s+[a-z]:/i, reason: 'Windows disk format' },
  { pattern: /\bdiskpart\b/, reason: 'Windows disk partitioning' },
  { pattern: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:/, reason: 'Fork bomb' },
  { pattern: />\s*\/dev\/[sh]d[a-z]/, reason: 'Direct disk device write' },

  // ── Network exfiltration via shell ──────────────────────────────────────
  { pattern: /\bcurl\b.*\|\s*(ba)?sh/, reason: 'Pipe remote script to shell' },
  { pattern: /\bwget\b.*\|\s*(ba)?sh/, reason: 'Pipe remote script to shell' },
  { pattern: /\bnc\s+-[a-z]*l/, reason: 'Netcat listener (reverse shell risk)' },

  // ── System modification ─────────────────────────────────────────────────
  { pattern: /\bchmod\s+(-[a-z]+\s+)*777\b/, reason: 'World-writable permissions' },
  { pattern: /\bshutdown\b/, reason: 'System shutdown' },
  { pattern: /\breboot\b/, reason: 'System reboot' },
  { pattern: /\binit\s+[06]\b/, reason: 'System halt/reboot via init' },

  // ── Windows-specific ───────────────────────────────────────────────────
  { pattern: /\breg\s+delete\b/i, reason: 'Windows registry deletion' },
  { pattern: /\brd\s+\/[a-z]*s[a-z]*/i, reason: 'Recursive directory removal (Windows)' },
  { pattern: /\bdel\s+\/[a-z]*[fs][a-z]*/i, reason: 'Forced/silent file deletion (Windows)' },
];

// ---------------------------------------------------------------------------
// Platform capability helpers
// ---------------------------------------------------------------------------

/**
 * Maximum sandbox level supported by each platform.
 *
 * @type {Record<string, string>}
 */
const PLATFORM_MAX_LEVEL = {
  darwin: SandboxLevel.FULL,       // macOS: sandbox-exec with seatbelt profiles
  linux: SandboxLevel.FULL,        // Linux: namespaces, cgroups, seccomp
  win32: SandboxLevel.FILESYSTEM,  // Windows: restricted token (best-effort)
};

/**
 * Determines the maximum sandbox level for a given platform.
 *
 * @param {string} platform - Value from `process.platform`.
 * @returns {string} The highest supported {@link SandboxLevel}.
 */
export function getMaxLevelForPlatform(platform) {
  return PLATFORM_MAX_LEVEL[platform] ?? SandboxLevel.PROCESS;
}

// ---------------------------------------------------------------------------
// Path validation helpers
// ---------------------------------------------------------------------------

/**
 * Normalise an array of glob/paths to resolved absolute path prefixes.
 * Strips trailing glob patterns (`**`, `*`) to obtain the static prefix.
 *
 * @param {string[]} paths - Raw path or glob entries.
 * @param {string}   base  - Base directory for relative path resolution.
 * @returns {string[]} Resolved absolute path prefixes.
 */
export function resolveAllowedPrefixes(paths, base) {
  return paths.map((p) => {
    // Strip glob suffixes to get the static prefix
    const staticPart = p.replace(/[/\\]\*.*$/, '').replace(/[/\\]$/, '');
    const resolved = resolve(base, staticPart || '.');
    return resolved;
  });
}

/**
 * Check whether a target path is within at least one of the allowed prefixes.
 *
 * @param {string}   targetPath - The path to validate.
 * @param {string[]} allowed    - Allowed path prefixes (already resolved).
 * @returns {boolean} `true` if the path is within an allowed prefix.
 */
export function isPathAllowed(targetPath, allowed) {
  const resolved = resolve(targetPath);
  return allowed.some(
    (prefix) => resolved === prefix || resolved.startsWith(prefix + sep),
  );
}

/**
 * Check whether a target path is inside any denied prefix.
 *
 * @param {string}   targetPath - The path to validate.
 * @param {string[]} denied     - Denied path prefixes (already resolved).
 * @returns {boolean} `true` if the path falls within a denied prefix.
 */
export function isPathDenied(targetPath, denied) {
  const resolved = resolve(targetPath);
  return denied.some(
    (prefix) => resolved === prefix || resolved.startsWith(prefix + sep),
  );
}

// ---------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------

/**
 * Result returned by {@link SandboxExecutor#execute}.
 *
 * @typedef {Object} SandboxResult
 * @property {number}      exitCode       - Process exit code (or -1 if killed).
 * @property {string}      stdout         - Captured standard output (possibly truncated).
 * @property {string}      stderr         - Captured standard error (possibly truncated).
 * @property {number}      duration       - Wall-clock execution time in ms.
 * @property {boolean}     killed         - Whether the process was forcefully terminated.
 * @property {string|null} killReason     - Reason for kill, if applicable.
 * @property {string}      sandboxLevel   - The effective sandbox level used.
 * @property {Object}      resourceUsage  - Resource consumption metrics.
 * @property {number}      resourceUsage.peakMemoryMB - Peak RSS memory in MB.
 * @property {number}      resourceUsage.cpuTimeMs    - Approximate CPU time in ms.
 */

/**
 * A sandbox profile describing the restrictions for a specific task.
 *
 * @typedef {Object} SandboxProfile
 * @property {string}   level          - The {@link SandboxLevel}.
 * @property {string[]} allowedPaths   - Allowed filesystem path prefixes.
 * @property {string[]} deniedPaths    - Denied filesystem path prefixes.
 * @property {number}   maxTimeMs      - Maximum execution time in ms.
 * @property {number}   maxMemoryMB    - Maximum memory usage in MB.
 * @property {Object}   env            - Extra environment variables for the child.
 * @property {boolean}  networkAccess  - Whether network access is permitted.
 */

/**
 * Pre-check result from {@link SandboxExecutor#preCheck}.
 *
 * @typedef {Object} PreCheckResult
 * @property {boolean}     safe   - Whether the command is considered safe.
 * @property {string|null} reason - Explanation when `safe` is `false`.
 * @property {string}      level  - The sandbox level that would be applied.
 */

// ---------------------------------------------------------------------------
// Extracted class-method logic (pure / standalone functions)
// ---------------------------------------------------------------------------

/**
 * Resolve the effective sandbox level, capped to platform capabilities.
 *
 * @param {string} [override] - Optional per-call level override.
 * @param {string} defaultLevel - Constructor-level default level.
 * @param {string} platform     - Detected platform identifier.
 * @returns {string} The effective {@link SandboxLevel}.
 */
export function resolveEffectiveLevel(override, defaultLevel, platform) {
  const requested = override ?? defaultLevel;
  const maxLevel = getMaxLevelForPlatform(platform);
  const levels = [SandboxLevel.NONE, SandboxLevel.PROCESS, SandboxLevel.FILESYSTEM, SandboxLevel.FULL];
  const requestedIdx = levels.indexOf(requested);
  const maxIdx = levels.indexOf(maxLevel);

  if (requestedIdx < 0) return SandboxLevel.PROCESS;
  return levels[Math.min(requestedIdx, maxIdx)];
}

/**
 * Pre-check whether a command string is safe to execute.
 *
 * @param {string} command - The raw command string.
 * @param {string} level   - Current sandbox level (for the result metadata).
 * @returns {PreCheckResult} Safety assessment.
 */
export function preCheckCommand(command, level) {
  if (!command || typeof command !== 'string') {
    return { safe: false, reason: 'Empty or invalid command.', level };
  }

  const normalised = command.trim().toLowerCase();

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(normalised)) {
      return { safe: false, reason: `Dangerous pattern: ${reason}.`, level };
    }
  }

  return { safe: true, reason: null, level };
}

/**
 * Build a standardised {@link SandboxResult} and record it in the history
 * ring buffer.
 *
 * @param {Object}   raw        - Raw result fields.
 * @param {Array}    history    - Mutable history ring buffer.
 * @param {number}   maxHistory - Maximum history entries before trimming.
 * @returns {SandboxResult}
 */
export function buildSandboxResult(raw, history, maxHistory) {
  const result = {
    exitCode: raw.exitCode,
    stdout: raw.stdout,
    stderr: raw.stderr,
    duration: raw.duration,
    killed: raw.killed,
    killReason: raw.killReason ?? null,
    sandboxLevel: raw.sandboxLevel,
    resourceUsage: {
      peakMemoryMB: raw.peakMemoryMB,
      cpuTimeMs: raw.duration, // Approximate: wall-clock ~= CPU for short-lived processes
    },
  };

  // Record in ring buffer
  history.push({
    duration: result.duration,
    killed: result.killed,
    killReason: result.killReason,
    peakMemoryMB: result.resourceUsage.peakMemoryMB,
  });

  if (history.length > maxHistory) {
    history.splice(0, history.length - maxHistory);
  }

  return result;
}

/**
 * Create a {@link SandboxProfile} tailored to a specific task context.
 *
 * @param {Object}   taskContext
 * @param {string}   taskContext.projectRoot  - Absolute path to the project root.
 * @param {string}   [taskContext.taskType]    - Task type identifier.
 * @param {string[]} [taskContext.allowedGlobs] - Additional allowed path globs.
 * @param {Object}   defaults
 * @param {string}   defaults.level       - Default sandbox level.
 * @param {number}   defaults.maxTimeMs   - Default time limit.
 * @param {number}   defaults.maxMemoryMB - Default memory limit.
 * @returns {SandboxProfile} The generated sandbox profile.
 */
export function createSandboxProfile(taskContext, defaults) {
  const { projectRoot, taskType = 'default', allowedGlobs = [] } = taskContext;
  const root = resolve(projectRoot);

  const allowedPaths = [
    root,
    ...resolveAllowedPrefixes(allowedGlobs, root),
  ];

  const deniedPaths = [
    resolve(root, '.env'),
    resolve(root, '.env.local'),
    resolve(root, 'credentials'),
    resolve(root, '.ssh'),
  ];

  const taskLimits = {
    test:  { maxTimeMs: 60_000,  maxMemoryMB: 1024 },
    build: { maxTimeMs: 120_000, maxMemoryMB: 2048 },
    lint:  { maxTimeMs: 30_000,  maxMemoryMB: 512  },
    default: { maxTimeMs: defaults.maxTimeMs, maxMemoryMB: defaults.maxMemoryMB },
  };
  const limits = taskLimits[taskType] ?? taskLimits.default;

  return {
    level: defaults.level,
    allowedPaths,
    deniedPaths,
    maxTimeMs: limits.maxTimeMs,
    maxMemoryMB: limits.maxMemoryMB,
    env: {
      NODE_ENV: 'test',
      FORGE_SANDBOX: '1',
      FORGE_TASK_TYPE: taskType,
    },
    networkAccess: taskType === 'build',
  };
}

/**
 * Aggregate resource usage statistics across recorded execution entries.
 *
 * @param {Array<{ duration: number, killed: boolean, killReason: string|null, peakMemoryMB: number }>} history
 * @returns {{ totalExecutions: number, avgDuration: number, maxMemoryUsed: number, killsByReason: Record<string, number> }}
 */
export function aggregateResourceStats(history) {
  if (history.length === 0) {
    return { totalExecutions: 0, avgDuration: 0, maxMemoryUsed: 0, killsByReason: {} };
  }

  let totalDuration = 0;
  let maxMemory = 0;
  const killsByReason = {};

  for (const entry of history) {
    totalDuration += entry.duration;
    if (entry.peakMemoryMB > maxMemory) maxMemory = entry.peakMemoryMB;
    if (entry.killed) {
      const reason = entry.killReason ?? 'unknown';
      killsByReason[reason] = (killsByReason[reason] ?? 0) + 1;
    }
  }

  return {
    totalExecutions: history.length,
    avgDuration: Math.round(totalDuration / history.length),
    maxMemoryUsed: maxMemory,
    killsByReason,
  };
}

/**
 * Validate a {@link SandboxProfile} for correctness.
 *
 * @param {SandboxProfile} profile - The profile to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSandboxProfile(profile) {
  const errors = [];
  const validLevels = Object.values(SandboxLevel);

  if (!profile || typeof profile !== 'object') {
    return { valid: false, errors: ['Profile must be a non-null object.'] };
  }

  if (!validLevels.includes(profile.level)) {
    errors.push(`Invalid sandbox level "${profile.level}". Must be one of: ${validLevels.join(', ')}.`);
  }

  if (typeof profile.maxTimeMs !== 'number' || profile.maxTimeMs <= 0) {
    errors.push('maxTimeMs must be a positive number.');
  }

  if (typeof profile.maxMemoryMB !== 'number' || profile.maxMemoryMB <= 0) {
    errors.push('maxMemoryMB must be a positive number.');
  }

  if (!Array.isArray(profile.allowedPaths) || profile.allowedPaths.length === 0) {
    errors.push('allowedPaths must be a non-empty array.');
  }

  if (!Array.isArray(profile.deniedPaths)) {
    errors.push('deniedPaths must be an array.');
  }

  if (Array.isArray(profile.allowedPaths) && Array.isArray(profile.deniedPaths)) {
    for (const denied of profile.deniedPaths) {
      const deniedResolved = resolve(denied);
      for (const allowed of profile.allowedPaths) {
        const allowedResolved = resolve(allowed);
        if (deniedResolved === allowedResolved || deniedResolved.startsWith(allowedResolved + sep)) {
          errors.push(`Denied path "${denied}" is within or equal to allowed path "${allowed}".`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
