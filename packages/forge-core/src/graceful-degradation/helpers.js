/**
 * Pure helpers for the graceful-degradation module.
 *
 * Extracted from index.js to keep the class file under 500 lines.
 * All functions are stateless -- they receive what they need via parameters.
 *
 * @module graceful-degradation/helpers
 */

// -- Constants ──────────────────────────────────────────────────────────────

/** Default resource usage threshold for MODERATE pressure (70%). */
export const DEFAULT_MODERATE_THRESHOLD = 0.7;

/** Default resource usage threshold for HIGH pressure (85%). */
export const DEFAULT_HIGH_THRESHOLD = 0.85;

/** Default resource usage threshold for CRITICAL pressure (95%). */
export const DEFAULT_CRITICAL_THRESHOLD = 0.95;

/** Default interval for periodic evaluation (ms). */
export const DEFAULT_CHECK_INTERVAL = 5000;

/** Default number of degradation history entries to retain. */
export const DEFAULT_HISTORY_SIZE = 100;

/** Hysteresis offset applied when recovering from a pressure level. */
export const HYSTERESIS_OFFSET = 0.1;

// -- Enumerations ───────────────────────────────────────────────────────────

/**
 * Module priority tiers. Lower numeric value = higher priority.
 * CRITICAL modules are never disabled.
 * @readonly
 * @enum {number}
 */
export const ModulePriority = Object.freeze({
  /** Never disable (core worker, agent pool). */
  CRITICAL: 0,
  /** Disable only in extreme conditions (verification, self-loop). */
  HIGH: 1,
  /** Disable under moderate pressure (knowledge graph, semantic memory). */
  MEDIUM: 2,
  /** First to disable (live stream, metrics, tracing). */
  LOW: 3,
  /** Always safe to disable (health dashboard, decision trace logging). */
  OPTIONAL: 4,
});

/**
 * System pressure levels derived from resource metrics.
 * @readonly
 * @enum {string}
 */
export const SystemPressure = Object.freeze({
  /** Resources within acceptable bounds. */
  NORMAL: 'normal',
  /** >70% resource usage -- disable OPTIONAL modules. */
  MODERATE: 'moderate',
  /** >85% resource usage -- disable OPTIONAL + LOW modules. */
  HIGH: 'high',
  /** >95% resource usage -- disable OPTIONAL + LOW + MEDIUM modules. */
  CRITICAL: 'critical',
});

// -- Type definitions ───────────────────────────────────────────────────────

/**
 * @typedef {object} HistoryEntry
 * @property {number}   timestamp -- epoch ms when the event occurred
 * @property {string}   pressure  -- SystemPressure level at the time
 * @property {'degrade'|'restore'} action -- type of event
 * @property {string[]} modules   -- module names affected by the event
 */

// -- Pure computation helpers ───────────────────────────────────────────────

/**
 * Compute a single pressure score from system metrics.
 * Formula: max(memoryUsage, cpuUsage, queueDepth / maxWorkers)
 *
 * @param {object} metrics
 * @param {number} [metrics.memoryUsage]
 * @param {number} [metrics.cpuUsage]
 * @param {number} [metrics.queueDepth]
 * @param {number} [metrics.maxWorkers]
 * @returns {number} pressure score in range [0, 1+]
 */
export function computePressureScore(metrics) {
  const memory = metrics?.memoryUsage ?? 0;
  const cpu = metrics?.cpuUsage ?? 0;
  const maxWorkers = metrics?.maxWorkers ?? 1;
  const queueRatio = maxWorkers > 0 ? (metrics?.queueDepth ?? 0) / maxWorkers : 0;
  return Math.max(memory, cpu, queueRatio);
}

/**
 * Classify a pressure score into a SystemPressure level.
 * Applies hysteresis when the current pressure is above NORMAL --
 * recovery requires the score to drop below (threshold - HYSTERESIS_OFFSET).
 *
 * @param {number} score -- computed pressure score (0-1+)
 * @param {string} currentPressure -- current SystemPressure level
 * @param {{ moderate: number, high: number, critical: number }} thresholds
 * @returns {string} SystemPressure value
 */
export function classifyPressure(score, currentPressure, thresholds) {
  const { moderate, high, critical } = thresholds;
  const offset = HYSTERESIS_OFFSET;

  const criticalEnter = critical;
  const highEnter = high;
  const moderateEnter = moderate;
  const moderateLeave = moderate - offset;
  const highLeave = high - offset;

  if (currentPressure === SystemPressure.CRITICAL) {
    if (score >= criticalEnter) return SystemPressure.CRITICAL;
    if (score >= highLeave) return SystemPressure.HIGH;
    if (score >= moderateLeave) return SystemPressure.MODERATE;
    return SystemPressure.NORMAL;
  }

  if (currentPressure === SystemPressure.HIGH) {
    if (score >= criticalEnter) return SystemPressure.CRITICAL;
    if (score >= highLeave) return SystemPressure.HIGH;
    if (score >= moderateLeave) return SystemPressure.MODERATE;
    return SystemPressure.NORMAL;
  }

  if (currentPressure === SystemPressure.MODERATE) {
    if (score >= criticalEnter) return SystemPressure.CRITICAL;
    if (score >= highEnter) return SystemPressure.HIGH;
    if (score >= moderateLeave) return SystemPressure.MODERATE;
    return SystemPressure.NORMAL;
  }

  // Currently NORMAL -- use enter thresholds (no hysteresis for entering)
  if (score >= criticalEnter) return SystemPressure.CRITICAL;
  if (score >= highEnter) return SystemPressure.HIGH;
  if (score >= moderateEnter) return SystemPressure.MODERATE;
  return SystemPressure.NORMAL;
}

/**
 * Get the set of module priorities that should be disabled at a given
 * pressure level. CRITICAL priority is never included.
 *
 * @param {string} pressure -- SystemPressure value
 * @returns {Set<number>} set of ModulePriority values to disable
 */
export function getDisabledPriorities(pressure) {
  switch (pressure) {
    case SystemPressure.CRITICAL:
      return new Set([ModulePriority.OPTIONAL, ModulePriority.LOW, ModulePriority.MEDIUM]);
    case SystemPressure.HIGH:
      return new Set([ModulePriority.OPTIONAL, ModulePriority.LOW]);
    case SystemPressure.MODERATE:
      return new Set([ModulePriority.OPTIONAL]);
    case SystemPressure.NORMAL:
    default:
      return new Set();
  }
}

// -- Validation / factory helpers ───────────────────────────────────────────

/**
 * Validate that all required handler functions are present.
 * Throws TypeError if any handler is missing.
 *
 * @param {string} name -- module name (for error messages)
 * @param {object} handlers -- { disable, enable, isEnabled }
 */
export function validateHandlers(name, handlers) {
  if (typeof handlers?.disable !== 'function') {
    throw new TypeError(`disable handler for module '${name}' must be a function`);
  }
  if (typeof handlers?.enable !== 'function') {
    throw new TypeError(`enable handler for module '${name}' must be a function`);
  }
  if (typeof handlers?.isEnabled !== 'function') {
    throw new TypeError(`isEnabled handler for module '${name}' must be a function`);
  }
}

/**
 * Create a normalized module entry object.
 *
 * @param {number} priority -- ModulePriority value
 * @param {object} handlers -- { disable, enable, isEnabled }
 * @returns {{ priority: number, handlers: object, enabled: boolean, lastChanged: number }}
 */
export function createModuleEntry(priority, handlers) {
  return {
    priority: typeof priority === 'number' ? priority : ModulePriority.OPTIONAL,
    handlers,
    enabled: true,
    lastChanged: 0,
  };
}

// -- History / state helpers ────────────────────────────────────────────────

/**
 * Filter and sort degradation history with optional constraints.
 *
 * @param {HistoryEntry[]} history -- full history array
 * @param {object} [opts]
 * @param {string} [opts.action]   -- filter by 'degrade' | 'restore'
 * @param {string} [opts.pressure] -- filter by pressure level
 * @param {number} [opts.limit]    -- max entries to return (default 50)
 * @returns {HistoryEntry[]} filtered entries sorted by timestamp descending
 */
export function filterHistory(history, opts = {}) {
  let result = [...history];
  if (opts.action) result = result.filter((h) => h.action === opts.action);
  if (opts.pressure) result = result.filter((h) => h.pressure === opts.pressure);
  result.sort((a, b) => b.timestamp - a.timestamp);
  const limit = opts.limit ?? 50;
  if (limit > 0) result = result.slice(0, limit);
  return result;
}

/**
 * Build a snapshot array of all module states.
 *
 * @param {Map} modules -- module Map from the class
 * @returns {{ modules: Array<{ name: string, priority: number, enabled: boolean, lastChanged: number }>, disabledCount: number }}
 */
export function snapshotModuleState(modules) {
  const modulesList = [];
  let disabledCount = 0;
  for (const [name, entry] of modules) {
    modulesList.push({ name, priority: entry.priority, enabled: entry.enabled, lastChanged: entry.lastChanged });
    if (!entry.enabled) disabledCount++;
  }
  return { modules: modulesList, disabledCount };
}

/**
 * Invoke a module handler (disable or enable) with error swallowing.
 * Updates entry.enabled and entry.lastChanged.
 *
 * @param {object} entry -- internal module entry
 * @param {'disable'|'enable'} handlerName -- which handler to invoke
 */
export function invokeModuleHandler(entry, handlerName) {
  try {
    entry.handlers[handlerName]();
  } catch {
    // Swallow handler errors -- best-effort degradation/restoration
  }
  entry.enabled = handlerName === 'enable';
  entry.lastChanged = Date.now();
}

/**
 * Append an entry to the degradation history ring buffer, trimming oldest
 * entries when the buffer exceeds its configured size.
 *
 * @param {HistoryEntry[]} history -- mutable history array
 * @param {number} historySize -- max entries to retain
 * @param {HistoryEntry} entry -- new entry to append
 */
export function recordHistoryEntry(history, historySize, entry) {
  history.push(entry);
  if (history.length > historySize) {
    history.splice(0, history.length - historySize);
  }
}

// -- Degradation application ────────────────────────────────────────────────

/**
 * Apply degradation/restoration to modules based on disabled priority set.
 * Returns lists of disabled and enabled module names.
 *
 * @param {Map} modules -- module Map from the class
 * @param {Set<number>} disabledPriorities -- priorities that should be off
 * @param {function} disableFn -- (name, entry) => void
 * @param {function} enableFn  -- (name, entry) => void
 * @returns {{ disabled: string[], enabled: string[] }}
 */
export function applyDegradation(modules, disabledPriorities, disableFn, enableFn) {
  const disabled = [];
  const enabled = [];

  for (const [name, entry] of modules) {
    if (entry.priority === ModulePriority.CRITICAL) continue;
    const shouldBeDisabled = disabledPriorities.has(entry.priority);
    if (shouldBeDisabled && entry.enabled) {
      disableFn(name, entry);
      disabled.push(name);
    }
  }

  for (const [name, entry] of modules) {
    if (entry.priority === ModulePriority.CRITICAL) continue;
    const shouldBeDisabled = disabledPriorities.has(entry.priority);
    if (!shouldBeDisabled && !entry.enabled) {
      enableFn(name, entry);
      enabled.push(name);
    }
  }

  return { disabled, enabled };
}
