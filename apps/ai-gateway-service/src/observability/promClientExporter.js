// =============================================================================
// promClientExporter.js — prom-client 指标导出器
// 替代手写字符串拼接，使用真正的 prom-client 库
// =============================================================================

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

/**
 * 创建 prom-client 指标导出器
 * @param {Object} options
 * @returns {Object}
 */
export function createPromClientExporter(options = {}) {
  const prefix = options.prefix ?? "ai_gateway";

  // 创建注册表
  const register = new Registry();

  // 收集默认指标（CPU、内存、事件循环等）
  collectDefaultMetrics({ register, prefix: `${prefix}_` });

  // ── 自定义指标 ──

  // 请求计数器
  const httpRequestsTotal = new Counter({
    name: `${prefix}_http_requests_total`,
    help: "Total number of HTTP requests",
    labelNames: ["method", "path", "status"],
    registers: [register],
  });

  // 请求延迟直方图
  const httpRequestDuration = new Histogram({
    name: `${prefix}_http_request_duration_ms`,
    help: "HTTP request duration in milliseconds",
    labelNames: ["method", "path"],
    buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
    registers: [register],
  });

  // 活跃连接数
  const activeConnections = new Gauge({
    name: `${prefix}_active_connections`,
    help: "Number of active connections",
    registers: [register],
  });

  // Provider 调用计数
  const providerCallsTotal = new Counter({
    name: `${prefix}_provider_calls_total`,
    help: "Total number of provider calls",
    labelNames: ["provider", "model", "status"],
    registers: [register],
  });

  // Provider 调用延迟
  const providerCallDuration = new Histogram({
    name: `${prefix}_provider_call_duration_ms`,
    help: "Provider call duration in milliseconds",
    labelNames: ["provider", "model"],
    buckets: [100, 500, 1000, 2000, 5000, 10000, 20000, 30000],
    registers: [register],
  });

  // Token 使用量
  const tokensTotal = new Counter({
    name: `${prefix}_tokens_total`,
    help: "Total number of tokens used",
    labelNames: ["provider", "model", "type"], // type: input/output
    registers: [register],
  });

  // 成本
  const costTotal = new Counter({
    name: `${prefix}_cost_usd_total`,
    help: "Total cost in USD",
    labelNames: ["provider", "model"],
    registers: [register],
  });

  // 错误计数
  const errorsTotal = new Counter({
    name: `${prefix}_errors_total`,
    help: "Total number of errors",
    labelNames: ["type", "code"],
    registers: [register],
  });

  // ── 记录方法 ──

  function recordHttpRequest(method, path, status, durationMs) {
    httpRequestsTotal.inc({ method, path, status: String(status) });
    httpRequestDuration.observe({ method, path }, durationMs);
  }

  function recordProviderCall(provider, model, status, durationMs) {
    providerCallsTotal.inc({ provider, model, status });
    providerCallDuration.observe({ provider, model }, durationMs);
  }

  function recordTokens(provider, model, inputTokens, outputTokens) {
    if (inputTokens > 0) tokensTotal.inc({ provider, model, type: "input" }, inputTokens);
    if (outputTokens > 0) tokensTotal.inc({ provider, model, type: "output" }, outputTokens);
  }

  function recordCost(provider, model, costUsd) {
    if (costUsd > 0) costTotal.inc({ provider, model }, costUsd);
  }

  function recordError(type, code) {
    errorsTotal.inc({ type, code });
  }

  function setActiveConnections(count) {
    activeConnections.set(count);
  }

  /**
   * 获取 Prometheus 格式的指标
   * @returns {Promise<string>}
   */
  async function getMetrics() {
    return register.metrics();
  }

  /**
   * 获取 Content-Type
   * @returns {string}
   */
  function getContentType() {
    return register.contentType;
  }

  /**
   * 获取健康状态
   */
  function getHealth() {
    return {
      status: "ready",
      type: "prom-client",
      metricsCount: register._metrics.size,
    };
  }

  return {
    register,
    recordHttpRequest,
    recordProviderCall,
    recordTokens,
    recordCost,
    recordError,
    setActiveConnections,
    getMetrics,
    getContentType,
    getHealth,
  };
}
