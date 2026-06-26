import { readJson as _readFileJson } from "../../entrypoints/entrypointUtils.js";
import { createErrorEnvelope } from "@unified-ai-system/shared-utils";
// =============================================================================
// responseUtils.js — HTTP 响应工具函数
// 从 httpServer.js 提取的通用响应工具
// =============================================================================

/**
 * Read JSON from HTTP request body
 * @param {object} request — HTTP request
 * @param {number} [maxSize] — Max body size in bytes (default: 1MB)
 */
export async function readJson(request, maxSize = 1_048_576) {
  // If body was already parsed (e.g. by middleware), return it
  if (request.body && typeof request.body === "object") return request.body;
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of request) {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      throw new Error(`Request body too large (max ${Math.round(maxSize / 1024)}KB)`);
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/**
 * Write JSON HTTP response
 */
export function writeJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

/**
 * Write HTML response
 */
export function writeHtml(response, status, html) {
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

/**
 * Write SSE headers for streaming responses
 */
export function writeSseHeaders(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

/**
 * Write a single SSE event
 */
export function writeSseEvent(response, event, data) {
  if (response.writableEnded) return;
  response.write(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
}

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
