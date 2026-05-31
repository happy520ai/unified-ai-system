import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = "272A-token-estimator-calibration";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const paths = {
  module: "apps/ai-gateway-service/src/cost/tokenEstimatorCalibration.js",
  runner: "apps/ai-gateway-service/src/entrypoints/runTokenEstimatorCalibration.js",
  verifier: "apps/ai-gateway-service/src/entrypoints/verifyTokenEstimatorCalibration.js",
  docs: "docs/TOKEN_ESTIMATOR_CALIBRATION.md",
  ui: "apps/ai-gateway-service/src/ui/consolePage.js",
  rootPackage: "package.json",
  servicePackage: "apps/ai-gateway-service/package.json",
  source269: "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  source271: "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  evidenceJson: "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
  evidenceMd: "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.md",
};

const checks = [];

try {
  verify();
  const evidence = readJson(paths.evidenceJson);
  evidence.verifiedAt = new Date().toISOString();
  evidence.verifier = {
    name: "verifyTokenEstimatorCalibration",
    status: "passed",
    checks,
  };
  writeJson(paths.evidenceJson, evidence);
  console.log(JSON.stringify({
    phase: PHASE,
    status: "passed",
    evidenceStatus: evidence.status,
    checks: checks.length,
    sampleCount: evidence.sampleCount,
    confidence: evidence.confidence,
    calibrationCoverage: evidence.calibrationCoverage,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
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
    tokenEstimatorCalibration: paths.module,
    runTokenEstimatorCalibration: paths.runner,
    verifyTokenEstimatorCalibration: paths.verifier,
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
  const source269 = readJson(paths.source269);
  const source271 = readJson(paths.source271);

  for (const section of [
    "Purpose",
    "Current status",
    "Source evidence",
    "MiMo usage samples",
    "Estimate vs actual comparison",
    "Calibration profile",
    "Safety multiplier",
    "Token floor observation",
    "Limitations",
    "How Token Cost Guard uses this",
    "What this does not do",
    "Safety boundaries",
    "Verification commands",
    "Next phase options",
  ]) {
    assertCheck(`docs_section_${slug(section)}`, docs.includes(section), section);
  }

  for (const marker of [
    "no new paid API call",
    "existing 269A/271A evidence only",
    "confidence=low",
    "smoke-only-limited",
    "does not change the default NVIDIA /chat lane",
    "does not set MiMo as default",
    "not a production token-billing accuracy claim",
  ]) {
    assertCheck(`docs_marker_${slug(marker)}`, docs.includes(marker), marker);
  }

  assertCheck("root_calibrate_script_exists", rootPackage.includes("\"calibrate:token-estimator\""), paths.rootPackage);
  assertCheck("root_verify_script_exists", rootPackage.includes("\"verify:phase272a-token-estimator-calibration\""), paths.rootPackage);
  assertCheck("service_calibrate_script_exists", servicePackage.includes("\"calibrate:token-estimator\""), paths.servicePackage);
  assertCheck("service_verify_script_exists", servicePackage.includes("\"verify:phase272a-token-estimator-calibration\""), paths.servicePackage);
  assertCheck("ui_marker_exists", ui.includes("Token Estimator Calibration / Token 估算器校准"), paths.ui);
  assertCheck("ui_evidence_path_exists", ui.includes("phase-272a-token-estimator-calibration.json"), paths.ui);
  assertCheck("source_269_passed", source269.status === "passed", paths.source269);
  assertCheck("source_271_passed", source271.status === "passed", paths.source271);
  assertCheck("source_269_usage_numeric", numeric(source269.response?.inputTokens) && numeric(source269.response?.outputTokens) && numeric(source269.response?.totalTokens), paths.source269);
  assertCheck("source_271_usage_numeric", numeric(source271.smoke?.inputTokens) && numeric(source271.smoke?.outputTokens) && numeric(source271.smoke?.totalTokens), paths.source271);

  assertCheck("evidence_status_passed", evidence.status === "passed", evidence.status);
  assertCheck("provider_mimo", evidence.provider === "mimo", evidence.provider);
  assertCheck("model_mimo_v25_pro", evidence.model === "mimo-v2.5-pro", evidence.model);
  assertCheck("sample_count_at_least_2", Number(evidence.sampleCount) >= 2, evidence.sampleCount);
  assertCheck("paid_api_call_count_zero", evidence.paidApiCallCount === 0, evidence.paidApiCallCount);
  assertCheck("external_api_called_false", evidence.externalApiCalled === false, evidence.externalApiCalled);
  assertCheck("confidence_low", evidence.confidence === "low", evidence.confidence);
  assertCheck("coverage_limited", evidence.calibrationCoverage === "smoke-only-limited", evidence.calibrationCoverage);
  assertCheck("samples_array_valid", Array.isArray(evidence.samples) && evidence.samples.length >= 2, "samples");

  for (const sample of evidence.samples) {
    assertCheck(`sample_${sample.sourcePhase}_actual_usage_numeric`, numeric(sample.actualInputTokens) && numeric(sample.actualOutputTokens) && numeric(sample.actualTotalTokens), sample.sourcePhase);
    assertCheck(`sample_${sample.sourcePhase}_estimate_numeric`, numeric(sample.estimatedInputTokens) && numeric(sample.estimatedOutputTokens) && numeric(sample.estimatedTotalTokens), sample.sourcePhase);
    assertCheck(`sample_${sample.sourcePhase}_error_numeric`, numeric(sample.inputTokenError) && numeric(sample.outputTokenError) && numeric(sample.totalTokenError), sample.sourcePhase);
    assertCheck(`sample_${sample.sourcePhase}_ratio_numeric`, numeric(sample.inputTokenErrorRatio) && numeric(sample.outputTokenErrorRatio) && numeric(sample.totalTokenErrorRatio), sample.sourcePhase);
    assertCheck(`sample_${sample.sourcePhase}_limited_source`, sample.estimateInputSource === "reconstructed-smoke-metadata", sample.estimateInputSource);
  }

  for (const field of [
    "averageInputTokenErrorRatio",
    "averageOutputTokenErrorRatio",
    "averageTotalTokenErrorRatio",
    "maxUnderEstimateRatio",
    "maxOverEstimateRatio",
  ]) {
    assertCheck(`summary_${field}_numeric`, numeric(evidence.summary?.[field]), field);
  }
  assertCheck("summary_bias_valid", ["under_estimate", "over_estimate", "mixed", "close"].includes(evidence.summary?.estimatorBias), evidence.summary?.estimatorBias);

  for (const field of [
    "recommendedInputSafetyMultiplier",
    "recommendedOutputSafetyMultiplier",
    "recommendedTotalSafetyMultiplier",
    "recommendedMinimumInputTokenFloor",
    "recommendedMinimumTotalTokenFloor",
  ]) {
    assertCheck(`profile_${field}_numeric`, numeric(evidence.calibrationProfile?.[field]) && Number(evidence.calibrationProfile[field]) > 0, field);
  }

  assertCheck("profile_provider", evidence.calibrationProfile?.appliesToProvider === "mimo", evidence.calibrationProfile?.appliesToProvider);
  assertCheck("profile_model", evidence.calibrationProfile?.appliesToModel === "mimo-v2.5-pro", evidence.calibrationProfile?.appliesToModel);
  assertCheck("profile_not_auto_applied", evidence.calibrationProfile?.autoAppliedToProductionCalls === false, evidence.calibrationProfile?.autoAppliedToProductionCalls);
  assertCheck("profile_preview_only", evidence.calibrationProfile?.previewOnly === true, evidence.calibrationProfile?.previewOnly);
  assertCheck("token_guard_feedback_present", evidence.tokenCostGuardFeedback?.calibrationProfileGenerated === true, "tokenCostGuardFeedback");

  for (const [field, expected] of Object.entries({
    plainTextApiKeyWritten: false,
    apiKeyPrinted: false,
    paidApiCallExecuted: false,
    externalApiCalled: false,
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

  assertCheck("no_plaintext_api_key_in_docs_evidence_ui", !containsPlaintextSecret([docs, md, JSON.stringify(evidence), ui].join("\n")), "docs/evidence/ui");
  assertCheck("no_production_ready_claim", !containsProductionReadyClaim([docs, md, JSON.stringify(evidence), ui].join("\n")), "docs/evidence/ui");
  assertCheck("legacy_not_modified_in_evidence", evidence.safety?.legacyModified === false, "legacyModified=false");
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
