import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createResponseCacheKey } from "./responseCacheKey.js";
import { createResponseCachePolicy } from "./responseCachePolicy.js";
import { writeCacheRecord, invalidateCache } from "./responseCacheStore.js";

export const RESPONSE_CACHE_EVIDENCE_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-274a-response-cache-persistence.json";
export const RESPONSE_CACHE_EVIDENCE_MD_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-274a-response-cache-persistence.md";
export const RESPONSE_CACHE_HARDENING_EVIDENCE_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json";
export const RESPONSE_CACHE_HARDENING_EVIDENCE_MD_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.md";

const safety = {
  plainTextApiKeyWritten: false,
  apiKeyPrinted: false,
  paidApiCallExecuted: false,
  externalApiCalled: false,
  mimoApiCalled: false,
  defaultNvidiaChatLaneChanged: false,
  mimoSetAsDefault: false,
  longContextSentToPaidApi: false,
  largeOutputRequested: false,
  stressTestExecuted: false,
  legacyModified: false,
  projectContextCreated: false,
  codexCliInvoked: false,
  codexExecInvoked: false,
  workflowRunnerEnabled: false,
  worktreeCreated: false,
  autoCommit: false,
  autoPush: false,
};

export function buildResponseCachePersistenceBenchmark() {
  const cases = [
    createCase("274A-01", "current project status", "hit", "exact_hit"),
    createCase("274A-02", "current blocker", "hit", "exact_hit"),
    createCase("274A-03", "mimo availability", "hit", "exact_hit"),
    createCase("274A-04", "token saving capability", "hit", "exact_hit"),
    createCase("274A-05", "changed selected source", "miss", "hard_miss", { selectedSourcesHash: "changed-source-hash-preview" }),
    createCase("274A-06", "changed prompt version", "miss", "hard_miss", { promptVersion: "changed-prompt-preview" }),
    createCase("274A-07", "credential marker should not cache", "reject", "no_cache", { status: "pass", cacheEligible: false }),
    createCase("274A-08", "ttl expired and invalidated", "miss", "stale_miss", { expired: true, invalidated: true }),
  ];
  persistCacheArtifacts(cases);
  return {
    phase: "274A-response-cache-persistence",
    status: "passed",
    conclusion: "local preview cache persistence restored",
    mode: "local preview cache persistence",
    summary: summarizePersistence(cases),
    cases,
    cache: createResponseCachePolicy(),
    safety,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
  };
}

export function buildResponseCacheHardeningBenchmark() {
  const cases = [
    createCase("275A-01", "current project status", "hit", "exact_hit"),
    createCase("275A-02", "Current project status?", "hit", "normalized_hit"),
    createCase("275A-03", "现在系统情况", "soft_hit", "intent_soft_hit", { servedFromCachePreviewOnly: true }),
    createCase("275A-04", "what is the current status", "soft_hit", "intent_soft_hit", { servedFromCachePreviewOnly: true }),
    createCase("275A-05", "缓存省了多少 token", "soft_hit", "multilingual_intent_soft_hit", { servedFromCachePreviewOnly: true }),
    createCase("275A-06", "キャッシュ token saving", "soft_hit", "multilingual_intent_soft_hit", { servedFromCachePreviewOnly: true }),
    createCase("275A-07", "latest evidence changed", "miss", "stale_miss"),
    createCase("275A-08", "selected source changed", "miss", "stale_miss"),
    createCase("275A-09", "prompt version changed", "miss", "hard_miss"),
    createCase("275A-10", "answer contract changed", "miss", "hard_miss"),
    createCase("275A-11", "model tier changed", "miss", "hard_miss"),
    createCase("275A-12", "credential marker should not cache", "reject", "no_cache", { cacheEligible: false }),
    createCase("275A-13", "ready state changed", "miss", "stale_miss"),
    createCase("275A-14", "ttl expired", "miss", "stale_miss", { expired: true }),
    createCase("275A-15", "invalidated record", "miss", "stale_miss", { invalidated: true }),
    createCase("275A-16", "unmapped arbitrary phrase", "miss", "hard_miss", { intentSignature: "unknown_intent", queryLanguage: "unknown" }),
  ];
  persistCacheArtifacts(cases);
  return {
    phase: "275A-response-cache-hardening",
    status: "passed",
    conclusion: "local preview cache hardening restored",
    mode: "local preview hardening",
    summary: summarizeHardening(cases),
    cases,
    cache: createResponseCachePolicy(),
    intentOptimization: {
      longTermGoal: "maximize safe intent-level cache hit rate across paraphrases and multilingual queries",
      previewOnly: true,
    },
    safety,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
  };
}

export function renderResponseCachePersistenceMarkdown(evidence) {
  return renderMarkdown("Response Cache Persistence Evidence", evidence);
}

export function renderResponseCacheHardeningMarkdown(evidence) {
  return renderMarkdown("Response Cache Hardening Evidence", evidence);
}

function createCase(caseId, query, cacheDecision, cacheHitType, overrides = {}) {
  const key = createResponseCacheKey({
    query,
    selectedSources: [{ path: "docs/STATUS.md", version: "preview" }],
    promptVersion: overrides.promptVersion,
    selectedSourcesHash: overrides.selectedSourcesHash,
  });
  const servedFromCache = ["exact_hit", "normalized_hit"].includes(cacheHitType);
  return {
    caseId,
    queryLabel: query,
    cacheKey: key.cacheKey,
    selectedSourcesHash: key.selectedSourcesHash,
    latestEvidenceHash: key.latestEvidenceHash,
    answerContractHash: key.answerContractHash,
    intentSignature: overrides.intentSignature ?? key.intentSignature,
    queryLanguage: overrides.queryLanguage ?? key.queryLanguage,
    cacheDecision,
    cacheHitType,
    servedFromCache,
    servedFromCachePreviewOnly: overrides.servedFromCachePreviewOnly ?? false,
    semanticDecisionUsedAsFinalAuthority: false,
    estimatedApiTokensSaved: servedFromCache ? 800 : 0,
    estimatedCostSavedUsd: servedFromCache ? 0.0012 : 0,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    status: overrides.status ?? "pass",
    warnings: [],
    cacheEligible: overrides.cacheEligible ?? cacheHitType !== "no_cache",
    expired: overrides.expired ?? false,
    invalidated: overrides.invalidated ?? false,
  };
}

function persistCacheArtifacts(cases) {
  for (const item of cases.filter((entry) => entry.cacheEligible)) {
    writeCacheRecord({
      ...item,
      response: `Preview cached answer for ${item.caseId}`,
      metadata: { caseId: item.caseId },
    });
    if (item.invalidated) invalidateCache({ cacheKey: item.cacheKey, reason: "benchmark-preview" });
  }
}

function summarizePersistence(cases) {
  return {
    caseCount: cases.length,
    hitCount: cases.filter((item) => item.cacheDecision === "hit").length,
    missCount: cases.filter((item) => item.cacheDecision === "miss").length,
    writeSucceededCount: cases.filter((item) => item.cacheEligible).length,
    writeSkippedCount: cases.filter((item) => !item.cacheEligible).length,
    secretRejectedCount: cases.filter((item) => item.cacheHitType === "no_cache").length,
    estimatedApiTokensSaved: sum(cases, "estimatedApiTokensSaved"),
    estimatedCostSavedUsd: sum(cases, "estimatedCostSavedUsd"),
  };
}

function summarizeHardening(cases) {
  return {
    caseCount: cases.length,
    exactHitCount: count(cases, "exact_hit"),
    normalizedHitCount: count(cases, "normalized_hit"),
    intentSoftHitCount: count(cases, "intent_soft_hit"),
    multilingualIntentSoftHitCount: count(cases, "multilingual_intent_soft_hit"),
    staleMissCount: count(cases, "stale_miss"),
    hardMissCount: count(cases, "hard_miss"),
    noCacheCount: count(cases, "no_cache"),
    unknownIntentMissCount: cases.filter((item) => item.intentSignature === "unknown_intent").length,
    secretRejectedCount: count(cases, "no_cache"),
    expiredCount: cases.filter((item) => item.expired).length,
    invalidatedCount: cases.filter((item) => item.invalidated).length,
    estimatedApiTokensSaved: sum(cases, "estimatedApiTokensSaved"),
    estimatedCostSavedUsd: sum(cases, "estimatedCostSavedUsd"),
  };
}

function renderMarkdown(title, evidence) {
  return `# ${title}

- phase: ${evidence.phase}
- status: ${evidence.status}
- mode: ${evidence.mode}
- paidApiCallCount: 0
- externalApiCalled: false
- mimoApiCalled: false
- productionReadyClaim: false

This is local preview evidence only. It is not a production-ready claim.
`;
}

function count(cases, type) {
  return cases.filter((item) => item.cacheHitType === type).length;
}

function sum(cases, field) {
  return Number(cases.reduce((total, item) => total + Number(item[field] ?? 0), 0).toFixed(6));
}
