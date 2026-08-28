import { createErrorEnvelope } from "@unified-ai-system/shared-utils";
// =============================================================================

const rawJsonRequestBodies = new WeakMap();

/**
 * Return a defensive copy of the exact bytes consumed by readJson(). A null
 * result means middleware supplied only a parsed body and request-bound proof
 * verification must fail closed.
 */
export function takeRawJsonRequestBody(request) {
  const raw = request && typeof request === "object"
    ? rawJsonRequestBodies.get(request)
    : undefined;
  if (!Buffer.isBuffer(raw)) return null;
  rawJsonRequestBodies.delete(request);
  const copy = Buffer.from(raw);
  raw.fill(0);
  return copy;
}

export function discardRawJsonRequestBody(request) {
  const raw = request && typeof request === "object"
    ? rawJsonRequestBodies.get(request)
    : undefined;
  rawJsonRequestBodies.delete(request);
  if (Buffer.isBuffer(raw)) raw.fill(0);
}
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
  const requestMaxBodyBytes = resolveRequestBodyLimit(request, maxSize);
  const chunks = [];
  let totalSize = 0;
  for await (const chunk of request) {
    totalSize += chunk.length;
    if (totalSize > requestMaxBodyBytes) {
      for (const buffered of chunks) {
        if (Buffer.isBuffer(buffered)) buffered.fill(0);
      }
      if (Buffer.isBuffer(chunk)) chunk.fill(0);
      const bodyError = new Error(`Request body too large (max ${Math.round(requestMaxBodyBytes / 1024)}KB)`);
      bodyError.code = "request_payload_too_large";
      bodyError.statusCode = 413;
      throw bodyError;
    }
    chunks.push(chunk);
  }
  const rawBytes = Buffer.concat(chunks);
  const captureForProof = request?.headers?.["x-ai-gateway-local-client-proof"] !== undefined;
  if (captureForProof) rawJsonRequestBodies.set(request, rawBytes);
  const raw = rawBytes.toString("utf8");
  if (!raw) {
    if (!captureForProof) rawBytes.fill(0);
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!captureForProof) rawBytes.fill(0);
    return parsed;
  } catch (error) {
    rawJsonRequestBodies.delete(request);
    rawBytes.fill(0);
    const parseError = new Error("Request body must be valid JSON.");
    parseError.code = "request_invalid_json";
    parseError.statusCode = 400;
    parseError.cause = error;
    throw parseError;
  }
}

/**
 * Write JSON HTTP response
 */
export function writeJson(response, status, data) {
  if (response.writableEnded || response.destroyed || response.headersSent) {
    return false;
  }
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
  return true;
}

/**
 * Write HTML response
 */
export function writeHtml(response, status, html) {
  if (response.writableEnded || response.destroyed || response.headersSent) {
    return false;
  }
  response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
  return true;
}

/**
 * Write SSE headers for streaming responses
 */
export function writeSseHeaders(response) {
  if (response.writableEnded || response.destroyed || response.headersSent) {
    return false;
  }
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (typeof response.flushHeaders === "function") {
    response.flushHeaders();
  }
  return true;
}

/**
 * Write a single SSE event
 */
export function writeSseEvent(response, event, data) {
  if (response.writableEnded || response.destroyed) return false;
  response.write(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
  return true;
}

function resolveRequestBodyLimit(request, fallbackLimit) {
  const configured = request?.maxBodyBytes;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  if (typeof configured === "string" && Number.isFinite(Number(configured)) && Number(configured) > 0) {
    return Number(configured);
  }
  return fallbackLimit;
}


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
