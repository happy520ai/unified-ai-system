// =============================================================================
// 执行日志管理器 (Execution Log Manager)
// 从 neuronRuntimeExecutor.js 提取的日志管理功能
// =============================================================================

import { MAX_LOG_ENTRIES_PER_SKILL } from "./neuronRuntimeConstants.js";

// ---------------------------------------------------------------------------
// 执行日志管理（内存 + 持久化）
// ---------------------------------------------------------------------------

/**
 * 创建执行日志管理器
 * @param {string} logPath - JSONL 日志文件路径
 * @returns {Object}
 */
export function createExecutionLogManager(logPath) {
  /**
   * 内存中的执行日志缓冲
   * Map<skillId, Array<LogEntry>>
   */
  const logBuffer = new Map();

  /** 缓冲区大小限制（每个技能最多保留的条目数） */
  const BUFFER_LIMIT = MAX_LOG_ENTRIES_PER_SKILL;

  return {
    /**
     * 记录一条执行日志
     * @param {Object} entry - 日志条目
     */
    record(entry) {
      const skillId = entry.skillId || "unknown";
      if (!logBuffer.has(skillId)) {
        logBuffer.set(skillId, []);
      }
      const buffer = logBuffer.get(skillId);
      buffer.push(entry);

      // 环形缓冲：超出限制时移除最早的条目
      while (buffer.length > BUFFER_LIMIT) {
        buffer.shift();
      }
    },

    /**
     * 获取指定技能的执行日志
     * @param {string} skillId - 技能 ID
     * @param {number} [limit=50] - 返回条数限制
     * @returns {Object[]}
     */
    getLogs(skillId, limit = 50) {
      const buffer = logBuffer.get(skillId);
      if (!buffer) return [];
      return buffer.slice(-limit);
    },

    /**
     * 获取所有技能的日志总览
     * @param {number} [limit=20] - 每个技能最多返回条数
     * @returns {Object}
     */
    getAllLogs(limit = 20) {
      const result = {};
      for (const [skillId, buffer] of logBuffer) {
        result[skillId] = buffer.slice(-limit);
      }
      return result;
    },

    /**
     * 获取日志统计
     * @returns {Object}
     */
    getStats() {
      const stats = {
        totalEntries: 0,
        bySkill: {},
      };
      for (const [skillId, buffer] of logBuffer) {
        stats.totalEntries += buffer.length;
        stats.bySkill[skillId] = buffer.length;
      }
      return stats;
    },

    /**
     * 清空日志缓冲
     */
    clear() {
      logBuffer.clear();
    },
  };
}
