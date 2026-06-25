/**
 * Execution Analytics Helpers — pure functions extracted from index.js.
 * All functions are stateless and operate on passed-in data.
 *
 * @module execution-analytics/helpers
 */

// ── Math / Statistics Utilities ─────────────────────────────────────────────

/**
 * Simple linear regression over an array of numeric values.
 * Returns slope, intercept, and R-squared.
 * @param {number[]} values
 * @returns {{ slope: number, intercept: number, rSquared: number }}
 */
export function linearRegression(values) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  if (n === 1) return { slope: 0, intercept: values[0], rSquared: 1 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
    sumY2 += values[i] * values[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const ssRes = values.reduce((acc, v, i) => acc + (v - (slope * i + intercept)) ** 2, 0);
  const ssTot = values.reduce((acc, v) => acc + (v - sumY / n) ** 2, 0);
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/**
 * Compute the p-th percentile of a sorted numeric array.
 * @param {number[]} sorted — must be pre-sorted ascending
 * @param {number} p — percentile in [0, 1]
 * @returns {number}
 */
export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Compute mean of a numeric array.
 * @param {number[]} arr
 * @returns {number}
 */
export function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Classify a trend direction from a regression slope relative to the mean.
 * @param {number} slope
 * @param {number} avg
 * @returns {'improving'|'degrading'|'stable'}
 */
export function classifyTrend(slope, avg) {
  if (avg === 0) return 'stable';
  const relativeSlope = slope / Math.abs(avg);
  if (relativeSlope > 0.01) return 'degrading';
  if (relativeSlope < -0.01) return 'improving';
  return 'stable';
}

// ── Severity Constants ──────────────────────────────────────────────────────

/** Order for sorting bottlenecks by severity */
export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// ── Timeline Building ───────────────────────────────────────────────────────

/**
 * Build timeline entries from task and goal events with parallel detection.
 * @param {Array<object>} taskEvts — filtered task events for one goalId
 * @param {Array<object>} goalEvts — filtered goal events for one goalId
 * @returns {Array<{ timestamp: number, type: string, taskId: string|null,
 *   workerType: string|null, duration: number, status: string, parallel: boolean }>}
 */
export function buildTimeline(taskEvts, goalEvts) {
  // Build start/end pairs for tasks to detect overlaps
  const taskRanges = new Map();
  for (const evt of taskEvts) {
    if (evt.status === 'started') {
      taskRanges.set(evt.taskId, { start: evt.timestamp, end: null, evt });
    } else if (taskRanges.has(evt.taskId)) {
      taskRanges.get(evt.taskId).end = evt.timestamp;
    }
  }

  // Detect parallel execution: two tasks whose ranges overlap
  const parallelTaskIds = new Set();
  const ranges = [...taskRanges.entries()];
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const [, a] = ranges[i];
      const [, b] = ranges[j];
      const aStart = a.start;
      const aEnd = a.end ?? (aStart + (a.evt.durationMs || 0));
      const bStart = b.start;
      const bEnd = b.end ?? (bStart + (b.evt.durationMs || 0));
      if (aStart < bEnd && bStart < aEnd) {
        parallelTaskIds.add(ranges[i][0]);
        parallelTaskIds.add(ranges[j][0]);
      }
    }
  }

  // Build timeline entries
  const timeline = [];
  for (const evt of taskEvts) {
    timeline.push({
      timestamp: evt.timestamp,
      type: 'task',
      taskId: evt.taskId,
      workerType: evt.workerType,
      duration: evt.durationMs,
      status: evt.status,
      parallel: parallelTaskIds.has(evt.taskId),
    });
  }
  for (const evt of goalEvts) {
    timeline.push({
      timestamp: evt.timestamp,
      type: 'goal',
      taskId: null,
      workerType: null,
      duration: evt.executionTimeMs || evt.compileTimeMs || 0,
      status: evt.status,
      parallel: false,
    });
  }

  timeline.sort((a, b) => a.timestamp - b.timestamp);
  return timeline;
}

// ── Bottleneck Detection ────────────────────────────────────────────────────

/**
 * Detect bottlenecks across recent task executions grouped by worker type.
 * @param {Array<object>} recent — completed/failed task events
 * @param {number} minOcc — minimum events per group to report
 * @returns {Array<{ type: string, target: string, severity: string,
 *   metric: object, suggestion: string }>}
 */
export function detectBottlenecks(recent, minOcc) {
  if (recent.length === 0) return [];

  // Group by worker type
  const groups = new Map();
  for (const evt of recent) {
    if (!groups.has(evt.workerType)) groups.set(evt.workerType, []);
    groups.get(evt.workerType).push(evt);
  }

  const bottlenecks = [];
  const globalAvgDur = mean(recent.map(e => e.durationMs).filter(d => d > 0));
  const globalAvgTokens = mean(recent.map(e => e.tokensUsed).filter(t => t > 0));

  for (const [workerType, events] of groups) {
    if (events.length < minOcc) continue;

    // Slow worker detection
    const durations = events.map(e => e.durationMs).filter(d => d > 0);
    if (durations.length > 0) {
      const avgDur = mean(durations);
      if (globalAvgDur > 0 && avgDur > globalAvgDur * 1.5) {
        const severity = avgDur > globalAvgDur * 3 ? 'high' : avgDur > globalAvgDur * 2 ? 'medium' : 'low';
        bottlenecks.push({
          type: 'slow_worker',
          target: workerType,
          severity,
          metric: { avgDurationMs: Math.round(avgDur), globalAvgMs: Math.round(globalAvgDur), ratio: +(avgDur / globalAvgDur).toFixed(2) },
          suggestion: `Worker "${workerType}" is ${(avgDur / globalAvgDur).toFixed(1)}x slower than average. Consider context reduction or caching.`,
        });
      }
    }

    // High retry detection
    const retries = events.map(e => e.retryCount);
    const avgRetries = mean(retries);
    if (avgRetries > 1) {
      const severity = avgRetries > 3 ? 'high' : avgRetries > 2 ? 'medium' : 'low';
      bottlenecks.push({
        type: 'high_retry',
        target: workerType,
        severity,
        metric: { avgRetries: +avgRetries.toFixed(2), maxRetries: Math.max(...retries) },
        suggestion: `Worker "${workerType}" averages ${avgRetries.toFixed(1)} retries. Investigate error patterns or input quality.`,
      });
    }

    // Queue wait detection
    const waits = events.map(e => e.queueWaitMs).filter(w => w > 0);
    if (waits.length > 0) {
      const avgWait = mean(waits);
      if (avgWait > 5000) {
        const severity = avgWait > 30000 ? 'critical' : avgWait > 15000 ? 'high' : 'medium';
        bottlenecks.push({
          type: 'queue_wait',
          target: workerType,
          severity,
          metric: { avgWaitMs: Math.round(avgWait), maxWaitMs: Math.max(...waits) },
          suggestion: `Worker "${workerType}" waits ${Math.round(avgWait)}ms in queue on average. Consider scaling up workers or reducing concurrency.`,
        });
      }
    }

    // High failure rate detection
    const failures = events.filter(e => e.status === 'failed').length;
    const failureRate = failures / events.length;
    if (failureRate > 0.2 && events.length >= minOcc) {
      const severity = failureRate > 0.5 ? 'critical' : failureRate > 0.35 ? 'high' : 'medium';
      bottlenecks.push({
        type: 'high_failure',
        target: workerType,
        severity,
        metric: { failureRate: +failureRate.toFixed(3), failures, total: events.length },
        suggestion: `Worker "${workerType}" has a ${(failureRate * 100).toFixed(0)}% failure rate. Check input validation and error handling.`,
      });
    }

    // Token-heavy detection
    const tokens = events.map(e => e.tokensUsed).filter(t => t > 0);
    if (tokens.length > 0) {
      const avgTokens = mean(tokens);
      if (globalAvgTokens > 0 && avgTokens > globalAvgTokens * 2) {
        const severity = avgTokens > globalAvgTokens * 5 ? 'high' : 'medium';
        bottlenecks.push({
          type: 'token_heavy',
          target: workerType,
          severity,
          metric: { avgTokens: Math.round(avgTokens), globalAvgTokens: Math.round(globalAvgTokens) },
          suggestion: `Worker "${workerType}" uses ${Math.round(avgTokens)} tokens on average (${(avgTokens / globalAvgTokens).toFixed(1)}x the mean). Consider context trimming.`,
        });
      }
    }
  }

  // Sort by severity: critical > high > medium > low
  bottlenecks.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));

  return bottlenecks;
}

// ── Trend Computation ───────────────────────────────────────────────────────

/**
 * Compute performance trends using linear regression.
 * @param {Array<object>} recent — completed/failed task events
 * @param {Array<object>} goalCompletions — completed/failed goal events
 * @returns {{ duration: object, successRate: object, costPerGoal: object, tokensPerTask: object }}
 */
export function computeTrends(recent, goalCompletions) {
  // Duration trend
  const durations = recent.map(e => e.durationMs).filter(d => d > 0);
  const durReg = linearRegression(durations);
  const sortedDur = [...durations].sort((a, b) => a - b);

  // Success rate trend — compute rolling success rate per batch of 10
  const successRates = [];
  const batchSize = Math.max(1, Math.floor(recent.length / 10));
  for (let i = 0; i < recent.length; i += batchSize) {
    const batch = recent.slice(i, i + batchSize);
    if (batch.length === 0) continue;
    const successes = batch.filter(e => e.status === 'completed').length;
    successRates.push(successes / batch.length);
  }
  const srReg = linearRegression(successRates);

  // Cost per goal trend
  const recentGoals = goalCompletions.slice(-Math.max(1, Math.floor(goalCompletions.length / 5)));
  const costs = recentGoals.map(g => g.totalCost);
  const costReg = linearRegression(costs);

  // Tokens per task trend
  const tokenValues = recent.map(e => e.tokensUsed).filter(t => t > 0);
  const tokReg = linearRegression(tokenValues);

  return {
    duration: {
      trend: classifyTrend(durReg.slope, mean(durations)),
      slope: +durReg.slope.toFixed(4),
      rSquared: +durReg.rSquared.toFixed(4),
      avg: Math.round(mean(durations)),
      p95: Math.round(percentile(sortedDur, 0.95)),
      sampleCount: durations.length,
    },
    successRate: {
      trend: classifyTrend(-srReg.slope, mean(successRates)),
      slope: +srReg.slope.toFixed(6),
      rSquared: +srReg.rSquared.toFixed(4),
      avg: +(mean(successRates) * 100).toFixed(1),
      sampleCount: successRates.length,
    },
    costPerGoal: {
      trend: classifyTrend(costReg.slope, mean(costs)),
      slope: +costReg.slope.toFixed(6),
      rSquared: +costReg.rSquared.toFixed(4),
      avg: +mean(costs).toFixed(4),
      sampleCount: costs.length,
    },
    tokensPerTask: {
      trend: classifyTrend(tokReg.slope, mean(tokenValues)),
      slope: +tokReg.slope.toFixed(4),
      rSquared: +tokReg.rSquared.toFixed(4),
      avg: Math.round(mean(tokenValues)),
      sampleCount: tokenValues.length,
    },
  };
}

// comparePeriods, getWorkerPerformance, generateRecommendations, and
// computeStatus live in ./helpers-analysis.js to keep each file under 500 lines.
