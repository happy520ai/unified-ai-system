// =============================================================================
// fallbackChain.js — 智能 Fallback 链
// 一级失败自动切二级，全链路透明，用户无感知
// =============================================================================

import { randomUUID } from "node:crypto";
import { sleep } from "../entrypoints/entrypointUtils.js"


/**
 * 创建智能 Fallback 链
 * @param {Object} options
 * @returns {Object}
 */
export function createFallbackChain(options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 500;
  const circuitBreakerRegistry = options.circuitBreakerRegistry;
  const providerRegistry = options.providerRegistry;

  // Fallback 规则
  const fallbackRules = new Map();
  const fallbackHistory = [];
  const MAX_HISTORY = 10000;

  /**
   * 注册 Fallback 规则
   * @param {string} primaryProvider - 主 Provider
   * @param {Array<string>} fallbackProviders - 备用 Provider 列表
   * @param {Object} conditions - 触发条件
   */
  function registerFallback(primaryProvider, fallbackProviders, conditions = {}) {
    fallbackRules.set(primaryProvider, {
      fallbacks: fallbackProviders,
      conditions: {
        statusCodes: conditions.statusCodes ?? [429, 500, 502, 503, 504],
        errorTypes: conditions.errorTypes ?? ["TIMEOUT", "ECONNREFUSED", "ETIMEDOUT"],
        maxLatencyMs: conditions.maxLatencyMs ?? 30000,
        ...conditions,
      },
    });
  }

  /**
   * 执行带 Fallback 的请求
   * @param {Function} requestFn - 请求函数 (providerId) => Promise<response>
   * @param {Array<string>} providerChain - Provider 链
   * @param {Object} context - 请求上下文
   * @returns {Object} { response, provider, fallbackUsed, attempts }
   */
  async function execute(requestFn, providerChain, context = {}) {
    const traceId = context.traceId ?? randomUUID().slice(0, 8);
    const attempts = [];
    let lastError = null;

    for (let i = 0; i < providerChain.length && i < maxRetries; i++) {
      const providerId = providerChain[i];
      const attemptStart = Date.now();

      // 检查熔断器
      if (circuitBreakerRegistry) {
        const breaker = circuitBreakerRegistry.getOrCreate(providerId);
        if (breaker.getState() === "open") {
          attempts.push({
            provider: providerId,
            status: "skipped",
            reason: "circuit_open",
            latencyMs: 0,
          });
          continue;
        }
      }

      try {
        const response = await requestFn(providerId);
        const latencyMs = Date.now() - attemptStart;

        attempts.push({
          provider: providerId,
          status: "success",
          latencyMs,
          statusCode: response?.status ?? 200,
        });

        // 记录成功
        if (circuitBreakerRegistry) {
          const breaker = circuitBreakerRegistry.getOrCreate(providerId);
          breaker.recordSuccess?.();
        }

        return {
          response,
          provider: providerId,
          fallbackUsed: i > 0,
          fallbackFrom: i > 0 ? providerChain[0] : null,
          attempts,
          traceId,
        };
      } catch (error) {
        const latencyMs = Date.now() - attemptStart;
        lastError = error;

        attempts.push({
          provider: providerId,
          status: "failed",
          latencyMs,
          error: error.message,
          errorCode: error.code,
        });

        // 记录失败
        if (circuitBreakerRegistry) {
          const breaker = circuitBreakerRegistry.getOrCreate(providerId);
          breaker.recordFailure?.();
        }

        // 检查是否应该重试
        if (!shouldRetry(error, providerId)) {
          break;
        }

        // 重试延迟（指数退避）
        if (i < providerChain.length - 1) {
          const delay = retryDelayMs * Math.pow(2, i);
          await sleep(Math.min(delay, 10000));
        }
      }
    }

    // 所有 Provider 都失败
    const record = {
      traceId,
      timestamp: Date.now(),
      providerChain,
      attempts,
      finalError: lastError?.message,
    };
    fallbackHistory.push(record);
    if (fallbackHistory.length > MAX_HISTORY) fallbackHistory.shift();

    throw lastError ?? new Error("All providers in fallback chain failed");
  }

  /**
   * 检查是否应该重试
   */
  function shouldRetry(error, providerId) {
    const rule = fallbackRules.get(providerId);
    if (!rule) return true;

    // 检查状态码
    if (error.statusCode && !rule.conditions.statusCodes.includes(error.statusCode)) {
      return false;
    }

    // 检查错误类型
    if (error.code && !rule.conditions.errorTypes.includes(error.code)) {
      return false;
    }

    return true;
  }

  /**
   * 构建 Provider 链
   * @param {string} primaryProvider - 主 Provider
   * @param {Object} context - { taskType, priority }
   * @returns {Array<string>}
   */
  function buildChain(primaryProvider, context = {}) {
    const chain = [primaryProvider];
    const rule = fallbackRules.get(primaryProvider);

    if (rule) {
      chain.push(...rule.fallbacks);
    }

    // 去重
    return [...new Set(chain)];
  }

  /**
   * 获取 Fallback 历史
   * @param {Object} filter
   * @returns {Array}
   */
  function getHistory(filter = {}) {
    let records = [...fallbackHistory];
    if (filter.since) records = records.filter((r) => r.timestamp >= filter.since);
    if (filter.provider) records = records.filter((r) => r.providerChain.includes(filter.provider));
    return records.slice(0, filter.limit ?? 50);
  }

  /**
   * 获取统计
   */
  function getStats() {
    const totalExecutions = fallbackHistory.length;
    const fallbackExecutions = fallbackHistory.filter((r) => r.attempts?.length > 1).length;
    const successfulFallbacks = fallbackHistory.filter((r) =>
      r.attempts?.some((a) => a.status === "success")
    ).length;

    return {
      registeredRules: fallbackRules.size,
      totalExecutions,
      fallbackExecutions,
      successfulFallbacks,
      fallbackRate: totalExecutions > 0 ? fallbackExecutions / totalExecutions : 0,
      fallbackSuccessRate: fallbackExecutions > 0 ? successfulFallbacks / fallbackExecutions : 0,
    };
  }

  return { registerFallback, execute, buildChain, getHistory, getStats };
}

