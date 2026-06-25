/**
 * GracefulDegradation -- manages module priority tiers and automatically
 * disables non-essential modules when system resources are constrained.
 *
 * Provides a cascade-based degradation strategy where lower-priority modules
 * are disabled first as system pressure increases, and re-enabled when
 * pressure subsides. Hysteresis is applied to prevent flapping at threshold
 * boundaries.
 *
 * Priority tiers:
 *   - CRITICAL (0) -- never disable (core worker, agent pool)
 *   - HIGH     (1) -- disable only in extreme conditions
 *   - MEDIUM   (2) -- disable under moderate pressure
 *   - LOW      (3) -- first to disable (live stream, metrics, tracing)
 *   - OPTIONAL (4) -- always safe to disable
 *
 * Pressure levels:
 *   - NORMAL   -- resources within acceptable bounds
 *   - MODERATE -- >70% resource usage, disable OPTIONAL modules
 *   - HIGH     -- >85% resource usage, disable OPTIONAL + LOW modules
 *   - CRITICAL -- >95% resource usage, disable OPTIONAL + LOW + MEDIUM modules
 *
 * Usage:
 *   import { GracefulDegradation, ModulePriority, SystemPressure } from './graceful-degradation/index.js';
 *
 *   const gd = new GracefulDegradation({ moderateThreshold: 0.7 });
 *   gd.registerModule('tracing', ModulePriority.LOW, {
 *     disable: () => tracing.stop(),
 *     enable:  () => tracing.start(),
 *     isEnabled: () => tracing.isRunning(),
 *   });
 *
 *   const result = gd.evaluate({ memoryUsage: 0.82, cpuUsage: 0.75, queueDepth: 10, activeWorkers: 4, maxWorkers: 8 });
 *   console.log(result.pressure); // 'moderate'
 *   console.log(result.disabled); // ['tracing']
 *
 * @module graceful-degradation
 */

import {
  DEFAULT_MODERATE_THRESHOLD,
  DEFAULT_HIGH_THRESHOLD,
  DEFAULT_CRITICAL_THRESHOLD,
  DEFAULT_CHECK_INTERVAL,
  DEFAULT_HISTORY_SIZE,
  HYSTERESIS_OFFSET,
  ModulePriority,
  SystemPressure,
  computePressureScore,
  classifyPressure,
  getDisabledPriorities,
  validateHandlers,
  createModuleEntry,
  filterHistory,
  snapshotModuleState,
  invokeModuleHandler,
  recordHistoryEntry,
  applyDegradation,
} from './helpers.js';

// Re-export enums so consumers can still import them from index.js
export { ModulePriority, SystemPressure };

// -- Type definitions ───────────────────────────────────────────────────────

/**
 * @typedef {object} ModuleHandlers
 * @property {() => void|Promise<void>} disable -- handler to disable the module
 * @property {() => void|Promise<void>} enable  -- handler to enable the module
 * @property {() => boolean} isEnabled -- returns whether the module is currently enabled
 */

/**
 * @typedef {object} SystemMetrics
 * @property {number} memoryUsage   -- memory usage fraction (0-1)
 * @property {number} cpuUsage      -- CPU usage fraction (0-1)
 * @property {number} queueDepth    -- number of pending tasks in the queue
 * @property {number} activeWorkers -- number of currently active workers
 * @property {number} maxWorkers    -- maximum number of workers
 */

/**
 * @typedef {object} DegradationResult
 * @property {string}   pressure -- current SystemPressure level
 * @property {string[]} disabled -- module names disabled during this evaluation
 * @property {string[]} enabled  -- module names re-enabled during this evaluation
 * @property {number}   changes  -- total number of state changes (disables + enables)
 */

/**
 * @typedef {object} HistoryEntry
 * @property {number}   timestamp -- epoch ms when the event occurred
 * @property {string}   pressure  -- SystemPressure level at the time
 * @property {'degrade'|'restore'} action -- type of event
 * @property {string[]} modules   -- module names affected by the event
 */

// -- GracefulDegradation class ──────────────────────────────────────────────

/**
 * Manages module priority tiers and automatically disables non-essential
 * modules when system resources are constrained. Uses hysteresis on
 * threshold boundaries to prevent flapping between degradation states.
 */
export class GracefulDegradation {
  /** @type {Map<string, { priority: number, handlers: ModuleHandlers, enabled: boolean, lastChanged: number }>} */
  #modules = new Map();

  /** @type {number} threshold for entering MODERATE pressure */
  #moderateThreshold;

  /** @type {number} threshold for entering HIGH pressure */
  #highThreshold;

  /** @type {number} threshold for entering CRITICAL pressure */
  #criticalThreshold;

  /** @type {number} suggested evaluation interval (ms) */
  #checkInterval;

  /** @type {number} max entries in the history ring buffer */
  #historySize;

  /** @type {string} current pressure level */
  #currentPressure;

  /** @type {HistoryEntry[]} ring buffer of degradation history */
  #history = [];

  /**
   * @param {object} [opts]
   * @param {number} [opts.moderateThreshold=0.7]  -- resource fraction for MODERATE pressure
   * @param {number} [opts.highThreshold=0.85]     -- resource fraction for HIGH pressure
   * @param {number} [opts.criticalThreshold=0.95] -- resource fraction for CRITICAL pressure
   * @param {number} [opts.checkInterval=5000]     -- suggested evaluation interval (ms)
   * @param {number} [opts.historySize=100]        -- max history entries to retain
   */
  constructor(opts = {}) {
    this.#moderateThreshold = opts.moderateThreshold ?? DEFAULT_MODERATE_THRESHOLD;
    this.#highThreshold = opts.highThreshold ?? DEFAULT_HIGH_THRESHOLD;
    this.#criticalThreshold = opts.criticalThreshold ?? DEFAULT_CRITICAL_THRESHOLD;
    this.#checkInterval = Math.max(1000, Math.floor(opts.checkInterval ?? DEFAULT_CHECK_INTERVAL));
    this.#historySize = Math.max(1, Math.floor(opts.historySize ?? DEFAULT_HISTORY_SIZE));
    this.#currentPressure = SystemPressure.NORMAL;
  }

  // ── 1. Register Module ───────────────────────────────────────────────────

  /**
   * Register a module with its priority tier and disable/enable handlers.
   *
   * CRITICAL modules are registered but will never be automatically disabled.
   * All handlers are required for proper degradation management.
   *
   * @param {string} name -- unique module identifier
   * @param {number} priority -- ModulePriority value (0-4)
   * @param {ModuleHandlers} handlers -- disable/enable/isEnabled callbacks
   */
  registerModule(name, priority, handlers) {
    validateHandlers(name, handlers);
    this.#modules.set(name, createModuleEntry(priority, handlers));
  }

  // ── 2. Unregister Module ─────────────────────────────────────────────────

  /**
   * Remove a module from degradation management.
   *
   * @param {string} name -- module identifier
   * @returns {boolean} true if the module existed and was removed
   */
  unregisterModule(name) {
    return this.#modules.delete(name);
  }

  // ── 3. Evaluate ──────────────────────────────────────────────────────────

  /**
   * Evaluate current system pressure and apply degradation or restoration
   * as needed. This is the primary entry point for the degradation engine.
   *
   * Pressure is computed as: max(memoryUsage, cpuUsage, queueDepth / maxWorkers)
   *
   * Degradation cascade:
   *   CRITICAL (>0.95): disable OPTIONAL + LOW + MEDIUM modules
   *   HIGH     (>0.85): disable OPTIONAL + LOW modules
   *   MODERATE (>0.70): disable OPTIONAL modules
   *   NORMAL:          re-enable all previously disabled modules
   *
   * Hysteresis is applied: leaving a degraded state requires the score to
   * drop below (threshold - 0.1) to prevent rapid flapping.
   *
   * @param {SystemMetrics} metrics -- current system resource metrics
   * @returns {DegradationResult}
   */
  evaluate(metrics) {
    const pressureScore = computePressureScore(metrics);
    const thresholds = { moderate: this.#moderateThreshold, high: this.#highThreshold, critical: this.#criticalThreshold };
    const newPressure = classifyPressure(pressureScore, this.#currentPressure, thresholds);

    const previousPressure = this.#currentPressure;
    this.#currentPressure = newPressure;

    const disabledPriorities = getDisabledPriorities(newPressure);
    const previousDisabledPriorities = getDisabledPriorities(previousPressure);

    const { disabled, enabled } = applyDegradation(
      this.#modules,
      disabledPriorities,
      (name, entry) => {
        invokeModuleHandler(entry, 'disable');
      },
      (name, entry) => {
        invokeModuleHandler(entry, 'enable');
      },
    );

    const changes = disabled.length + enabled.length;

    if (disabled.length > 0) {
      recordHistoryEntry(this.#history, this.#historySize, {
        timestamp: Date.now(),
        pressure: newPressure,
        action: 'degrade',
        modules: [...disabled],
      });
    }

    if (enabled.length > 0) {
      recordHistoryEntry(this.#history, this.#historySize, {
        timestamp: Date.now(),
        pressure: newPressure,
        action: 'restore',
        modules: [...enabled],
      });
    }

    return { pressure: newPressure, disabled, enabled, changes };
  }

  // ── 4. Force Degradation ─────────────────────────────────────────────────

  /**
   * Force a specific degradation level regardless of current system metrics.
   * Useful for operator-initiated degradation during maintenance or incidents.
   *
   * @param {string} level -- SystemPressure value to force
   * @returns {{ previous: string, current: string, disabled: string[] }}
   */
  forceDegradation(level) {
    const validLevels = [SystemPressure.NORMAL, SystemPressure.MODERATE, SystemPressure.HIGH, SystemPressure.CRITICAL];
    if (!validLevels.includes(level)) {
      throw new Error(`Invalid degradation level '${level}'. Must be one of: ${validLevels.join(', ')}`);
    }

    const previous = this.#currentPressure;
    this.#currentPressure = level;

    const disabledPriorities = getDisabledPriorities(level);
    const disabled = [];

    for (const [name, entry] of this.#modules) {
      if (entry.priority === ModulePriority.CRITICAL) continue;
      const shouldBeDisabled = disabledPriorities.has(entry.priority);
      if (shouldBeDisabled && entry.enabled) {
        invokeModuleHandler(entry, 'disable');
        disabled.push(name);
      }
    }

    if (disabled.length > 0) {
      recordHistoryEntry(this.#history, this.#historySize, {
        timestamp: Date.now(),
        pressure: level,
        action: 'degrade',
        modules: [...disabled],
      });
    }

    return { previous, current: level, disabled };
  }

  // ── 5. Restore All ───────────────────────────────────────────────────────

  /**
   * Restore all disabled modules to enabled state, resetting pressure to NORMAL.
   *
   * @returns {{ restored: string[] }}
   */
  restoreAll() {
    this.#currentPressure = SystemPressure.NORMAL;
    const restored = [];

    for (const [name, entry] of this.#modules) {
      if (!entry.enabled) {
        invokeModuleHandler(entry, 'enable');
        restored.push(name);
      }
    }

    if (restored.length > 0) {
      recordHistoryEntry(this.#history, this.#historySize, {
        timestamp: Date.now(),
        pressure: SystemPressure.NORMAL,
        action: 'restore',
        modules: [...restored],
      });
    }

    return { restored };
  }

  // ── 6. Get Degradation State ─────────────────────────────────────────────

  /**
   * Get the current degradation state of all managed modules.
   *
   * @returns {{ pressure: string, modules: Array<{ name: string, priority: number, enabled: boolean, lastChanged: number }>, disabledCount: number, totalModules: number }}
   */
  getDegradationState() {
    const { modules, disabledCount } = snapshotModuleState(this.#modules);
    return {
      pressure: this.#currentPressure,
      modules,
      disabledCount,
      totalModules: this.#modules.size,
    };
  }

  // ── 7. Get History ───────────────────────────────────────────────────────

  /**
   * Get degradation history with optional filtering.
   *
   * @param {object} [opts]
   * @param {string} [opts.action]  -- filter by action type ('degrade'|'restore')
   * @param {string} [opts.pressure] -- filter by pressure level
   * @param {number} [opts.limit]   -- max entries to return
   * @returns {HistoryEntry[]} history entries sorted by timestamp descending
   */
  getHistory(opts = {}) {
    return filterHistory(this.#history, opts);
  }

  // ── 8. Get Status ────────────────────────────────────────────────────────

  /**
   * Get a lightweight status summary of the degradation engine.
   *
   * @returns {{ pressure: string, degradedModules: number, totalModules: number, thresholds: { moderate: number, high: number, critical: number } }}
   */
  getStatus() {
    let degradedCount = 0;
    for (const [, entry] of this.#modules) {
      if (!entry.enabled) degradedCount++;
    }
    return {
      pressure: this.#currentPressure,
      degradedModules: degradedCount,
      totalModules: this.#modules.size,
      thresholds: {
        moderate: this.#moderateThreshold,
        high: this.#highThreshold,
        critical: this.#criticalThreshold,
      },
    };
  }

  // ── 9. Clear ─────────────────────────────────────────────────────────────

  /**
   * Clear all degradation history. Module registrations and current
   * enabled/disabled states are preserved.
   */
  clear() {
    this.#history.length = 0;
  }

  // ── 10. Convenience API (used by agent-pool) ───────────────────────────

  /**
   * Evaluate system pressure and return just the pressure level string.
   * Normalizes metric field names from agent-pool (maxConcurrent → maxWorkers).
   *
   * @param {object} metrics
   * @returns {string} SystemPressure value
   */
  evaluatePressure(metrics = {}) {
    const normalized = {
      ...metrics,
      maxWorkers: metrics.maxWorkers ?? metrics.maxConcurrent ?? 1,
    };
    const result = this.evaluate(normalized);
    return result.pressure;
  }

  /**
   * Check whether a specific module is currently enabled.
   *
   * @param {string} name -- module identifier
   * @returns {boolean}
   */
  isModuleEnabled(name) {
    const entry = this.#modules.get(name);
    return entry ? entry.enabled : false;
  }

  /**
   * Disable a specific module by name.
   *
   * @param {string} name -- module identifier
   * @param {string} [reason] -- optional reason for logging
   * @returns {boolean} true if the module was disabled
   */
  disableModule(name, reason) {
    const entry = this.#modules.get(name);
    if (!entry || !entry.enabled) return false;
    invokeModuleHandler(entry, 'disable');
    recordHistoryEntry(this.#history, this.#historySize, {
      timestamp: Date.now(),
      pressure: this.#currentPressure,
      action: 'degrade',
      modules: [name],
    });
    return true;
  }

  /**
   * Re-enable a specific module by name.
   *
   * @param {string} name -- module identifier
   * @returns {boolean} true if the module was re-enabled
   */
  reenableModule(name) {
    const entry = this.#modules.get(name);
    if (!entry || entry.enabled) return false;
    invokeModuleHandler(entry, 'enable');
    recordHistoryEntry(this.#history, this.#historySize, {
      timestamp: Date.now(),
      pressure: this.#currentPressure,
      action: 'restore',
      modules: [name],
    });
    return true;
  }
}
