// =============================================================================
// 性能统计管理器 (Performance Stats Manager)
// 从 neuronRuntimeExecutor.js 提取的性能统计功能
// =============================================================================

import { now } from "./neuronRuntimeUtils.js";

// ---------------------------------------------------------------------------
// 性能统计管理
// ---------------------------------------------------------------------------

/**
 * 创建性能统计管理器
 * @returns {Object}
 */
export function createPerformanceStatsManager() {
  /**
   * 性能统计数据
   * Map<string, { totalCalls, totalMs, successCount, errorCount, lastCallAt, avgMs, minMs, maxMs }>
   */
  const stats = new Map();

  /**
   * 按钩子阶段的统计
   * Map<hookName, { totalCalls, totalMs, neuronBreakdown: Map<skillId, {calls, ms}> }>
   */
  const hookStats = new Map();

  return {
    /**
     * 记录一次神经元执行的性能数据
     * @param {string} skillId - 技能 ID
     * @param {number} durationMs - 执行耗时
     * @param {boolean} success - 是否成功
     * @param {string} [hookName] - 触发的钩子名称
     */
    recordExecution(skillId, durationMs, success, hookName) {
      // 按技能统计
      if (!stats.has(skillId)) {
        stats.set(skillId, {
          totalCalls: 0,
          totalMs: 0,
          successCount: 0,
          errorCount: 0,
          lastCallAt: null,
          avgMs: 0,
          minMs: Infinity,
          maxMs: 0,
        });
      }

      const s = stats.get(skillId);
      s.totalCalls++;
      s.totalMs += durationMs;
      s.avgMs = Math.round(s.totalMs / s.totalCalls);
      s.minMs = Math.min(s.minMs, durationMs);
      s.maxMs = Math.max(s.maxMs, durationMs);
      s.lastCallAt = now();

      if (success) {
        s.successCount++;
      } else {
        s.errorCount++;
      }

      // 按钩子统计
      if (hookName) {
        if (!hookStats.has(hookName)) {
          hookStats.set(hookName, {
            totalCalls: 0,
            totalMs: 0,
            neuronBreakdown: new Map(),
          });
        }
        const hs = hookStats.get(hookName);
        hs.totalCalls++;
        hs.totalMs += durationMs;

        if (!hs.neuronBreakdown.has(skillId)) {
          hs.neuronBreakdown.set(skillId, { calls: 0, ms: 0 });
        }
        const nb = hs.neuronBreakdown.get(skillId);
        nb.calls++;
        nb.ms += durationMs;
      }
    },

    /**
     * 获取指定技能的性能统计
     * @param {string} skillId
     * @returns {Object|null}
     */
    getSkillStats(skillId) {
      const s = stats.get(skillId);
      if (!s) return null;
      return { ...s, minMs: s.minMs === Infinity ? 0 : s.minMs };
    },

    /**
     * 获取所有性能统计
     * @returns {Object}
     */
    getAllStats() {
      const bySkill = {};
      for (const [skillId, s] of stats) {
        bySkill[skillId] = {
          ...s,
          minMs: s.minMs === Infinity ? 0 : s.minMs,
          successRate: s.totalCalls > 0 ? Math.round((s.successCount / s.totalCalls) * 100) : 0,
        };
      }

      const byHook = {};
      for (const [hookName, hs] of hookStats) {
        const breakdown = {};
        for (const [skillId, nb] of hs.neuronBreakdown) {
          breakdown[skillId] = { ...nb };
        }
        byHook[hookName] = {
          totalCalls: hs.totalCalls,
          totalMs: hs.totalMs,
          avgMs: hs.totalCalls > 0 ? Math.round(hs.totalMs / hs.totalCalls) : 0,
          neuronBreakdown: breakdown,
        };
      }

      return { bySkill, byHook, generatedAt: now() };
    },

    /**
     * 重置所有统计
     */
    reset() {
      stats.clear();
      hookStats.clear();
    },
  };
}
