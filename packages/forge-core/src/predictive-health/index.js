/**
 * Predictive Health Module — anticipates failures before they happen.
 *
 * Tracks per-module health metric samples and uses statistical analysis
 * (linear regression, z-score anomaly detection) to predict when a module
 * will breach thresholds, detect anomalous behavior, and suggest preventive
 * actions.
 *
 * Pure Node.js, no external dependencies.
 *
 * @module predictive-health
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  buildPreventiveActions,
  detectAnomaliesFromSamples,
  predictFromSamples,
  getDegradationTimelineFromSamples,
  deduplicateRecommendations,
} from './helpers.js';

// ── PredictiveHealth ────────────────────────────────────────────────────────

/**
 * Predictive health monitor that anticipates module failures.
 *
 * Records periodic health metric samples per module and uses statistical
 * analysis to predict when metrics will breach thresholds, detect anomalous
 * behavior, track degradation timelines, and suggest preventive actions.
 *
 * @example
 *   const health = new PredictiveHealth({ historyWindow: 200 });
 *   health.recordSample('worker-pool', {
 *     successRate: 0.95, avgLatency: 1200, errorRate: 0.05,
 *     queueDepth: 3, memoryUsage: 0.6, cpuUsage: 0.4, activeConnections: 8
 *   });
 *   const prediction = health.predict('worker-pool');
 */
export class PredictiveHealth {
  /** @type {Map<string, Array<{ timestamp: number, metrics: object }>>} */
  #samples = new Map();

  /** @type {number} Max samples to retain per module */
  #historyWindow;

  /** @type {number} Confidence threshold for alerts (0-1) */
  #alertThreshold;

  /** @type {number} How many samples ahead to project for predictions */
  #predictionInterval;

  /** @type {number} Slope threshold that indicates degradation */
  #degradationRateThreshold;

  /** @type {Map<string, number>} Timestamp when degradation was first detected */
  #degradationStart = new Map();

  /**
   * @param {object} [opts]
   * @param {number} [opts.historyWindow=100] — max samples per module
   * @param {number} [opts.alertThreshold=0.7] — confidence threshold for alerts
   * @param {number} [opts.predictionInterval=10] — samples ahead to project
   * @param {number} [opts.degradationRateThreshold=0.05] — slope threshold
   */
  constructor(opts = {}) {
    this.#historyWindow = opts.historyWindow ?? 100;
    this.#alertThreshold = opts.alertThreshold ?? 0.7;
    this.#predictionInterval = opts.predictionInterval ?? 10;
    this.#degradationRateThreshold = opts.degradationRateThreshold ?? 0.05;
  }

  // ── Recording ───────────────────────────────────────────────────────────

  /**
   * Record a health metric sample for a module.
   *
   * @param {string} moduleId — module identifier
   * @param {object} metrics — health metrics snapshot
   * @param {number} [metrics.successRate] — 0-1 success rate
   * @param {number} [metrics.avgLatency] — average latency in ms
   * @param {number} [metrics.errorRate] — 0-1 error rate
   * @param {number} [metrics.queueDepth] — pending items in queue
   * @param {number} [metrics.memoryUsage] — 0-1 memory usage ratio
   * @param {number} [metrics.cpuUsage] — 0-1 CPU usage ratio
   * @param {number} [metrics.activeConnections] — current connection count
   */
  recordSample(moduleId, metrics) {
    if (!this.#samples.has(moduleId)) {
      this.#samples.set(moduleId, []);
    }

    const samples = this.#samples.get(moduleId);
    samples.push({ timestamp: Date.now(), metrics: { ...metrics } });

    // Enforce history window
    if (samples.length > this.#historyWindow) {
      this.#samples.get(moduleId).length = this.#historyWindow;
    }
  }

  // ── Prediction ──────────────────────────────────────────────────────────

  /**
   * Predict future health for a module based on current trends.
   *
   * Uses linear regression on each metric's history to project values
   * `predictionInterval` samples into the future, then estimates when
   * each metric will breach its threshold.
   *
   * @param {string} moduleId
   * @param {number} [horizonMs=300000] — prediction horizon in ms
   * @returns {{ moduleId: string, status: 'healthy'|'degrading'|'at_risk'|'critical',
   *   predictions: Array, recommendations: string[] }}
   */
  predict(moduleId, horizonMs = 300000) {
    const samples = this.#samples.get(moduleId);
    const result = predictFromSamples(samples, {
      predictionInterval: this.#predictionInterval,
      alertThreshold: this.#alertThreshold,
      degradationRateThreshold: this.#degradationRateThreshold,
      historyWindow: this.#historyWindow,
      horizonMs,
    });
    return { moduleId, ...result };
  }

  // ── Anomaly Detection ───────────────────────────────────────────────────

  /**
   * Detect anomalous behavior by comparing recent samples to historical baseline.
   *
   * Uses z-score analysis: a metric is flagged as anomalous when its most
   * recent value is more than 2 standard deviations from the historical mean.
   *
   * @param {string} moduleId
   * @returns {Array<{ metric: string, value: number, mean: number,
   *   stdDev: number, zScore: number, severity: 'info'|'warning'|'critical' }>}
   */
  detectAnomalies(moduleId) {
    const samples = this.#samples.get(moduleId);
    return detectAnomaliesFromSamples(samples);
  }

  // ── System-Wide Prediction ──────────────────────────────────────────────

  /**
   * Get system-wide health prediction by aggregating all module predictions.
   *
   * @returns {{ overallStatus: string, modules: Array, atRiskModules: string[],
   *   recommendations: string[] }}
   */
  predictSystemHealth() {
    const modules = [];
    const atRiskModules = [];
    const allRecommendations = [];
    let overallStatus = 'healthy';

    const statusSeverity = { healthy: 0, degrading: 1, at_risk: 2, critical: 3 };

    for (const moduleId of this.#samples.keys()) {
      const prediction = this.predict(moduleId);
      modules.push({
        moduleId,
        status: prediction.status,
        predictions: prediction.predictions,
      });

      if (prediction.status === 'at_risk' || prediction.status === 'critical') {
        atRiskModules.push(moduleId);
      }

      if (statusSeverity[prediction.status] > statusSeverity[overallStatus]) {
        overallStatus = prediction.status;
      }

      allRecommendations.push(...prediction.recommendations);
    }

    return {
      overallStatus,
      modules,
      atRiskModules,
      recommendations: deduplicateRecommendations(allRecommendations),
    };
  }

  // ── Degradation Timeline ────────────────────────────────────────────────

  /**
   * Get the degradation timeline for a specific module.
   *
   * Tracks when degradation started, the rate of decline, and projects
   * when the module will reach critical status.
   *
   * @param {string} moduleId
   * @returns {{ startedAt: number|null, rate: number, currentLevel: string,
   *   projectedCritical: number|null, metrics: Array }}
   */
  getDegradationTimeline(moduleId) {
    const samples = this.#samples.get(moduleId);
    return getDegradationTimelineFromSamples(samples, {
      degradationRateThreshold: this.#degradationRateThreshold,
    });
  }

  // ── Preventive Actions ──────────────────────────────────────────────────

  /**
   * Suggest preventive actions based on current predictions and anomalies.
   *
   * @param {string} moduleId
   * @returns {Array<{ action: string, reason: string,
   *   urgency: 'low'|'medium'|'high'|'critical', expectedImpact: string }>}
   */
  suggestPreventiveActions(moduleId) {
    const prediction = this.predict(moduleId);
    const anomalies = this.detectAnomalies(moduleId);
    return buildPreventiveActions(prediction.predictions, anomalies);
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  /**
   * Persist health samples to disk.
   * @param {string} path
   * @returns {Promise<void>}
   */
  async persist(path) {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      samples: Object.fromEntries(this.#samples),
      degradationStart: Object.fromEntries(this.#degradationStart),
    };
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Load health samples from disk.
   * @param {string} path
   * @returns {Promise<void>}
   */
  async load(path) {
    const raw = await readFile(path, 'utf8');
    const data = JSON.parse(raw);
    if (data.version !== 1) {
      throw new Error(`Unsupported predictive-health version: ${data.version}`);
    }
    this.#samples = new Map(Object.entries(data.samples || {}));
    this.#degradationStart = new Map(Object.entries(data.degradationStart || {}));

    // Enforce history window
    for (const [key, samples] of this.#samples) {
      if (samples.length > this.#historyWindow) {
        this.#samples.set(key, samples.slice(-this.#historyWindow));
      }
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────

  /**
   * Get current status summary.
   *
   * @returns {{ monitoredModules: number, totalSamples: number,
   *   anomalyCount: number, atRiskCount: number, lastPrediction: object|null }}
   */
  getStatus() {
    let totalSamples = 0;
    let anomalyCount = 0;
    let atRiskCount = 0;

    for (const moduleId of this.#samples.keys()) {
      const samples = this.#samples.get(moduleId);
      totalSamples += samples.length;

      const anomalies = this.detectAnomalies(moduleId);
      anomalyCount += anomalies.length;

      const prediction = this.predict(moduleId);
      if (prediction.status === 'at_risk' || prediction.status === 'critical') {
        atRiskCount++;
      }
    }

    return {
      monitoredModules: this.#samples.size,
      totalSamples,
      anomalyCount,
      atRiskCount,
      historyWindow: this.#historyWindow,
      alertThreshold: this.#alertThreshold,
    };
  }
}
