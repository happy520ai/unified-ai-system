// =============================================================================
// openTelemetry.js — OpenTelemetry 分布式追踪集成
// 轻量级实现，不依赖外部 SDK
// =============================================================================

import { randomUUID } from "node:crypto";

/**
 * 创建 OpenTelemetry 追踪器
 * @param {Object} options - { serviceName, enabled }
 * @returns {Object} { startSpan, getActiveSpans, getTraceContext }
 */
export function createTracer(options = {}) {
  const serviceName = options.serviceName ?? "ai-gateway";
  const enabled = options.enabled ?? true;

  // 活跃 span 存储
  const activeSpans = new Map();

  /**
   * 创建新的 span
   * @param {string} name - span 名称
   * @param {Object} parentContext - 父上下文（可选）
   * @returns {Object} span 对象
   */
  function startSpan(name, parentContext = null) {
    if (!enabled) return createNoopSpan();

    const traceId = parentContext?.traceId ?? randomUUID().replace(/-/g, "");
    const spanId = randomUUID().replace(/-/g, "").slice(0, 16);
    const parentSpanId = parentContext?.spanId ?? null;

    const span = {
      traceId,
      spanId,
      parentSpanId,
      name,
      serviceName,
      startTime: Date.now(),
      endTime: null,
      status: "ok",
      attributes: {},
      events: [],
    };

    activeSpans.set(spanId, span);

    // Build span interface (use self-reference for chaining)
    const spanInterface = {
      getTraceId: () => traceId,
      getSpanId: () => spanId,
      getParentSpanId: () => parentSpanId,

      setAttribute: (key, value) => {
        span.attributes[key] = value;
        return spanInterface;
      },

      addEvent: (name, attributes = {}) => {
        span.events.push({
          name,
          timestamp: Date.now(),
          attributes,
        });
        return spanInterface;
      },

      setStatus: (status, message) => {
        span.status = status;
        if (message) span.attributes.statusMessage = message;
        return spanInterface;
      },

      end: () => {
        span.endTime = Date.now();
        span.durationMs = span.endTime - span.startTime;
        activeSpans.delete(spanId);
        return span;
      },

      getContext: () => ({
        traceId,
        spanId,
        parentSpanId,
      }),

      toObject: () => ({ ...span }),
    };
    return spanInterface;
  }

  /**
   * 获取当前活跃的 span 数量
   */
  function getActiveSpanCount() {
    return activeSpans.size;
  }

  /**
   * 获取所有活跃 span 的摘要
   */
  function getActiveSpans() {
    return Array.from(activeSpans.values()).map((span) => ({
      traceId: span.traceId,
      spanId: span.spanId,
      name: span.name,
      durationMs: Date.now() - span.startTime,
    }));
  }

  /**
   * 从请求头中提取追踪上下文
   * @param {Object} headers - HTTP 请求头
   * @returns {Object|null} 追踪上下文
   */
  function extractContext(headers) {
    const traceId = headers?.["x-trace-id"] ?? headers?.["traceparent"]?.split("-")[1];
    const spanId = headers?.["x-span-id"] ?? headers?.["traceparent"]?.split("-")[2];
    if (traceId && spanId) {
      return { traceId, spanId };
    }
    return null;
  }

  /**
   * 将追踪上下文注入到请求头
   * @param {Object} context - 追踪上下文
   * @returns {Object} 请求头
   */
  function injectHeaders(context) {
    if (!context) return {};
    return {
      "x-trace-id": context.traceId,
      "x-span-id": context.spanId,
      "traceparent": `00-${context.traceId}-${context.spanId}-01`,
    };
  }

  return {
    startSpan,
    getActiveSpanCount,
    getActiveSpans,
    extractContext,
    injectHeaders,
    serviceName,
    enabled,
  };
}

/**
 * 创建空操作 span（追踪禁用时使用）
 */
function createNoopSpan() {
  return {
    getTraceId: () => "noop",
    getSpanId: () => "noop",
    getParentSpanId: () => null,
    setAttribute: () => {},
    addEvent: () => {},
    setStatus: () => {},
    end: () => ({}),
    getContext: () => ({ traceId: "noop", spanId: "noop" }),
    toObject: () => ({}),
  };
}
