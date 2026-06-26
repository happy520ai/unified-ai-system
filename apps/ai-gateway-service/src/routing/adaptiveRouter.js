// =============================================================================
// adaptiveRouter.js — 自适应学习路由（创新）
// 根据历史执行结果自动调整路由决策，越用越准
// =============================================================================

export function createAdaptiveRouter(options = {}) {
  const learningRate = options.learningRate ?? 0.1;
  const decayFactor = options.decayFactor ?? 0.95;

  // 模型性能记忆：model -> { taskType -> { success, failure, avgLatency, avgQuality, weight } }
  const memory = new Map();
  const MAX_MEMORY_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

  /**
   * 记录一次执行结果
   * @param {Object} result - { model, taskType, success, latencyMs, qualityScore }
   */
  function recordResult(result) {
    const { model, taskType, success, latencyMs, qualityScore } = result;
    const key = `${model}::${taskType ?? "general"}`;

    // Evict stale entries
    const now = Date.now();
    for (const [k, v] of memory) {
      if (now - v.lastUpdated > MAX_MEMORY_AGE_MS) {
        memory.delete(k);
      }
    }

    if (!memory.has(key)) {
      memory.set(key, {
        model,
        taskType: taskType ?? "general",
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
        totalQuality: 0,
        weight: 1.0,
        lastUpdated: Date.now(),
        history: [],
      });
    }

    const entry = memory.get(key);
    if (success) entry.successes++;
    else entry.failures++;
    entry.totalLatencyMs += latencyMs ?? 0;
    entry.totalQuality += qualityScore ?? 0;
    entry.lastUpdated = Date.now();

    // 保留最近 100 条历史
    entry.history.push({ success, latencyMs, qualityScore, at: Date.now() });
    if (entry.history.length > 100) entry.history.shift();

    // 更新权重（基于成功率和质量）
    const total = entry.successes + entry.failures;
    const successRate = total > 0 ? entry.successes / total : 0.5;
    const avgQuality = total > 0 ? entry.totalQuality / total : 0.5;
    const avgLatency = total > 0 ? entry.totalLatencyMs / total : 1000;
    const latencyScore = Math.max(0, 1 - avgLatency / 10000);

    entry.weight = (successRate * 0.4 + avgQuality * 0.4 + latencyScore * 0.2);
  }

  /**
   * 自适应路由选择
   * @param {string} taskType
   * @param {Array<string>} candidates
   * @returns {Object} { model, weight, reason }
   */
  function route(taskType, candidates) {
    if (candidates.length === 0) return { model: null, weight: 0, reason: "no_candidates" };
    if (candidates.length === 1) return { model: candidates[0], weight: 1, reason: "single_candidate" };

    // 获取每个候选的权重
    const scored = candidates.map((model) => {
      const key = `${model}::${taskType}`;
      const generalKey = `${model}::general`;
      const entry = memory.get(key) ?? memory.get(generalKey);

      if (!entry) {
        return { model, weight: 0.5, reason: "no_history", data: null };
      }

      return {
        model,
        weight: entry.weight,
        reason: `success_rate=${(entry.successes / (entry.successes + entry.failures) * 100).toFixed(0)}%`,
        data: entry,
      };
    });

    // 加权随机选择
    scored.sort((a, b) => b.weight - a.weight);

    // 探索 vs 利用：90% 利用最佳，10% 探索其他
    if (Math.random() < 0.9) {
      return scored[0];
    } else {
      // 探索：随机选一个非最佳的
      const exploratory = scored.slice(1);
      if (exploratory.length === 0) return scored[0];
      return exploratory[Math.floor(Math.random() * exploratory.length)];
    }
  }

  /**
   * 获取模型性能排名
   * @param {string} taskType
   * @returns {Array}
   */
  function getModelRanking(taskType) {
    const entries = [];
    for (const [key, entry] of memory) {
      if (taskType && !key.endsWith(`::${taskType}`)) continue;
      entries.push({
        model: entry.model,
        taskType: entry.taskType,
        weight: entry.weight,
        successRate: entry.successes / (entry.successes + entry.failures || 1),
        avgLatencyMs: entry.totalLatencyMs / (entry.successes + entry.failures || 1),
        totalRequests: entry.successes + entry.failures,
      });
    }
    entries.sort((a, b) => b.weight - a.weight);
    return entries;
  }

  /**
   * 获取统计
   */
  function getStats() {
    let totalEntries = 0;
    let totalRequests = 0;
    for (const entry of memory.values()) {
      totalEntries++;
      totalRequests += entry.successes + entry.failures;
    }
    return {
      modelTaskPairs: totalEntries,
      totalRequests,
      learningRate,
      decayFactor,
    };
  }

  return { recordResult, route, getModelRanking, getStats };
}
