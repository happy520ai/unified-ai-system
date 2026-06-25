// =============================================================================
// modelAggregator.js — 多模型聚合引擎
// 多模型结果聚合、共识投票、质量评分
// =============================================================================

export function createModelAggregator(options = {}) {
  const defaultStrategy = options.defaultStrategy ?? "best_of_n";
  const qualityScorer = options.qualityScorer;

  /**
   * 多模型聚合执行
   * @param {Array<Function>} modelFns - 模型执行函数列表
   * @param {Object} params - { strategy, minResponses, timeoutMs }
   * @returns {Object} { result, consensus, allResponses, strategy }
   */
  async function aggregate(modelFns, params = {}) {
    const strategy = params.strategy ?? defaultStrategy;
    const timeoutMs = params.timeoutMs ?? 30000;

    // 并发执行所有模型
    const responses = await Promise.allSettled(
      modelFns.map((fn) => Promise.race([fn(), timeout(timeoutMs)]))
    );

    const successful = responses
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

    if (successful.length === 0) {
      throw new Error("All models failed");
    }

    switch (strategy) {
      case "best_of_n":
        return bestOfN(successful);
      case "consensus":
        return consensusVote(successful);
      case "longest":
        return longest(successful);
      case "fastest":
        return fastest(successful);
      default:
        return bestOfN(successful);
    }
  }

  function bestOfN(responses) {
    const scored = responses.map((r) => ({
      ...r,
      score: qualityScorer ? qualityScorer(r) : scoreResponse(r),
    }));
    scored.sort((a, b) => b.score - a.score);
    return {
      result: scored[0],
      consensus: scored.length > 1 ? scored[0].score > scored[1].score : true,
      allResponses: scored,
      strategy: "best_of_n",
    };
  }

  function consensusVote(responses) {
    if (responses.length < 2) return bestOfN(responses);

    // 简单的文本相似度投票
    const groups = new Map();
    for (const r of responses) {
      const key = normalizeForComparison(r.text ?? r.content ?? "").slice(0, 200);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    // 找到最大的一致组
    let maxGroup = [];
    for (const group of groups.values()) {
      if (group.length > maxGroup.length) maxGroup = group;
    }

    const consensusRatio = maxGroup.length / responses.length;
    return {
      result: maxGroup[0],
      consensus: consensusRatio > 0.5,
      consensusRatio,
      allResponses: responses,
      strategy: "consensus",
    };
  }

  function longest(responses) {
    responses.sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0));
    return { result: responses[0], consensus: true, allResponses: responses, strategy: "longest" };
  }

  function fastest(responses) {
    responses.sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity));
    return { result: responses[0], consensus: true, allResponses: responses, strategy: "fastest" };
  }

  function scoreResponse(response) {
    let score = 0;
    const text = response.text ?? response.content ?? "";
    if (text.length > 0) score += 0.2;
    if (text.length > 50) score += 0.2;
    if (text.length > 200) score += 0.1;
    if (response.toolCalls?.length > 0) score += 0.3;
    if (response.finishReason === "stop") score += 0.2;
    return Math.min(1, score);
  }

  function normalizeForComparison(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
  }

  function timeout(ms) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
  }

  return { aggregate, getStats: () => ({ strategies: ["best_of_n", "consensus", "longest", "fastest"] }) };
}
