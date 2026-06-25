/**
 * @fileoverview AdaptiveScaling — dynamic worker concurrency adjustment for Forge.
 *
 * Adjusts worker pool size based on queue depth, execution time trends, system load,
 * and success rates. Uses a sliding window of samples and linear regression to detect
 * trends. Applies cooldown between scaling events to prevent thrashing.
 *
 * @example
 *   const scaler = new AdaptiveScaling({ minWorkers: 2, maxWorkers: 20 });
 *   scaler.record({ queueDepth: 10, activeWorkers: 4, avgExecutionTime: 5000, successRate: 0.95 });
 *   const { recommended, action } = scaler.getRecommendedWorkers();
 *   if (action === 'scale_up') scaler.applyScaling(recommended);
 *
 * @module adaptive-scaling
 */

/** Default minimum number of workers. */
const DEFAULT_MIN_WORKERS = 1;
/** Default maximum number of workers. */
const DEFAULT_MAX_WORKERS = 16;
/** Default initial worker count. */
const DEFAULT_CURRENT_WORKERS = 4;
/** Utilization threshold above which scale-up is considered. */
const DEFAULT_SCALE_UP_THRESHOLD = 0.8;
/** Utilization threshold below which scale-down is considered. */
const DEFAULT_SCALE_DOWN_THRESHOLD = 0.3;
/** Cooldown period (ms) between scaling events to prevent thrashing. */
const DEFAULT_COOLDOWN_MS = 60_000;
/** Number of recent samples to consider when analyzing trends. */
const DEFAULT_SAMPLE_WINDOW = 20;
/** Multiplier applied when scaling up (e.g., 1.5 = increase by 50%). */
const DEFAULT_SCALE_UP_FACTOR = 1.5;
/** Multiplier applied when scaling down (e.g., 0.7 = decrease by 30%). */
const DEFAULT_SCALE_DOWN_FACTOR = 0.7;
/** Maximum number of scaling events to retain in history (ring buffer). */
const MAX_SCALING_EVENTS = 50;

/**
 * A single data point recorded from the worker pool.
 * @typedef {Object} DataPoint
 * @property {number} queueDepth - Pending tasks in the queue.
 * @property {number} activeWorkers - Workers currently executing tasks.
 * @property {number} avgExecutionTime - Average task execution time (ms).
 * @property {number} successRate - Fraction of tasks that succeeded (0-1).
 * @property {number} timestamp - Epoch ms when the sample was taken.
 */

/**
 * Scaling decision returned by {@link AdaptiveScaling#getRecommendedWorkers}.
 * @typedef {Object} ScalingRecommendation
 * @property {number} recommended - Recommended worker count.
 * @property {number} current - Current worker count.
 * @property {'scale_up'|'scale_down'|'hold'} action - Recommended action.
 * @property {string} reason - Human-readable explanation.
 */

/**
 * Scaling event logged when a scaling decision is applied.
 * @typedef {Object} ScalingEvent
 * @property {number} timestamp - Epoch ms when the event occurred.
 * @property {number} from - Previous worker count.
 * @property {number} to - New worker count.
 * @property {string} reason - Why the scaling occurred.
 */

/**
 * Dynamic worker concurrency adjustment based on queue depth, execution time trends,
 * and system load.
 *
 * Maintains a sliding window of data points and uses linear regression to detect trends.
 * Applies scaling decisions with cooldown to prevent thrashing. Supports manual override
 * and automatic scaling modes.
 */
export class AdaptiveScaling {
  /** @type {number} */ #minWorkers;
  /** @type {number} */ #maxWorkers;
  /** @type {number} */ #currentWorkers;
  /** @type {number} */ #scaleUpThreshold;
  /** @type {number} */ #scaleDownThreshold;
  /** @type {number} */ #cooldownMs;
  /** @type {number} */ #sampleWindow;
  /** @type {number} */ #scaleUpFactor;
  /** @type {number} */ #scaleDownFactor;
  /** @type {Array<DataPoint>} Sliding window of recorded samples. */
  #samples = [];
  /** @type {Array<ScalingEvent>} Ring buffer of recent scaling events. */
  #scalingEvents = [];
  /** @type {number} Epoch ms of the last scaling event (0 = never). */
  #lastScalingTime = 0;
  /** @type {boolean} Whether auto-scaling is active. */
  #autoScaling = true;

  /**
   * @param {object} [opts]
   * @param {number} [opts.minWorkers=1] — minimum allowed workers
   * @param {number} [opts.maxWorkers=16] — maximum allowed workers
   * @param {number} [opts.currentWorkers=4] — initial worker count
   * @param {number} [opts.scaleUpThreshold=0.8] — utilization threshold for scale-up
   * @param {number} [opts.scaleDownThreshold=0.3] — utilization threshold for scale-down
   * @param {number} [opts.cooldownMs=60000] — cooldown between scaling events (ms)
   * @param {number} [opts.sampleWindow=20] — samples to consider for analysis
   * @param {number} [opts.scaleUpFactor=1.5] — multiplier when scaling up
   * @param {number} [opts.scaleDownFactor=0.7] — multiplier when scaling down
   */
  constructor(opts = {}) {
    this.#minWorkers = Math.max(1, opts.minWorkers ?? DEFAULT_MIN_WORKERS);
    this.#maxWorkers = Math.max(this.#minWorkers, opts.maxWorkers ?? DEFAULT_MAX_WORKERS);
    this.#currentWorkers = Math.max(
      this.#minWorkers,
      Math.min(this.#maxWorkers, opts.currentWorkers ?? DEFAULT_CURRENT_WORKERS),
    );
    this.#scaleUpThreshold = opts.scaleUpThreshold ?? DEFAULT_SCALE_UP_THRESHOLD;
    this.#scaleDownThreshold = opts.scaleDownThreshold ?? DEFAULT_SCALE_DOWN_THRESHOLD;
    this.#cooldownMs = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.#sampleWindow = opts.sampleWindow ?? DEFAULT_SAMPLE_WINDOW;
    this.#scaleUpFactor = opts.scaleUpFactor ?? DEFAULT_SCALE_UP_FACTOR;
    this.#scaleDownFactor = opts.scaleDownFactor ?? DEFAULT_SCALE_DOWN_FACTOR;
  }

  // ── 1. Record ───────────────────────────────────────────────────────────────

  /**
   * Record a data point (called periodically or after each task completion).
   * Maintains a sliding window — older samples beyond the window are discarded.
   * @param {DataPoint} dataPoint
   */
  record(dataPoint) {
    this.#samples.push({
      queueDepth: dataPoint.queueDepth ?? 0,
      activeWorkers: dataPoint.activeWorkers ?? 0,
      avgExecutionTime: dataPoint.avgExecutionTime ?? 0,
      successRate: dataPoint.successRate ?? 1,
      timestamp: dataPoint.timestamp ?? Date.now(),
    });

    if (this.#samples.length > this.#sampleWindow) {
      this.#samples.shift();
    }
  }

  // ── 2. Get Recommended Workers ──────────────────────────────────────────────

  /**
   * Get recommended worker count based on recent metrics.
   * Respects cooldown period and manual override settings.
   * @returns {ScalingRecommendation}
   */
  getRecommendedWorkers() {
    const current = this.#currentWorkers;

    if (!this.#autoScaling) {
      return { recommended: current, current, action: 'hold',
        reason: 'Auto-scaling is disabled (manual override active)' };
    }

    if (this.isInCooldown()) {
      const remaining = Math.ceil((this.#cooldownMs - (Date.now() - this.#lastScalingTime)) / 1000);
      return { recommended: current, current, action: 'hold',
        reason: `Cooldown period active (${remaining}s remaining)` };
    }

    if (this.#samples.length === 0) {
      return { recommended: current, current, action: 'hold', reason: 'No samples recorded yet' };
    }

    const latest = this.#samples[this.#samples.length - 1];
    const utilization = current > 0 ? latest.activeWorkers / current : 0;

    // Scale UP: high utilization AND queue depth exceeds worker count
    if (utilization > this.#scaleUpThreshold && latest.queueDepth > current) {
      const recommended = Math.min(this.#maxWorkers, Math.ceil(current * this.#scaleUpFactor));
      return { recommended, current, action: 'scale_up',
        reason: `High utilization (${(utilization * 100).toFixed(1)}%) with queue depth (${latest.queueDepth}) exceeding worker count (${current})` };
    }

    // Scale DOWN: low utilization AND queue depth below 50 % of worker count
    if (utilization < this.#scaleDownThreshold && latest.queueDepth < current * 0.5) {
      const recommended = Math.max(this.#minWorkers, Math.floor(current * this.#scaleDownFactor));
      return { recommended, current, action: 'scale_down',
        reason: `Low utilization (${(utilization * 100).toFixed(1)}%) with queue depth (${latest.queueDepth}) below 50% of worker count (${current})` };
    }

    return { recommended: current, current, action: 'hold',
      reason: `Utilization (${(utilization * 100).toFixed(1)}%) within acceptable range` };
  }

  // ── 3. Apply Scaling ────────────────────────────────────────────────────────

  /**
   * Apply a scaling decision. Clamps to [min, max], logs event, starts cooldown.
   * @param {number} newCount — desired worker count
   * @returns {{ previous: number, current: number, change: number }}
   */
  applyScaling(newCount) {
    const previous = this.#currentWorkers;
    const clamped = Math.max(this.#minWorkers, Math.min(this.#maxWorkers, Math.floor(newCount)));

    this.#currentWorkers = clamped;
    this.#lastScalingTime = Date.now();
    const change = clamped - previous;

    this.#scalingEvents.push({
      timestamp: this.#lastScalingTime,
      from: previous, to: clamped,
      reason: change > 0 ? `Scale up by ${change}` : `Scale down by ${Math.abs(change)}`,
    });

    // Ring buffer: keep only last MAX_SCALING_EVENTS
    if (this.#scalingEvents.length > MAX_SCALING_EVENTS) {
      this.#scalingEvents.shift();
    }

    return { previous, current: clamped, change };
  }

  // ── 4. Get Metrics ──────────────────────────────────────────────────────────

  /**
   * Get current scaling metrics including averages, percentiles, and trends.
   * @returns {Object} Comprehensive metrics snapshot with queueDepth, executionTime,
   *   successRate, utilization, and scalingEvents.
   */
  getMetrics() {
    const current = this.#currentWorkers;
    const { recommended } = this.getRecommendedWorkers();
    const empty = () => ({
      currentWorkers: current, recommendedWorkers: recommended,
      queueDepth: { current: 0, avg: 0, trend: 'stable' },
      executionTime: { avg: 0, p95: 0, trend: 'stable' },
      successRate: { current: 1, avg: 1 },
      utilization: 0,
      scalingEvents: [...this.#scalingEvents],
    });

    if (this.#samples.length === 0) return empty();

    const latest = this.#samples[this.#samples.length - 1];
    const queueDepths = this.#samples.map(s => s.queueDepth);
    const execTimes = this.#samples.map(s => s.avgExecutionTime);
    const successRates = this.#samples.map(s => s.successRate);

    return {
      currentWorkers: current,
      recommendedWorkers: recommended,
      queueDepth: {
        current: latest.queueDepth,
        avg: this.#average(queueDepths),
        trend: this.#calculateTrend(queueDepths),
      },
      executionTime: {
        avg: this.#average(execTimes),
        p95: this.#percentile(execTimes, 0.95),
        trend: this.#calculateTrend(execTimes),
      },
      successRate: {
        current: latest.successRate,
        avg: this.#average(successRates),
      },
      utilization: current > 0 ? latest.activeWorkers / current : 0,
      scalingEvents: [...this.#scalingEvents],
    };
  }

  // ── 5. Get History ──────────────────────────────────────────────────────────

  /**
   * Get scaling history with optional filtering.
   * @param {object} [opts]
   * @param {number} [opts.limit] — max events to return
   * @param {'scale_up'|'scale_down'} [opts.action] — filter by action type
   * @returns {Array<ScalingEvent>}
   */
  getHistory(opts = {}) {
    let events = [...this.#scalingEvents];

    if (opts.action === 'scale_up') {
      events = events.filter(e => e.to > e.from);
    } else if (opts.action === 'scale_down') {
      events = events.filter(e => e.to < e.from);
    }

    return opts.limit ? events.slice(-opts.limit) : events;
  }

  // ── 6. Is In Cooldown ───────────────────────────────────────────────────────

  /**
   * Check if scaling is in cooldown period.
   * @returns {boolean}
   */
  isInCooldown() {
    return this.#lastScalingTime > 0 && (Date.now() - this.#lastScalingTime) < this.#cooldownMs;
  }

  // ── 7. Set Manual ───────────────────────────────────────────────────────────

  /**
   * Manually set worker count. Disables auto-scaling until setAutoScaling(true).
   * @param {number} count — desired worker count
   * @returns {{ previous: number, current: number }}
   */
  setManual(count) {
    const previous = this.#currentWorkers;
    this.#currentWorkers = Math.max(this.#minWorkers, Math.min(this.#maxWorkers, Math.floor(count)));
    this.#autoScaling = false;
    return { previous, current: this.#currentWorkers };
  }

  // ── 8. Set Auto Scaling ─────────────────────────────────────────────────────

  /**
   * Enable or disable auto-scaling. When disabled, getRecommendedWorkers returns 'hold'.
   * @param {boolean} enabled
   */
  setAutoScaling(enabled) {
    this.#autoScaling = Boolean(enabled);
  }

  // ── 9. Get Status ───────────────────────────────────────────────────────────

  /**
   * Get scaling status summary.
   * @returns {{ currentWorkers, minWorkers, maxWorkers, autoScaling: boolean,
   *             cooldown: boolean, utilization: number, trend: 'up'|'down'|'stable' }}
   */
  getStatus() {
    const latest = this.#samples.length > 0 ? this.#samples[this.#samples.length - 1] : null;
    const utilization = latest && this.#currentWorkers > 0
      ? latest.activeWorkers / this.#currentWorkers : 0;
    const trend = this.#calculateTrend(this.#samples.map(s => s.queueDepth));

    return {
      currentWorkers: this.#currentWorkers,
      minWorkers: this.#minWorkers,
      maxWorkers: this.#maxWorkers,
      autoScaling: this.#autoScaling,
      cooldown: this.isInCooldown(),
      utilization,
      trend,
    };
  }

  // ── 10. Reset ──────────────────────────────────────────────────────────────

  /**
   * Reset all metrics and scaling history. Preserves configuration and current worker count.
   */
  reset() {
    this.#samples = [];
    this.#scalingEvents = [];
    this.#lastScalingTime = 0;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  /**
   * Calculate average of an array of numbers.
   * @private
   * @param {number[]} values
   * @returns {number}
   */
  #average(values) {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate percentile value (sort then take 95th-index).
   * @private
   * @param {number[]} values
   * @param {number} p — percentile fraction (0-1)
   * @returns {number}
   */
  #percentile(values, p) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate trend direction via linear regression slope analysis.
   * Slope must exceed 5 % of the average to register as 'up' or 'down'.
   * @private
   * @param {number[]} values — sequential metric values
   * @returns {'up'|'down'|'stable'}
   */
  #calculateTrend(values) {
    if (values.length < 2) return 'stable';

    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const threshold = this.#average(values) * 0.05;

    if (slope > threshold) return 'up';
    if (slope < -threshold) return 'down';
    return 'stable';
  }
}
