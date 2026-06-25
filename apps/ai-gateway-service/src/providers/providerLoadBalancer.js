// =============================================================================
// providerLoadBalancer.js — 智能负载均衡器
// 基于健康评分的加权随机选择
// =============================================================================

import { createProviderHealthScorer } from "./providerHealthScorer.js";

/**
 * 智能负载均衡器
 * @param {Object} options - { healthScorer }
 * @returns {Object} { select, getStatus, healthScorer }
 */
export function createProviderLoadBalancer(options = {}) {
  const healthScorer = options.healthScorer ?? createProviderHealthScorer();

  /**
   * 从候选 Provider 列表中选择一个
   * 使用加权随机：分数越高的 Provider 被选中概率越大
   * @param {string[]} candidateIds
   * @returns {string|null}
   */
  function select(candidateIds) {
    if (!candidateIds || candidateIds.length === 0) return null;
    if (candidateIds.length === 1) return candidateIds[0];

    // 获取每个 Provider 的健康分数
    const scored = candidateIds.map((id) => ({
      id,
      score: Math.max(1, healthScorer.getScore(id)), // 最低 1 分，避免权重为 0
    }));

    // 加权随机选择
    const totalWeight = scored.reduce((sum, p) => sum + p.score, 0);
    let random = Math.random() * totalWeight;

    for (const provider of scored) {
      random -= provider.score;
      if (random <= 0) return provider.id;
    }

    // 兜底：返回最后一个
    return scored[scored.length - 1].id;
  }

  /**
   * 获取负载均衡器状态
   * @param {string[]} candidateIds
   * @returns {Array<{id: string, score: number}>}
   */
  function getStatus(candidateIds) {
    return candidateIds.map((id) => ({
      id,
      score: healthScorer.getScore(id),
    }));
  }

  return { select, getStatus, healthScorer };
}
