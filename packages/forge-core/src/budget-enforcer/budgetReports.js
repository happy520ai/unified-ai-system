/**
 * BudgetEnforcer — pure budget report and threshold helpers.
 *
 * Extracted from budget-enforcer/index.js to keep the class module
 * under the 500-line limit (分层律).
 */

/** Default alert thresholds. */
export const DEFAULT_ALERT_THRESHOLDS = [0.5, 0.75, 0.9, 1.0];

/** Default throttle ratio — block new work above this usage ratio. */
export const DEFAULT_THROTTLE_RATIO = 0.8;

/** Default global budget. */
export const DEFAULT_GLOBAL_BUDGET = {
  maxTokens: 1_000_000,
  maxCost: 50.0,
  maxMinutes: 480,
};

/**
 * Check usage against threshold ratios and generate alerts for any crossed.
 *
 * @param {object} usage — { tokens, cost, minutes }
 * @param {object} budget — { maxTokens?, maxCost?, maxMinutes? }
 * @param {number[]} thresholds
 * @param {Set<string>} alreadyTriggered
 * @param {string} goalId
 * @returns {object[]}
 */
export function checkThresholds(usage, budget, thresholds, alreadyTriggered, goalId) {
  const alerts = [];
  const now = Date.now();

  const dimensions = [
    { key: 'tokens', current: usage.tokens, limit: budget.maxTokens },
    { key: 'cost', current: usage.cost, limit: budget.maxCost },
    { key: 'minutes', current: usage.minutes, limit: budget.maxMinutes },
  ];

  for (const dim of dimensions) {
    if (dim.limit == null || dim.limit <= 0) continue;
    const ratio = dim.current / dim.limit;

    for (const threshold of thresholds) {
      const alertKey = `${goalId}:${dim.key}:${threshold}`;
      if (alreadyTriggered.has(alertKey)) continue;
      if (ratio >= threshold) {
        alreadyTriggered.add(alertKey);
        const level = threshold >= 1.0
          ? 'exceeded'
          : threshold >= 0.9
            ? 'critical'
            : 'warning';
        alerts.push({
          goalId,
          level,
          dimension: dim.key,
          threshold,
          current: dim.current,
          limit: dim.limit,
          timestamp: now,
        });
      }
    }
  }

  return alerts;
}

/**
 * Suggest a budget for a new goal based on historical data from completed goals.
 *
 * @param {Map} goals — Map of goalId → goal state
 * @param {number} taskCount — expected number of tasks in the goal
 * @param {string} avgTaskComplexity — 'low' | 'medium' | 'high'
 * @returns {{ suggested: object, confidence: number }}
 */
export function suggestBudget(goals, taskCount, avgTaskComplexity = 'medium') {
  const complexityMultiplier = { low: 0.6, medium: 1.0, high: 1.5 };
  const mult = complexityMultiplier[avgTaskComplexity] ?? 1.0;

  let avgTokensPerTask = 8000;
  let avgCostPerTask = 0.24;
  let avgMinutesPerTask = 3;
  let historicalCount = 0;

  for (const goal of goals.values()) {
    if (goal.history.length > 0) {
      const totalHistTokens = goal.history.reduce((s, h) => s + h.tokens, 0);
      const totalHistCost = goal.history.reduce((s, h) => s + h.cost, 0);
      avgTokensPerTask = totalHistTokens / goal.history.length;
      avgCostPerTask = totalHistCost / goal.history.length;
      historicalCount++;
    }
  }

  const suggestedTokens = Math.round(avgTokensPerTask * taskCount * mult);
  const suggestedCost = Math.round(avgCostPerTask * taskCount * mult * 100) / 100;
  const suggestedMinutes = Math.round(avgMinutesPerTask * taskCount * mult);

  const confidence = historicalCount >= 5 ? 0.8 : historicalCount >= 2 ? 0.5 : 0.3;

  return {
    suggested: {
      maxTokens: suggestedTokens,
      maxCost: suggestedCost,
      maxMinutes: suggestedMinutes,
    },
    confidence,
  };
}

/**
 * Generate a spending report over the given time window.
 *
 * @param {Map} goals — Map of goalId → goal state
 * @param {string} [timeWindow='24h']
 * @returns {object}
 */
export function getSpendingReport(goals, timeWindow = '24h') {
  const now = Date.now();
  const windowMs = timeWindow === '24h' ? 86_400_000 : 86_400_000;
  const cutoff = now - windowMs;

  let totalCost = 0;
  let totalTokens = 0;
  let goalsCompleted = 0;
  let goalsFailed = 0;
  /** @type {Record<string, number>} */
  const costByGoalType = {};
  /** @type {Array<{ goalId: string, cost: number, tokens: number }>} */
  const goalCosts = [];
  const recentCosts = [];

  for (const [goalId, goal] of goals) {
    let goalCost = 0;
    let goalTokens = 0;

    for (const entry of goal.history) {
      if (entry.timestamp >= cutoff) {
        goalCost += entry.cost;
        goalTokens += entry.tokens;
        recentCosts.push(entry.cost);
      }
    }

    totalCost += goalCost;
    totalTokens += goalTokens;
    goalCosts.push({ goalId, cost: goalCost, tokens: goalTokens });

    if (goal.status === 'exceeded') {
      goalsFailed++;
    } else if (goal.history.length > 0) {
      goalsCompleted++;
    }

    const typeKey = goalId.split('-')[0] || 'unknown';
    costByGoalType[typeKey] = (costByGoalType[typeKey] ?? 0) + goalCost;
  }

  let trend = 'stable';
  if (recentCosts.length >= 4) {
    const mid = Math.floor(recentCosts.length / 2);
    const firstHalf = recentCosts.slice(0, mid).reduce((a, b) => a + b, 0);
    const secondHalf = recentCosts.slice(mid).reduce((a, b) => a + b, 0);
    if (secondHalf > firstHalf * 1.2) trend = 'increasing';
    else if (secondHalf < firstHalf * 0.8) trend = 'decreasing';
  }

  const topExpensiveGoals = goalCosts
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  return {
    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
    totalTokens,
    goalsCompleted,
    goalsFailed,
    costByGoalType,
    trend,
    topExpensiveGoals,
  };
}
