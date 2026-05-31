import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "275A-response-cache-hardening";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const paths = {
  key: "apps/ai-gateway-service/src/cache/responseCacheKey.js",
  policy: "apps/ai-gateway-service/src/cache/responseCachePolicy.js",
  store: "apps/ai-gateway-service/src/cache/responseCacheStore.js",
  sanitizer: "apps/ai-gateway-service/src/cache/responseCacheSanitizer.js",
  duplicateJudge: "apps/ai-gateway-service/src/cache/responseCacheDuplicateJudge.js",
  answerContract: "apps/ai-gateway-service/src/cache/responseCacheAnswerContract.js",
  freshnessGuard: "apps/ai-gateway-service/src/cache/responseCacheFreshnessGuard.js",
  auditTrail: "apps/ai-gateway-service/src/cache/responseCacheAuditTrail.js",
  intentSignature: "apps/ai-gateway-service/src/cache/responseCacheIntentSignature.js",
  languageNormalizer: "apps/ai-gateway-service/src/cache/responseCacheLanguageNormalizer.js",
  benchmark: "apps/ai-gateway-service/src/cache/responseCacheBenchmark.js",
  runner: "apps/ai-gateway-service/src/entrypoints/runResponseCacheHardeningBenchmark.js",
  verifier: "apps/ai-gateway-service/src/entrypoints/verifyResponseCacheHardening.js",
  docs: "docs/RESPONSE_CACHE_PERSISTENCE_HARDENING.md",
  ui: "apps/ai-gateway-service/src/ui/consolePage.js",
  rootPackage: "package.json",
  servicePackage: "apps/ai-gateway-service/package.json",
  evidenceJson: "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json",
  evidenceMd: "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.md",
  cacheRecords: "apps/ai-gateway-service/evidence/response-cache/response-cache-records.jsonl",
  cacheIndex: "apps/ai-gateway-service/evidence/response-cache/response-cache-index.json",
  cacheSummary: "apps/ai-gateway-service/evidence/response-cache/response-cache-summary.json",
  cacheAudit: "apps/ai-gateway-service/evidence/response-cache/response-cache-audit-trail.jsonl",
  phase268: "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  phase269: "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  phase270: "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  phase271: "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  phase272: "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
  phase273: "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json",
  phase274: "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json",
};

const checks = [];

try {
  verify();
  const evidence = readJson(paths.evidenceJson);
  evidence.verifiedAt = new Date().toISOString();
  evidence.verifier = {
    name: "verifyResponseCacheHardening",
    status: "passed",
    checks,
  };
  writeJson(paths.evidenceJson, evidence);
  console.log(JSON.stringify({
    phase: PHASE,
    status: "passed",
    evidenceStatus: evidence.status,
    checks: checks.length,
    caseCount: evidence.summary?.caseCount,
    exactHitCount: evidence.summary?.exactHitCount,
    normalizedHitCount: evidence.summary?.normalizedHitCount,
    intentSoftHitCount: evidence.summary?.intentSoftHitCount,
    multilingualIntentSoftHitCount: evidence.summary?.multilingualIntentSoftHitCount,
    staleMissCount: evidence.summary?.staleMissCount,
    hardMissCount: evidence.summary?.hardMissCount,
    noCacheCount: evidence.summary?.noCacheCount,
    unknownIntentMissCount: evidence.summary?.unknownIntentMissCount,
    secretRejectedCount: evidence.summary?.secretRejectedCount,
    estimatedApiTokensSaved: evidence.summary?.estimatedApiTokensSaved,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    evidenceJsonPath: resolve(repoRoot, paths.evidenceJson),
    evidenceMdPath: resolve(repoRoot, paths.evidenceMd),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    phase: PHASE,
    status: "failed",
    failedCheck: error instanceof Error ? error.message : String(error),
    checks,
  }, null, 2));
  process.exitCode = 1;
}

function verify() {
  for (const [name, relativePath] of Object.entries({
    responseCacheKey: paths.key,
    responseCachePolicy: paths.policy,
    responseCacheStore: paths.store,
    responseCacheSanitizer: paths.sanitizer,
    responseCacheDuplicateJudge: paths.duplicateJudge,
    responseCacheAnswerContract: paths.answerContract,
    responseCacheFreshnessGuard: paths.freshnessGuard,
    responseCacheAuditTrail: paths.auditTrail,
    responseCacheIntentSignature: paths.intentSignature,
    responseCacheLanguageNormalizer: paths.languageNormalizer,
    responseCacheBenchmark: paths.benchmark,
    runResponseCacheHardeningBenchmark: paths.runner,
    docs: paths.docs,
    evidenceJson: paths.evidenceJson,
    evidenceMd: paths.evidenceMd,
    ui: paths.ui,
    rootPackage: paths.rootPackage,
    servicePackage: paths.servicePackage,
    cacheRecords: paths.cacheRecords,
    cacheIndex: paths.cacheIndex,
    cacheSummary: paths.cacheSummary,
    cacheAudit: paths.cacheAudit,
  })) {
    assertCheck(`${name}_exists`, exists(relativePath), relativePath);
  }

  const docs = readText(paths.docs);
  const md = readText(paths.evidenceMd);
  const ui = readText(paths.ui);
  const cacheRecords = readText(paths.cacheRecords);
  const cacheIndex = readText(paths.cacheIndex);
  const cacheSummary = readText(paths.cacheSummary);
  const cacheAudit = readText(paths.cacheAudit);
  const rootPackage = readText(paths.rootPackage);
  const servicePackage = readText(paths.servicePackage);
  const evidence = readJson(paths.evidenceJson);

  for (const section of [
    "Purpose",
    "Current status",
    "Why cache hardening matters after Phase 274A",
    "Duplicate question definition",
    "Intent-level cache hit optimization",
    "Multilingual and paraphrase handling",
    "Cache hit levels",
    "Cache key design",
    "Intent signature",
    "Answer contract",
    "Freshness guard",
    "Selected source hash",
    "Latest evidence hash",
    "Semantic judge slot",
    "Why semantic judge is not final authority",
    "Cache policy",
    "Cache store",
    "Sanitizer and secret rejection",
    "Audit trail",
    "Benchmark cases",
    "Token saving result",
    "Limitations",
    "What this does not do",
    "Safety boundaries",
    "Verification commands",
    "Next phase options",
  ]) {
    assertCheck(`docs_section_${slug(section)}`, docs.includes(section), section);
  }

  for (const marker of [
    "does not call MiMo",
    "does not call any paid API",
    "local preview hardening",
    "does not cache API key",
    "does not cache Authorization header",
    "does not cache api-key header",
    "does not cache env",
    "semanticModelEnabled=false",
    "semanticDecisionUsedAsFinalAuthority=false",
    "intent_soft_hit is preview-only",
    "multilingual_intent_soft_hit is preview-only",
    "deterministic safety gate",
    "does not change default NVIDIA /chat",
    "does not set MiMo as default",
  ]) {
    assertCheck(`docs_marker_${slug(marker)}`, docs.includes(marker), marker);
  }

  assertCheck("root_benchmark_script_exists", rootPackage.includes("\"benchmark:response-cache-hardening\""), paths.rootPackage);
  assertCheck("root_verify_script_exists", rootPackage.includes("\"verify:phase275a-response-cache-hardening\""), paths.rootPackage);
  assertCheck("service_benchmark_script_exists", servicePackage.includes("\"benchmark:response-cache-hardening\""), paths.servicePackage);
  assertCheck("service_verify_script_exists", servicePackage.includes("\"verify:phase275a-response-cache-hardening\""), paths.servicePackage);
  assertCheck("ui_marker_exists", ui.includes("Response Cache Persistence Hardening"), paths.ui);
  assertCheck("ui_intent_fields_exist", ui.includes("intentSoftHitCount") && ui.includes("multilingualIntentSoftHitCount") && ui.includes("unknownIntentMissCount"), paths.ui);
  assertCheck("ui_evidence_path_exists", ui.includes("phase-275a-response-cache-hardening.json"), paths.ui);

  for (const key of ["phase268", "phase269", "phase270", "phase271", "phase272", "phase273", "phase274"]) {
    assertCheck(`${key}_evidence_exists`, exists(paths[key]), paths[key]);
  }

  assertCheck("evidence_status_passed", evidence.status === "passed", evidence.status);
  assertCheck("case_count_at_least_16", Number(evidence.summary?.caseCount) >= 16, evidence.summary?.caseCount);
  assertCheck("exact_hit_count_gt_0", Number(evidence.summary?.exactHitCount) > 0, evidence.summary?.exactHitCount);
  assertCheck("normalized_hit_count_gt_0", Number(evidence.summary?.normalizedHitCount) > 0, evidence.summary?.normalizedHitCount);
  assertCheck("intent_soft_hit_count_gt_0", Number(evidence.summary?.intentSoftHitCount) > 0, evidence.summary?.intentSoftHitCount);
  assertCheck("multilingual_intent_soft_hit_count_gt_0", Number(evidence.summary?.multilingualIntentSoftHitCount) > 0, evidence.summary?.multilingualIntentSoftHitCount);
  assertCheck("stale_miss_count_gt_0", Number(evidence.summary?.staleMissCount) > 0, evidence.summary?.staleMissCount);
  assertCheck("hard_miss_count_gt_0", Number(evidence.summary?.hardMissCount) > 0, evidence.summary?.hardMissCount);
  assertCheck("no_cache_count_gt_0", Number(evidence.summary?.noCacheCount) > 0, evidence.summary?.noCacheCount);
  assertCheck("unknown_intent_miss_count_gt_0", Number(evidence.summary?.unknownIntentMissCount) > 0, evidence.summary?.unknownIntentMissCount);
  assertCheck("secret_rejected_count_gt_0", Number(evidence.summary?.secretRejectedCount) > 0, evidence.summary?.secretRejectedCount);
  assertCheck("expired_count_gt_0", Number(evidence.summary?.expiredCount) > 0, evidence.summary?.expiredCount);
  assertCheck("invalidated_count_gt_0", Number(evidence.summary?.invalidatedCount) > 0, evidence.summary?.invalidatedCount);
  assertCheck("estimated_tokens_saved_gt_0", Number(evidence.summary?.estimatedApiTokensSaved) > 0, evidence.summary?.estimatedApiTokensSaved);
  assertCheck("semantic_model_disabled", evidence.cache?.semanticModelEnabled === false, evidence.cache?.semanticModelEnabled);
  assertCheck("semantic_final_authority_false", evidence.cache?.semanticDecisionUsedAsFinalAuthority === false, evidence.cache?.semanticDecisionUsedAsFinalAuthority);
  assertCheck("intent_soft_hit_not_served", !(evidence.cases ?? []).some((item) => item.cacheHitType === "intent_soft_hit" && item.servedFromCache === true), "intent soft final hit");
  assertCheck("multilingual_intent_soft_hit_not_served", !(evidence.cases ?? []).some((item) => item.cacheHitType === "multilingual_intent_soft_hit" && item.servedFromCache === true), "multilingual intent soft final hit");
  assertCheck("no_semantic_hard_hit", !(evidence.cases ?? []).some((item) => item.cacheHitType === "semantic_hard_hit" || item.cacheHitType === "semantic_soft_hit"), "semantic cache hit type");
  assertCheck("intent_optimization_present", evidence.intentOptimization?.longTermGoal === "maximize safe intent-level cache hit rate across paraphrases and multilingual queries", "intentOptimization");

  for (const item of evidence.cases ?? []) {
    assertCheck(`case_${item.caseId}_decision_present`, ["hit", "soft_hit", "miss", "reject"].includes(item.cacheDecision), item.caseId);
    assertCheck(`case_${item.caseId}_hit_type_present`, ["exact_hit", "normalized_hit", "intent_soft_hit", "multilingual_intent_soft_hit", "stale_miss", "hard_miss", "no_cache"].includes(item.cacheHitType), item.caseId);
    assertCheck(`case_${item.caseId}_intent_present`, typeof item.intentSignature === "string" && item.intentSignature.length > 0, item.caseId);
    assertCheck(`case_${item.caseId}_language_present`, ["zh", "en", "ja", "mixed", "unknown"].includes(item.queryLanguage), item.caseId);
    assertCheck(`case_${item.caseId}_semantic_not_final`, item.semanticDecisionUsedAsFinalAuthority === false, item.caseId);
    assertCheck(`case_${item.caseId}_paid_zero`, item.paidApiCallCount === 0, item.caseId);
    assertCheck(`case_${item.caseId}_external_false`, item.externalApiCalled === false, item.caseId);
    assertCheck(`case_${item.caseId}_status_pass`, item.status === "pass", `${item.caseId}:${item.warnings?.join(",")}`);
  }

  for (const [field, expected] of Object.entries({
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
  })) {
    assertCheck(`top_level_${field}`, evidence[field] === expected, `${field}=${evidence[field]}`);
  }

  for (const [field, expected] of Object.entries({
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
  })) {
    assertCheck(`safety_${field}`, evidence.safety?.[field] === expected, `${field}=${evidence.safety?.[field]}`);
  }

  assertCheck("project_context_absent", !exists("PROJECT_CONTEXT.md"), "PROJECT_CONTEXT.md");
  assertCheck("legacy_not_modified", gitStatusLegacyIsEmpty(), "legacy git status");
  assertCheck("no_plaintext_api_key_in_docs_evidence_ui_cache", !containsPlaintextSecret([docs, md, JSON.stringify(evidence), ui, cacheRecords, cacheIndex, cacheSummary, cacheAudit].join("\n")), "docs/evidence/ui/cache");
  assertCheck("no_production_ready_claim", !containsProductionReadyClaim([docs, md, JSON.stringify(evidence), ui].join("\n")), "docs/evidence/ui");
}

function assertCheck(name, passed, detail) {
  const item = {
    name,
    passed: Boolean(passed),
    detail: String(detail ?? ""),
  };
  checks.push(item);
  if (!item.passed) throw new Error(`${name}: ${item.detail}`);
}

function exists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function writeJson(relativePath, value) {
  writeFileSync(resolve(repoRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function gitStatusLegacyIsEmpty() {
  try {
    const output = execFileSync("git", ["-c", `safe.directory=${repoRoot}`, "status", "--short", "--", "legacy"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.trim().length === 0;
  } catch {
    return false;
  }
}

function containsPlaintextSecret(text) {
  return /(Bearer\s+[A-Za-z0-9._-]{20,})|((api[_-]?key|authorization)\s*[:=]\s*[A-Za-z0-9._-]{20,})|\bsk-[A-Za-z0-9_-]{8,}\b|\bnvapi-[A-Za-z0-9_-]{12,}\b/i.test(text);
}

function containsProductionReadyClaim(text) {
  return text
    .split(/\r?\n/)
    .some((line) => /\bproduction-ready\b/i.test(line) && !(/\b(not|no|does not|do not|cannot|can't|is not|not a)\b/i.test(line) || /不能|不得|不可|不允许/.test(line)));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
