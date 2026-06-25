// =============================================================================
// costCacheRoutes.js — 成本核算 / 响应缓存路由模块
// 从 httpServer.js 抽取的第二批路由
// =============================================================================

import { readSummary as readTokenCostSummary } from "../cost/tokenCostLedger.js";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";
import { readLatestMimoTokenCalibrationProfile } from "../cost/tokenEstimatorCalibration.js";
import { createResponseCacheKey } from "../cache/responseCacheKey.js";
import { createResponseCachePolicy } from "../cache/responseCachePolicy.js";
import { writeJson } from "./utils/responseUtils.js";
import { createOkEnvelope } from "@unified-ai-system/shared-utils";
import {
  invalidateCache,
  lookupCache,
  readCacheSummary as readResponseCacheSummary,
  writeCacheRecord,
} from "../cache/responseCacheStore.js";
import { listResponseCacheAuditTrail } from "../cache/responseCacheAuditTrail.js";

/**
 * 创建成本/缓存路由 handler 集合
 * @param {Object} application
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createCostCacheRoutes(application) {
  // ── 成本路由 ──

  async function handleCostHealth(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({
      route: "/cost/health",
      status: "ready",
      ledgerSummary: readTokenCostSummary(),
      calibrationProfile: readLatestMimoTokenCalibrationProfile(),
    }, { startedAt }));
  }

  async function handleCostEstimate(req, res, { startedAt, body }) {
    const estimate = {
      providerId: body?.providerId ?? "nvidia",
      modelId: body?.model ?? body?.modelId ?? "unknown",
      estimatedInputTokens: body?.estimatedInputTokens ?? 0,
      estimatedOutputTokens: body?.estimatedOutputTokens ?? 0,
      estimatedCostUsd: 0,
      note: "Cost estimate is advisory; actual cost depends on provider billing.",
    };
    writeJson(res, 200, createOkEnvelope({ route: "/cost/estimate", estimate }, { startedAt }));
  }

  async function handleCostGuardCheck(req, res, { startedAt, body }) {
    const guardResult = checkTokenCostGuard(body ?? {});
    writeJson(res, 200, createOkEnvelope({ route: "/cost/guard/check", ...guardResult }, { startedAt }));
  }

  async function handleCostSummary(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({
      route: "/cost/summary",
      summary: readTokenCostSummary(),
      calibrationProfile: readLatestMimoTokenCalibrationProfile(),
    }, { startedAt }));
  }

  // ── 缓存路由 ──

  async function handleCacheHealth(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({
      route: "/cache/health",
      status: "ready",
      summary: readResponseCacheSummary(),
    }, { startedAt }));
  }

  async function handleCacheLookup(req, res, { startedAt, body }) {
    const key = body?.key ?? body?.prompt ?? "";
    const cacheKey = createResponseCacheKey({ prompt: key, providerId: body?.providerId, model: body?.model });
    const hit = lookupCache(cacheKey);
    writeJson(res, 200, createOkEnvelope({
      route: "/cache/lookup",
      hit: !!hit,
      key: cacheKey,
      entry: hit,
    }, { startedAt }));
  }

  async function handleCacheWrite(req, res, { startedAt, body }) {
    const key = body?.key ?? body?.prompt ?? "";
    const cacheKey = createResponseCacheKey({ prompt: key, providerId: body?.providerId, model: body?.model });
    const policy = createResponseCachePolicy(body ?? {});
    if (policy.cacheable) {
      writeCacheRecord(cacheKey, body?.response ?? body?.value ?? "", body?.metadata ?? {});
    }
    writeJson(res, 200, createOkEnvelope({
      route: "/cache/write",
      key: cacheKey,
      cached: policy.cacheable,
      policy,
    }, { startedAt }));
  }

  async function handleCacheInvalidate(req, res, { startedAt, body }) {
    const key = body?.key ?? "";
    const removed = invalidateCache(key);
    writeJson(res, 200, createOkEnvelope({
      route: "/cache/invalidate",
      key,
      removed,
    }, { startedAt }));
  }

  async function handleCacheSummary(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({
      route: "/cache/summary",
      summary: readResponseCacheSummary(),
    }, { startedAt }));
  }

  async function handleCacheAudit(_req, res, { startedAt }) {
    const audit = listResponseCacheAuditTrail();
    writeJson(res, 200, createOkEnvelope({
      route: "/cache/audit",
      entries: audit,
      count: audit.length,
    }, { startedAt }));
  }

  // ── 导出 ──

  const handlers = new Map([
    ["GET /cost/health", { handler: handleCostHealth, public: false, permission: "provider:read" }],
    ["POST /cost/estimate", { handler: handleCostEstimate, public: false, permission: "provider:read" }],
    ["POST /cost/guard/check", { handler: handleCostGuardCheck, public: false, permission: "provider:read" }],
    ["GET /cost/summary", { handler: handleCostSummary, public: false, permission: "provider:read" }],
    ["GET /cache/health", { handler: handleCacheHealth, public: false, permission: "provider:read" }],
    ["POST /cache/lookup", { handler: handleCacheLookup, public: false, permission: "provider:read" }],
    ["POST /cache/write", { handler: handleCacheWrite, public: false, permission: "provider:read" }],
    ["POST /cache/invalidate", { handler: handleCacheInvalidate, public: false, permission: "provider:read" }],
    ["GET /cache/summary", { handler: handleCacheSummary, public: false, permission: "provider:read" }],
    ["GET /cache/audit", { handler: handleCacheAudit, public: false, permission: "provider:read" }],
  ]);

  return { handlers };
}

// ── 辅助函数 ──
// createOkEnvelope 已提取到 ./utils/responseUtils.js（剃刀律）
