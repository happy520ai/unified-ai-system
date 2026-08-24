import { appendFile as appendFileAsync } from "node:fs/promises";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createResponseCachePolicy } from "./responseCachePolicy.js";
import { inspectCacheSafety, sanitizeCacheText } from "./responseCacheSanitizer.js";
import { createResponseCacheTenantScope } from "./responseCacheTenantScope.ts";

const responseCacheEvidenceDir = fileURLToPath(new URL("../../evidence/response-cache/", import.meta.url));
export const DEFAULT_RESPONSE_CACHE_STORE_PATHS = Object.freeze({
  records: resolve(responseCacheEvidenceDir, "response-cache-records.jsonl"),
  index: resolve(responseCacheEvidenceDir, "response-cache-index.json"),
  summary: resolve(responseCacheEvidenceDir, "response-cache-summary.json"),
  audit: resolve(responseCacheEvidenceDir, "response-cache-audit-trail.jsonl"),
});

const DEFAULT_MAX_INDEX_ENTRIES = 1_000;
const DEFAULT_AUDIT_BUFFER_LIMIT = 500;
const DEFAULT_AUDIT_FLUSH_INTERVAL_MS = 30_000;

/**
 * Create a response cache store instance.
 *
 * Options exist so callers (and tests) can scope storage paths and resource
 * limits; the module-level default instance below keeps the original exported
 * function signatures intact for the HTTP routes.
 */
export function createResponseCacheStore(options = {}) {
  const paths = { ...DEFAULT_RESPONSE_CACHE_STORE_PATHS, ...options.paths };
  const maxIndexEntries = readPositiveInt(options.maxIndexEntries, DEFAULT_MAX_INDEX_ENTRIES);
  const auditBufferLimit = readPositiveInt(options.auditBufferLimit, DEFAULT_AUDIT_BUFFER_LIMIT);
  const auditFlushIntervalMs = Number.isFinite(Number(options.auditFlushIntervalMs))
    ? Math.max(0, Math.floor(Number(options.auditFlushIntervalMs)))
    : DEFAULT_AUDIT_FLUSH_INTERVAL_MS;

  // In-memory ring buffer for audit entries; flushed to disk in batches so a
  // cache miss no longer pays a synchronous append on every lookup.
  const auditBuffer = [];
  let auditFlushTimer = null;
  let auditFlushChain = Promise.resolve();

  function lookupCache(input = {}) {
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

  function writeCacheRecord(input = {}, responseValue, metadata = {}) {
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
    pruneExpiredIndexEntries(index, now);
    // Refresh insertion order: a rewritten key counts as the newest entry.
    delete index[record.cacheKey];
    index[record.cacheKey] = record;
    evictIndexEntriesForCap(index, maxIndexEntries);
    ensureDir(paths.records);
    appendFileSync(resolve(process.cwd(), paths.records), `${JSON.stringify(record)}\n`, "utf8");
    writeJson(paths.index, index);
    writeJson(paths.summary, createSummary(index));
    return auditResult("write", { cacheDecision: "hit", cacheHitType: "exact_hit", writeSucceeded: true, ...record });
  }

  function invalidateCache(input = {}) {
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

  function readCacheSummary(options = {}) {
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
    auditBuffer.push(result);
    if (auditBuffer.length > auditBufferLimit) {
      auditBuffer.splice(0, auditBuffer.length - auditBufferLimit);
    }
    scheduleAuditFlush();
    return result;
  }

  function scheduleAuditFlush() {
    if (auditFlushTimer || auditFlushIntervalMs <= 0) return;
    auditFlushTimer = setInterval(() => {
      flushAuditBuffer();
    }, auditFlushIntervalMs);
    // Never keep the process alive just for the audit timer.
    auditFlushTimer.unref?.();
  }

  function flushAuditBuffer() {
    if (auditBuffer.length === 0) return auditFlushChain;
    const chunk = auditBuffer.splice(0, auditBuffer.length);
    const lines = chunk.map((entry) => `${JSON.stringify(entry)}\n`).join("");
    ensureDir(paths.audit);
    auditFlushChain = auditFlushChain
      .then(() => appendFileAsync(resolve(process.cwd(), paths.audit), lines, "utf8"))
      .catch((error) => {
        console.warn(`[responseCacheStore] failed to append audit batch: ${error?.message ?? error}`);
      });
    return auditFlushChain;
  }

  async function closeStore() {
    if (auditFlushTimer) {
      clearInterval(auditFlushTimer);
      auditFlushTimer = null;
    }
    await flushAuditBuffer();
  }

  return {
    lookupCache,
    writeCacheRecord,
    invalidateCache,
    readCacheSummary,
    flush: flushAuditBuffer,
    close: closeStore,
  };
}

// Default instance backing the original module-level exports (routes keep
// calling lookupCache/writeCacheRecord/... unchanged).
const defaultResponseCacheStore = createResponseCacheStore();

export function lookupCache(input = {}) {
  return defaultResponseCacheStore.lookupCache(input);
}

export function writeCacheRecord(input = {}, responseValue, metadata = {}) {
  return defaultResponseCacheStore.writeCacheRecord(input, responseValue, metadata);
}

export function invalidateCache(input = {}) {
  return defaultResponseCacheStore.invalidateCache(input);
}

export function readCacheSummary(options = {}) {
  return defaultResponseCacheStore.readCacheSummary(options);
}

export function flushResponseCacheStore() {
  return defaultResponseCacheStore.flush();
}

export function closeResponseCacheStore() {
  return defaultResponseCacheStore.close();
}

// Drop entries whose TTL already elapsed; called on every write path so the
// on-disk index cannot grow without bound through expired leftovers.
function pruneExpiredIndexEntries(index, now) {
  for (const cacheKey of Object.keys(index)) {
    const record = index[cacheKey];
    if (!record || typeof record !== "object") {
      delete index[cacheKey];
      continue;
    }
    if (Number(record.expiresAt ?? 0) < now) {
      delete index[cacheKey];
    }
  }
}

// Enforce the index entry cap: evict the oldest invalidated entries first,
// then fall back to evicting the oldest entries by insertion order.
function evictIndexEntriesForCap(index, maxEntries) {
  const cacheKeys = Object.keys(index);
  let overflow = cacheKeys.length - maxEntries;
  if (overflow <= 0) return;
  for (const cacheKey of cacheKeys) {
    if (overflow <= 0) break;
    if (index[cacheKey]?.invalidated) {
      delete index[cacheKey];
      overflow -= 1;
    }
  }
  for (const cacheKey of Object.keys(index)) {
    if (overflow <= 0) break;
    delete index[cacheKey];
    overflow -= 1;
  }
}

function readPositiveInt(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
  try {
    const parsed = JSON.parse(readFileSync(fullPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(`[responseCacheStore] ${path} is not a JSON object; resetting index.`);
      return fallback;
    }
    return parsed;
  } catch (error) {
    // A corrupted index file must not take the cache (or the route) down.
    console.warn(`[responseCacheStore] failed to parse ${path}: ${error?.message ?? error}; resetting index.`);
    return fallback;
  }
}

function writeJson(path, value) {
  ensureDir(path);
  writeFileSync(resolve(process.cwd(), path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureDir(path) {
  mkdirSync(dirname(resolve(process.cwd(), path)), { recursive: true });
}
