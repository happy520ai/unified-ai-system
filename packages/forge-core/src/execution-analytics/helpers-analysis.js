/**
 * Execution Analytics — analysis helpers (period comparison, worker performance,
 * recommendations, status computation).
 *
 * Split from helpers.js to keep each file under 500 lines.
 *
 * @module execution-analytics/helpers-analysis
 */

import { mean } from './helpers.js';

// ── Period Comparison ───────────────────────────────────────────────────────

/**
 * Compare performance metrics between two time periods.
 * @param {Array<object>} tasksA — filtered task events for period A
 * @param {Array<object>} tasksB — filtered task events for period B
 * @param {Array<object>} goalsA — filtered goal events for period A
 * @param {Array<object>} goalsB — filtered goal events for period B
 * @param {{ start: number, end: number }} periodA
 * @param {{ start: number, end: number }} periodB
 * @returns {{ duration: object, successRate: object, cost: object,
 *   throughput: object, winner: 'A'|'B'|'equal' }}
 */
export function comparePeriods(tasksA, tasksB, goalsA, goalsB, periodA, periodB) {
  const avgDurA = mean(tasksA.map(t => t.durationMs).filter(d => d > 0));
  const avgDurB = mean(tasksB.map(t => t.durationMs).filter(d => d > 0));
  const durChange = avgDurB - avgDurA;
  const durPct = avgDurA > 0 ? (durChange / avgDurA) * 100 : 0;

  const srA = tasksA.length > 0 ? tasksA.filter(t => t.status === 'completed').length / tasksA.length : 0;
  const srB = tasksB.length > 0 ? tasksB.filter(t => t.status === 'completed').length / tasksB.length : 0;

  const costA = mean(goalsA.map(g => g.totalCost));
  const costB = mean(goalsB.map(g => g.totalCost));

  // Throughput: tasks completed per hour
  const hoursA = Math.max(1, (periodA.end - periodA.start) / 3_600_000);
  const hoursB = Math.max(1, (periodB.end - periodB.start) / 3_600_000);
  const tpA = tasksA.filter(t => t.status === 'completed').length / hoursA;
  const tpB = tasksB.filter(t => t.status === 'completed').length / hoursB;

  // Determine winner based on composite score
  let scoreA = 0, scoreB = 0;
  if (avgDurA < avgDurB) scoreA++; else if (avgDurB < avgDurA) scoreB++;
  if (srA > srB) scoreA++; else if (srB > srA) scoreB++;
  if (costA < costB) scoreA++; else if (costB < costA) scoreB++;
  if (tpA > tpB) scoreA++; else if (tpB > tpA) scoreB++;
  const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'equal';

  return {
    duration: {
      periodA: Math.round(avgDurA),
      periodB: Math.round(avgDurB),
      change: Math.round(durChange),
      percentChange: +durPct.toFixed(1),
    },
    successRate: {
      periodA: +(srA * 100).toFixed(1),
      periodB: +(srB * 100).toFixed(1),
      change: +((srB - srA) * 100).toFixed(1),
    },
    cost: {
      periodA: +costA.toFixed(4),
      periodB: +costB.toFixed(4),
      change: +(costB - costA).toFixed(4),
    },
    throughput: {
      periodA: +tpA.toFixed(2),
      periodB: +tpB.toFixed(2),
      change: +(tpB - tpA).toFixed(2),
      unit: 'tasks/hour',
    },
    winner,
  };
}

// ── Worker Performance ──────────────────────────────────────────────────────

/**
 * Get per-worker-type performance breakdown.
 * @param {Array<object>} completed — completed/failed task events
 * @returns {Map<string, { count: number, avgDuration: number, successRate: number,
 *   avgTokens: number, avgCost: number, avgRetries: number }>}
 */
export function getWorkerPerformance(completed) {
  const groups = new Map();

  for (const evt of completed) {
    if (!groups.has(evt.workerType)) groups.set(evt.workerType, []);
    groups.get(evt.workerType).push(evt);
  }

  const result = new Map();
  for (const [workerType, events] of groups) {
    const durations = events.map(e => e.durationMs).filter(d => d > 0);
    const tokens = events.map(e => e.tokensUsed).filter(t => t > 0);
    const costs = events.map(e => e.cost).filter(c => c > 0);
    const retries = events.map(e => e.retryCount);
    const successes = events.filter(e => e.status === 'completed').length;

    result.set(workerType, {
      count: events.length,
      avgDuration: Math.round(mean(durations)),
      successRate: events.length > 0 ? +(successes / events.length).toFixed(3) : 0,
      avgTokens: Math.round(mean(tokens)),
      avgCost: +mean(costs).toFixed(4),
      avgRetries: +mean(retries).toFixed(2),
    });
  }

  return result;
}

// ── Report Generation Helpers ───────────────────────────────────────────────

/**
 * Generate recommendations based on summary metrics and trends.
 * @param {object} summary — report summary stats
 * @param {object} metrics — computed metrics
 * @param {object} trends — trend analysis results
 * @param {Array<object>} bottlenecks — detected bottlenecks
 * @returns {string[]}
 */
export function generateRecommendations(summary, metrics, trends, bottlenecks) {
  const recommendations = [];

  if (summary.overallSuccessRate < 80) {
    recommendations.push(`Overall success rate is ${summary.overallSuccessRate}%. Investigate recurring failure patterns.`);
  }
  if (metrics.avgRetriesPerTask > 1.5) {
    recommendations.push(`Average retries per task is ${metrics.avgRetriesPerTask}. Consider improving input validation or error recovery.`);
  }
  if (metrics.avgQueueWaitMs > 10000) {
    recommendations.push(`Average queue wait is ${metrics.avgQueueWaitMs}ms. Consider increasing worker pool size or reducing task granularity.`);
  }
  if (trends.duration.trend === 'degrading') {
    recommendations.push('Task duration is trending upward. Review recent changes for performance regressions.');
  }
  if (trends.successRate.trend === 'degrading') {
    recommendations.push('Success rate is trending downward. Check for new error patterns or environment issues.');
  }
  if (trends.costPerGoal.trend === 'degrading') {
    recommendations.push('Cost per goal is increasing. Review token usage and consider context optimization.');
  }

  for (const bn of bottlenecks.filter(b => b.severity === 'critical' || b.severity === 'high')) {
    recommendations.push(bn.suggestion);
  }

  if (recommendations.length === 0) {
    recommendations.push('System is performing within normal parameters. No immediate action needed.');
  }

  return recommendations;
}

// ── Status Computation ──────────────────────────────────────────────────────

/**
 * Compute current analytics status summary.
 * @param {Array<object>} taskEvents
 * @param {Array<object>} goalEvents
 * @returns {{ recordCount: number, taskEventCount: number, goalEventCount: number,
 *   goalsTracked: number, avgSuccessRate: number, lastActivity: number|null }}
 */
export function computeStatus(taskEvents, goalEvents) {
  const allTasks = taskEvents.filter(e => e.status !== 'started');
  const completed = allTasks.filter(e => e.status === 'completed').length;
  const uniqueGoals = new Set([
    ...taskEvents.map(e => e.goalId),
    ...goalEvents.map(e => e.goalId),
  ]);

  const lastTask = taskEvents.length > 0
    ? taskEvents[taskEvents.length - 1].timestamp
    : null;
  const lastGoal = goalEvents.length > 0
    ? goalEvents[goalEvents.length - 1].timestamp
    : null;
  const lastActivity = lastTask && lastGoal
    ? Math.max(lastTask, lastGoal)
    : lastTask ?? lastGoal;

  return {
    recordCount: taskEvents.length + goalEvents.length,
    taskEventCount: taskEvents.length,
    goalEventCount: goalEvents.length,
    goalsTracked: uniqueGoals.size,
    avgSuccessRate: allTasks.length > 0
      ? +((completed / allTasks.length) * 100).toFixed(1)
      : 0,
    lastActivity,
  };
}
