import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "274A-system-capability-benchmark";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const benchmarkPath = resolve(serviceRoot, "src/benchmarks/systemCapabilityBenchmark.js");
const runnerPath = resolve(serviceRoot, "src/entrypoints/runSystemCapabilityBenchmark.js");
const verifierPath = resolve(serviceRoot, "src/entrypoints/verifySystemCapabilityBenchmark.js");
const docsPath = resolve(repoRoot, "docs/UNIFIED_SYSTEM_CAPABILITY_BENCHMARK.md");
const uiPath = resolve(serviceRoot, "src/ui/consolePage.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(serviceRoot, "package.json");
const evidenceJsonPath = resolve(serviceRoot, "evidence/phase-274a-system-capability-benchmark.json");
const evidenceMdPath = resolve(serviceRoot, "evidence/phase-274a-system-capability-benchmark.md");

const requiredSourceEvidence = [
  "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
  "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json",
];

const requiredDocSections = [
  "Executive Summary",
  "Scorecard",
  "Headline Metrics",
  "Dimension-by-dimension Assessment",
  "Token Saving Capability",
  "RAG Source Selection Capability",
  "MiMo Paid Provider Safety",
  "Token Estimator Calibration",
  "Cache Readiness",
  "UI Observability",
  "Regression Stability",
  "Security Boundary",
  "Commercial Self-use Readiness",
  "Production Readiness Gap",
  "Top 10 Risks",
  "Top 10 Next Improvements",
  "Recommended Next Route",
  "What this benchmark does not prove",
  "Verification Commands",
];

const checks = [];

try {
  const docsText = readRequiredText(docsPath, "docs_exists");
  const uiText = readRequiredText(uiPath, "ui_exists");
  const evidence = readJson(evidenceJsonPath, "evidence_json_exists");
  const evidenceMarkdown = readRequiredText(evidenceMdPath, "evidence_md_exists");
  const rootPackage = readJson(rootPackagePath, "root_package_exists");
  const servicePackage = readJson(servicePackagePath, "service_package_exists");

  assertCheck("systemCapabilityBenchmark_exists", existsSync(benchmarkPath), benchmarkPath);
  assertCheck("runSystemCapabilityBenchmark_exists", existsSync(runnerPath), runnerPath);
  assertCheck("verifier_exists", existsSync(verifierPath), verifierPath);
  assertCheck("docs_exists", docsText.length > 0, docsPath);
  assertCheck("evidence_json_exists", evidence.phase === PHASE, evidenceJsonPath);
  assertCheck("evidence_md_exists", evidenceMarkdown.includes("Phase 274A"), evidenceMdPath);
  assertCheck("root_script_present", rootPackage.scripts?.["benchmark:system-capability"] === "pnpm --filter @unified-ai-system/ai-gateway-service benchmark:system-capability", "package.json");
  assertCheck("root_verify_script_present", rootPackage.scripts?.["verify:phase274a-system-capability-benchmark"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase274a-system-capability-benchmark", "package.json");
  assertCheck("service_script_present", servicePackage.scripts?.["benchmark:system-capability"] === "node ./src/entrypoints/runSystemCapabilityBenchmark.js", "apps/ai-gateway-service/package.json");
  assertCheck("service_verify_script_present", servicePackage.scripts?.["verify:phase274a-system-capability-benchmark"] === "node ./src/entrypoints/verifySystemCapabilityBenchmark.js", "apps/ai-gateway-service/package.json");
  assertCheck("ui_marker_exists", uiText.includes("Unified System Capability Benchmark") && uiText.includes("totalScore"), "consolePage.js");

  for (const section of requiredDocSections) {
    assertCheck(`doc_section_${slug(section)}`, docsText.includes(section), section);
  }

  assertCheck("evidence_status_passed", evidence.status === "passed", evidence.status);
  assertCheck("total_score_numeric", Number.isFinite(Number(evidence.scorecard?.totalScore)), evidence.scorecard?.totalScore);
  assertCheck("max_score_100", evidence.scorecard?.maxScore === 100, evidence.scorecard?.maxScore);
  assertCheck("grade_present", ["A", "B", "C", "D"].includes(evidence.scorecard?.grade), evidence.scorecard?.grade);
  assertCheck("production_readiness_not_ready", evidence.scorecard?.productionReadiness === "not-production-ready", evidence.scorecard?.productionReadiness);
  assertCheck("dimensions_length", Array.isArray(evidence.dimensions) && evidence.dimensions.length >= 10, evidence.dimensions?.length);
  assertCheck("headline_metrics_present", evidence.headlineMetrics && typeof evidence.headlineMetrics === "object", "headlineMetrics");
  assertCheck("strengths_populated", Array.isArray(evidence.strengths) && evidence.strengths.length >= 5, evidence.strengths?.length);
  assertCheck("risks_populated", Array.isArray(evidence.risks) && evidence.risks.length >= 10, evidence.risks?.length);
  assertCheck("gaps_populated", Array.isArray(evidence.gaps) && evidence.gaps.length >= 10, evidence.gaps?.length);
  assertCheck("recommended_routes_populated", Array.isArray(evidence.recommendedNextRoutes) && evidence.recommendedNextRoutes.length >= 5, evidence.recommendedNextRoutes?.length);

  for (const [index, dimension] of (evidence.dimensions ?? []).entries()) {
    assertCheck(`dimension_${index}_name`, typeof dimension.name === "string" && dimension.name.length > 0, dimension.name);
    assertCheck(`dimension_${index}_score_numeric`, Number.isFinite(Number(dimension.score)), dimension.name);
    assertCheck(`dimension_${index}_max_score_numeric`, Number.isFinite(Number(dimension.maxScore)), dimension.name);
    assertCheck(`dimension_${index}_evidence_array`, Array.isArray(dimension.evidence), dimension.name);
    assertCheck(`dimension_${index}_metrics_object`, dimension.metrics && typeof dimension.metrics === "object", dimension.name);
    assertCheck(`dimension_${index}_limitations_array`, Array.isArray(dimension.limitations), dimension.name);
  }

  assertCheck("paid_api_call_count_zero", evidence.paidApiCallCount === 0, evidence.paidApiCallCount);
  assertCheck("external_api_called_false", evidence.externalApiCalled === false, evidence.externalApiCalled);
  assertCheck("mimo_api_called_false", evidence.mimoApiCalled === false, evidence.mimoApiCalled);
  assertCheck("default_nvidia_chat_lane_changed_false", evidence.defaultNvidiaChatLaneChanged === false, evidence.defaultNvidiaChatLaneChanged);
  assertCheck("mimo_set_as_default_false", evidence.mimoSetAsDefault === false, evidence.mimoSetAsDefault);
  assertSafetyFalse(evidence.safety);

  const legacyStatus = execFileSync(
    "git",
    ["-c", `safe.directory=${repoRoot}`, "status", "--short", "--", "legacy"],
    { cwd: repoRoot, encoding: "utf8" }
  ).trim();
  assertCheck("legacy_not_modified", legacyStatus.length === 0 && evidence.safety?.legacyModified === false, legacyStatus);
  assertCheck("project_context_absent", !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")) && evidence.safety?.projectContextCreated === false, "PROJECT_CONTEXT.md");

  for (const relativePath of requiredSourceEvidence) {
    assertCheck(`source_evidence_exists_${slug(relativePath)}`, existsSync(resolve(repoRoot, relativePath)), relativePath);
  }

  const secretScanText = [
    docsText,
    evidenceMarkdown,
    JSON.stringify(evidence),
    uiText,
  ].join("\n");
  assertCheck("no_plaintext_api_key_in_docs_evidence_ui", !containsPlaintextSecret(secretScanText), "docs/evidence/UI scan");
  assertCheck("no_production_ready_claim", !hasForbiddenProductionClaim(secretScanText), "production claim scan");

  const output = {
    phase: PHASE,
    status: "passed",
    checks: checks.length,
    totalScore: evidence.scorecard.totalScore,
    grade: evidence.scorecard.grade,
    productionReadiness: evidence.scorecard.productionReadiness,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    evidenceJsonPath,
    evidenceMdPath,
  };
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  const output = {
    phase: PHASE,
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
    failedChecks: checks.filter((item) => !item.passed),
  };
  await writeFile(evidenceJsonPath, `${JSON.stringify({
    phase: PHASE,
    status: "failed",
    conclusion: "unified-system-capability-benchmark-verification-failed",
    generatedAt: new Date().toISOString(),
    verifierError: output.error,
    failedChecks: output.failedChecks,
    safety: {
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
    },
  }, null, 2)}\n`, "utf8").catch(() => {});
  console.error(JSON.stringify(output, null, 2));
  process.exitCode = 1;
}

function readRequiredText(path, checkName) {
  assertCheck(checkName, existsSync(path), path);
  return readFileSync(path, "utf8");
}

function readJson(path, checkName) {
  const text = readRequiredText(path, checkName);
  return JSON.parse(text);
}

function assertSafetyFalse(safety = {}) {
  const keys = [
    "plainTextApiKeyWritten",
    "apiKeyPrinted",
    "paidApiCallExecuted",
    "externalApiCalled",
    "mimoApiCalled",
    "defaultNvidiaChatLaneChanged",
    "mimoSetAsDefault",
    "longContextSentToPaidApi",
    "largeOutputRequested",
    "stressTestExecuted",
    "legacyModified",
    "projectContextCreated",
    "codexCliInvoked",
    "codexExecInvoked",
    "workflowRunnerEnabled",
    "worktreeCreated",
    "autoCommit",
    "autoPush",
  ];
  for (const key of keys) {
    assertCheck(`safety_${key}_false`, safety[key] === false, safety[key]);
  }
}

function containsPlaintextSecret(text) {
  const patterns = [
    /\bnvapi-[A-Za-z0-9_-]{20,}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i,
    /\b(?:OPENAI|NVIDIA|MIMO|XIAOMI)_API_KEY\s*=\s*["']?[A-Za-z0-9._-]{12,}/i,
    /\bapi-key\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function hasForbiddenProductionClaim(text) {
  const normalized = text
    .replace(/not-production-ready/gi, "")
    .replace(/not production-ready/gi, "")
    .replace(/not production ready/gi, "")
    .replace(/do not describe[^\n]*production-grade[^\n]*/gi, "");
  const forbidden = [
    /\bis production-ready\b/i,
    /\bproduction-ready SaaS\b/i,
    /\bproduction deployment complete\b/i,
    /\bproduction-grade\b/i,
    /世界顶级已认证/,
  ];
  return forbidden.some((pattern) => pattern.test(normalized));
}

function assertCheck(name, passed, detail) {
  const check = { name, passed: Boolean(passed), detail };
  checks.push(check);
  if (!check.passed) {
    throw new Error(`Check failed: ${name}`);
  }
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
