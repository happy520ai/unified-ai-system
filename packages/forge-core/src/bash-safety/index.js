/**
 * @module bash-safety
 * @description Bash command safety validation for the Forge code generation engine.
 *
 * Sits between raw LLM output and `execSync` calls, blocking destructive,
 * exfiltrative, or otherwise dangerous shell commands via a configurable
 * whitelist/blacklist system.
 *
 * - In **non-strict** mode (default) only blacklisted commands are blocked;
 *   unknown commands are allowed.
 * - In **strict** mode only whitelisted commands are allowed; unknown commands
 *   receive a `NEEDS_REVIEW` verdict.
 *
 * @example
 * import { BashSafety, SafetyVerdict, isCommandSafe } from './bash-safety/index.js';
 *
 * const safety = new BashSafety({ strict: false });
 * const result = safety.check('rm -rf /');
 * // result.verdict === SafetyVerdict.BLOCKED
 *
 * const quick = isCommandSafe('npm test');
 * // quick.verdict === SafetyVerdict.ALLOWED
 */

// ---------------------------------------------------------------------------
// SafetyVerdict enum
// ---------------------------------------------------------------------------

/**
 * Immutable set of possible verdicts returned by {@link BashSafety#check}.
 *
 * @readonly
 * @enum {string}
 */
export const SafetyVerdict = Object.freeze({
  /** The command is considered safe and may be executed. */
  ALLOWED: 'ALLOWED',
  /** The command matched a blacklist pattern and must not be executed. */
  BLOCKED: 'BLOCKED',
  /** Strict mode is active and the command did not match any whitelist pattern. */
  NEEDS_REVIEW: 'NEEDS_REVIEW',
});

// ---------------------------------------------------------------------------
// Default pattern sets
// ---------------------------------------------------------------------------

/**
 * Default blacklist patterns — commands that are always blocked.
 *
 * Each entry is either a plain string (prefix match against the normalised
 * command) or a `RegExp` (`.test()` match). All string comparisons are
 * case-insensitive by virtue of the normalisation step in {@link normalize}.
 *
 * @type {Array<string|RegExp>}
 */
const DEFAULT_BLACKLIST = [
  // ── Destructive filesystem ──────────────────────────────────────────────
  'rm -rf /',
  'rm -rf ~',
  'rm -rf ..',
  'mkfs',
  'dd if=',
  'format',
  'diskpart',

  // ── Network exfiltration ────────────────────────────────────────────────
  // Piped-to-shell variants require a regex because of the wildcard pipe.
  /curl.*\|.*sh/,
  /wget.*\|.*sh/,
  'nc -',
  'ncat',
  'nc -l',

  // ── Sensitive file access ───────────────────────────────────────────────
  'cat /etc/shadow',
  'cat /etc/passwd',
  'cat ~/.ssh',
  'cat ~/.env',

  // ── System modification ─────────────────────────────────────────────────
  'chmod -r 777', // lowercased form of `chmod -R 777`
  'chown',
  'mount',
  'umount',
  'iptables',
  'systemctl',
  'service ',

  // ── Credential exposure ─────────────────────────────────────────────────
  'env |',
  'printenv',
  'set |',
  'export |',

  // ── Process manipulation ────────────────────────────────────────────────
  'kill -9',
  'pkill',
  'killall',

  // ── Registry / system (Windows) ─────────────────────────────────────────
  'reg delete',
  'regedit',
  'net user',
  'netsh',

  // ── Git destructive ─────────────────────────────────────────────────────
  'git push --force',
  'git push -f',
  'git reset --hard',
  'git clean -fd',

  // ── PowerShell dangerous ────────────────────────────────────────────────
  'remove-item -recurse',
  'format-volume',
  'clear-disk',
];

/**
 * Default whitelist patterns — commands that are always considered safe.
 *
 * @type {Array<string|RegExp>}
 */
const DEFAULT_WHITELIST = [
  // ── Node.js / JS tooling ────────────────────────────────────────────────
  'npm test',
  'npm run',
  'npx ',
  'node ',
  'jest',
  'vitest',
  'mocha',

  // ── Filesystem (read-only / safe) ──────────────────────────────────────
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'find',
  'grep',
  'echo',

  // ── Git (safe) ──────────────────────────────────────────────────────────
  'git status',
  'git log',
  'git diff',
  'git branch',
  'git add',
  'git commit',

  // ── File manipulation ───────────────────────────────────────────────────
  'mkdir',
  'cp',
  'mv',
  'touch',
  'pwd',
  'which',
  'type',

  // ── Python ──────────────────────────────────────────────────────────────
  'python ',
  'pip install',
  'pip list',

  // ── Build / lint ────────────────────────────────────────────────────────
  'tsc',
  'eslint',
  'prettier',
  'babel',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a raw command string for comparison: trims surrounding whitespace
 * and converts to lowercase.
 *
 * @param {string} command - Raw command string.
 * @returns {string} Normalised command string.
 */
function normalize(command) {
  return String(command).trim().toLowerCase();
}

/**
 * Tests whether a normalised command matches a single pattern entry.
 *
 * - `RegExp` patterns: evaluated with `.test()` (supports complex matching such
 *   as `curl.*|.*sh`).
 * - `string` patterns: the normalised command must **start with** the
 *   lowercased pattern value (prefix match).
 *
 * @param {string}        normalisedCmd - An already-normalised command.
 * @param {string|RegExp} pattern       - A blacklist or whitelist entry.
 * @returns {boolean} `true` when the command matches the pattern.
 */
function matchesPattern(normalisedCmd, pattern) {
  if (pattern instanceof RegExp) {
    return pattern.test(normalisedCmd);
  }
  return normalisedCmd.startsWith(String(pattern).toLowerCase());
}

/**
 * Removes the first occurrence of `target` from `arr`.
 *
 * - String entries are compared with strict equality.
 * - `RegExp` entries are compared by `source` and `flags`.
 *
 * @param {Array<string|RegExp>} arr    - The array to mutate.
 * @param {string|RegExp}        target - The pattern to remove.
 * @returns {boolean} `true` if an entry was removed, `false` if not found.
 */
function removeFromArray(arr, target) {
  const idx = arr.findIndex((entry) => {
    if (target instanceof RegExp && entry instanceof RegExp) {
      return entry.source === target.source && entry.flags === target.flags;
    }
    return entry === target;
  });

  if (idx !== -1) {
    arr.splice(idx, 1);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// CheckResult typedef
// ---------------------------------------------------------------------------

/**
 * Object returned by {@link BashSafety#check} describing the outcome of a
 * command evaluation.
 *
 * @typedef {Object} CheckResult
 * @property {import('./index.js').SafetyVerdict} verdict
 *   The safety verdict for the command.
 * @property {string} reason
 *   Human-readable explanation of why this verdict was chosen.
 * @property {string|RegExp|null} matchedPattern
 *   The specific pattern that triggered the decision, or `null` when the
 *   verdict was reached by default (no pattern match).
 * @property {boolean} isBlacklisted
 *   `true` when the command matched at least one blacklist pattern.
 * @property {boolean} isWhitelisted
 *   `true` when the command matched at least one whitelist pattern.
 */

// ---------------------------------------------------------------------------
// BashSafety class
// ---------------------------------------------------------------------------

/**
 * Validates shell/bash commands against configurable whitelist and blacklist
 * pattern sets.
 *
 * Designed to be instantiated once per Forge pipeline run and reused across
 * multiple `execSync` call sites.
 *
 * Resolution order inside {@link BashSafety#check}:
 * 1. Blacklist match  → `BLOCKED`
 * 2. Whitelist match  → `ALLOWED`
 * 3. Strict mode, no match → `NEEDS_REVIEW`
 * 4. Non-strict mode, no match → `ALLOWED` (permissive default)
 *
 * @example
 * const safety = new BashSafety({ strict: false });
 *
 * const result = safety.check('rm -rf /');
 * // { verdict: 'BLOCKED', reason: '...', isBlacklisted: true, ... }
 *
 * const safe = safety.check('npm test');
 * // { verdict: 'ALLOWED', ... }
 */
export class BashSafety {
  /** @type {boolean} */
  #strict;

  /** @type {Array<string|RegExp>} */
  #blacklist;

  /** @type {Array<string|RegExp>} */
  #whitelist;

  /**
   * Creates a new `BashSafety` validator.
   *
   * @param {Object}                   [options]
   * @param {boolean}                  [options.strict=false]
   *   When `true`, only commands that match a whitelist pattern are allowed.
   *   Unknown commands receive `NEEDS_REVIEW` instead of `ALLOWED`.
   * @param {Array<string|RegExp>}     [options.customBlacklist=[]]
   *   Additional patterns appended to the default blacklist.
   * @param {Array<string|RegExp>}     [options.customWhitelist=[]]
   *   Additional patterns appended to the default whitelist.
   */
  constructor({ strict = false, customBlacklist = [], customWhitelist = [] } = {}) {
    this.#strict = Boolean(strict);
    this.#blacklist = [...DEFAULT_BLACKLIST, ...customBlacklist];
    this.#whitelist = [...DEFAULT_WHITELIST, ...customWhitelist];
  }

  /**
   * Evaluate a single command against the blacklist and whitelist.
   *
   * The command is normalised (trimmed + lowercased) before any comparison.
   * Blacklist patterns are evaluated first, so a command that appears on both
   * lists is always blocked.
   *
   * @param {string} command - The raw shell command to evaluate.
   * @returns {CheckResult} Detailed verdict object.
   */
  check(command) {
    const normalised = normalize(command);

    // 1. Blacklist — always takes priority.
    for (const pattern of this.#blacklist) {
      if (matchesPattern(normalised, pattern)) {
        return {
          verdict: SafetyVerdict.BLOCKED,
          reason: `Command blocked: matches blacklist pattern "${pattern}".`,
          matchedPattern: pattern,
          isBlacklisted: true,
          isWhitelisted: false,
        };
      }
    }

    // 2. Whitelist — explicit safe patterns.
    for (const pattern of this.#whitelist) {
      if (matchesPattern(normalised, pattern)) {
        return {
          verdict: SafetyVerdict.ALLOWED,
          reason: `Command allowed: matches whitelist pattern "${pattern}".`,
          matchedPattern: pattern,
          isBlacklisted: false,
          isWhitelisted: true,
        };
      }
    }

    // 3. No match — behaviour depends on strict mode.
    if (this.#strict) {
      return {
        verdict: SafetyVerdict.NEEDS_REVIEW,
        reason:
          'Command does not match any whitelist pattern and strict mode is enabled.',
        matchedPattern: null,
        isBlacklisted: false,
        isWhitelisted: false,
      };
    }

    // 4. Non-strict, no match — permissive default.
    return {
      verdict: SafetyVerdict.ALLOWED,
      reason: 'Command does not match any blacklist pattern.',
      matchedPattern: null,
      isBlacklisted: false,
      isWhitelisted: false,
    };
  }

  /**
   * Append a pattern to the runtime blacklist.
   *
   * @param {string|RegExp} pattern - Pattern to add.
   * @returns {void}
   */
  addBlacklist(pattern) {
    this.#blacklist.push(pattern);
  }

  /**
   * Append a pattern to the runtime whitelist.
   *
   * @param {string|RegExp} pattern - Pattern to add.
   * @returns {void}
   */
  addWhitelist(pattern) {
    this.#whitelist.push(pattern);
  }

  /**
   * Remove the first occurrence of a pattern from the blacklist.
   *
   * String entries are matched by value; `RegExp` entries by `source` + `flags`.
   *
   * @param {string|RegExp} pattern - Pattern to remove.
   * @returns {boolean} `true` if a matching entry was found and removed.
   */
  removeBlacklist(pattern) {
    return removeFromArray(this.#blacklist, pattern);
  }

  /**
   * Remove the first occurrence of a pattern from the whitelist.
   *
   * @param {string|RegExp} pattern - Pattern to remove.
   * @returns {boolean} `true` if a matching entry was found and removed.
   */
  removeWhitelist(pattern) {
    return removeFromArray(this.#whitelist, pattern);
  }

  /**
   * Returns a shallow copy of the current blacklist.
   *
   * Mutating the returned array does **not** affect the validator; use
   * {@link BashSafety#addBlacklist} / {@link BashSafety#removeBlacklist}
   * instead.
   *
   * @returns {Array<string|RegExp>}
   */
  getBlacklist() {
    return [...this.#blacklist];
  }

  /**
   * Returns a shallow copy of the current whitelist.
   *
   * @returns {Array<string|RegExp>}
   */
  getWhitelist() {
    return [...this.#whitelist];
  }

  /**
   * Returns a summary snapshot of the validator's current configuration.
   *
   * @returns {{ strict: boolean, blacklistCount: number, whitelistCount: number }}
   */
  getStatus() {
    return {
      strict: this.#strict,
      blacklistCount: this.#blacklist.length,
      whitelistCount: this.#whitelist.length,
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience function
// ---------------------------------------------------------------------------

/**
 * One-shot convenience: instantiates a {@link BashSafety} validator with the
 * given options and evaluates a single command.
 *
 * Prefer creating a persistent `BashSafety` instance when evaluating many
 * commands to avoid redundant array copies.
 *
 * @param {string} command  - The raw shell command to evaluate.
 * @param {Object} [opts]   - Options forwarded to the {@link BashSafety} constructor.
 * @returns {CheckResult} Detailed verdict object.
 *
 * @example
 * import { isCommandSafe, SafetyVerdict } from './bash-safety/index.js';
 *
 * const { verdict } = isCommandSafe('git push --force');
 * // verdict === SafetyVerdict.BLOCKED
 *
 * const { verdict: ok } = isCommandSafe('npm test', { strict: true });
 * // ok === SafetyVerdict.ALLOWED
 */
export function isCommandSafe(command, opts) {
  const safety = new BashSafety(opts);
  return safety.check(command);
}
