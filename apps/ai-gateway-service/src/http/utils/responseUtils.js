import { readJson, writeJson } from "../../entrypoints/entrypointUtils.js";
import { createErrorEnvelope } from "@unified-ai-system/shared-utils";
// =============================================================================
// responseUtils.js — HTTP 响应工具函数
// 从 httpServer.js 提取的通用响应工具
// =============================================================================

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB


/**
 * 写服务日志
 */
export function writeServiceLog(event, details = {}, logger) {
  if (logger) {
    logger.info({ event, ...details });
  }
}

/**
 * 统一错误响应 — 使用 shared-utils createErrorEnvelope
 * 替代已移除的 writeEnterpriseError 和 writeCapabilityError
 */
export function writeErrorResponse({ response, error, startedAt, fallbackCode }) {
  const code = error?.code ?? fallbackCode ?? "internal_error";
  const message = error instanceof Error ? error.message : "Operation failed";
  const status = error?.statusCode ?? 500;
  writeJson(response, status, createErrorEnvelope(code, message, {
    startedAt,
    category: error?.category ?? "internal",
    retryable: error?.retryable ?? false,
  }));
}

/**
 * 读取有界整数
 */
export function readBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
