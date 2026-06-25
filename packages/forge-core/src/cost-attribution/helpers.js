/**
 * Pure helper functions and constants for Cost Attribution.
 *
 * Extracted from index.js to keep the main module under 500 lines.
 * All functions here are stateless and side-effect-free.
 */

// ── Type definitions ──────────────────────────────────────────────────────

/**
 * @typedef {object} CostRecord
 * @property {string} id           — unique record identifier
 * @property {string} goalId       — goal this record belongs to
 * @property {string} taskId       — task within the goal
 * @property {string} workerType   — worker that produced the call (coder, tester, …)
 * @property {string} model        — model identifier used
 * @property {number} inputTokens  — number of input tokens consumed
 * @property {number} outputTokens — number of output tokens consumed
 * @property {number} cost         — total cost in USD
 * @property {number} duration     — wall-clock duration in milliseconds
 * @property {number} timestamp    — epoch ms when the record was created
 */

/**
 * @typedef {object} CostBucket
 * @property {string} period — ISO-8601 period key (e.g. '2026-06-13T10:00:00.000Z')
 * @property {number} cost   — total cost in the bucket
 * @property {number} tokens — total tokens in the bucket
 * @property {number} count  — number of records in the bucket
 */

/**
 * @typedef {object} ModelPricing
 * @property {number} input  — cost per 1 000 000 input tokens (USD)
 * @property {number} output — cost per 1 000 000 output tokens (USD)
 */

/**
 * @typedef {{ cost: number, tokens: number, count: number }} GroupStats
 */

// ── Constants ─────────────────────────────────────────────────────────────

/** Tokens that pricing rates are quoted against (1 million). */
export const PER_MILLION = 1_000_000;

/**
 * Default model pricing (per 1M tokens in USD).
 * Mirrors CostCalculator defaults for consistency.
 * @type {Record<string, ModelPricing>}
 */
export const DEFAULT_PRICING = {
  'mimo-v2.5-pro':                           { input: 0.30, output: 0.60 },
  'nvidia/llama-3.3-nemotron-super-49b-v1':  { input: 0.20, output: 0.40 },
  'deepseek-v3':                              { input: 0.27, output: 1.10 },
  'qwen-2.5-72b':                             { input: 0.35, output: 0.70 },
  'default':                                  { input: 1.00, output: 2.00 },
};

/** Default maximum number of records in the ring buffer. */
export const DEFAULT_MAX_RECORDS = 10_000;

/** Default number of recent records used for projection calculations. */
export const PROJECTION_SAMPLE_SIZE = 100;

/** Default number of trend periods returned. */
export const DEFAULT_TREND_PERIODS = 24;

// ── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Round a cost value to 6 decimal places to avoid floating-point drift.
 *
 * @param {number} value — raw cost value
 * @returns {number}
 */
export function roundCost(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Calculate cost from model pricing and token counts.
 *
 * @param {Record<string, ModelPricing>} pricing — pricing table
 * @param {string} model        — model identifier
 * @param {number} inputTokens  — input token count
 * @param {number} outputTokens — output token count
 * @returns {number} cost in USD
 */
export function calculateCost(pricing, model, inputTokens = 0, outputTokens = 0) {
  const rates = pricing[model] ?? pricing['default'];
  const inputCost = (inputTokens / PER_MILLION) * rates.input;
  const outputCost = (outputTokens / PER_MILLION) * rates.output;
  return roundCost(inputCost + outputCost);
}

/**
 * Group records by a key and aggregate cost / tokens / count.
 *
 * @param {CostRecord[]} records
 * @param {(r: CostRecord) => string} keyFn
 * @returns {Record<string, GroupStats>}
 */
function groupByKey(records, keyFn) {
  /** @type {Record<string, GroupStats>} */
  const result = {};
  for (const r of records) {
    const key = keyFn(r);
    const tokens = r.inputTokens + r.outputTokens;
    if (!result[key]) {
      result[key] = { cost: 0, tokens: 0, count: 0 };
    }
    result[key].cost += r.cost;
    result[key].tokens += tokens;
    result[key].count += 1;
  }
  return result;
}

/**
 * Build empty time buckets and fill them from records.
 *
 * @param {CostRecord[]} records
 * @param {'hour'|'day'} granularity
 * @param {number} periods
 * @returns {CostBucket[]}
 */
export function buildTimeBuckets(records, granularity, periods) {
  const bucketMs = granularity === 'day' ? 86_400_000 : 3_600_000;
  const now = Date.now();
  const startTime = now - periods * bucketMs;

  /** @type {Map<string, CostBucket>} */
  const buckets = new Map();
  for (let i = 0; i < periods; i++) {
    const bucketStart = startTime + i * bucketMs;
    const key = new Date(bucketStart).toISOString();
    buckets.set(key, { period: key, cost: 0, tokens: 0, count: 0 });
  }

  for (const r of records) {
    if (r.timestamp < startTime) continue;
    const bucketIndex = Math.floor((r.timestamp - startTime) / bucketMs);
    const bucketStart = startTime + bucketIndex * bucketMs;
    const key = new Date(bucketStart).toISOString();
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.cost += r.cost;
      bucket.tokens += r.inputTokens + r.outputTokens;
      bucket.count += 1;
    }
  }

  for (const bucket of buckets.values()) {
    bucket.cost = roundCost(bucket.cost);
  }

  return [...buckets.values()];
}

/**
 * Aggregate records by goal or task for top-N queries.
 *
 * @param {CostRecord[]} records
 * @param {'goal'|'task'} type
 * @returns {Record<string, { cost: number, tokens: number }>}
 */
export function computeTopAggregated(records, type) {
  /** @type {Record<string, { cost: number, tokens: number }>} */
  const aggregated = {};
  for (const r of records) {
    const key = type === 'goal' ? r.goalId : r.taskId;
    if (!aggregated[key]) {
      aggregated[key] = { cost: 0, tokens: 0 };
    }
    aggregated[key].cost += r.cost;
    aggregated[key].tokens += r.inputTokens + r.outputTokens;
  }
  return aggregated;
}

/**
 * Compute cost projection from a sample of recent records.
 *
 * @param {CostRecord[]} records — full record array (slicing is done here)
 * @param {number} sampleSize
 * @returns {{ hourlyRate: number, dailyRate: number, monthlyProjection: number }}
 */
export function computeProjection(records, sampleSize) {
  if (records.length === 0) {
    return { hourlyRate: 0, dailyRate: 0, monthlyProjection: 0 };
  }

  const sample = records.slice(-sampleSize);

  if (sample.length < 2) {
    const cost = sample[0]?.cost ?? 0;
    return {
      hourlyRate: roundCost(cost),
      dailyRate: roundCost(cost * 24),
      monthlyProjection: roundCost(cost * 24 * 30),
    };
  }

  const firstTs = sample[0].timestamp;
  const lastTs = sample[sample.length - 1].timestamp;
  const spanMs = Math.max(1, lastTs - firstTs);
  const spanHours = spanMs / 3_600_000;

  let totalCost = 0;
  for (const r of sample) {
    totalCost += r.cost;
  }

  const hourlyRate = totalCost / Math.max(0.001, spanHours);
  const dailyRate = hourlyRate * 24;
  const monthlyProjection = dailyRate * 30;

  return {
    hourlyRate: roundCost(hourlyRate),
    dailyRate: roundCost(dailyRate),
    monthlyProjection: roundCost(monthlyProjection),
  };
}

// ── Composite query helpers ───────────────────────────────────────────────

/**
 * @param {CostRecord[]} records
 * @param {string} goalId
 * @returns {object}
 */
export function getGoalCostData(records, goalId) {
  const filtered = records.filter((r) => r.goalId === goalId);
  const taskIds = new Set();
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalDuration = 0;
  /** @type {Record<string, GroupStats>} */
  const byWorker = {};
  /** @type {Record<string, GroupStats>} */
  const byModel = {};

  for (const r of filtered) {
    const tokens = r.inputTokens + r.outputTokens;
    totalCost += r.cost;
    totalInput += r.inputTokens;
    totalOutput += r.outputTokens;
    totalDuration += r.duration;
    taskIds.add(r.taskId);

    if (!byWorker[r.workerType]) byWorker[r.workerType] = { cost: 0, tokens: 0, count: 0 };
    byWorker[r.workerType].cost += r.cost;
    byWorker[r.workerType].tokens += tokens;
    byWorker[r.workerType].count += 1;

    if (!byModel[r.model]) byModel[r.model] = { cost: 0, tokens: 0, count: 0 };
    byModel[r.model].cost += r.cost;
    byModel[r.model].tokens += tokens;
    byModel[r.model].count += 1;
  }

  return {
    goalId,
    totalCost: roundCost(totalCost),
    totalTokens: totalInput + totalOutput,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    tasks: taskIds.size,
    byWorker,
    byModel,
    duration: totalDuration,
  };
}

/**
 * @param {CostRecord[]} records
 * @param {string} taskId
 * @returns {object}
 */
export function getTaskCostData(records, taskId) {
  const filtered = records.filter((r) => r.taskId === taskId);

  if (filtered.length === 0) {
    return { taskId, goalId: '', workerType: '', model: '', inputTokens: 0, outputTokens: 0, cost: 0, duration: 0 };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let duration = 0;

  for (const r of filtered) {
    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    cost += r.cost;
    duration += r.duration;
  }

  const first = filtered[0];
  return {
    taskId,
    goalId: first.goalId,
    workerType: first.workerType,
    model: first.model,
    inputTokens,
    outputTokens,
    cost: roundCost(cost),
    duration,
  };
}

/**
 * @param {CostRecord[]} records
 * @returns {object}
 */
export function getTotalCostData(records) {
  const goalIds = new Set();
  const taskIds = new Set();
  let totalCost = 0;
  let totalTokens = 0;
  /** @type {Record<string, GroupStats>} */
  const byWorker = {};
  /** @type {Record<string, GroupStats>} */
  const byModel = {};

  for (const r of records) {
    const tokens = r.inputTokens + r.outputTokens;
    totalCost += r.cost;
    totalTokens += tokens;
    goalIds.add(r.goalId);
    taskIds.add(r.taskId);

    if (!byWorker[r.workerType]) byWorker[r.workerType] = { cost: 0, tokens: 0, count: 0 };
    byWorker[r.workerType].cost += r.cost;
    byWorker[r.workerType].tokens += tokens;
    byWorker[r.workerType].count += 1;

    if (!byModel[r.model]) byModel[r.model] = { cost: 0, tokens: 0, count: 0 };
    byModel[r.model].cost += r.cost;
    byModel[r.model].tokens += tokens;
    byModel[r.model].count += 1;
  }

  return {
    totalCost: roundCost(totalCost),
    totalTokens,
    goals: goalIds.size,
    tasks: taskIds.size,
    byWorker,
    byModel,
  };
}

/**
 * @param {CostRecord[]} records
 * @returns {Record<string, GroupStats>}
 */
export function _getCostByWorker(records) {
  return groupByKey(records, (r) => r.workerType);
}

/**
 * @param {CostRecord[]} records
 * @returns {Record<string, GroupStats>}
 */
export function _getCostByModel(records) {
  return groupByKey(records, (r) => r.model);
}

/**
 * @param {CostRecord[]} records
 * @param {object} opts
 * @returns {CostBucket[]}
 */
export function getCostTrendData(records, opts) {
  const granularity = opts.granularity ?? 'hour';
  const periods = opts.periods ?? DEFAULT_TREND_PERIODS;
  return buildTimeBuckets(records, granularity, periods);
}

/**
 * @param {CostRecord[]} records
 * @param {object} opts
 * @returns {Array<{ id: string, cost: number, tokens: number, type: string }>}
 */
export function getTopExpensiveData(records, opts) {
  const limit = opts.limit ?? 10;
  const type = opts.type ?? 'goal';
  const aggregated = computeTopAggregated(records, type);

  const sorted = Object.entries(aggregated)
    .map(([id, data]) => ({ id, cost: roundCost(data.cost), tokens: data.tokens, type }))
    .sort((a, b) => b.cost - a.cost);

  return sorted.slice(0, limit);
}

/**
 * @param {CostRecord[]} records
 * @param {object} opts
 * @returns {{ hourlyRate: number, dailyRate: number, monthlyProjection: number }}
 */
export function getProjectionData(records, opts) {
  const sampleSize = opts.sampleSize ?? PROJECTION_SAMPLE_SIZE;
  return computeProjection(records, sampleSize);
}

/**
 * @param {CostRecord[]} records
 * @param {object} total — result of getTotalCostData
 * @param {number} defaultTrendPeriods
 * @returns {object}
 */
export function getStatusData(records, total, defaultTrendPeriods) {
  const cutoff24h = Date.now() - 86_400_000;
  let last24hCost = 0;
  let last24hTokens = 0;

  for (const r of records) {
    if (r.timestamp >= cutoff24h) {
      last24hCost += r.cost;
      last24hTokens += r.inputTokens + r.outputTokens;
    }
  }

  const trend = buildTimeBuckets(records, 'hour', defaultTrendPeriods);

  return {
    totalCost: total.totalCost,
    totalTokens: total.totalTokens,
    goals: total.goals,
    tasks: total.tasks,
    last24h: {
      cost: roundCost(last24hCost),
      tokens: last24hTokens,
    },
    trend,
  };
}
