/**
 * Cost Attribution — tracks ACTUAL token/cost consumption per goal → task → worker.
 *
 * While the BudgetTracker records aggregate usage during a single goal and the
 * CostCalculator estimates costs *before* a request, CostAttribution records
 * actual consumption after the fact and provides detailed reporting:
 *
 *   - Per-goal cost breakdown (getGoalCost)
 *   - Per-task cost breakdown (getTaskCost)
 *   - Cost by worker type (getCostByWorker)
 *   - Cost by model (getCostByModel)
 *   - Time-series trends (getCostTrend)
 *   - Top-N most expensive items (getTopExpensive)
 *   - Projection based on recent usage (getProjection)
 *
 * Records are stored in a ring buffer (default 10 000 entries) so memory
 * stays bounded even during long-running sessions. Persistence to a JSON
 * file is supported via save/load.
 *
 * Usage:
 *   const attr = new CostAttribution({ maxRecords: 10000 });
 *   attr.record({ goalId: 'g1', taskId: 't1', workerType: 'coder',
 *                 model: 'mimo-v2.5-pro', inputTokens: 5000, outputTokens: 2000,
 *                 cost: 0.0027, duration: 1200 });
 *   const report = attr.getGoalCost('g1');
 *   console.log(report.totalCost);   // 0.0027
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_PRICING as _DEFAULT_PRICING,
  DEFAULT_MAX_RECORDS as _DEFAULT_MAX_RECORDS,
  DEFAULT_TREND_PERIODS as _DEFAULT_TREND_PERIODS,
  roundCost as _roundCost,
  calculateCost as _calculateCost,
  getGoalCostData as _getGoalCostData,
  getTaskCostData as _getTaskCostData,
  getTotalCostData as _getTotalCostData,
  _getCostByWorker,
  _getCostByModel,
  getCostTrendData as _getCostTrendData,
  getTopExpensiveData as _getTopExpensiveData,
  getProjectionData as _getProjectionData,
  getStatusData as _getStatusData,
} from './helpers.js';

// ── CostAttribution class ─────────────────────────────────────────────────

/**
 * Tracks actual token and cost consumption per goal, task, and worker,
 * providing detailed cost reports and projections.
 *
 * @example
 * ```js
 * const attr = new CostAttribution();
 * attr.record({ goalId: 'g1', taskId: 't1', workerType: 'coder',
 *               model: 'mimo-v2.5-pro', inputTokens: 5000, outputTokens: 2000,
 *               cost: 0.0027, duration: 1200 });
 * const status = attr.getStatus();
 * ```
 */
export class CostAttribution {
  /** @type {import('./helpers.js').CostRecord[]} ring buffer of records */
  #records;

  /** @type {number} maximum records before ring-buffer eviction */
  #maxRecords;

  /** @type {number} monotonically increasing ID counter */
  #idCounter;

  /** @type {string|undefined} optional file path for JSON persistence */
  #persistencePath;

  /** @type {Record<string, import('./helpers.js').ModelPricing>} per-model pricing for cost calculation */
  #pricing;

  /**
   * Create a new CostAttribution tracker.
   *
   * @param {object} [opts]
   * @param {number} [opts.maxRecords=10000] — max records in the ring buffer
   * @param {string} [opts.persistencePath]  — optional JSON file path for save/load
   * @param {Record<string, import('./helpers.js').ModelPricing>} [opts.pricing] — optional pricing overrides
   */
  constructor(opts = {}) {
    this.#maxRecords = Math.max(1, Math.floor(opts.maxRecords ?? _DEFAULT_MAX_RECORDS));
    this.#persistencePath = opts.persistencePath;
    this.#records = [];
    this.#idCounter = 0;

    this.#pricing = { ..._DEFAULT_PRICING };
    if (opts.pricing && typeof opts.pricing === 'object') {
      for (const [name, rates] of Object.entries(opts.pricing)) {
        this.#pricing[name] = { input: rates.input, output: rates.output };
      }
    }
  }

  // ── Recording ─────────────────────────────────────────────────────────

  /**
   * Record actual usage for a task execution.
   *
   * If `cost` is not provided it is calculated from the model pricing and
   * token counts. When the ring buffer is full the oldest record is evicted.
   *
   * @param {object} record
   * @param {string} record.goalId       — owning goal identifier
   * @param {string} record.taskId       — task identifier
   * @param {string} record.workerType   — worker type (coder, tester, reviewer, …)
   * @param {string} record.model        — model identifier
   * @param {number} record.inputTokens  — input tokens consumed
   * @param {number} record.outputTokens — output tokens consumed
   * @param {number} [record.cost]       — explicit cost in USD (auto-calculated if omitted)
   * @param {number} [record.duration]   — wall-clock duration in ms
   * @param {number} [record.timestamp]  — epoch ms (defaults to now)
   * @returns {string} unique record identifier
   */
  record(record) {
    const id = `cr_${++this.#idCounter}_${Date.now().toString(36)}`;
    const cost = record.cost ?? _calculateCost(this.#pricing, record.model, record.inputTokens, record.outputTokens);

    /** @type {import('./helpers.js').CostRecord} */
    const entry = {
      id,
      goalId: record.goalId ?? 'unknown',
      taskId: record.taskId ?? 'unknown',
      workerType: record.workerType ?? 'unknown',
      model: record.model ?? 'default',
      inputTokens: record.inputTokens ?? 0,
      outputTokens: record.outputTokens ?? 0,
      cost,
      duration: record.duration ?? 0,
      timestamp: record.timestamp ?? Date.now(),
    };

    if (this.#records.length >= this.#maxRecords) {
      this.#records.shift();
    }

    this.#records.push(entry);
    return id;
  }

  // ── Goal-level queries ────────────────────────────────────────────────

  /**
   * Get cost breakdown for a specific goal.
   * @param {string} goalId — goal identifier
   * @returns {object}
   */
  getGoalCost(goalId) {
    return _getGoalCostData(this.#records, goalId);
  }

  // ── Task-level queries ────────────────────────────────────────────────

  /**
   * Get cost breakdown for a specific task.
   * @param {string} taskId — task identifier
   * @returns {object}
   */
  getTaskCost(taskId) {
    return _getTaskCostData(this.#records, taskId);
  }

  // ── Aggregate queries ─────────────────────────────────────────────────

  /**
   * Get total cost across all recorded goals and tasks.
   * @returns {object}
   */
  getTotalCost() {
    return _getTotalCostData(this.#records);
  }

  /**
   * Get cost breakdown by worker type.
   * @returns {Record<string, { cost: number, tokens: number, count: number }>}
   */
  getCostByWorker() {
    return _getCostByWorker(this.#records);
  }

  /**
   * Get cost breakdown by model.
   * @returns {Record<string, { cost: number, tokens: number, count: number }>}
   */
  getCostByModel() {
    return _getCostByModel(this.#records);
  }

  // ── Trend analysis ────────────────────────────────────────────────────

  /**
   * Get cost trend over time, bucketed by the specified granularity.
   * @param {object} [opts]
   * @param {'hour'|'day'} [opts.granularity='hour'] — bucket size
   * @param {number}       [opts.periods=24]         — number of periods to return
   * @returns {import('./helpers.js').CostBucket[]}
   */
  getCostTrend(opts = {}) {
    return _getCostTrendData(this.#records, opts);
  }

  // ── Top-N queries ─────────────────────────────────────────────────────

  /**
   * Get the top N most expensive goals or tasks.
   * @param {object} [opts]
   * @param {number}             [opts.limit=10] — max number of results
   * @param {'goal'|'task'}      [opts.type='goal'] — aggregate by goal or task
   * @returns {Array<{ id: string, cost: number, tokens: number, type: string }>}
   */
  getTopExpensive(opts = {}) {
    return _getTopExpensiveData(this.#records, opts);
  }

  // ── Projection ────────────────────────────────────────────────────────

  /**
   * Get cost projection based on recent usage.
   * @param {object} [opts]
   * @param {number} [opts.sampleSize=100] — number of recent records to sample
   * @returns {{ hourlyRate: number, dailyRate: number, monthlyProjection: number }}
   */
  getProjection(opts = {}) {
    return _getProjectionData(this.#records, opts);
  }

  // ── Dashboard status ──────────────────────────────────────────────────

  /**
   * Get cost summary for dashboard display.
   * @returns {object}
   */
  getStatus() {
    const total = this.getTotalCost();
    return _getStatusData(this.#records, total, _DEFAULT_TREND_PERIODS);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Clear all recorded data.
   */
  clear() {
    this.#records = [];
    this.#idCounter = 0;
  }

  // ── Persistence ───────────────────────────────────────────────────────

  /**
   * Save all records to the configured persistence path as JSON.
   * Throws if no `persistencePath` was configured in the constructor.
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.#persistencePath) {
      throw new Error('CostAttribution: no persistencePath configured');
    }

    const dir = path.dirname(this.#persistencePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const payload = JSON.stringify({
      version: 1,
      maxRecords: this.#maxRecords,
      idCounter: this.#idCounter,
      records: this.#records,
    }, null, 2);

    await fs.promises.writeFile(this.#persistencePath, payload, 'utf8');
  }

  /**
   * Load records from the configured persistence path.
   * If the file does not exist the method silently returns (the tracker
   * starts empty). Records are capped at `maxRecords` on load.
   * @returns {Promise<void>}
   */
  async load() {
    if (!this.#persistencePath) {
      throw new Error('CostAttribution: no persistencePath configured');
    }

    try {
      const raw = await fs.promises.readFile(this.#persistencePath, 'utf8');
      const data = JSON.parse(raw);

      this.#idCounter = data.idCounter ?? 0;
      this.#records = Array.isArray(data.records) ? data.records : [];

      if (this.#records.length > this.#maxRecords) {
        this.#records = this.#records.slice(-this.#maxRecords);
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
