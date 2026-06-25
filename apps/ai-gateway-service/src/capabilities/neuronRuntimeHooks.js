// =============================================================================
// 神经元运行时钩子注册 (Neuron Runtime Hooks)
// 从 neuronRuntimeExecutor.js 提取的生命周期钩子注册逻辑
// =============================================================================

import { now } from "./neuronRuntimeUtils.js";

/**
 * 注册生命周期钩子
 *
 * 返回一个 hooks 对象，可以被 httpServer.js 或 gatewayService.js 调用，
 * 在请求处理的不同阶段自动触发对应类型的神经元。
 *
 * @param {Object} api - 执行器 API 对象（用于调用 executeByType）
 * @param {boolean} failOpen - 神经元失败时是否放行
 * @returns {Object} hooks 对象
 */
export function registerHooks(api, failOpen) {
  const hooks = {
    /**
     * 聊天网关执行前钩子
     * 执行 safety + planning 类型神经元
     *
     * @param {Object} request - 请求对象
     * @param {Object} context - 请求上下文
     * @returns {Promise<Object>}
     */
    beforeChatExecute: async (request, context = {}) => {
      const hookName = "beforeChatExecute";
      const enrichedContext = { ...context, hookName };

      // 并行执行 safety 和 planning 类型神经元
      const [safetyResult, planningResult] = await Promise.all([
        api.executeByType("safety", request, enrichedContext),
        api.executeByType("planning", request, enrichedContext),
      ]);

      // 汇总：如果任何 safety 神经元标记为高风险，记录警告
      const safetyFlags = safetyResult.results
        .filter((r) => r.success && r.result)
        .map((r) => r.result);

      const highRiskDetected = safetyFlags.some(
        (r) => r.riskLevel === "high" || r.blocked === true,
      );

      return {
        hookName,
        safety: safetyResult,
        planning: planningResult,
        highRiskDetected,
        shouldBlock: highRiskDetected && !failOpen,
        timestamp: now(),
      };
    },

    /**
     * 模型选择后钩子
     * 执行 review 类型神经元，评估是否需要 God Mode 或模型降级
     *
     * @param {Object} selection - 模型选择结果
     * @param {Object} context - 请求上下文
     * @returns {Promise<Object>}
     */
    afterModelSelection: async (selection, context = {}) => {
      const hookName = "afterModelSelection";
      const enrichedContext = { ...context, hookName };

      const reviewResult = await api.executeByType("review", selection, enrichedContext);

      // 检查是否有 review 神经元建议升级到更强模型
      const upgradeSuggestions = reviewResult.results
        .filter((r) => r.success && r.result?.suggestUpgrade)
        .map((r) => ({
          skillId: r.skillId,
          suggestion: r.result.suggestedModel || r.result.suggestion,
          reason: r.result.reason,
        }));

      return {
        hookName,
        review: reviewResult,
        upgradeSuggestions,
        hasUpgradeSuggestions: upgradeSuggestions.length > 0,
        timestamp: now(),
      };
    },

    /**
     * 响应返回前钩子
     * 执行 evidence + context 类型神经元，记录证据并优化响应上下文
     *
     * @param {Object} response - 响应对象
     * @param {Object} context - 请求上下文
     * @returns {Promise<Object>}
     */
    beforeResponseReturn: async (response, context = {}) => {
      const hookName = "beforeResponseReturn";
      const enrichedContext = { ...context, hookName };

      // 并行执行 evidence 和 analysis 类型神经元
      const [evidenceResult, analysisResult] = await Promise.all([
        api.executeByType("evidence", response, enrichedContext),
        api.executeByType("analysis", response, enrichedContext),
      ]);

      // 收集证据记录
      const evidenceRecords = evidenceResult.results
        .filter((r) => r.success && r.result)
        .map((r) => ({
          skillId: r.skillId,
          evidence: r.result,
        }));

      return {
        hookName,
        evidence: evidenceResult,
        analysis: analysisResult,
        evidenceRecords,
        evidenceCount: evidenceRecords.length,
        timestamp: now(),
      };
    },

    /**
     * 路由决策钩子
     * 执行 context + transform 类型神经元，优化路由决策的上下文
     *
     * @param {Object} routingInput - 路由输入
     * @param {Object} context - 请求上下文
     * @returns {Promise<Object>}
     */
    onRoutingDecision: async (routingInput, context = {}) => {
      const hookName = "onRoutingDecision";
      const enrichedContext = { ...context, hookName };

      // 并行执行 context, transform, routing 类型神经元
      const [contextResult, transformResult, routingResult] = await Promise.all([
        api.executeByType("context", routingInput, enrichedContext),
        api.executeByType("transform", routingInput, enrichedContext),
        api.executeByType("routing", routingInput, enrichedContext),
      ]);

      // 收集路由增强建议
      const routingEnhancements = routingResult.results
        .filter((r) => r.success && r.result)
        .map((r) => ({
          skillId: r.skillId,
          enhancement: r.result,
        }));

      return {
        hookName,
        context: contextResult,
        transform: transformResult,
        routing: routingResult,
        routingEnhancements,
        hasEnhancements: routingEnhancements.length > 0,
        timestamp: now(),
      };
    },
  };

  return hooks;
}
