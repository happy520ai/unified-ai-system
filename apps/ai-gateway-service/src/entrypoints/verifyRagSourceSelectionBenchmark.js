import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "273A-rag-source-selection-benchmark";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const paths = {
  benchmark: "apps/ai-gateway-service/src/rag/sourceSelectionBenchmark.js",
  runner: "apps/ai-gateway-service/src/entrypoints/runRagSourceSelectionBenchmark.js",
  verifier: "apps/ai-gateway-service/src/entrypoints/verifyRagSourceSelectionBenchmark.js",
  docs: "docs/RAG_SOURCE_SELECTION_BENCHMARK.md",
  ui: "apps/ai-gateway-service/src/ui/consolePage.js",
  rootPackage: "package.json",
  servicePackage: "apps/ai-gateway-service/package.json",
  evidenceJson: "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json",
  evidenceMd: "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.md",
  phase268: "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  phase269: "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  phase270: "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  phase271: "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  phase272: "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
};

const checks = [];

try {
  verify();
  const evidence = readJson(paths.evidenceJson);
  evidence.verifiedAt = new Date().toISOString();
  evidence.verifier = {
    name: "verifyRagSourceSelectionBenchmark",
    status: "passed",
    checks,
  };
  writeJson(paths.evidenceJson, evidence);
  console.log(JSON.stringify({
    phase: PHASE,
    status: "passed",
    evidenceStatus: evidence.status,
    checks: checks.length,
    caseCount: evidence.caseCount,
    averageSavingsRatio: evidence.summary?.averageSavingsRatio,
    averageRequiredSourceRecall: evidence.summary?.averageRequiredSourceRecall,
    latestEvidenceHitRate: evidence.summary?.latestEvidenceHitRate,
    staleSourceSelectedCount: evidence.summary?.staleSourceSelectedCount,
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
    sourceSelectionBenchmark: paths.benchmark,
    runRagSourceSelectionBenchmark: paths.runner,
    verifyRagSourceSelectionBenchmark: paths.verifier,
    docs: paths.docs,
    evidenceJson: paths.evidenceJson,
    evidenceMd: paths.evidenceMd,
    ui: paths.ui,
    rootPackage: paths.rootPackage,
    servicePackage: paths.servicePackage,
  })) {
    assertCheck(`${name}_exists`, exists(relativePath), relativePath);
  }

  const docs = readText(paths.docs);
  const md = readText(paths.evidenceMd);
  const ui = readText(paths.ui);
  const rootPackage = readText(paths.rootPackage);
  const servicePackage = readText(paths.servicePackage);
  const evidence = readJson(paths.evidenceJson);

  for (const section of [
    "Purpose",
    "Current status",
    "Why source selection matters after 272A",
    "Benchmark cases",
    "Source selection rules",
    "Freshness guard",
    "Stale evidence handling",
    "Required source recall",
    "Token saving result",
    "Gaps",
    "Recommended next routes",
    "What this does not do",
    "Safety boundaries",
    "Verification commands",
  ]) {
    assertCheck(`docs_section_${slug(section)}`, docs.includes(section), section);
  }

  for (const marker of [
    "does not call MiMo",
    "does not call any paid API",
    "local source selection benchmark",
    "not production RAG",
    "does not change default NVIDIA /chat",
    "does not set MiMo as default",
    "272A calibration confidence remains low",
  ]) {
    assertCheck(`docs_marker_${slug(marker)}`, docs.includes(marker), marker);
  }

  assertCheck("root_benchmark_script_exists", rootPackage.includes("\"benchmark:rag-source-selection\""), paths.rootPackage);
  assertCheck("root_verify_script_exists", rootPackage.includes("\"verify:phase273a-rag-source-selection-benchmark\""), paths.rootPackage);
  assertCheck("service_benchmark_script_exists", servicePackage.includes("\"benchmark:rag-source-selection\""), paths.servicePackage);
  assertCheck("service_verify_script_exists", servicePackage.includes("\"verify:phase273a-rag-source-selection-benchmark\""), paths.servicePackage);
  assertCheck("ui_marker_exists", ui.includes("RAG Source Selection Benchmark / RAG 选源质量测试"), paths.ui);
  assertCheck("ui_evidence_path_exists", ui.includes("phase-273a-rag-source-selection-benchmark.json"), paths.ui);

  for (const key of ["phase268", "phase269", "phase270", "phase271", "phase272"]) {
    assertCheck(`${key}_evidence_exists`, exists(paths[key]), paths[key]);
  }

  assertCheck("evidence_status_passed", evidence.status === "passed", evidence.status);
  assertCheck("case_count_at_least_8", Number(evidence.caseCount) >= 8, evidence.caseCount);
  assertCheck("mode_local_only", evidence.mode === "local-source-selection-only", evidence.mode);

  for (const item of evidence.cases ?? []) {
    assertCheck(`case_${item.caseId}_naive_tokens_numeric`, numeric(item.naiveEstimatedTokens), item.caseId);
    assertCheck(`case_${item.caseId}_selected_tokens_numeric`, numeric(item.selectedEstimatedTokens), item.caseId);
    assertCheck(`case_${item.caseId}_savings_ratio_numeric`, numeric(item.savingsRatio), item.caseId);
    assertCheck(`case_${item.caseId}_required_recall_numeric`, numeric(item.requiredSourceRecall), item.caseId);
    assertCheck(`case_${item.caseId}_freshness_present`, ["fresh", "mixed", "stale", "unknown"].includes(item.freshnessStatus), item.caseId);
    assertCheck(`case_${item.caseId}_context_pack_present`, Array.isArray(item.recommendedContextPack) && item.recommendedContextPack.length > 0, item.caseId);
  }

  assertCheck("average_required_recall_present", numeric(evidence.summary?.averageRequiredSourceRecall), "averageRequiredSourceRecall");
  assertCheck("latest_evidence_hit_rate_present", numeric(evidence.summary?.latestEvidenceHitRate), "latestEvidenceHitRate");
  assertCheck("stale_source_selected_count_present", numeric(evidence.summary?.staleSourceSelectedCount), "staleSourceSelectedCount");
  assertCheck("gaps_populated", Array.isArray(evidence.gaps) && evidence.gaps.length > 0, "gaps");
  assertCheck("recommended_next_routes_populated", Array.isArray(evidence.recommendedNextRoutes) && evidence.recommendedNextRoutes.length > 0, "recommendedNextRoutes");

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

  assertCheck("no_plaintext_api_key_in_docs_evidence_ui", !containsPlaintextSecret([docs, md, JSON.stringify(evidence), ui].join("\n")), "docs/evidence/ui");
  assertCheck("no_production_ready_claim", !containsProductionReadyClaim([docs, md, JSON.stringify(evidence), ui].join("\n")), "docs/evidence/ui");
  assertCheck("project_context_absent", !exists("PROJECT_CONTEXT.md"), "PROJECT_CONTEXT.md");
}

function assertCheck(name, passed, detail) {
  const item = {
    name,
    passed: Boolean(passed),
    detail: String(detail ?? ""),
  };
  checks.push(item);
  if (!item.passed) {
    throw new Error(`${name}: ${item.detail}`);
  }
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

function numeric(value) {
  return Number.isFinite(Number(value));
}

function containsPlaintextSecret(text) {
  return /(Bearer\s+[A-Za-z0-9._-]{20,})|((api[_-]?key|authorization)\s*[:=]\s*[A-Za-z0-9._-]{20,})|(sk-[A-Za-z0-9]{20,})/i.test(text);
}

function containsProductionReadyClaim(text) {
  return text
    .split(/\r?\n/)
    .some((line) => /\bproduction-ready\b/i.test(line) && !/(not|no|does not|cannot|不能|不得)/i.test(line));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
