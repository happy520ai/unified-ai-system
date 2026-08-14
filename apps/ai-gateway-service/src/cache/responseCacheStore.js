import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createResponseCachePolicy } from "./responseCachePolicy.js";
import { inspectCacheSafety, sanitizeCacheText } from "./responseCacheSanitizer.js";
import { createResponseCacheTenantScope } from "./responseCacheTenantScope.ts";

const paths = {
  records: "apps/ai-gateway-service/evidence/response-cache/response-cache-records.jsonl",
  index: "apps/ai-gateway-service/evidence/response-cache/response-cache-index.json",
  summary: "apps/ai-gateway-service/evidence/response-cache/response-cache-summary.json",
  audit: "apps/ai-gateway-service/evidence/response-cache/response-cache-audit-trail.jsonl",
};

export function lookupCache(input = {}) {
  const requestInput = typeof input === "string" ? { cacheKey: input } : input;
  const tenantScope = createResponseCacheTenantScope(requestInput.tenantScopeIdentity);
  const cacheKey = tenantScope.scopeCacheKey(requestInput.cacheKey);
  const index = readJson(paths.index, {});
  const record = cacheKey ? index[cacheKey] : null;
  if (!record) return auditResult("lookup", { cacheDecision: "miss", cacheHitType: "hard_miss", cacheKey });
  const expired = Date.now() > Number(record.expiresAt ?? 0);
  if (record.invalidated || expired) {
    return auditResult("lookup", {
      cacheDecision: "miss",
      cacheHitType: "stale_miss",
      cacheKey,
      duplicateReason: record.invalidated ? "invalidated" : "expired",
      expired,
      invalidated: Boolean(record.invalidated),
    });
  }
  return auditResult("lookup", {
    cacheDecision: "hit",
    cacheHitType: record.cacheHitType ?? "exact_hit",
    servedFromCache: true,
    finalDecisionBy: "deterministic_rules",
    ...record,
  });
}

export function writeCacheRecord(input = {}, responseValue, metadata = {}) {
  const recordInput = typeof input === "string"
    ? { cacheKey: input, response: responseValue, metadata }
    : input;
  const tenantScope = createResponseCacheTenantScope(recordInput.tenantScopeIdentity);
  const cacheKey = tenantScope.scopeCacheKey(recordInput.cacheKey);
  const { tenantScopeIdentity: _tenantScopeIdentity, ...cacheInput } = recordInput;
  const policy = createResponseCachePolicy(cacheInput);
  const safety = inspectCacheSafety(cacheInput);
  if (!policy.cacheable || !safety.cacheEligible) {
    return auditResult("reject", {
      cacheDecision: "reject",
      cacheHitType: "no_cache",
      cacheKey,
      reason: safety.rejectionReason ?? "policy_not_cacheable",
      writeSucceeded: false,
    });
  }

  const now = Date.now();
  const record = {
    cacheKey,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + policy.ttlMs,
    responsePreview: sanitizeCacheText(recordInput.response ?? recordInput.value ?? ""),
    metadata: recordInput.metadata ?? {},
    selectedSourcesHash: recordInput.selectedSourcesHash,
    latestEvidenceHash: recordInput.latestEvidenceHash,
    answerContractHash: recordInput.answerContractHash,
    rawQueryHash: recordInput.rawQueryHash,
    normalizedQueryHash: recordInput.normalizedQueryHash ?? recordInput.queryHash,
    intentSignature: recordInput.intentSignature,
    paraphraseGroupId: recordInput.paraphraseGroupId,
    queryLanguage: recordInput.queryLanguage ?? "unknown",
    cacheHitType: recordInput.cacheHitType ?? "exact_hit",
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
  };
  const index = readJson(paths.index, {});
  index[record.cacheKey] = record;
  ensureDir(paths.records);
  appendFileSync(resolve(process.cwd(), paths.records), `${JSON.stringify(record)}\n`, "utf8");
  writeJson(paths.index, index);
  writeJson(paths.summary, createSummary(index));
  return auditResult("write", { cacheDecision: "hit", cacheHitType: "exact_hit", writeSucceeded: true, ...record });
}

export function invalidateCache(input = {}) {
  const requestInput = typeof input === "string" ? { cacheKey: input } : input;
  const tenantScope = createResponseCacheTenantScope(requestInput.tenantScopeIdentity);
  const cacheKey = tenantScope.scopeCacheKey(requestInput.cacheKey);
  const index = readJson(paths.index, {});
  const removed = Boolean(cacheKey && index[cacheKey] && !index[cacheKey].invalidated);
  if (removed) index[cacheKey] = { ...index[cacheKey], invalidated: true, invalidatedAt: new Date().toISOString() };
  writeJson(paths.index, index);
  writeJson(paths.summary, createSummary(index));
  return auditResult("invalidate", { cacheDecision: "miss", cacheHitType: "stale_miss", cacheKey, removed });
}

export function readCacheSummary(options = {}) {
  const tenantScope = createResponseCacheTenantScope(options.tenantScopeIdentity);
  const index = readJson(paths.index, {});
  const tenantIndex = Object.fromEntries(
    Object.entries(index).filter(([cacheKey]) => cacheKey.startsWith(tenantScope.cacheKeyPrefix)),
  );
  return createSummary(tenantIndex);
}

function auditResult(event, fields) {
  const result = {
    event,
    at: new Date().toISOString(),
    servedFromCache: false,
    servedFromCachePreviewOnly: false,
    finalDecisionBy: "deterministic_rules",
    semanticDecisionUsedAsFinalAuthority: false,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    ...fields,
  };
  ensureDir(paths.audit);
  appendFileSync(resolve(process.cwd(), paths.audit), `${JSON.stringify(result)}\n`, "utf8");
  return result;
}

function createSummary(index) {
  const records = Object.values(index);
  return {
    mode: "local-preview-hardening",
    recordCount: records.length,
    activeCount: records.filter((record) => !record.invalidated && Date.now() <= Number(record.expiresAt ?? 0)).length,
    invalidatedCount: records.filter((record) => record.invalidated).length,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
  };
}

function readJson(path, fallback) {
  const fullPath = resolve(process.cwd(), path);
  if (!existsSync(fullPath)) return fallback;
  return JSON.parse(readFileSync(fullPath, "utf8"));
}

function writeJson(path, value) {
  ensureDir(path);
  writeFileSync(resolve(process.cwd(), path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureDir(path) {
  mkdirSync(dirname(resolve(process.cwd(), path)), { recursive: true });
}
