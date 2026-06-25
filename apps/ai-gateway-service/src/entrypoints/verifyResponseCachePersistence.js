import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, readText, writeJson } from "./entrypointUtils.js"

const PHASE = "274A-response-cache-persistence";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const paths = {
  key: "apps/ai-gateway-service/src/cache/responseCacheKey.js",
  store: "apps/ai-gateway-service/src/cache/responseCacheStore.js",
  policy: "apps/ai-gateway-service/src/cache/responseCachePolicy.js",
  benchmark: "apps/ai-gateway-service/src/cache/responseCacheBenchmark.js",
  runner: "apps/ai-gateway-service/src/entrypoints/runResponseCachePersistenceBenchmark.js",
  verifier: "apps/ai-gateway-service/src/entrypoints/verifyResponseCachePersistence.js",
  docs: "docs/RESPONSE_CACHE_PERSISTENCE.md",
  ui: "apps/ai-gateway-service/src/ui/consolePage.js",
  rootPackage: "package.json",
  servicePackage: "apps/ai-gateway-service/package.json",
  evidenceJson: "apps/ai-gateway-service/evidence/phase-274a-response-cache-persistence.json",
  evidenceMd: "apps/ai-gateway-service/evidence/phase-274a-response-cache-persistence.md",
  cacheRecords: "apps/ai-gateway-service/evidence/response-cache/response-cache-records.jsonl",
  cacheIndex: "apps/ai-gateway-service/evidence/response-cache/response-cache-index.json",
  cacheSummary: "apps/ai-gateway-service/evidence/response-cache/response-cache-summary.json",
  phase268: "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  phase269: "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  phase270: "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  phase271: "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  phase272: "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
  phase273: "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json",
};

const checks = [];

try {
  verify();
  const evidence = readJson(paths.evidenceJson);
  evidence.verifiedAt = new Date().toISOString();
  evidence.verifier = {
    name: "verifyResponseCachePersistence",
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
    hitCount: evidence.summary?.hitCount,
    writeSucceededCount: evidence.summary?.writeSucceededCount,
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
    responseCacheStore: paths.store,
    responseCachePolicy: paths.policy,
    responseCacheBenchmark: paths.benchmark,
    runResponseCachePersistenceBenchmark: paths.runner,
    verifyResponseCachePersistence: paths.verifier,
    docs: paths.docs,
    evidenceJson: paths.evidenceJson,
    evidenceMd: paths.evidenceMd,
    cacheRecords: paths.cacheRecords,
    cacheIndex: paths.cacheIndex,
    cacheSummary: paths.cacheSummary,
    ui: paths.ui,
    rootPackage: paths.rootPackage,
    servicePackage: paths.servicePackage,
  })) {
    assertCheck(`${name}_exists`, exists(relativePath), relativePath);
  }

  const docs = readText(paths.docs);
  const md = readText(paths.evidenceMd);
  const ui = readText(paths.ui);
  const cacheRecords = readText(paths.cacheRecords);
  const cacheIndex = readText(paths.cacheIndex);
  const cacheSummary = readText(paths.cacheSummary);
  const rootPackage = readText(paths.rootPackage);
  const servicePackage = readText(paths.servicePackage);
  const evidence = readJson(paths.evidenceJson);

  for (const section of [
    "Purpose",
    "Current status",
    "Why cache persistence matters after 273A",
    "Cache key design",
    "Cache policy",
    "Cache store",
    "Cache lookup/write/invalidate",
    "Security and sanitizer",
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
    "local preview cache persistence",
    "not a production multi-user cache",
    "does not cache API key",
    "does not cache Authorization header",
    "does not cache env",
    "does not change default NVIDIA /chat",
    "does not set MiMo as default",
  ]) {
    assertCheck(`docs_marker_${slug(marker)}`, docs.includes(marker), marker);
  }

  assertCheck("root_benchmark_script_exists", rootPackage.includes("\"benchmark:response-cache\""), paths.rootPackage);
  assertCheck("root_verify_script_exists", rootPackage.includes("\"verify:phase274a-response-cache-persistence\""), paths.rootPackage);
  assertCheck("service_benchmark_script_exists", servicePackage.includes("\"benchmark:response-cache\""), paths.servicePackage);
  assertCheck("service_verify_script_exists", servicePackage.includes("\"verify:phase274a-response-cache-persistence\""), paths.servicePackage);
  assertCheck("ui_marker_exists", ui.includes("Response Cache Persistence / \u54cd\u5e94\u7f13\u5b58\u843d\u76d8"), paths.ui);
  assertCheck("ui_evidence_path_exists", ui.includes("phase-274a-response-cache-persistence.json"), paths.ui);

  for (const key of ["phase268", "phase269", "phase270", "phase271", "phase272", "phase273"]) {
    assertCheck(`${key}_evidence_exists`, exists(paths[key]), paths[key]);
  }

  assertCheck("evidence_status_passed", evidence.status === "passed", evidence.status);
  assertCheck("case_count_at_least_8", Number(evidence.summary?.caseCount) >= 8, evidence.summary?.caseCount);
  assertCheck("hit_count_gt_0", Number(evidence.summary?.hitCount) > 0, evidence.summary?.hitCount);
  assertCheck("write_succeeded_gt_0", Number(evidence.summary?.writeSucceededCount) > 0, evidence.summary?.writeSucceededCount);
  assertCheck("secret_rejected_gt_0", Number(evidence.summary?.secretRejectedCount) > 0, evidence.summary?.secretRejectedCount);
  assertCheck("estimated_tokens_saved_gt_0", Number(evidence.summary?.estimatedApiTokensSaved) > 0, evidence.summary?.estimatedApiTokensSaved);

  for (const item of evidence.cases ?? []) {
    assertCheck(`case_${item.caseId}_cache_key`, typeof item.cacheKey === "string" && item.cacheKey.startsWith("response-cache:"), item.caseId);
    assertCheck(`case_${item.caseId}_selected_sources_hash`, typeof item.selectedSourcesHash === "string" && item.selectedSourcesHash.length >= 32, item.caseId);
    assertCheck(`case_${item.caseId}_status_valid`, ["pass", "warn", "fail"].includes(item.status), item.caseId);
    assertCheck(`case_${item.caseId}_paid_zero`, item.paidApiCallCount === 0, item.caseId);
    assertCheck(`case_${item.caseId}_external_false`, item.externalApiCalled === false, item.caseId);
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

  assertCheck("long_context_not_sent", evidence.safety?.longContextSentToPaidApi === false, "longContextSentToPaidApi");
  assertCheck("legacy_not_modified_flag", evidence.safety?.legacyModified === false, "legacyModified");
  assertCheck("project_context_absent_flag", evidence.safety?.projectContextCreated === false, "projectContextCreated");
  assertCheck("project_context_absent", !exists("PROJECT_CONTEXT.md"), "PROJECT_CONTEXT.md");
  assertCheck("no_plaintext_api_key_in_docs_evidence_ui_cache", !containsPlaintextSecret([docs, md, JSON.stringify(evidence), ui, cacheRecords, cacheIndex, cacheSummary].join("\n")), "docs/evidence/ui/cache");
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




function containsPlaintextSecret(text) {
  return /(Bearer\s+[A-Za-z0-9._-]{20,})|((api[_-]?key|authorization)\s*[:=]\s*[A-Za-z0-9._-]{20,})|\bsk-(?!copy|safety|package|test|redacted|preview)[A-Za-z0-9_-]{16,}\b|\bnvapi-(?!redacted|preview|test)[A-Za-z0-9_-]{12,}\b/i.test(text);
}

function containsProductionReadyClaim(text) {
  return text
    .split(/\r?\n/)
    .some((line) => /\bproduction-ready\b/i.test(line) && !/(not|no|does not|cannot|can't|不能|不得)/i.test(line));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
