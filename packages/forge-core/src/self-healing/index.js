/**
 * SelfHealingEngine -- monitors module health and automatically executes recovery strategies.
 * Works with HealthDashboard for closed-loop self-healing: detect -> diagnose -> recover -> verify.
 * @module self-healing
 */

import {
  DEFAULT_CHECK_INTERVAL,
  DEFAULT_MAX_AUTO_HEALS,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_HISTORY_SIZE,
  HealingAction as _HealingAction,
  HealthLevel as _HealthLevel,
  normalizeStatus as _normalizeStatus,
  recordHistory as _recordHistory,
  computeStatsByGroup as _computeStatsByGroup,
  filterAndSortHistory as _filterAndSortHistory,
  computeOverallHealth as _computeOverallHealth,
} from './helpers.js';

// Re-export public API
export const HealingAction = _HealingAction;
export const HealthLevel = _HealthLevel;

/**
 * Monitors module health and automatically executes recovery strategies when modules degrade or crash.
 * Maintains a healing history ring buffer and enforces cooldown/max-heal safeguards.
 */
export class SelfHealingEngine {
  /** @type {Map<string, { healthFn: () => object, strategies: import('./helpers.js').RecoveryStrategy[] }>} */
  #modules = new Map();
  /** @type {Map<string, import('./helpers.js').ModuleHealth>} last known health per module */
  #moduleHealth = new Map();
  /** @type {Map<string, number>} epoch ms of last heal per module (for cooldown) */
  #lastHealTime = new Map();
  /** @type {Map<string, number>} consecutive heal count per module */
  #consecutiveHeals = new Map();
  /** @type {import('./helpers.js').HistoryEntry[]} ring buffer of healing history */
  #history = [];
  /** @type {number} interval between periodic health checks (ms) */
  #checkInterval;
  /** @type {number} max consecutive auto-heals before pausing */
  #maxAutoHeals;
  /** @type {number} cooldown period (ms) before re-healing the same module */
  #cooldownMs;
  /** @type {boolean} whether automatic healing is enabled */
  #enableAutoHeal;
  /** @type {number} max entries in the history ring buffer */
  #historySize;
  /** @type {ReturnType<typeof setInterval>|null} periodic check timer handle */
  #timer = null;
  /** @type {number} total number of health checks performed */
  #totalChecks = 0;
  /** @type {number} total number of heal attempts (successful or not) */
  #totalHeals = 0;
  /** @type {number} total number of successful heals */
  #successfulHeals = 0;
  /** @type {number} total number of alert-only actions */
  #totalAlerts = 0;

  /**
   * @param {object} [opts]
   * @param {number}  [opts.checkInterval=10000]  -- interval between periodic checks (ms)
   * @param {number}  [opts.maxAutoHeals=5]       -- max consecutive auto-heals per module
   * @param {number}  [opts.cooldownMs=60000]     -- cooldown before re-healing same module (ms)
   * @param {boolean} [opts.enableAutoHeal=true]   -- whether to auto-heal on detection
   * @param {number}  [opts.historySize=200]       -- max healing history entries
   */
  constructor(opts = {}) {
    this.#checkInterval = Math.max(1000, Math.floor(opts.checkInterval ?? DEFAULT_CHECK_INTERVAL));
    this.#maxAutoHeals = Math.max(1, Math.floor(opts.maxAutoHeals ?? DEFAULT_MAX_AUTO_HEALS));
    this.#cooldownMs = Math.max(0, Math.floor(opts.cooldownMs ?? DEFAULT_COOLDOWN_MS));
    this.#enableAutoHeal = opts.enableAutoHeal !== false;
    this.#historySize = Math.max(1, Math.floor(opts.historySize ?? DEFAULT_HISTORY_SIZE));
  }

  /**
   * Register a module with its health function and recovery strategies.
   * Strategies are sorted by priority (lower number = higher priority).
   * @param {string} name -- unique module identifier
   * @param {() => object|Promise<object>} healthFn -- function that returns module health
   * @param {import('./helpers.js').RecoveryStrategy[]} strategies -- ordered recovery strategies
   */
  registerModule(name, healthFn, strategies) {
    if (typeof healthFn !== 'function') throw new TypeError(`healthFn for module '${name}' must be a function`);
    if (!Array.isArray(strategies)) throw new TypeError(`strategies for module '${name}' must be an array`);
    const sorted = [...strategies].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    this.#modules.set(name, { healthFn, strategies: sorted });
  }

  /**
   * Remove a module from self-healing monitoring.
   * @param {string} name -- module identifier
   * @returns {boolean} true if the module existed and was removed
   */
  unregisterModule(name) {
    const existed = this.#modules.delete(name);
    this.#moduleHealth.delete(name);
    this.#lastHealTime.delete(name);
    this.#consecutiveHeals.delete(name);
    return existed;
  }

  /**
   * Run a health check on all registered modules, auto-healing degraded/critical ones if enabled.
   * @returns {Promise<import('./helpers.js').CheckResult>}
   */
  async check() {
    this.#totalChecks++;
    /** @type {import('./helpers.js').CheckResult} */
    const result = { overall: _HealthLevel.HEALTHY, modules: [], healed: 0, alerts: 0 };
    for (const [name] of this.#modules) {
      const moduleResult = await this.#checkSingleModule(name, this.#enableAutoHeal);
      result.modules.push({ name, health: moduleResult.health, ...(moduleResult.action ? { action: moduleResult.action } : {}) });
      if (moduleResult.health === _HealthLevel.CRITICAL) result.overall = _HealthLevel.CRITICAL;
      else if (moduleResult.health === _HealthLevel.DEGRADED && result.overall !== _HealthLevel.CRITICAL) result.overall = _HealthLevel.DEGRADED;
      if (moduleResult.healed) result.healed++;
      if (moduleResult.action === _HealingAction.ALERT) result.alerts++;
    }
    if (this.#modules.size === 0) result.overall = _HealthLevel.HEALTHY;
    return result;
  }

  /**
   * Run a health check on a specific module. Auto-heal is applied if enabled.
   * @param {string} name -- module identifier
   * @returns {Promise<{ name: string, health: string, action?: string, healed: boolean }>}
   */
  async checkModule(name) {
    if (!this.#modules.has(name)) return { name, health: _HealthLevel.HEALTHY, healed: false };
    return this.#checkSingleModule(name, this.#enableAutoHeal);
  }

  /**
   * Manually trigger healing for a module, bypassing cooldown and auto-heal limits.
   * @param {string} name -- module identifier
   * @returns {Promise<{ success: boolean, action: string|null, message: string }>}
   */
  async heal(name) {
    if (!this.#modules.has(name)) return { success: false, action: null, message: `Module '${name}' is not registered` };
    const { healthFn, strategies } = this.#modules.get(name);
    let health;
    try {
      health = await Promise.resolve(healthFn());
    } catch (err) {
      return { success: false, action: null, message: `Health check failed: ${err.message}` };
    }
    const status = _normalizeStatus(health?.status);
    if (status === _HealthLevel.HEALTHY) return { success: true, action: null, message: `Module '${name}' is already healthy` };
    const matching = strategies.filter((s) => s.condition === status);
    if (matching.length === 0) return { success: false, action: null, message: `No strategy for '${name}' in '${status}' state` };
    for (const strategy of matching) {
      const start = performance.now();
      try {
        await Promise.resolve(strategy.handler());
        const duration = Math.round((performance.now() - start) * 100) / 100;
        _recordHistory(this.#history, { timestamp: Date.now(), module: name, action: strategy.action, success: true, message: `Manual heal succeeded for '${name}' (${strategy.action})`, duration }, this.#historySize);
        this.#totalHeals++;
        this.#successfulHeals++;
        this.#lastHealTime.set(name, Date.now());
        return { success: true, action: strategy.action, message: `Healed '${name}' via ${strategy.action} in ${duration}ms` };
      } catch (err) {
        const duration = Math.round((performance.now() - start) * 100) / 100;
        _recordHistory(this.#history, { timestamp: Date.now(), module: name, action: strategy.action, success: false, message: `Manual heal failed for '${name}': ${err.message}`, duration }, this.#historySize);
        this.#totalHeals++;
      }
    }
    return { success: false, action: null, message: `All strategies failed for '${name}'` };
  }

  /** Start periodic health checks using the configured interval. Clears previous timer if running. */
  start() {
    this.stop();
    this.#timer = setInterval(() => { this.check().catch(() => { /* swallow unhandled errors */ }); }, this.#checkInterval);
  }

  /** Stop periodic health checks. Manual checks and heals remain available. */
  stop() {
    if (this.#timer !== null) { clearInterval(this.#timer); this.#timer = null; }
  }

  /**
   * Get healing history with optional filtering.
   * @param {object} [opts]
   * @param {string} [opts.module] -- filter by module name
   * @param {string} [opts.action] -- filter by HealingAction value
   * @param {number} [opts.limit]  -- max entries to return
   * @returns {import('./helpers.js').HistoryEntry[]} history entries sorted by timestamp descending
   */
  getHistory(opts = {}) {
    return _filterAndSortHistory(this.#history, opts);
  }

  /**
   * Get current health status of all registered modules and the engine.
   * @returns {{ running: boolean, overall: string, modules: Array<{ name: string, health: string, lastChecked: number|null }>, healCount: number, alertCount: number }}
   */
  getStatus() {
    const overall = _computeOverallHealth(this.#modules.keys(), this.#moduleHealth);
    const modules = [];
    for (const [name] of this.#modules) {
      const cached = this.#moduleHealth.get(name);
      const health = cached ? cached.status : _HealthLevel.HEALTHY;
      const lastChecked = cached ? (cached.lastChecked ?? null) : null;
      modules.push({ name, health, lastChecked });
    }
    return { running: this.#timer !== null, overall, modules, healCount: this.#totalHeals, alertCount: this.#totalAlerts };
  }

  /**
   * Get healing statistics including success rate and per-module/per-action breakdowns.
   * @returns {{ totalChecks: number, totalHeals: number, successRate: number, byModule: Record<string, { heals: number, successes: number }>, byAction: Record<string, { heals: number, successes: number }> }}
   */
  getStats() {
    const byModule = _computeStatsByGroup(this.#history, 'module');
    const byAction = _computeStatsByGroup(this.#history, 'action');
    const successRate = this.#totalHeals > 0 ? Math.round((this.#successfulHeals / this.#totalHeals) * 10000) / 10000 : 0;
    return { totalChecks: this.#totalChecks, totalHeals: this.#totalHeals, successRate, byModule, byAction };
  }

  /** Clear all healing history, statistics, and cooldown state. Module registrations are preserved. */
  clear() {
    this.#history.length = 0;
    this.#totalChecks = 0;
    this.#totalHeals = 0;
    this.#successfulHeals = 0;
    this.#totalAlerts = 0;
    this.#lastHealTime.clear();
    this.#consecutiveHeals.clear();
  }

  /**
   * Check all modules and return a simplified array format expected by agent-pool.
   * Each entry: { moduleId: string, healthy: boolean, health: string }
   * @returns {Promise<Array<{ moduleId: string, healthy: boolean, health: string }>>}
   */
  async checkAll() {
    const report = await this.check();
    return report.modules.map(m => ({ moduleId: m.name, healthy: m.health === _HealthLevel.HEALTHY, health: m.health }));
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Check a single module's health and optionally apply healing.
   * @private
   * @param {string} name -- module identifier
   * @param {boolean} autoHeal -- whether to apply automatic healing
   * @returns {Promise<{ name: string, health: string, action?: string, healed: boolean }>}
   */
  async #checkSingleModule(name, autoHeal) {
    const { healthFn, strategies } = this.#modules.get(name);
    let health;
    try {
      health = await Promise.resolve(healthFn());
    } catch (err) {
      health = { status: _HealthLevel.CRITICAL, error: err.message };
    }
    const status = _normalizeStatus(health?.status);
    /** @type {import('./helpers.js').ModuleHealth} */
    const moduleHealth = { status, details: health ?? {}, lastChecked: Date.now() };
    this.#moduleHealth.set(name, moduleHealth);
    if (status === _HealthLevel.HEALTHY) {
      this.#consecutiveHeals.delete(name);
      return { name, health: status, healed: false };
    }
    if (!autoHeal) return { name, health: status, healed: false };
    const lastHeal = this.#lastHealTime.get(name) ?? 0;
    if (Date.now() - lastHeal < this.#cooldownMs) return { name, health: status, healed: false };
    const consecutive = this.#consecutiveHeals.get(name) ?? 0;
    if (consecutive >= this.#maxAutoHeals) {
      _recordHistory(this.#history, { timestamp: Date.now(), module: name, action: _HealingAction.ALERT, success: true, message: `Auto-heal paused for '${name}': max consecutive heals (${this.#maxAutoHeals}) reached`, duration: 0 }, this.#historySize);
      this.#totalAlerts++;
      return { name, health: status, action: _HealingAction.ALERT, healed: false };
    }
    const matching = strategies.filter((s) => s.condition === status);
    if (matching.length === 0) return { name, health: status, healed: false };
    for (const strategy of matching) {
      const start = performance.now();
      try {
        await Promise.resolve(strategy.handler());
        const duration = Math.round((performance.now() - start) * 100) / 100;
        _recordHistory(this.#history, { timestamp: Date.now(), module: name, action: strategy.action, success: true, message: `Auto-heal succeeded for '${name}' (${strategy.action})`, duration }, this.#historySize);
        this.#totalHeals++;
        this.#successfulHeals++;
        this.#lastHealTime.set(name, Date.now());
        this.#consecutiveHeals.set(name, consecutive + 1);
        if (strategy.action === _HealingAction.ALERT) this.#totalAlerts++;
        return { name, health: status, action: strategy.action, healed: true };
      } catch (err) {
        const duration = Math.round((performance.now() - start) * 100) / 100;
        _recordHistory(this.#history, { timestamp: Date.now(), module: name, action: strategy.action, success: false, message: `Auto-heal failed for '${name}' (${strategy.action}): ${err.message}`, duration }, this.#historySize);
        this.#totalHeals++;
      }
    }
    _recordHistory(this.#history, { timestamp: Date.now(), module: name, action: _HealingAction.ALERT, success: false, message: `All auto-heal strategies failed for '${name}' in '${status}' state`, duration: 0 }, this.#historySize);
    this.#totalAlerts++;
    return { name, health: status, action: _HealingAction.ALERT, healed: false };
  }
}
