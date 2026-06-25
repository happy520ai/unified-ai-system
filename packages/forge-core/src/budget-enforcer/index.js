/**
 * Budget Enforcer — real-time budget enforcement with alerts and throttling.
 *
 * Tracks token, cost, and time usage per goal and across a global budget.
 * Emits alerts at configurable thresholds and can block new work when the
 * budget is exhausted.
 *
 * Usage:
 *   import { BudgetEnforcer } from './budget-enforcer/index.js';
 *
 *   const enforcer = new BudgetEnforcer({
 *     globalBudget: { maxTokens: 1_000_000, maxCost: 50.0, maxMinutes: 480 },
 *     alertThresholds: [0.5, 0.75, 0.9, 1.0],
 *   });
 *
 *   enforcer.registerGoal('goal-1', { maxTokens: 200_000, maxCost: 10.0 });
 *   const result = enforcer.recordUsage('goal-1', { inputTokens: 1200, outputTokens: 800 });
 *   if (result.status === 'exceeded') { enforcer.canProceed('goal-1', 0); }
 */

// ── Type definitions ──────────────────────────────────────────────────────

/**
 * @typedef {object} BudgetLimits
 * @property {number} [maxTokens]  — maximum total tokens
 * @property {number} [maxCost]    — maximum cost in USD
 * @property {number} [maxMinutes] — maximum wall-clock minutes
 */

/**
 * @typedef {object} UsageInput
 * @property {number} inputTokens  — input tokens consumed
 * @property {number} outputTokens — output tokens consumed
 * @property {number} [cost]       — cost in USD (computed from tokens if omitted)
 * @property {number} [durationMs] — wall-clock duration in milliseconds
 */

/**
 * @typedef {object} Alert
 * @property {string} goalId      — goal identifier (or '__global__')
 * @property {string} level       — 'warning' | 'critical' | 'exceeded'
 * @property {string} dimension   — 'tokens' | 'cost' | 'minutes'
 * @property {number} threshold   — the threshold ratio that was crossed
 * @property {number} current     — current usage value
 * @property {number} limit       — budget limit value
 * @property {number} timestamp   — epoch ms
 */

/**
 * @typedef {object} RecordResult
 * @property {'ok'|'warning'|'critical'|'exceeded'} status
 * @property {object} usage       — current usage totals
 * @property {number} usage.tokens
 * @property {number} usage.cost
 * @property {number} usage.minutes
 * @property {object} remaining   — remaining budget
 * @property {number} remaining.tokens
 * @property {number} remaining.cost
 * @property {number} remaining.minutes
 * @property {Alert[]} alerts     — newly triggered alerts
 */

/**
 * @typedef {object} ProceedCheck
 * @property {boolean} allowed    — whether the goal may proceed
 * @property {string}  [reason]   — human-readable denial reason
 * @property {object}  remaining  — remaining budget
 * @property {number}  estimated  — estimated cost for the proposed operation
 */

/**
 * @typedef {object} SpendingReport
 * @property {number} totalCost
 * @property {number} totalTokens
 * @property {number} goalsCompleted
 * @property {number} goalsFailed
 * @property {Record<string, number>} costByGoalType
 * @property {'increasing'|'stable'|'decreasing'} trend
 * @property {Array<{ goalId: string, cost: number, tokens: number }>} topExpensiveGoals
 */

// ── Imported helpers ──────────────────────────────────────────────────────

import {
  DEFAULT_ALERT_THRESHOLDS, DEFAULT_THROTTLE_RATIO, DEFAULT_GLOBAL_BUDGET,
  checkThresholds, suggestBudget as _suggestBudget, getSpendingReport as _getSpendingReport,
} from './budgetReports.js';

// ── BudgetEnforcer class ──────────────────────────────────────────────────

export class BudgetEnforcer {
  /** @type {BudgetLimits} */ #globalBudget;
  /** @type {number[]} */ #alertThresholds;
  /** @type {number} */ #throttleAtRatio;

  /**
   * @type {Map<string, {
   *   budget: BudgetLimits,
   *   usage: { tokens: number, cost: number, minutes: number },
   *   startTime: number,
   *   status: string,
   *   alerts: Alert[],
   *   triggeredThresholds: Set<string>,
   *   history: Array<{ tokens: number, cost: number, durationMs: number, timestamp: number }>
   * }>}
   */
  #goals = new Map();

  /** @type {Alert[]} */ #globalAlerts = [];
  /** @type {Set<string>} */ #globalTriggered = new Set();

  /**
   * Create a new budget enforcer.
   *
   * @param {object}   [opts]
   * @param {BudgetLimits} [opts.globalBudget]       — global budget limits
   * @param {BudgetLimits} [opts.goalBudget]         — default per-goal budget template
   * @param {number[]} [opts.alertThresholds]        — threshold ratios that trigger alerts
   * @param {number}   [opts.throttleAtRatio=0.8]    — usage ratio above which new work is blocked
   */
  constructor(opts = {}) {
    this.#globalBudget = { ...DEFAULT_GLOBAL_BUDGET, ...(opts.globalBudget ?? {}) };
    this.#alertThresholds = opts.alertThresholds ?? DEFAULT_ALERT_THRESHOLDS;
    this.#throttleAtRatio = opts.throttleAtRatio ?? DEFAULT_THROTTLE_RATIO;
  }

  // ── Public API: registerGoal ──────────────────────────────────────────

  /**
   * Register a new goal with its own budget limits.
   *
   * @param {string} goalId      — unique goal identifier
   * @param {BudgetLimits} budget — per-goal budget limits
   */
  registerGoal(goalId, budget) {
    this.#goals.set(goalId, {
      budget: { ...budget },
      usage: { tokens: 0, cost: 0, minutes: 0 },
      startTime: Date.now(),
      status: 'active',
      alerts: [],
      triggeredThresholds: new Set(),
      history: [],
    });
  }

  // ── Public API: recordUsage ───────────────────────────────────────────

  /**
   * Record usage for a goal and check against thresholds.
   *
   * @param {string} goalId
   * @param {UsageInput} usage
   * @returns {RecordResult}
   */
  recordUsage(goalId, usage) {
    const goal = this.#goals.get(goalId);
    if (!goal) {
      throw new Error(`BudgetEnforcer: unknown goal "${goalId}"`);
    }

    const totalTokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
    const cost = usage.cost ?? 0;
    const durationMs = usage.durationMs ?? 0;

    goal.usage.tokens += totalTokens;
    goal.usage.cost += cost;
    goal.usage.minutes = (Date.now() - goal.startTime) / 60_000;

    goal.history.push({
      tokens: totalTokens,
      cost,
      durationMs,
      timestamp: Date.now(),
    });

    // Check goal-level thresholds.
    const newAlerts = checkThresholds(
      goal.usage,
      goal.budget,
      this.#alertThresholds,
      goal.triggeredThresholds,
      goalId,
    );
    goal.alerts.push(...newAlerts);

    // Check global thresholds.
    const globalUsage = this.#computeGlobalUsage();
    const globalAlerts = checkThresholds(
      globalUsage,
      this.#globalBudget,
      this.#alertThresholds,
      this.#globalTriggered,
      '__global__',
    );
    this.#globalAlerts.push(...globalAlerts);

    const allAlerts = [...newAlerts, ...globalAlerts];

    // Determine status.
    let status = 'ok';
    for (const alert of allAlerts) {
      if (alert.level === 'exceeded') { status = 'exceeded'; break; }
      if (alert.level === 'critical') { status = 'critical'; }
      if (alert.level === 'warning' && status === 'ok') { status = 'warning'; }
    }

    if (status === 'exceeded') {
      goal.status = 'exceeded';
    }

    const remaining = {
      tokens: goal.budget.maxTokens != null
        ? Math.max(0, goal.budget.maxTokens - goal.usage.tokens)
        : Infinity,
      cost: goal.budget.maxCost != null
        ? Math.max(0, goal.budget.maxCost - goal.usage.cost)
        : Infinity,
      minutes: goal.budget.maxMinutes != null
        ? Math.max(0, goal.budget.maxMinutes - goal.usage.minutes)
        : Infinity,
    };

    return { status, usage: { ...goal.usage }, remaining, alerts: allAlerts };
  }

  // ── Public API: canProceed ────────────────────────────────────────────

  /**
   * Check whether a goal can proceed given an estimated cost.
   *
   * @param {string} goalId
   * @param {number} estimatedCost — estimated USD cost for the next operation
   * @returns {ProceedCheck}
   */
  canProceed(goalId, estimatedCost) {
    const goal = this.#goals.get(goalId);
    if (!goal) {
      return { allowed: false, reason: `Unknown goal "${goalId}"`, remaining: {}, estimated: estimatedCost };
    }

    if (goal.status === 'exceeded') {
      return {
        allowed: false,
        reason: 'Goal budget exceeded',
        remaining: {
          tokens: goal.budget.maxTokens != null ? Math.max(0, goal.budget.maxTokens - goal.usage.tokens) : Infinity,
          cost: goal.budget.maxCost != null ? Math.max(0, goal.budget.maxCost - goal.usage.cost) : Infinity,
          minutes: goal.budget.maxMinutes != null ? Math.max(0, goal.budget.maxMinutes - goal.usage.minutes) : Infinity,
        },
        estimated: estimatedCost,
      };
    }

    const remaining = {
      tokens: goal.budget.maxTokens != null ? Math.max(0, goal.budget.maxTokens - goal.usage.tokens) : Infinity,
      cost: goal.budget.maxCost != null ? Math.max(0, goal.budget.maxCost - goal.usage.cost) : Infinity,
      minutes: goal.budget.maxMinutes != null ? Math.max(0, goal.budget.maxMinutes - goal.usage.minutes) : Infinity,
    };

    // Throttle check: block if usage ratio exceeds throttle threshold.
    if (goal.budget.maxCost != null) {
      const costRatio = goal.usage.cost / goal.budget.maxCost;
      if (costRatio >= this.#throttleAtRatio && estimatedCost > 0) {
        return {
          allowed: false,
          reason: `Usage ratio ${(costRatio * 100).toFixed(1)}% exceeds throttle threshold (${this.#throttleAtRatio * 100}%)`,
          remaining,
          estimated: estimatedCost,
        };
      }
    }

    // Absolute budget check.
    if (goal.budget.maxCost != null && goal.usage.cost + estimatedCost > goal.budget.maxCost) {
      return { allowed: false, reason: 'Estimated cost exceeds remaining budget', remaining, estimated: estimatedCost };
    }

    // Global check.
    const globalUsage = this.#computeGlobalUsage();
    if (this.#globalBudget.maxCost != null && globalUsage.cost + estimatedCost > this.#globalBudget.maxCost) {
      return { allowed: false, reason: 'Estimated cost exceeds global budget', remaining, estimated: estimatedCost };
    }

    return { allowed: true, remaining, estimated: estimatedCost };
  }

  // ── Public API: getAllUsage ────────────────────────────────────────────

  /**
   * Return usage data for all registered goals.
   *
   * @returns {Map<string, { budget: BudgetLimits, usage: object, status: string }>}
   */
  getAllUsage() {
    const result = new Map();
    for (const [goalId, goal] of this.#goals) {
      result.set(goalId, {
        budget: { ...goal.budget },
        usage: { ...goal.usage },
        status: goal.status,
      });
    }
    return result;
  }

  // ── Public API: checkGlobal ───────────────────────────────────────────

  /**
   * Aggregate all goal usage and check against the global budget.
   *
   * @returns {{ status: string, totalUsage: object, totalBudget: BudgetLimits, alerts: Alert[] }}
   */
  checkGlobal() {
    const usage = this.#computeGlobalUsage();

    let status = 'ok';
    if (this.#globalBudget.maxTokens != null && usage.tokens >= this.#globalBudget.maxTokens) {
      status = 'exceeded';
    } else if (this.#globalBudget.maxCost != null && usage.cost >= this.#globalBudget.maxCost) {
      status = 'exceeded';
    } else if (this.#globalBudget.maxMinutes != null && usage.minutes >= this.#globalBudget.maxMinutes) {
      status = 'exceeded';
    } else if (this.#globalAlerts.some((a) => a.level === 'critical')) {
      status = 'critical';
    } else if (this.#globalAlerts.some((a) => a.level === 'warning')) {
      status = 'warning';
    }

    return {
      status,
      totalUsage: usage,
      totalBudget: { ...this.#globalBudget },
      alerts: [...this.#globalAlerts],
    };
  }

  // ── Public API: suggestBudget ─────────────────────────────────────────

  /**
   * Suggest a budget for a new goal based on historical data from completed
   * goals.
   *
   * @param {number} taskCount         — expected number of tasks in the goal
   * @param {string} avgTaskComplexity — 'low' | 'medium' | 'high'
   * @returns {{ suggested: BudgetLimits, confidence: number }}
   */
  suggestBudget(taskCount, avgTaskComplexity = 'medium') {
    return _suggestBudget(this.#goals, taskCount, avgTaskComplexity);
  }

  // ── Public API: getSpendingReport ─────────────────────────────────────

  /**
   * Generate a spending report over the given time window.
   *
   * @param {string} [timeWindow='24h'] — time window label (currently only '24h' is meaningful)
   * @returns {SpendingReport}
   */
  getSpendingReport(timeWindow = '24h') {
    return _getSpendingReport(this.#goals, timeWindow);
  }

  // ── Public API: getStatus ─────────────────────────────────────────────

  /**
   * Return a compact status summary.
   *
   * @returns {{ activeGoals: number, totalSpent: number, globalBudgetRemaining: object, alerts: Alert[] }}
   */
  getStatus() {
    const globalUsage = this.#computeGlobalUsage();
    let activeGoals = 0;
    for (const goal of this.#goals.values()) {
      if (goal.status === 'active') activeGoals++;
    }

    return {
      activeGoals,
      totalSpent: Math.round(globalUsage.cost * 1_000_000) / 1_000_000,
      globalBudgetRemaining: {
        tokens: this.#globalBudget.maxTokens != null
          ? Math.max(0, this.#globalBudget.maxTokens - globalUsage.tokens)
          : Infinity,
        cost: this.#globalBudget.maxCost != null
          ? Math.max(0, this.#globalBudget.maxCost - globalUsage.cost)
          : Infinity,
        minutes: this.#globalBudget.maxMinutes != null
          ? Math.max(0, this.#globalBudget.maxMinutes - globalUsage.minutes)
          : Infinity,
      },
      alerts: [...this.#globalAlerts],
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Aggregate usage across all goals.
   *
   * @returns {{ tokens: number, cost: number, minutes: number }}
   */
  #computeGlobalUsage() {
    let tokens = 0;
    let cost = 0;
    let earliestStart = Infinity;

    for (const goal of this.#goals.values()) {
      tokens += goal.usage.tokens;
      cost += goal.usage.cost;
      if (goal.startTime < earliestStart) earliestStart = goal.startTime;
    }

    const minutes = earliestStart < Infinity
      ? (Date.now() - earliestStart) / 60_000
      : 0;

    return { tokens, cost, minutes };
  }
}
