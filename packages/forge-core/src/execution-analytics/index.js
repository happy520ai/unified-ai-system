/**
 * Execution Analytics Module — deep execution analytics with timeline,
 * bottleneck detection, and performance trends.
 *
 * Records task and goal execution events, then provides analytical views
 * including:
 *   - Execution timelines with parallel/sequential detection
 *   - Bottleneck detection across worker types, retries, queues, and tokens
 *   - Performance trend analysis with linear regression
 *   - Period-over-period comparison
 *   - Per-worker performance breakdowns
 *   - Comprehensive performance reports with recommendations
 *
 * Pure Node.js, no external dependencies.
 *
 * @module execution-analytics
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  mean,
  buildTimeline,
  detectBottlenecks as _detectBottlenecks,
  computeTrends,
} from './helpers.js';
import {
  comparePeriods as _comparePeriods,
  getWorkerPerformance as _getWorkerPerformance,
  generateRecommendations,
  computeStatus,
} from './helpers-analysis.js';

// ── ExecutionAnalytics ───────────────────────────────────────────────────────

/**
 * Deep execution analytics engine.
 *
 * Records task execution and goal lifecycle events, then provides timeline
 * views, bottleneck detection, trend analysis, and performance reports.
 *
 * @example
 *   const analytics = new ExecutionAnalytics({ maxRecords: 2000 });
 *   analytics.recordTask({ goalId: 'g1', taskId: 't1', workerType: 'coder',
 *     status: 'completed', durationMs: 5000, tokensUsed: 1200 });
 *   const report = analytics.generateReport();
 */
export class ExecutionAnalytics {
  /** @type {Array<object>} Ring buffer of task events */
  #taskEvents = [];

  /** @type {Array<object>} Ring buffer of goal events */
  #goalEvents = [];

  /** @type {number} Maximum events to retain in each ring buffer */
  #maxRecords;

  /** @type {number} Default window size for trend calculations */
  #trendWindow;

  /** @type {string|null} Optional persistence path */
  #persistencePath;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxRecords=1000] — max events per ring buffer
   * @param {number} [opts.trendWindow=50] — default trend window size
   * @param {string|null} [opts.persistencePath=null] — auto-persist path
   */
  constructor(opts = {}) {
    this.#maxRecords = opts.maxRecords ?? 1000;
    this.#trendWindow = opts.trendWindow ?? 50;
    this.#persistencePath = opts.persistencePath ?? null;
  }

  // ── Recording ───────────────────────────────────────────────────────────

  /**
   * Record a task execution event.
   *
   * @param {object} event
   * @param {string} event.goalId — owning goal identifier
   * @param {string} event.taskId — task identifier
   * @param {string} event.workerType — worker type (coder, tester, reviewer, etc.)
   * @param {'started'|'completed'|'failed'} event.status — event status
   * @param {number} [event.durationMs] — execution duration in ms
   * @param {number} [event.tokensUsed] — LLM tokens consumed
   * @param {number} [event.cost] — monetary cost of this task
   * @param {number} [event.filesModified] — files changed by this task
   * @param {number} [event.retryCount] — retries before completion
   * @param {number} [event.contextSize] — context size in tokens
   * @param {number} [event.queueWaitMs] — time spent waiting in queue
   */
  recordTask(event) {
    const record = {
      timestamp: Date.now(),
      type: 'task',
      goalId: event.goalId,
      taskId: event.taskId,
      workerType: event.workerType ?? 'unknown',
      status: event.status ?? 'started',
      durationMs: event.durationMs ?? 0,
      tokensUsed: event.tokensUsed ?? 0,
      cost: event.cost ?? 0,
      filesModified: event.filesModified ?? 0,
      retryCount: event.retryCount ?? 0,
      contextSize: event.contextSize ?? 0,
      queueWaitMs: event.queueWaitMs ?? 0,
    };

    this.#taskEvents.push(record);
    if (this.#taskEvents.length > this.#maxRecords) {
      this.#taskEvents = this.#taskEvents.slice(-this.#maxRecords);
    }
  }

  /**
   * Record a goal lifecycle event.
   *
   * @param {object} event
   * @param {string} event.goalId — goal identifier
   * @param {'compiled'|'running'|'completed'|'failed'|'budget_exceeded'} event.status
   * @param {number} [event.taskCount] — number of tasks in the goal
   * @param {number} [event.compileTimeMs] — goal compilation time
   * @param {number} [event.executionTimeMs] — total execution time
   * @param {number} [event.totalTokens] — aggregate tokens consumed
   * @param {number} [event.totalCost] — aggregate cost
   */
  recordGoal(event) {
    const record = {
      timestamp: Date.now(),
      type: 'goal',
      goalId: event.goalId,
      status: event.status ?? 'compiled',
      taskCount: event.taskCount ?? 0,
      compileTimeMs: event.compileTimeMs ?? 0,
      executionTimeMs: event.executionTimeMs ?? 0,
      totalTokens: event.totalTokens ?? 0,
      totalCost: event.totalCost ?? 0,
    };

    this.#goalEvents.push(record);
    if (this.#goalEvents.length > this.#maxRecords) {
      this.#goalEvents = this.#goalEvents.slice(-this.#maxRecords);
    }
  }

  // ── Timeline ────────────────────────────────────────────────────────────

  /**
   * Get the execution timeline for a specific goal.
   *
   * Returns events sorted by timestamp with parallel-execution detection.
   * Two tasks are considered parallel when their time ranges overlap.
   *
   * @param {string} goalId
   * @returns {Array<{ timestamp: number, type: string, taskId: string,
   *   workerType: string, duration: number, status: string, parallel: boolean }>}
   */
  getTimeline(goalId) {
    const taskEvts = this.#taskEvents.filter(e => e.goalId === goalId);
    const goalEvts = this.#goalEvents.filter(e => e.goalId === goalId);
    return buildTimeline(taskEvts, goalEvts);
  }

  // ── Bottleneck Detection ────────────────────────────────────────────────

  /**
   * Detect bottlenecks across recent task executions.
   *
   * Analyzes the most recent completed/failed tasks and identifies:
   *   - Slow worker types (highest average duration)
   *   - High-retry task types (most retries on average)
   *   - Long queue waits (highest average queueWaitMs)
   *   - High failure rates by worker type
   *   - Token-heavy operations (highest average tokensUsed)
   *
   * @param {object} [opts]
   * @param {number} [opts.lookback=50] — number of recent events to analyze
   * @param {number} [opts.minOccurrences=3] — minimum events per group to report
   * @returns {Array<{ type: string, target: string, severity: 'low'|'medium'|'high'|'critical',
   *   metric: object, suggestion: string }>}
   */
  detectBottlenecks(opts = {}) {
    const lookback = opts.lookback ?? 50;
    const minOcc = opts.minOccurrences ?? 3;

    const recent = this.#taskEvents
      .filter(e => e.status === 'completed' || e.status === 'failed')
      .slice(-lookback);

    return _detectBottlenecks(recent, minOcc);
  }

  // ── Trends ──────────────────────────────────────────────────────────────

  /**
   * Get performance trends over recent executions using linear regression.
   *
   * @param {object} [opts]
   * @param {number} [opts.window] — number of recent events to analyze
   * @param {string[]} [opts.metrics] — which metrics to compute
   * @returns {{ duration: object, successRate: object, costPerGoal: object, tokensPerTask: object }}
   */
  getTrends(opts = {}) {
    const window = opts.window ?? this.#trendWindow;

    const recent = this.#taskEvents
      .filter(e => e.status === 'completed' || e.status === 'failed')
      .slice(-window);

    const goalCompletions = this.#goalEvents
      .filter(e => e.status === 'completed' || e.status === 'failed');

    return computeTrends(recent, goalCompletions);
  }

  // ── Period Comparison ───────────────────────────────────────────────────

  /**
   * Compare performance metrics between two time periods.
   *
   * @param {{ start: number, end: number }} periodA
   * @param {{ start: number, end: number }} periodB
   * @returns {{ duration: object, successRate: object, cost: object,
   *   throughput: object, winner: 'A'|'B'|'equal' }}
   */
  comparePeriods(periodA, periodB) {
    const filterPeriod = (events, period) =>
      events.filter(e => e.timestamp >= period.start && e.timestamp <= period.end);

    const tasksA = filterPeriod(this.#taskEvents, periodA).filter(e => e.status !== 'started');
    const tasksB = filterPeriod(this.#taskEvents, periodB).filter(e => e.status !== 'started');
    const goalsA = filterPeriod(this.#goalEvents, periodA);
    const goalsB = filterPeriod(this.#goalEvents, periodB);

    return _comparePeriods(tasksA, tasksB, goalsA, goalsB, periodA, periodB);
  }

  // ── Worker Performance ──────────────────────────────────────────────────

  /**
   * Get per-worker-type performance breakdown.
   *
   * @returns {Map<string, { count: number, avgDuration: number, successRate: number,
   *   avgTokens: number, avgCost: number, avgRetries: number }>}
   */
  getWorkerPerformance() {
    const completed = this.#taskEvents.filter(
      e => e.status === 'completed' || e.status === 'failed'
    );
    return _getWorkerPerformance(completed);
  }

  // ── Report Generation ───────────────────────────────────────────────────

  /**
   * Generate a comprehensive performance report.
   *
   * @param {object} [opts]
   * @param {number} [opts.lookback] — events to include in analysis
   * @returns {{ summary: object, metrics: object, bottlenecks: Array,
   *   trends: object, recommendations: string[] }}
   */
  generateReport(opts = {}) {
    const lookback = opts.lookback ?? this.#maxRecords;

    // Summary stats
    const allTasks = this.#taskEvents.filter(e => e.status !== 'started').slice(-lookback);
    const allGoals = this.#goalEvents.slice(-lookback);
    const completedGoals = allGoals.filter(g => g.status === 'completed');
    const failedGoals = allGoals.filter(g => g.status === 'failed');
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    const failedTasks = allTasks.filter(t => t.status === 'failed');

    const totalTokens = allTasks.reduce((s, t) => s + t.tokensUsed, 0);
    const totalCost = allTasks.reduce((s, t) => s + t.cost, 0);
    const totalDuration = allTasks.reduce((s, t) => s + t.durationMs, 0);

    const summary = {
      goalsCompleted: completedGoals.length,
      goalsFailed: failedGoals.length,
      tasksCompleted: completedTasks.length,
      tasksFailed: failedTasks.length,
      totalTokens,
      totalCost: +totalCost.toFixed(4),
      avgTaskDurationMs: Math.round(mean(allTasks.map(t => t.durationMs).filter(d => d > 0))),
      overallSuccessRate: allTasks.length > 0
        ? +((completedTasks.length / allTasks.length) * 100).toFixed(1)
        : 0,
      totalExecutionTimeMs: totalDuration,
    };

    // Metrics breakdown
    const metrics = {
      costPerGoal: completedGoals.length > 0
        ? +(totalCost / completedGoals.length).toFixed(4)
        : 0,
      tokensPerTask: allTasks.length > 0
        ? Math.round(totalTokens / allTasks.length)
        : 0,
      avgRetriesPerTask: +mean(allTasks.map(t => t.retryCount)).toFixed(2),
      avgQueueWaitMs: Math.round(mean(allTasks.map(t => t.queueWaitMs).filter(w => w > 0))),
      uniqueWorkerTypes: [...new Set(allTasks.map(t => t.workerType))].length,
    };

    // Bottlenecks
    const bottlenecks = this.detectBottlenecks({ lookback });

    // Trends
    const trends = this.getTrends({ window: lookback });

    // Recommendations
    const recommendations = generateRecommendations(summary, metrics, trends, bottlenecks);

    return { summary, metrics, bottlenecks, trends, recommendations };
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  /**
   * Persist analytics data to disk as JSON.
   *
   * @param {string} [path] — file path (defaults to constructor persistencePath)
   * @returns {Promise<void>}
   */
  async persist(path) {
    const target = path ?? this.#persistencePath;
    if (!target) throw new Error('No persistence path provided');

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      taskEvents: this.#taskEvents,
      goalEvents: this.#goalEvents,
    };

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Load analytics data from a previously persisted JSON file.
   *
   * @param {string} [path] — file path (defaults to constructor persistencePath)
   * @returns {Promise<void>}
   */
  async load(path) {
    const target = path ?? this.#persistencePath;
    if (!target) throw new Error('No persistence path provided');

    const raw = await readFile(target, 'utf8');
    const data = JSON.parse(raw);

    if (data.version !== 1) {
      throw new Error(`Unsupported analytics data version: ${data.version}`);
    }

    this.#taskEvents = Array.isArray(data.taskEvents) ? data.taskEvents : [];
    this.#goalEvents = Array.isArray(data.goalEvents) ? data.goalEvents : [];

    // Enforce max records after load
    if (this.#taskEvents.length > this.#maxRecords) {
      this.#taskEvents = this.#taskEvents.slice(-this.#maxRecords);
    }
    if (this.#goalEvents.length > this.#maxRecords) {
      this.#goalEvents = this.#goalEvents.slice(-this.#maxRecords);
    }
  }

  // ── Status ──────────────────────────────────────────────────────────────

  /**
   * Get current analytics status summary.
   *
   * @returns {{ recordCount: number, goalsTracked: number,
   *   avgSuccessRate: number, lastActivity: number|null }}
   */
  getStatus() {
    return computeStatus(this.#taskEvents, this.#goalEvents);
  }
}
