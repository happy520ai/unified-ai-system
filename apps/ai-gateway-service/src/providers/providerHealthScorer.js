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
        successes: [],
        failures: [],
        latencies: [],
        lastUpdated: Date.now(),
      });
    }
    return stats.get(providerId);
  }

  function recordSuccess(providerId, latencyMs) {
    const s = ensureStats(providerId);
    s.successes.push({ at: Date.now(), latencyMs });
    s.latencies.push(latencyMs);
    // 滑动窗口
    if (s.successes.length > WINDOW_SIZE) s.successes.shift();
    if (s.latencies.length > WINDOW_SIZE) s.latencies.shift();
    s.lastUpdated = Date.now();
  }

  function recordFailure(providerId, _errorCode) {
    const s = ensureStats(providerId);
    s.failures.push({ at: Date.now() });
    if (s.failures.length > WINDOW_SIZE) s.failures.shift();
    s.lastUpdated = Date.now();
  }

  function getScore(providerId) {
    const s = stats.get(providerId);
    if (!s) return DEFAULT_SCORE;

    const total = s.successes.length + s.failures.length;
    if (total === 0) return DEFAULT_SCORE;

    // 成功率 (权重 50%)
    const successRate = s.successes.length / total;

    // 延迟分数 (权重 30%) — P50 < 2s = 1.0, P50 > 10s = 0.0
    let latencyScore = 1.0;
    if (s.latencies.length > 0) {
      const sorted = [...s.latencies].sort((a, b) => a - b);
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

  return { recordSuccess, recordFailure, getScore, getRankedProviders, getAllScores };
}
