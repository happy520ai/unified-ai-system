// =============================================================================
// 神经元运行时执行器 (Neuron Runtime Executor)
// 将已注册的神经元集成到网关的请求处理流程中
//
// 集成点：
// 1. 聊天网关执行前 → 调用 safety 类型神经元进行风险分类
// 2. 路由决策时 → 调用 context 类型神经元优化上下文
// 3. 模型选择后 → 调用 review 类型神经元评估是否需要 God Mode
// 4. 响应返回前 → 调用 evidence 类型神经元记录证据
// =============================================================================

import {
  DEFAULT_EXECUTION_LOG_PATH,
  TYPE_TO_HOOK_STAGE,
  MAX_EXECUTION_TIMEOUT_MS,
  DEFAULT_NEURON_TIMEOUT_MS,
} from "./neuronRuntimeConstants.js";
import { withTimeout, now, timedExecution } from "./neuronRuntimeUtils.js";
import { createExecutionLogManager } from "./executionLogManager.js";
import { createPerformanceStatsManager } from "./performanceStatsManager.js";
import { getActiveSkillsByType, matchesContext } from "./neuronRuntimeHelpers.js";
import { registerHooks } from "./neuronRuntimeHooks.js";

// ---------------------------------------------------------------------------
// 工厂函数：创建神经元运行时执行器
// ---------------------------------------------------------------------------

/**
 * 创建神经元运行时执行器实例
 *
 * @param {Object} [options={}] - 配置选项
 * @param {Object} options.registry - LiveSkillRegistry 实例
 * @param {number} [options.defaultTimeoutMs=15000] - 默认神经元超时
 * @param {number} [options.maxBatchTimeoutMs=30000] - 批量执行总超时
 * @param {boolean} [options.failOpen=true] - 神经元失败时是否放行（true=放行, false=阻断）
 * @param {boolean} [options.enableLogging=true] - 是否启用执行日志
 * @param {string} [options.executionLogPath] - 执行日志文件路径
 * @returns {Object} 执行器 API 对象
 */
export function createNeuronRuntimeExecutor(options = {}) {
  const registry = options.registry;

  if (!registry) {
    throw new Error("[neuronRuntimeExecutor] registry option is required (provide a LiveSkillRegistry instance)");
  }

  const defaultTimeoutMs = options.defaultTimeoutMs || DEFAULT_NEURON_TIMEOUT_MS;
  const maxBatchTimeoutMs = options.maxBatchTimeoutMs || MAX_EXECUTION_TIMEOUT_MS;
  const failOpen = options.failOpen !== undefined ? options.failOpen : true;
  const enableLogging = options.enableLogging !== undefined ? options.enableLogging : true;
  const executionLogPath = options.executionLogPath || DEFAULT_EXECUTION_LOG_PATH;

  /** 执行日志管理器 */
  const logManager = createExecutionLogManager(executionLogPath);

  /** 性能统计管理器 */
  const perfManager = createPerformanceStatsManager();

  // -------------------------------------------------------------------------
  // 内部方法
  // -------------------------------------------------------------------------

  /**
   * 执行单个神经元并记录日志和性能数据
   * @param {Object} skill - 技能条目
   * @param {*} input - 输入数据
   * @param {Object} context - 执行上下文
   * @param {string} [hookName] - 触发钩子名称
   * @returns {Promise<Object>} 执行结果
   */
  async function executeSkillWithTracking(skill, input, context, hookName) {
    const startTs = now();
    const { result, durationMs } = await timedExecution(() =>
      registry.execute(skill.skillId, input, context),
    );

    const success = result?.success === true;

    // 记录性能统计
    perfManager.recordExecution(skill.skillId, durationMs, success, hookName);

    // 记录执行日志
    if (enableLogging) {
      const logEntry = {
        timestamp: startTs,
        skillId: skill.skillId,
        type: skill.type,
        hookName: hookName || null,
        success,
        durationMs,
        error: result?.error || null,
        contextMode: context.mode || "default",
        contextStress: context.stressType || "normal",
      };
      logManager.record(logEntry);
    }

    return {
      skillId: skill.skillId,
      type: skill.type,
      success,
      result: result?.result ?? null,
      error: result?.error || null,
      durationMs,
    };
  }

  // -------------------------------------------------------------------------
  // 公开 API
  // -------------------------------------------------------------------------

  const api = {
    // -----------------------------------------------------------------------
    // 按类型批量执行神经元
    // -----------------------------------------------------------------------

    /**
     * 按类型批量执行所有匹配的活跃神经元
     *
     * 执行流程：
     * 1. 从注册表获取所有该类型的 active 技能
     * 2. 按 synapse.weight 排序（权重高的先执行）
     * 3. 检查模式匹配（当前 mode 是否在 synapse.modes 中）
     * 4. 检查压力类型匹配
     * 5. 按顺序执行每个神经元
     * 6. 汇总结果
     *
     * @param {string} type - 神经元类型（safety/context/review/evidence 等）
     * @param {*} input - 输入数据
     * @param {Object} [context={}] - 执行上下文
     * @returns {Promise<Object>} { results, summary, executionMs }
     */
    async executeByType(type, input, context = {}) {
      const batchStart = Date.now();

      // 1. 获取所有该类型的活跃技能
      const skills = await getActiveSkillsByType(registry, type);

      if (skills.length === 0) {
        return {
          type,
          results: [],
          summary: {
            total: 0,
            executed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
          },
          executionMs: Date.now() - batchStart,
        };
      }

      // 2. 过滤出匹配当前上下文的技能
      const matchedSkills = skills.filter((s) => matchesContext(s, context));
      const skippedCount = skills.length - matchedSkills.length;

      // 3. 按顺序执行每个神经元（带批量超时保护）
      const results = [];
      let succeededCount = 0;
      let failedCount = 0;

      for (const skill of matchedSkills) {
        // 检查批量超时
        const elapsed = Date.now() - batchStart;
        if (elapsed >= maxBatchTimeoutMs) {
          results.push({
            skillId: skill.skillId,
            type: skill.type,
            success: false,
            error: "batch_timeout",
            durationMs: 0,
          });
          failedCount++;
          continue;
        }

        try {
          const execResult = await executeSkillWithTracking(skill, input, context);
          results.push(execResult);

          if (execResult.success) {
            succeededCount++;
          } else {
            failedCount++;

            // failOpen=false 时，遇到失败立即停止
            if (!failOpen) {
              break;
            }
          }
        } catch (unexpectedError) {
          results.push({
            skillId: skill.skillId,
            type: skill.type,
            success: false,
            error: unexpectedError.message,
            durationMs: 0,
          });
          failedCount++;

          if (!failOpen) {
            break;
          }
        }
      }

      const totalExecutionMs = Date.now() - batchStart;

      return {
        type,
        results,
        summary: {
          total: skills.length,
          matched: matchedSkills.length,
          executed: results.length,
          succeeded: succeededCount,
          failed: failedCount,
          skipped: skippedCount,
        },
        executionMs: totalExecutionMs,
        context: {
          mode: context.mode || "default",
          stressType: context.stressType || "normal",
        },
      };
    },

    // -----------------------------------------------------------------------
    // 执行单个神经元
    // -----------------------------------------------------------------------

    /**
     * 执行单个指定神经元（带超时保护）
     *
     * @param {string} skillId - 技能 ID
     * @param {*} input - 输入数据
     * @param {Object} [context={}] - 执行上下文
     * @returns {Promise<Object>} 执行结果
     */
    async executeOne(skillId, input, context = {}) {
      // 获取技能以读取超时配置
      const skill = await registry.get(skillId);
      if (!skill) {
        return {
          success: false,
          error: "skill_not_found",
          message: `Skill "${skillId}" is not registered.`,
        };
      }

      // 计算超时：min(spec.runtime.ttlSeconds * 1000, MAX_EXECUTION_TIMEOUT_MS)
      const ttlSeconds = skill.runtime?.ttlSeconds || 30;
      const timeoutMs = Math.min(ttlSeconds * 1000, MAX_EXECUTION_TIMEOUT_MS);

      try {
        const execResult = await withTimeout(
          executeSkillWithTracking(skill, input, context),
          timeoutMs,
          `executeOne("${skillId}")`,
        );
        return execResult;
      } catch (timeoutError) {
        // 超时记录
        perfManager.recordExecution(skillId, timeoutMs, false);

        if (enableLogging) {
          logManager.record({
            timestamp: now(),
            skillId,
            type: skill.type,
            success: false,
            error: timeoutError.message,
            durationMs: timeoutMs,
          });
        }

        return {
          success: false,
          skillId,
          error: "execution_timeout",
          message: timeoutError.message,
          timeoutMs,
        };
      }
    },

    // -----------------------------------------------------------------------
    // 钩子注册
    // -----------------------------------------------------------------------

    /**
     * 注册生命周期钩子
     *
     * 返回一个 hooks 对象，可以被 httpServer.js 或 gatewayService.js 调用，
     * 在请求处理的不同阶段自动触发对应类型的神经元。
     *
     * @returns {Object} hooks 对象
     */
    registerHooks() {
      return registerHooks(api, failOpen);
    },

    // -----------------------------------------------------------------------
    // 执行日志
    // -----------------------------------------------------------------------

    /**
     * 获取指定技能的执行日志
     *
     * @param {string} skillId - 技能 ID（为空时返回所有技能的日志）
     * @param {Object} [options={}] - 选项
     * @param {number} [options.limit=50] - 返回条数限制
     * @returns {Object} 执行日志
     */
    getExecutionLog(skillId, { limit = 50 } = {}) {
      if (skillId) {
        const logs = logManager.getLogs(skillId, limit);
        return {
          skillId,
          logs,
          count: logs.length,
          limit,
        };
      }

      // 返回所有技能的日志
      return {
        allLogs: logManager.getAllLogs(limit),
        stats: logManager.getStats(),
        limit,
      };
    },

    // -----------------------------------------------------------------------
    // 性能统计
    // -----------------------------------------------------------------------

    /**
     * 获取性能统计数据
     * @returns {Object}
     */
    getPerformanceStats() {
      return perfManager.getAllStats();
    },

    // -----------------------------------------------------------------------
    // 辅助方法
    // -----------------------------------------------------------------------

    /**
     * 获取执行器配置信息
     * @returns {Object}
     */
    getConfig() {
      return {
        defaultTimeoutMs,
        maxBatchTimeoutMs,
        failOpen,
        enableLogging,
        executionLogPath,
        registryPath: registry.registryPath,
      };
    },

    /**
     * 获取执行器运行状态摘要
     * @returns {Promise<Object>}
     */
    async getStatus() {
      const registryStats = await registry.getStats();
      const perfStats = perfManager.getAllStats();
      const logStats = logManager.getStats();

      return {
        status: "ready",
        config: api.getConfig(),
        registry: registryStats,
        performance: {
          trackedSkills: Object.keys(perfStats.bySkill).length,
          trackedHooks: Object.keys(perfStats.byHook).length,
        },
        logging: logStats,
        timestamp: now(),
      };
    },

    /**
     * 重置运行时状态（清除日志和性能统计）
     * 不影响注册表数据
     */
    reset() {
      logManager.clear();
      perfManager.reset();
    },

    /**
     * 检查指定类型是否有活跃的神经元可用
     * @param {string} type - 神经元类型
     * @returns {Promise<boolean>}
     */
    async hasActiveNeurons(type) {
      const result = await registry.list({ type, status: "active" });
      return result.skills.length > 0;
    },

    /**
     * 获取所有已注册钩子及其关联的神经元类型
     * @returns {Object}
     */
    getHookMapping() {
      const mapping = {};
      for (const [type, stage] of Object.entries(TYPE_TO_HOOK_STAGE)) {
        if (!mapping[stage]) {
          mapping[stage] = [];
        }
        mapping[stage].push(type);
      }
      return mapping;
    },
  };

  return api;
}
