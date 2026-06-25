/**
 * SelfHealingEngine helpers -- constants, enums, type definitions, and pure utility functions.
 * @module self-healing/helpers
 */

// -- Constants ──────────────────────────────────────────────────────────────

/** Default interval between periodic health checks (ms). */
export const DEFAULT_CHECK_INTERVAL = 10000;

/** Default maximum consecutive auto-heals before pausing. */
export const DEFAULT_MAX_AUTO_HEALS = 5;

/** Default cooldown period (ms) before re-healing the same module. */
export const DEFAULT_COOLDOWN_MS = 60000;

/** Default number of healing history entries to retain. */
export const DEFAULT_HISTORY_SIZE = 200;

// -- Enumerations ───────────────────────────────────────────────────────────

/**
 * Healing actions that can be executed when a module degrades.
 * @readonly
 * @enum {string}
 */
export const HealingAction = Object.freeze({
  RESTART: 'restart',
  CLEAR_STATE: 'clear_state',
  FALLBACK: 'fallback',
  ALERT: 'alert',
  QUARANTINE: 'quarantine',
});

/**
 * Health severity levels for modules and the overall system.
 * @readonly
 * @enum {string}
 */
export const HealthLevel = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
});

// -- Type definitions ───────────────────────────────────────────────────────

/**
 * @typedef {object} ModuleHealth
 * @property {'healthy'|'degraded'|'critical'} status -- current health status
 * @property {object}  [details]  -- arbitrary module-specific details
 */

/**
 * @typedef {object} RecoveryStrategy
 * @property {'degraded'|'critical'} condition -- health condition that triggers this strategy
 * @property {string}  action   -- HealingAction value to execute
 * @property {() => void|Promise<void>} handler -- recovery function to invoke
 * @property {number}  priority -- lower number = higher priority (first match wins)
 */

/**
 * @typedef {object} HistoryEntry
 * @property {number}  timestamp -- epoch ms when the healing occurred
 * @property {string}  module    -- name of the module that was healed
 * @property {string}  action    -- HealingAction that was executed
 * @property {boolean} success   -- whether the handler completed without error
 * @property {string}  message   -- human-readable description of the result
 * @property {number}  duration  -- time (ms) the handler took to execute
 */

/**
 * @typedef {object} CheckResult
 * @property {'healthy'|'degraded'|'critical'} overall -- worst health across all modules
 * @property {Array<{ name: string, health: string, action?: string }>} modules -- per-module results
 * @property {number} healed -- number of modules successfully healed during this check
 * @property {number} alerts -- number of alert-only actions triggered
 */

// -- Pure utility functions ─────────────────────────────────────────────────

/**
 * Normalize a status value to one of the accepted health levels.
 * @param {*} status -- raw status value
 * @returns {'healthy'|'degraded'|'critical'}
 */
export function normalizeStatus(status) {
  if (status === HealthLevel.HEALTHY || status === HealthLevel.DEGRADED || status === HealthLevel.CRITICAL) {
    return status;
  }
  return HealthLevel.HEALTHY;
}

/**
 * Append an entry to the healing history ring buffer, trimming oldest entries
 * when the buffer exceeds its configured size.
 * @param {HistoryEntry[]} history -- mutable history array
 * @param {HistoryEntry} entry -- new entry to append
 * @param {number} maxSize -- max entries to retain
 */
export function recordHistory(history, entry, maxSize) {
  history.push(entry);
  if (history.length > maxSize) {
    history.splice(0, history.length - maxSize);
  }
}

/**
 * Compute aggregate statistics grouped by a specified field from history entries.
 * @param {HistoryEntry[]} history -- healing history entries
 * @param {'module'|'action'} groupBy -- field to group by
 * @returns {Record<string, { heals: number, successes: number }>}
 */
export function computeStatsByGroup(history, groupBy) {
  /** @type {Record<string, { heals: number, successes: number }>} */
  const groups = {};
  for (const entry of history) {
    if (!entry.action || entry.action === HealingAction.ALERT) continue;
    const key = entry[groupBy];
    if (!groups[key]) groups[key] = { heals: 0, successes: 0 };
    groups[key].heals++;
    if (entry.success) groups[key].successes++;
  }
  return groups;
}

/**
 * Filter and sort healing history entries.
 * @param {HistoryEntry[]} history -- full history array
 * @param {{ module?: string, action?: string, limit?: number }} opts -- filter options
 * @returns {HistoryEntry[]} sorted descending by timestamp
 */
export function filterAndSortHistory(history, opts = {}) {
  let filtered = [...history];
  if (opts.module) filtered = filtered.filter((h) => h.module === opts.module);
  if (opts.action) filtered = filtered.filter((h) => h.action === opts.action);
  filtered.sort((a, b) => b.timestamp - a.timestamp);
  const limit = opts.limit ?? 50;
  if (limit > 0) filtered = filtered.slice(0, limit);
  return filtered;
}

/**
 * Determine the worst health level across a set of modules.
 * @param {IterableIterator<string>} moduleNames -- names to iterate
 * @param {Map<string, ModuleHealth>} moduleHealth -- cached health per module
 * @returns {'healthy'|'degraded'|'critical'}
 */
export function computeOverallHealth(moduleNames, moduleHealth) {
  let overall = HealthLevel.HEALTHY;
  for (const name of moduleNames) {
    const cached = moduleHealth.get(name);
    const health = cached ? cached.status : HealthLevel.HEALTHY;
    if (health === HealthLevel.CRITICAL) return HealthLevel.CRITICAL;
    if (health === HealthLevel.DEGRADED && overall !== HealthLevel.CRITICAL) {
      overall = HealthLevel.DEGRADED;
    }
  }
  return overall;
}
