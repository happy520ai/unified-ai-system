import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const jsonPath = "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json";
const mdPath = "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.md";

const requiredFiles = [
  "apps/ai-gateway-service/src/routing/qualityCostAnswerRouter.js",
  "apps/ai-gateway-service/src/routing/answerPathClassifier.js",
  "apps/ai-gateway-service/src/routing/modelTierPolicy.js",
  "apps/ai-gateway-service/src/routing/providerAgnosticModelCatalog.js",
  "apps/ai-gateway-service/src/routing/answerQualityGatePreview.js",
  "apps/ai-gateway-service/src/routing/progressiveEscalationPolicy.js",
  "apps/ai-gateway-service/src/routing/qualityCostRoutingBenchmark.js",
  "apps/ai-gateway-service/src/entrypoints/runQualityCostRoutingBenchmark.js",
  "apps/ai-gateway-service/src/entrypoints/verifyQualityCostRoutingPreview.js",
  "docs/QUALITY_COST_ANSWER_ROUTER_PREVIEW.md",
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
  "Why provider-agnostic routing matters",
  "Why anti-model-dependency matters",
  "Perfect UX + minimum necessary tokens",
  "Answer path definitions",
  "Model tier definitions",
  "Provider-agnostic model catalog",
  "Quality-cost routing policy",
  "Answer quality gate preview",
  "Progressive escalation",
  "How cache / RAG / token guard affect routing",
  "Why MiMo is only one premium candidate",
  "When to use rule_only",
  "When to use cache_only",
  "When to use rag_local",
  "When to recommend cheap_model",
  "When to recommend standard_model",
  "When to recommend premium_model",
  "When to recommend expert_model",
  "When to recommend multi_model_review",
  "When to require approval",
  "When to block",
  "Benchmark cases",
  "Token saving impact",
  "UX quality impact",
  "What this does not do",
  "Safety boundaries",
  "Verification commands",
  "Next phase options",
];

function main() {
  const evidence = readJson(jsonPath);
  const docsText = readText("docs/QUALITY_COST_ANSWER_ROUTER_PREVIEW.md");
  const evidenceText = readText(jsonPath);
  const evidenceMdText = readText(mdPath);
  const uiText = readText("apps/ai-gateway-service/src/ui/consolePage.js");
  const rootPackage = readJson("package.json");
  const servicePackage = readJson("apps/ai-gateway-service/package.json");
  const phase275 = readJson("apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json", { optional: true });

  const premiumCases = evidence.cases?.filter((item) => item.answerPath === "premium_model") ?? [];
  const expertCases = evidence.cases?.filter((item) => item.answerPath === "expert_model") ?? [];
  const multiCases = evidence.cases?.filter((item) => item.answerPath === "multi_model_review") ?? [];

  const checks = {
    requiredFilesExist: requiredFiles.every(fileExists),
    packageScriptsExist: Boolean(rootPackage.scripts?.["benchmark:quality-cost-routing"])
      && Boolean(rootPackage.scripts?.["verify:phase276a-quality-cost-routing-preview"])
      && Boolean(servicePackage.scripts?.["benchmark:quality-cost-routing"])
      && Boolean(servicePackage.scripts?.["verify:phase276a-quality-cost-routing-preview"]),
    uiMarkerExists: uiText.includes("Provider-Agnostic Quality-Cost Answer Router"),
    requiredDocsSectionsPresent: requiredDocSections.every((section) => docsText.includes(`## ${section}`)),
    evidenceStatusPassed: evidence.status === "passed",
    caseCountAtLeast20: evidence.summary?.caseCount >= 20 && Array.isArray(evidence.cases) && evidence.cases.length >= 20,
    providerAgnosticTrue: evidence.router?.providerAgnostic === true,
    singleProviderLockedFalse: evidence.router?.singleProviderLocked === false,
    defaultPremiumProviderNull: evidence.router?.defaultPremiumProvider === null,
    premiumCandidatesIncludesMimo: evidence.router?.premiumCandidates?.includes("mimo-v2.5-pro") === true,
    premiumCandidatesLengthAtLeast3: (evidence.router?.premiumCandidates?.length ?? 0) >= 3,
    ruleOnlyCountPositive: evidence.summary?.ruleOnlyCount > 0,
    ragLocalCountPositive: evidence.summary?.ragLocalCount > 0,
    cheapModelCountPositive: evidence.summary?.cheapModelCount > 0,
    standardModelCountPositive: evidence.summary?.standardModelCount > 0,
    premiumModelRecommendationCountPositive: evidence.summary?.premiumModelRecommendationCount > 0,
    expertModelRecommendationCountPositive: evidence.summary?.expertModelRecommendationCount > 0,
    multiModelReviewRecommendationCountPositive: evidence.summary?.multiModelReviewRecommendationCount > 0,
    requireApprovalCountPositive: evidence.summary?.requireApprovalCount > 0,
    blockCountPositive: evidence.summary?.blockCount > 0,
    qualityGateRequiredCountPositive: evidence.summary?.qualityGateRequiredCount > 0,
    progressiveEscalationCountPositive: evidence.summary?.progressiveEscalationCount > 0,
    paidApiCallCountZero: evidence.paidApiCallCount === 0 && evidence.summary?.paidApiCallCount === 0,
    externalApiCalledFalse: evidence.externalApiCalled === false,
    mimoApiCalledFalse: evidence.mimoApiCalled === false,
    modelActuallyCalledFalse: evidence.modelActuallyCalled === false,
    defaultNvidiaChatLaneChangedFalse: evidence.defaultNvidiaChatLaneChanged === false,
    mimoSetAsDefaultFalse: evidence.mimoSetAsDefault === false,
    premiumModelDefaultFalse: evidence.router?.premiumModelDefault === false,
    premiumModelRequiresApproval: premiumCases.length > 0 && premiumCases.every((item) => item.requiresApproval === true),
    expertModelRequiresApproval: expertCases.length > 0 && expertCases.every((item) => item.requiresApproval === true),
    multiModelReviewRequiresApproval: multiCases.length > 0 && multiCases.every((item) => item.requiresApproval === true),
    noLongContextSentToPaidApi: evidence.safety?.longContextSentToPaidApi === false,
    noPlaintextApiKeyInDocsEvidenceUi: !containsPlaintextApiKey([
      docsText,
      evidenceText,
      evidenceMdText,
      uiText,
    ].join("\n")),
    noProductionReadyClaim: !hasPositiveProductionReadyClaim(docsText) && !hasPositiveProductionReadyClaim(evidenceMdText),
    legacyModifiedFalse: evidence.safety?.legacyModified === false,
    projectContextCreatedFalse: evidence.safety?.projectContextCreated === false && !fileExists("PROJECT_CONTEXT.md"),
    upstreamEvidenceExists: upstreamEvidence.every(fileExists),
    cacheIntegrationHonest: phase275?.status === "passed"
      ? evidence.upstream?.cacheHardeningAvailable === true && evidence.upstream?.cacheHardeningDependencyStatus === "passed"
      : evidence.upstream?.cacheHardeningAvailable === false && evidence.upstream?.cacheHardeningDependencyStatus === "not_available_or_not_sealed",
    longContextToMimoBlocked: evidence.cases?.find((item) => item.caseId === "send-all-docs-to-mimo")?.blockReason === "long_context_to_paid_api_forbidden",
    secretLikeCaseBlocked: evidence.cases?.find((item) => item.caseId === "secret-like-query")?.blockReason === "secret_detected",
    defaultProviderChangeBlocked: evidence.cases?.find((item) => item.caseId === "set-mimo-default")?.blockReason === "default_provider_change_forbidden_in_this_phase",
    wastefulPremiumDefaultBlocked: evidence.cases?.find((item) => item.caseId === "default-most-expensive-model")?.blockReason === "wasteful_premium_default_forbidden",
    softHitNotCacheOnly: evidence.cases?.find((item) => item.caseId === "cache-intent-soft-hit")?.answerPath !== "cache_only",
  };

  const failures = Object.entries(checks).filter(([, value]) => value !== true).map(([key]) => key);
  const result = {
    phase: "276A-quality-cost-answer-router-preview",
    status: failures.length === 0 ? "passed" : "failed",
    checks: Object.keys(checks).length,
    failures,
    caseCount: evidence.summary?.caseCount ?? 0,
    providerAgnostic: evidence.router?.providerAgnostic,
    singleProviderLocked: evidence.router?.singleProviderLocked,
    defaultPremiumProvider: evidence.router?.defaultPremiumProvider,
    premiumCandidates: evidence.router?.premiumCandidates ?? [],
    ruleOnlyCount: evidence.summary?.ruleOnlyCount ?? 0,
    ragLocalCount: evidence.summary?.ragLocalCount ?? 0,
    cheapModelCount: evidence.summary?.cheapModelCount ?? 0,
    standardModelCount: evidence.summary?.standardModelCount ?? 0,
    premiumModelRecommendationCount: evidence.summary?.premiumModelRecommendationCount ?? 0,
    expertModelRecommendationCount: evidence.summary?.expertModelRecommendationCount ?? 0,
    multiModelReviewRecommendationCount: evidence.summary?.multiModelReviewRecommendationCount ?? 0,
    requireApprovalCount: evidence.summary?.requireApprovalCount ?? 0,
    blockCount: evidence.summary?.blockCount ?? 0,
    paidApiCallCount: evidence.paidApiCallCount,
    externalApiCalled: evidence.externalApiCalled,
    mimoApiCalled: evidence.mimoApiCalled,
    modelActuallyCalled: evidence.modelActuallyCalled,
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
  return text
    .split(/\r?\n/)
    .map((line) => line.toLowerCase())
    .some((line) => {
      const mentionsReadiness = line.includes("production-ready") || line.includes("production ready");
      if (!mentionsReadiness) return false;
      return ![
        "not",
        "does not",
        "false",
        "forbidden",
        "correction",
        "claim",
      ].some((guardWord) => line.includes(guardWord));
    });
}

main();
