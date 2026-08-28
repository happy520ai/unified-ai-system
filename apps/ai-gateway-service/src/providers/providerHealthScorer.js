// =============================================================================
// providerHealthScorer.js — Provider 健康评分引擎
// 基于成功率、延迟计算 0-100 健康分数
// =============================================================================

const WINDOW_SIZE = 100; // 保留最近 100 次请求
const DEFAULT_SCORE = 50;

/**
 * Provider 健康评分引擎
 * @returns {Object} { recordSuccess, recordFailure, getScore, getRankedProviders, getAllScores }
 */
export function createProviderHealthScorer() {
  // providerId -> { successes, failures, latencies, lastUpdated }
  const stats = new Map();

  function ensureStats(providerId) {
    if (!stats.has(providerId)) {
      stats.set(providerId, {
        events: [],
        lastUpdated: Date.now(),
      });
    }
    return stats.get(providerId);
  }

  function recordSuccess(providerId, latencyMs) {
    const s = ensureStats(providerId);
    s.events.push({ success: true, at: Date.now(), latencyMs });
    if (s.events.length > WINDOW_SIZE) s.events.shift();
    s.lastUpdated = Date.now();
  }

  function recordFailure(providerId, _errorCode) {
    const s = ensureStats(providerId);
    s.events.push({ success: false, at: Date.now(), latencyMs: null });
    if (s.events.length > WINDOW_SIZE) s.events.shift();
    s.lastUpdated = Date.now();
  }

  function getScore(providerId) {
    const s = stats.get(providerId);
    if (!s) return DEFAULT_SCORE;

    const total = s.events.length;
    if (total === 0) return DEFAULT_SCORE;

    // 成功率 (权重 50%)
    const successes = s.events.filter((event) => event.success);
    const successRate = successes.length / total;

    // 延迟分数 (权重 30%) — P50 < 2s = 1.0, P50 > 10s = 0.0
    let latencyScore = 0;
    const latencies = successes
      .map((event) => event.latencyMs)
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (latencies.length > 0) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length / 2)];
      latencyScore = Math.max(0, Math.min(1, 1 - (p50 - 2000) / 8000));
    }

    // 新鲜度分数 (权重 20%) — 最近 5 分钟内有请求 = 1.0
    const age = Date.now() - s.lastUpdated;
    const freshnessScore = Math.max(0, 1 - age / (5 * 60 * 1000));

    const score = (successRate * 50) + (latencyScore * 30) + (freshnessScore * 20);
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  function getRankedProviders(providerIds) {
    return [...providerIds].sort((a, b) => getScore(b) - getScore(a));
  }

  function getAllScores() {
    const result = {};
    for (const [providerId] of stats) {
      result[providerId] = getScore(providerId);
    }
    return result;
  }

  function getSnapshot(providerId) {
    const s = stats.get(providerId);
    if (!s) {
      return Object.freeze({
        sampleCount: 0,
        successRate: null,
        p50LatencyMs: null,
      });
    }
    const sampleCount = s.events.length;
    const successfulEvents = s.events.filter((event) => event.success);
    const successRate = sampleCount > 0 ? successfulEvents.length / sampleCount : null;
    const sortedLatencies = successfulEvents
      .map((event) => event.latencyMs)
      .filter((value) => Number.isFinite(value) && value >= 0)
      .sort((a, b) => a - b);
    const p50LatencyMs = sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length / 2)]
      : null;
    return Object.freeze({ sampleCount, successRate, p50LatencyMs });
  }

  return { recordSuccess, recordFailure, getScore, getRankedProviders, getAllScores, getSnapshot };
}
