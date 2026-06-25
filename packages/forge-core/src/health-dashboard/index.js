/**
 * HealthDashboard -- aggregated health monitoring for all Forge modules.
 *
 * Provides a unified health endpoint that collects status from registered
 * modules, computes overall system health, tracks history, and generates
 * alerts when issues are detected.
 *
 * Health levels:
 *   - healthy  -- all modules operating normally
 *   - degraded -- one or more modules experiencing issues, but no critical failures
 *   - critical -- at least one module has a critical failure
 *
 * Usage:
 *   import { HealthDashboard } from './health-dashboard/index.js';
 *
 *   const dashboard = new HealthDashboard({ refreshInterval: 5000 });
 *   dashboard.registerModule('orchestrator', () => ({ status: 'healthy', tasks: 42 }));
 *   dashboard.registerModule('llm-client', () => ({ status: 'degraded', latency: 2500 }));
 *
 *   const snapshot = await dashboard.refresh();
 *   console.log(snapshot.status); // 'degraded'
 */

import {
  DEFAULT_REFRESH_INTERVAL, DEFAULT_HISTORY_SIZE, MAX_ALERTS,
  HEALTH_LEVELS, ALERT_LEVELS,
  normalizeStatus, inferUnit,
} from './types.js';

// -- Type definitions ───────────────────────────────────────────────────────

/**
 * @typedef {object} ModuleStatus
 * @property {'healthy'|'degraded'|'critical'} status — current health
 * @property {object}  [details]   — arbitrary module-specific details
 * @property {number}  latencyMs   — time taken to execute the status function
 * @property {number}  lastChecked — epoch ms of the last status check
 */

/**
 * @typedef {object} HealthSnapshot
 * @property {'healthy'|'degraded'|'critical'} status — overall system health
 * @property {number}   timestamp — epoch ms when the snapshot was taken
 * @property {Record<string, ModuleStatus>} modules — per-module status
 * @property {object}   metrics   — aggregated metrics from all modules
 * @property {Alert[]}  alerts    — active alerts at time of snapshot
 */

/**
 * @typedef {object} Alert
 * @property {'info'|'warning'|'error'|'critical'} level
 * @property {string}  module      — name of the module that triggered the alert
 * @property {string}  message     — human-readable description
 * @property {number}  timestamp   — epoch ms when the alert was generated
 * @property {boolean} acknowledged — whether the alert has been acknowledged
 */

/**
 * @typedef {object} MetricValue
 * @property {number}  value  — current metric value
 * @property {string}  unit   — unit of measurement
 * @property {'up'|'down'|'stable'} trend — direction of change
 */

/**
 * @typedef {object} UptimeStats
 * @property {number}  startedAt       — epoch ms when the dashboard was created
 * @property {number}  uptime          — milliseconds since start
 * @property {number}  checksPerformed — total number of refresh cycles
 * @property {number}  healthyChecks   — snapshots with overall 'healthy' status
 * @property {number}  degradedChecks  — snapshots with overall 'degraded' status
 * @property {number}  criticalChecks  — snapshots with overall 'critical' status
 */

// -- HealthDashboard class ──────────────────────────────────────────────────

export class HealthDashboard {
  /** @type {Map<string, () => object>} registered module status functions */
  #modules = new Map();

  /** @type {Map<string, ModuleStatus>} last known status per module */
  #moduleStatus = new Map();

  /** @type {HealthSnapshot[]} ring buffer of historical snapshots */
  #history = [];

  /** @type {Alert[]} active alerts */
  #alerts = [];

  /** @type {number} max snapshots in history ring buffer */
  #historySize;

  /** @type {number} suggested refresh interval (ms) */
  #refreshInterval;

  /** @type {number} epoch ms when dashboard was instantiated */
  #startedAt;

  /** @type {number} total refresh cycles performed */
  #checksPerformed = 0;

  /** @type {number} count of snapshots with 'healthy' status */
  #healthyChecks = 0;

  /** @type {number} count of snapshots with 'degraded' status */
  #degradedChecks = 0;

  /** @type {number} count of snapshots with 'critical' status */
  #criticalChecks = 0;

  /** @type {Map<string, string>} last known status per module (for change detection) */
  #lastKnownStatus = new Map();

  /**
   * @param {object} [opts]
   * @param {number} [opts.refreshInterval=5000] — suggested auto-refresh interval (ms)
   * @param {number} [opts.historySize=100]       — max historical snapshots to retain
   */
  constructor(opts = {}) {
    this.#refreshInterval = Math.max(1000, Math.floor(opts.refreshInterval ?? DEFAULT_REFRESH_INTERVAL));
    this.#historySize = Math.max(1, Math.floor(opts.historySize ?? DEFAULT_HISTORY_SIZE));
    this.#startedAt = Date.now();
  }

  // ── 1. Register Module ───────────────────────────────────────────────────

  /**
   * Register a module with a status function.
   *
   * The status function should return an object with at least a `status` field:
   * `{ status: 'healthy'|'degraded'|'critical', ...details }`
   *
   * @param {string} name — unique module identifier
   * @param {() => object} statusFn — function that returns module status
   */
  registerModule(name, statusFn) {
    if (typeof statusFn !== 'function') {
      throw new TypeError(`statusFn for module '${name}' must be a function`);
    }
    this.#modules.set(name, statusFn);
  }

  // ── 2. Unregister Module ─────────────────────────────────────────────────

  /**
   * Remove a module from health monitoring.
   *
   * @param {string} name
   * @returns {boolean} true if the module existed and was removed
   */
  unregisterModule(name) {
    const existed = this.#modules.delete(name);
    this.#moduleStatus.delete(name);
    this.#lastKnownStatus.delete(name);
    return existed;
  }

  // ── 3. Get Snapshot ──────────────────────────────────────────────────────

  /**
   * Get an aggregated health snapshot of all registered modules.
   * Does NOT call status functions -- returns the most recently cached data.
   * Use {@link HealthDashboard#refresh} to fetch fresh data.
   *
   * @returns {HealthSnapshot}
   */
  getSnapshot() {
    const modules = {};
    let overallStatus = 'healthy';

    for (const [name, status] of this.#moduleStatus) {
      modules[name] = { ...status };
      if (status.status === 'critical') {
        overallStatus = 'critical';
      } else if (status.status === 'degraded' && overallStatus !== 'critical') {
        overallStatus = 'degraded';
      }
    }

    // If no modules registered, report healthy with empty data
    if (this.#modules.size === 0) {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp: Date.now(),
      modules,
      metrics: this.getMetrics(),
      alerts: this.#alerts.filter((a) => !a.acknowledged),
    };
  }

  // ── 4. Get Module Health ─────────────────────────────────────────────────

  /**
   * Get cached health information for a specific module.
   *
   * @param {string} name
   * @returns {ModuleStatus|null} module status, or null if not registered
   */
  getModuleHealth(name) {
    return this.#moduleStatus.get(name) ?? null;
  }

  // ── 5. Get History ───────────────────────────────────────────────────────

  /**
   * Get historical health snapshots.
   *
   * @param {object} [opts]
   * @param {number} [opts.limit=20]  — max snapshots to return
   * @param {string} [opts.module]    — filter to snapshots where this module had issues
   * @returns {HealthSnapshot[]} snapshots sorted by timestamp descending
   */
  getHistory(opts = {}) {
    let history = [...this.#history];

    if (opts.module) {
      history = history.filter((snap) => {
        const mod = snap.modules[opts.module];
        return mod && (mod.status === 'degraded' || mod.status === 'critical');
      });
    }

    history.sort((a, b) => b.timestamp - a.timestamp);

    const limit = opts.limit ?? 20;
    if (limit > 0) {
      history = history.slice(0, limit);
    }

    return history;
  }

  // ── 6. Get Metrics ───────────────────────────────────────────────────────

  /**
   * Get aggregated metrics extracted from all module status objects.
   * Metrics are any numeric fields in the module status beyond `status` itself.
   *
   * @returns {Record<string, MetricValue>}
   */
  getMetrics() {
    /** @type {Record<string, MetricValue>} */
    const metrics = {};

    for (const [name, status] of this.#moduleStatus) {
      if (!status.details) continue;

      for (const [key, value] of Object.entries(status.details)) {
        if (typeof value !== 'number') continue;

        const metricName = `${name}.${key}`;
        const prevValue = metrics[metricName]?.value;

        let trend = 'stable';
        if (prevValue != null) {
          if (value > prevValue) trend = 'up';
          else if (value < prevValue) trend = 'down';
        }

        metrics[metricName] = {
          value,
          unit: inferUnit(key),
          trend,
        };
      }
    }

    return metrics;
  }

  // ── 7. Get Alerts ────────────────────────────────────────────────────────

  /**
   * Get all active (non-acknowledged) alerts.
   *
   * @returns {Alert[]}
   */
  getAlerts() {
    return this.#alerts.filter((a) => !a.acknowledged);
  }

  // ── 8. Acknowledge Alert ─────────────────────────────────────────────────

  /**
   * Acknowledge an alert by its index in the alerts array.
   *
   * @param {number} alertIndex — zero-based index into the internal alerts array
   * @returns {boolean} true if the alert existed and was acknowledged
   */
  acknowledgeAlert(alertIndex) {
    if (alertIndex < 0 || alertIndex >= this.#alerts.length) return false;
    this.#alerts[alertIndex].acknowledged = true;
    return true;
  }

  // ── 9. Add Alert ─────────────────────────────────────────────────────────

  /**
   * Manually add a custom alert.
   *
   * @param {'info'|'warning'|'error'|'critical'} level
   * @param {string} module  — module name or 'system'
   * @param {string} message — human-readable description
   */
  addAlert(level, module, message) {
    const alertLevel = ALERT_LEVELS.includes(level) ? level : 'info';

    this.#alerts.push({
      level: alertLevel,
      module: module ?? 'system',
      message: message ?? '',
      timestamp: Date.now(),
      acknowledged: false,
    });

    // Trim oldest alerts if over capacity
    if (this.#alerts.length > MAX_ALERTS) {
      this.#alerts.splice(0, this.#alerts.length - MAX_ALERTS);
    }
  }

  // ── 10. Get Uptime ───────────────────────────────────────────────────────

  /**
   * Get uptime and check statistics.
   *
   * @returns {UptimeStats}
   */
  getUptime() {
    return {
      startedAt: this.#startedAt,
      uptime: Date.now() - this.#startedAt,
      checksPerformed: this.#checksPerformed,
      healthyChecks: this.#healthyChecks,
      degradedChecks: this.#degradedChecks,
      criticalChecks: this.#criticalChecks,
    };
  }

  // ── 11. Refresh ──────────────────────────────────────────────────────────

  /**
   * Call all registered status functions, compute overall health, store a
   * snapshot in history, and generate alerts for degraded or critical modules.
   *
   * @returns {Promise<HealthSnapshot>}
   */
  async refresh() {
    this.#checksPerformed++;

    const modules = {};
    let overallStatus = 'healthy';

    for (const [name, statusFn] of this.#modules) {
      const start = performance.now();
      let result;
      let status = 'healthy';

      try {
        result = await Promise.resolve(statusFn());
        status = normalizeStatus(result?.status);
      } catch (err) {
        // Module status function threw -- treat as critical
        result = { error: err.message };
        status = 'critical';
      }

      const latencyMs = Math.round((performance.now() - start) * 100) / 100;

      /** @type {ModuleStatus} */
      const moduleStatus = {
        status,
        details: result ?? {},
        latencyMs,
        lastChecked: Date.now(),
      };

      modules[name] = moduleStatus;
      this.#moduleStatus.set(name, moduleStatus);

      // Detect status changes and generate alerts
      const prevStatus = this.#lastKnownStatus.get(name);
      if (prevStatus && prevStatus !== status) {
        this.#generateChangeAlert(name, prevStatus, status);
      }
      this.#lastKnownStatus.set(name, status);

      // Update overall status
      if (status === 'critical') {
        overallStatus = 'critical';
      } else if (status === 'degraded' && overallStatus !== 'critical') {
        overallStatus = 'degraded';
      }
    }

    // Handle no modules registered
    if (this.#modules.size === 0) {
      overallStatus = 'healthy';
    }

    // Track check statistics
    if (overallStatus === 'healthy') this.#healthyChecks++;
    else if (overallStatus === 'degraded') this.#degradedChecks++;
    else if (overallStatus === 'critical') this.#criticalChecks++;

    /** @type {HealthSnapshot} */
    const snapshot = {
      status: overallStatus,
      timestamp: Date.now(),
      modules,
      metrics: this.getMetrics(),
      alerts: this.#alerts.filter((a) => !a.acknowledged),
    };

    // Store in history ring buffer
    this.#history.push(snapshot);
    if (this.#history.length > this.#historySize) {
      this.#history.splice(0, this.#history.length - this.#historySize);
    }

    return snapshot;
  }

  // ── 12. Get Status ───────────────────────────────────────────────────────

  /**
   * Lightweight status summary (no module details).
   *
   * @returns {{ status: string, moduleCount: number, alertCount: number, uptime: number }}
   */
  getStatus() {
    const snapshot = this.getSnapshot();
    return {
      status: snapshot.status,
      moduleCount: this.#modules.size,
      alertCount: this.#alerts.filter((a) => !a.acknowledged).length,
      uptime: Date.now() - this.#startedAt,
    };
  }

  // ── 13. Clear ────────────────────────────────────────────────────────────

  /**
   * Clear all historical snapshots and alerts.
   * Module registrations and current status are preserved.
   */
  clear() {
    this.#history.length = 0;
    this.#alerts.length = 0;
    this.#checksPerformed = 0;
    this.#healthyChecks = 0;
    this.#degradedChecks = 0;
    this.#criticalChecks = 0;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Generate an alert when a module's status changes.
   *
   * @param {string} module
   * @param {string} prevStatus
   * @param {string} newStatus
   */
  #generateChangeAlert(module, prevStatus, newStatus) {
    // Determine alert level based on new status
    let level = 'info';
    if (newStatus === 'degraded') level = 'warning';
    if (newStatus === 'critical') level = 'error';

    // If recovering, use info level
    const isRecovery = (
      (prevStatus === 'critical' && newStatus !== 'critical') ||
      (prevStatus === 'degraded' && newStatus === 'healthy')
    );

    if (isRecovery) {
      level = 'info';
    }

    const message = isRecovery
      ? `Module '${module}' recovered from '${prevStatus}' to '${newStatus}'`
      : `Module '${module}' status changed from '${prevStatus}' to '${newStatus}'`;

    this.addAlert(level, module, message);
  }
}
