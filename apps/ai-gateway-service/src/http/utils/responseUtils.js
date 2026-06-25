import { readJson, writeJson } from "../../entrypoints/entrypointUtils.js";
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
 * 写企业错误响应
 */
export function writeEnterpriseError({ response, error, startedAt, fallbackCode, writeJsonFn }) {
  const code = error?.code ?? fallbackCode ?? "enterprise_error";
  const message = error instanceof Error ? error.message : "Enterprise operation failed";
  const status = error?.statusCode ?? 500;
  writeJsonFn(response, status, {
    status: "error",
    error: { code, message },
    meta: { startedAt, completedAt: Date.now(), durationMs: Date.now() - startedAt },
  });
}

/**
 * 写能力错误响应
 */
export function writeCapabilityError({ response, error, startedAt, fallbackCode, writeJsonFn }) {
  const code = error?.code ?? fallbackCode ?? "capability_error";
  const message = error instanceof Error ? error.message : "Capability operation failed";
  const status = error?.statusCode ?? 500;
  writeJsonFn(response, status, {
    status: "error",
    error: { code, message },
    meta: { startedAt, completedAt: Date.now(), durationMs: Date.now() - startedAt },
  });
}

/**
 * 读取有界整数
 */
export function readBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
