import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const jsonPath = "apps/ai-gateway-service/evidence/phase-276a-model-tier-routing-preview.json";
const mdPath = "apps/ai-gateway-service/evidence/phase-276a-model-tier-routing-preview.md";

const requiredFiles = [
  "apps/ai-gateway-service/src/routing/modelTierRouter.js",
  "apps/ai-gateway-service/src/routing/answerPathClassifier.js",
  "apps/ai-gateway-service/src/routing/modelTierPolicy.js",
  "apps/ai-gateway-service/src/routing/modelTierRoutingBenchmark.js",
  "apps/ai-gateway-service/src/entrypoints/runModelTierRoutingBenchmark.js",
  "apps/ai-gateway-service/src/entrypoints/verifyModelTierRoutingPreview.js",
  "docs/MODEL_TIER_ROUTING_PREVIEW.md",
  jsonPath,
  mdPath,
];

const upstreamEvidence = [
  "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
  "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json",
  "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json",
];

const requiredDocSections = [
  "Purpose",
  "Current status",
  "Why anti-model-dependency matters",
  "Answer path definitions",
  "Model tier definitions",
  "Routing policy",
  "How cache / RAG / token guard affect routing",
  "Why MiMo is premium and non-default",
  "When to use rule_only",
  "When to use cache_only",
  "When to use rag_local",
  "When to recommend cheap_model",
  "When to recommend standard_model",
  "When to recommend premium_mimo",
  "When to require approval",
  "When to block",
  "Benchmark cases",
  "Token saving impact",
  "What this does not do",
  "Safety boundaries",
  "Verification commands",
  "Next phase options",
];

function main() {
  const evidence = readJson(jsonPath);
  const docsText = readText("docs/MODEL_TIER_ROUTING_PREVIEW.md");
  const uiText = readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const rootPackage = readJson("package.json");
  const servicePackage = readJson("apps/ai-gateway-service/package.json");
  const phase275 = readJson("apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json", { optional: true });

  const checks = {
    requiredFilesExist: requiredFiles.every(fileExists),
    packageScriptsExist: Boolean(rootPackage.scripts?.["benchmark:model-tier-routing"])
      && Boolean(rootPackage.scripts?.["verify:phase276a-model-tier-routing-preview"])
      && Boolean(servicePackage.scripts?.["benchmark:model-tier-routing"])
      && Boolean(servicePackage.scripts?.["verify:phase276a-model-tier-routing-preview"]),
    uiMarkerExists: uiText.includes("Model Tier Routing Preview"),
    requiredDocsSectionsPresent: requiredDocSections.every((section) => docsText.includes(`## ${section}`)),
    evidenceStatusPassed: evidence.status === "passed",
    caseCountAtLeast16: evidence.summary?.caseCount >= 16 && Array.isArray(evidence.cases) && evidence.cases.length >= 16,
    ruleOnlyCountPositive: evidence.summary?.ruleOnlyCount > 0,
    ragLocalCountPositive: evidence.summary?.ragLocalCount > 0,
    premiumMimoRecommendationCountPositive: evidence.summary?.premiumMimoRecommendationCount > 0,
    requireApprovalCountPositive: evidence.summary?.requireApprovalCount > 0,
    blockCountPositive: evidence.summary?.blockCount > 0,
    paidApiCallCountZero: evidence.paidApiCallCount === 0 && evidence.summary?.paidApiCallCount === 0,
    externalApiCalledFalse: evidence.externalApiCalled === false,
    mimoApiCalledFalse: evidence.mimoApiCalled === false,
    defaultNvidiaChatLaneChangedFalse: evidence.defaultNvidiaChatLaneChanged === false,
    mimoSetAsDefaultFalse: evidence.mimoSetAsDefault === false,
    premiumModelDefaultFalse: evidence.routingPolicy?.premiumModelDefault === false,
    premiumMimoRequiresApproval: evidence.cases
      ?.filter((item) => item.answerPath === "premium_mimo")
      .every((item) => item.requiresApproval === true) === true,
    noLongContextSentToPaidApi: evidence.safety?.longContextSentToPaidApi === false,
    noPlaintextApiKeyInDocsEvidenceUi: !containsPlaintextApiKey([
      docsText,
      readText(jsonPath),
      readText(mdPath),
      uiText,
    ].join("\n")),
    noProductionReadyClaim: !hasPositiveProductionReadyClaim(docsText) && !hasPositiveProductionReadyClaim(readText(mdPath)),
    legacyModifiedFalse: evidence.safety?.legacyModified === false,
    projectContextCreatedFalse: evidence.safety?.projectContextCreated === false && !fileExists("PROJECT_CONTEXT.md"),
    upstreamEvidenceExists: upstreamEvidence.every(fileExists),
    cacheIntegrationHonest: phase275?.status === "passed"
      ? evidence.upstream?.cacheHardeningAvailable === true && evidence.upstream?.cacheHardeningDependencyStatus === "passed"
      : evidence.upstream?.cacheHardeningAvailable === false && evidence.upstream?.cacheHardeningDependencyStatus === "not_available_or_not_sealed",
    secretLikeCaseBlocked: evidence.cases?.find((item) => item.caseId === "secret-like-query")?.answerPath === "block",
    longContextToMimoBlocked: evidence.cases?.find((item) => item.caseId === "send-all-docs-to-mimo")?.blockReason === "long_context_to_paid_api_forbidden",
    defaultProviderChangeBlocked: evidence.cases?.find((item) => item.caseId === "set-mimo-default")?.blockReason === "default_provider_change_forbidden_in_this_phase",
    softHitNotCacheOnly: evidence.cases?.find((item) => item.caseId === "cache-soft-hit")?.answerPath !== "cache_only",
  };

  const failures = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  const result = {
    phase: "276A-model-tier-routing-preview",
    status: failures.length === 0 ? "passed" : "failed",
    checks: Object.keys(checks).length,
    failures,
    caseCount: evidence.summary?.caseCount ?? 0,
    ruleOnlyCount: evidence.summary?.ruleOnlyCount ?? 0,
    ragLocalCount: evidence.summary?.ragLocalCount ?? 0,
    premiumMimoRecommendationCount: evidence.summary?.premiumMimoRecommendationCount ?? 0,
    requireApprovalCount: evidence.summary?.requireApprovalCount ?? 0,
    blockCount: evidence.summary?.blockCount ?? 0,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    evidenceJsonPath: resolve(repoRoot, jsonPath),
    evidenceMdPath: resolve(repoRoot, mdPath),
  };

  console.log(JSON.stringify(result, null, 2));

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function fileExists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function readJson(relativePath, options = {}) {
  const absolute = resolve(repoRoot, relativePath);
  if (!existsSync(absolute)) {
    if (options.optional) return null;
    throw new Error(`Missing JSON file: ${relativePath}`);
  }
  return JSON.parse(readFileSync(absolute, "utf8"));
}

function containsPlaintextApiKey(text) {
  return /sk-[A-Za-z0-9]{16,}/i.test(text)
    || /nvapi-[A-Za-z0-9]{16,}/i.test(text)
    || /Bearer\s+[A-Za-z0-9._-]{16,}/i.test(text)
    || /(Authorization|api-key)\s*[:=]\s*[A-Za-z0-9._-]{16,}/i.test(text);
}

function hasPositiveProductionReadyClaim(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes("not production routing") || normalized.includes("not production-ready") || normalized.includes("not production ready")) {
    return false;
  }
  return normalized.includes("production-ready") || normalized.includes("production ready");
}

main();
