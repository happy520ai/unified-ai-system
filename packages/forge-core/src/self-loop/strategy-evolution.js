/**
 * StrategyEvolution — learns from execution outcomes to improve future strategy selection.
 *
 * This is the "自进化" (self-evolution) component of the self-loop engine.
 *
 * How it works:
 *   1. After each task outcome, call `recordOutcome()` with task type, strategy used, and result.
 *   2. The engine maintains a success rate for each (taskType, strategy) pair.
 *   3. When selecting a strategy, it uses weighted random selection biased toward
 *      higher-performing strategies, with exploration for less-tried options.
 *   4. Periodically, `evolve()` analyzes patterns and generates prompt adjustments
 *      that encode lessons learned.
 *
 * Strategies:
 *   - targeted_fix:  Focus on the specific failing files/checks
 *   - full_rewrite:  Rewrite the entire file from scratch
 *   - rollback_retry: Rollback changes and retry with a fresh approach
 *   - debugger:      Escalate to debugger worker for deep analysis
 *   - test_first:    Write tests first, then implementation
 *
 * Usage:
 *   const evolution = new StrategyEvolution();
 *   evolution.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true });
 *   const strategy = evolution.selectStrategy('implement', 'targeted_fix');
 *   const insights = evolution.evolve();
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export class StrategyEvolution {
  /**
   * Strategy performance tracking: Map<`${taskType}:${strategy}`, { success, failure, totalCost }>
   * @type {Map<string, { success: number, failure: number, avgLoops: number, lastUsed: number }>}
   */
  #stats = new Map();

  /**
   * Learned prompt adjustments: Map<taskType, string[]>
   * Accumulated insights from evolution analysis.
   * @type {Map<string, string[]>}
   */
  #insights = new Map();

  /**
   * Recent outcome history for pattern analysis (bounded ring buffer).
   * @type {Array<{ taskType: string, strategy: string, loopCount: number, success: boolean, timestamp: number }>}
   */
  #history = [];
  #maxHistory = 200;

  /** Available strategies in priority order */
  static STRATEGIES = [
    'targeted_fix',
    'full_rewrite',
    'rollback_retry',
    'debugger',
    'test_first',
  ];

  /** Exploration rate: probability of trying a less-used strategy */
  #explorationRate;

  /** File path for JSON persistence (null if disabled) */
  #persistencePath;

  /**
   * @param {object} [opts]
   * @param {number} [opts.explorationRate=0.15] — probability of exploring a new strategy
   * @param {number} [opts.maxHistory=200] — max outcome records to keep
   * @param {string|null} [opts.persistencePath=null] — file path for JSON persistence
   */
  constructor(opts = {}) {
    this.#explorationRate = opts.explorationRate ?? 0.15;
    this.#maxHistory = opts.maxHistory ?? 200;
    this.#persistencePath = opts.persistencePath ?? null;
  }

  // ── Record & Track ─────────────────────────────────────────────────────

  /**
   * Record the outcome of a task execution attempt.
   *
   * @param {object} outcome
   * @param {string} outcome.taskType — 'implement', 'test', 'refactor', 'debug'
   * @param {string} outcome.strategy — strategy that was used
   * @param {number} [outcome.loopCount=0] — how many loops it took
   * @param {boolean} outcome.success — whether it ultimately succeeded
   * @param {string} [outcome.goalId]
   * @param {string} [outcome.taskId]
   */
  recordOutcome({ taskType, strategy, loopCount = 0, success, goalId, taskId }) {
    const key = `${taskType}:${strategy}`;
    const existing = this.#stats.get(key) || { success: 0, failure: 0, avgLoops: 0, lastUsed: 0 };

    const total = existing.success + existing.failure;
    existing.avgLoops = total > 0
      ? (existing.avgLoops * total + loopCount) / (total + 1)
      : loopCount;

    if (success) existing.success++;
    else existing.failure++;
    existing.lastUsed = Date.now();

    this.#stats.set(key, existing);

    // Add to history ring buffer
    this.#history.push({
      taskType, strategy, loopCount, success,
      goalId, taskId,
      timestamp: Date.now(),
    });
    if (this.#history.length > this.#maxHistory) {
      this.#history.shift();
    }
  }

  // ── Strategy Selection ─────────────────────────────────────────────────

  /**
   * Select the best strategy for a task type, given the current (failed) strategy.
   *
   * Uses a weighted selection:
   *   - 85% of the time: pick the strategy with the best success rate for this task type
   *   - 15% of the time: explore a less-used strategy (to discover better approaches)
   *
   * When the current strategy has failed, prefer strategies that are "more aggressive"
   * (further right in the STRATEGIES list).
   *
   * @param {string} taskType
   * @param {string} [currentStrategy] — the strategy that just failed
   * @returns {string} — selected strategy name
   */
  selectStrategy(taskType, currentStrategy) {
    const candidates = StrategyEvolution.STRATEGIES.filter(s => s !== currentStrategy);

    if (candidates.length === 0) return 'targeted_fix';

    // Exploration: randomly pick a less-used strategy
    if (Math.random() < this.#explorationRate) {
      // Prefer strategies with fewer attempts (explore the unknown)
      const withAttempts = candidates.map(s => {
        const key = `${taskType}:${s}`;
        const stats = this.#stats.get(key);
        return { strategy: s, attempts: stats ? stats.success + stats.failure : 0 };
      });
      withAttempts.sort((a, b) => a.attempts - b.attempts);
      // Pick from the least-tried half
      const topHalf = withAttempts.slice(0, Math.max(1, Math.ceil(withAttempts.length / 2)));
      return topHalf[Math.floor(Math.random() * topHalf.length)].strategy;
    }

    // Exploitation: pick the best-performing strategy
    let bestStrategy = candidates[0];
    let bestScore = -1;

    for (const strategy of candidates) {
      const key = `${taskType}:${strategy}`;
      const stats = this.#stats.get(key);

      if (!stats) {
        // Never tried — give it a baseline score (encourage exploration)
        const score = 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestStrategy = strategy;
        }
        continue;
      }

      const total = stats.success + stats.failure;
      const successRate = total > 0 ? stats.success / total : 0.5;
      // Penalize strategies that take many loops on average
      const loopPenalty = Math.min(stats.avgLoops * 0.1, 0.3);
      const score = successRate - loopPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }

    return bestStrategy;
  }

  // ── Evolution / Learning ───────────────────────────────────────────────

  /**
   * Analyze accumulated outcomes and generate prompt insights.
   * Call this periodically (e.g., after every goal completion) to evolve.
   *
   * @returns {{ insights: Map<string, string[]>, summary: object }}
   */
  evolve() {
    const summary = {
      totalOutcomes: this.#history.length,
      overallSuccessRate: 0,
      bestStrategies: {},
      patterns: [],
    };

    if (this.#history.length < 5) {
      // Fire-and-forget persistence (won't affect synchronous return)
      this.save().catch(() => {});
      return { insights: this.#insights, summary };
    }

    // Calculate overall success rate
    const successes = this.#history.filter(h => h.success).length;
    summary.overallSuccessRate = successes / this.#history.length;

    // Find best strategy per task type
    const taskTypes = [...new Set(this.#history.map(h => h.taskType))];
    for (const taskType of taskTypes) {
      let bestStrategy = null;
      let bestRate = -1;

      for (const strategy of StrategyEvolution.STRATEGIES) {
        const key = `${taskType}:${strategy}`;
        const stats = this.#stats.get(key);
        if (!stats) continue;
        const total = stats.success + stats.failure;
        if (total < 2) continue; // need at least 2 attempts
        const rate = stats.success / total;
        if (rate > bestRate) {
          bestRate = rate;
          bestStrategy = strategy;
        }
      }

      if (bestStrategy) {
        summary.bestStrategies[taskType] = {
          strategy: bestStrategy,
          successRate: bestRate,
        };
      }
    }

    // Pattern detection: find recurring failure modes
    const recentFailures = this.#history.filter(h => !h.success).slice(-20);
    if (recentFailures.length > 3) {
      // Check if a specific strategy consistently fails for a task type
      const failureGroups = new Map();
      for (const f of recentFailures) {
        const key = `${f.taskType}:${f.strategy}`;
        failureGroups.set(key, (failureGroups.get(key) || 0) + 1);
      }

      for (const [key, count] of failureGroups) {
        if (count >= 3) {
          const [taskType, strategy] = key.split(':');
          summary.patterns.push({
            type: 'consistent_failure',
            taskType,
            strategy,
            failureCount: count,
            insight: `Strategy "${strategy}" consistently fails for "${taskType}" tasks (${count} times). Consider avoiding it.`,
          });

          // Add to learned insights
          if (!this.#insights.has(taskType)) {
            this.#insights.set(taskType, []);
          }
          const existing = this.#insights.get(taskType);
          const insight = `AVOID strategy "${strategy}" — it has failed ${count} times for ${taskType} tasks.`;
          if (!existing.includes(insight)) {
            existing.push(insight);
          }
        }
      }
    }

    // Detect if loop counts are trending upward (tasks getting harder)
    const recentLoops = this.#history.slice(-10).map(h => h.loopCount);
    const olderLoops = this.#history.slice(-30, -10).map(h => h.loopCount);
    if (recentLoops.length > 3 && olderLoops.length > 3) {
      const recentAvg = recentLoops.reduce((a, b) => a + b, 0) / recentLoops.length;
      const olderAvg = olderLoops.reduce((a, b) => a + b, 0) / olderLoops.length;
      if (recentAvg > olderAvg + 0.5) {
        summary.patterns.push({
          type: 'increasing_complexity',
          recentAvgLoops: recentAvg,
          olderAvgLoops: olderAvg,
          insight: 'Tasks are requiring more loops to succeed — complexity may be increasing.',
        });
      }
    }

    // Fire-and-forget persistence (won't affect synchronous return)
    this.save().catch(() => {});
    return { insights: this.#insights, summary };
  }

  /**
   * Get accumulated insights for a specific task type.
   * These can be injected into prompts as learned constraints.
   *
   * @param {string} taskType
   * @returns {string[]}
   */
  getInsights(taskType) {
    return this.#insights.get(taskType) || [];
  }

  /**
   * Get full performance statistics.
   *
   * @returns {object}
   */
  getStats() {
    const result = {};
    for (const [key, stats] of this.#stats) {
      const [taskType, strategy] = key.split(':');
      if (!result[taskType]) result[taskType] = {};
      const total = stats.success + stats.failure;
      result[taskType][strategy] = {
        success: stats.success,
        failure: stats.failure,
        total,
        successRate: total > 0 ? (stats.success / total).toFixed(2) : 'N/A',
        avgLoops: stats.avgLoops.toFixed(1),
        lastUsed: stats.lastUsed,
      };
    }
    return result;
  }

  /**
   * Reset all learned data (for testing or fresh start).
   */
  reset() {
    this.#stats.clear();
    this.#insights.clear();
    this.#history.length = 0;
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  /**
   * Load persisted state from the JSON file at `#persistencePath`.
   * If the path is not set, or the file is missing / corrupt, the current
   * (empty) state is kept and the method returns silently.
   *
   * @returns {Promise<{ loaded: boolean, entries: number }>}
   */
  async load() {
    if (!this.#persistencePath) {
      return { loaded: false, entries: 0 };
    }

    try {
      const raw = await readFile(this.#persistencePath, 'utf8');
      const data = JSON.parse(raw);

      // Restore stats Map
      if (data.stats && typeof data.stats === 'object') {
        this.#stats.clear();
        for (const [key, value] of Object.entries(data.stats)) {
          this.#stats.set(key, {
            success: value.success ?? 0,
            failure: value.failure ?? 0,
            avgLoops: value.avgLoops ?? 0,
            lastUsed: value.lastUsed ?? 0,
          });
        }
      }

      // Restore insights Map
      if (data.insights && typeof data.insights === 'object') {
        this.#insights.clear();
        for (const [taskType, insights] of Object.entries(data.insights)) {
          this.#insights.set(taskType, Array.isArray(insights) ? insights : []);
        }
      }

      // Restore history array
      if (Array.isArray(data.history)) {
        this.#history.length = 0;
        // Respect maxHistory — only keep the most recent entries
        const trimmed = data.history.slice(-this.#maxHistory);
        for (const entry of trimmed) {
          this.#history.push(entry);
        }
      }

      const entries = this.#stats.size + this.#insights.size + this.#history.length;
      return { loaded: true, entries };
    } catch {
      // File missing, unreadable, or corrupt JSON — silently continue with empty state
      return { loaded: false, entries: 0 };
    }
  }

  /**
   * Persist the current state to the JSON file at `#persistencePath`.
   * Parent directories are created automatically.
   *
   * @returns {Promise<{ saved: boolean, path: string }>}
   */
  async save() {
    if (!this.#persistencePath) {
      return { saved: false, path: null };
    }

    try {
      // Ensure parent directory exists
      await mkdir(dirname(this.#persistencePath), { recursive: true });

      const payload = {
        stats: Object.fromEntries(this.#stats),
        insights: Object.fromEntries(this.#insights),
        history: this.#history,
        savedAt: new Date().toISOString(),
      };

      await writeFile(this.#persistencePath, JSON.stringify(payload, null, 2), 'utf8');
      return { saved: true, path: this.#persistencePath };
    } catch {
      return { saved: false, path: this.#persistencePath };
    }
  }

  /**
   * Run `evolve()` then persist the result.
   * Equivalent to calling `evolve()` followed by `save()`, but provided as a
   * single async convenience so callers don't need to manage the two steps.
   *
   * The synchronous `evolve()` method is left untouched so existing callers
   * are not affected.
   *
   * @returns {Promise<{ insights: Map<string, string[]>, summary: object }>}
   */
  async evolveAndSave() {
    const result = this.evolve();
    await this.save();
    return result;
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /**
   * The configured persistence file path, or `null` if persistence is disabled.
   * @returns {string|null}
   */
  get persistencePath() {
    return this.#persistencePath;
  }
}
