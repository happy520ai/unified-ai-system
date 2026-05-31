import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createProviderAgnosticModelCatalog } from "./providerAgnosticModelCatalog.js";
import { createQualityCostRoutingCases } from "./qualityCostRoutingCases.js";
import { routeQualityCostAnswer } from "./qualityCostAnswerRouter.js";
import { createModelTierRoutingPolicy, createRoutingSafety } from "./modelTierPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

export const PHASE_276A_QUALITY_COST_JSON_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json";
export const PHASE_276A_QUALITY_COST_MD_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.md";

const REQUIRED_UPSTREAM_EVIDENCE = [
  "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
  "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json",
  "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json",
];

const PHASE_275A_EVIDENCE = "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json";

export function runQualityCostRoutingBenchmark() {
  const generatedAt = new Date().toISOString();
  const catalog = createProviderAgnosticModelCatalog();
  const policy = createModelTierRoutingPolicy({
    routerType: "provider-agnostic-quality-cost",
    providerAgnostic: true,
    singleProviderLocked: false,
    defaultPremiumProvider: null,
    premiumCandidates: catalog.tiers.premium,
  });
  const upstream = readUpstreamStatus();
  const cases = createQualityCostRoutingCases({
    cacheHardeningAvailable: upstream.cacheHardeningAvailable,
  }).map((testCase) => runCase(testCase, policy, catalog, upstream));
  const summary = summarizeCases(cases);

  return {
    phase: "276A-quality-cost-answer-router-preview",
    status: summary.failCount === 0 ? "passed" : "failed",
    conclusion: summary.failCount === 0
      ? "provider-agnostic-quality-cost-answer-router-preview-ready"
      : "provider-agnostic-quality-cost-answer-router-preview-needs-repair",
    generatedAt,
    mode: "local-quality-cost-routing-preview-only",
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    modelActuallyCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    router: {
      routerType: "provider-agnostic-quality-cost",
      providerAgnostic: true,
      singleProviderLocked: false,
      qualityGoal: "best_possible_answer_with_minimum_necessary_tokens",
      progressiveEscalationEnabled: true,
      answerQualityGatePreview: true,
      defaultChatProvider: "nvidia",
      defaultPremiumProvider: null,
      premiumModelDefault: false,
      premiumCandidates: catalog.tiers.premium,
    },
    routingPolicy: {
      routingPolicyVersion: policy.routingPolicyVersion,
      defaultAnswerPath: policy.defaultAnswerPath,
      requireApprovalForPaidApi: policy.requireApprovalForPaidApi,
      requireApprovalForPremiumModel: policy.requireApprovalForPremiumModel,
      requireApprovalForExpertModel: policy.requireApprovalForExpertModel,
      requireApprovalForMultiModelReview: policy.requireApprovalForMultiModelReview,
      preferCacheBeforeModel: policy.preferCacheBeforeModel,
      preferRagBeforeModel: policy.preferRagBeforeModel,
      preferRuleOnlyBeforeModel: policy.preferRuleOnlyBeforeModel,
    },
    modelCatalog: catalog,
    upstream,
    summary,
    cases,
    gaps: [
      "This is not a production model router.",
      "There is no real cheap or standard provider execution.",
      "There is no real answer quality scoring or user satisfaction loop.",
      "There is no LLM judge or embedding semantic confidence.",
      "There is no real multi-model cost reconciliation.",
      "There is no production policy engine.",
      "There is no multi-user permission or budget isolation.",
    ],
    recommendedNextRoutes: [
      {
        route: "Phase 277A Paid API Preflight Orchestrator",
        reason: "Wire cache, RAG, Token Guard, Quality-Cost Router, and Approval Gate into one preview preflight before any paid call.",
        paidApiExpansionRecommended: false,
      },
      {
        route: "Answer Quality Scoring Preview",
        reason: "Add local answer-contract scoring and user feedback metadata before real model routing.",
        paidApiExpansionRecommended: false,
      },
      {
        route: "Provider Cost Catalog Calibration",
        reason: "Improve cost estimates across future cheap, standard, premium, and expert candidates without calling providers.",
        paidApiExpansionRecommended: false,
      },
    ],
    safety: createRoutingSafety(),
  };
}

export function renderQualityCostRoutingMarkdown(evidence) {
  const summary = evidence.summary;
  const lines = [
    "# Phase 276A Provider-Agnostic Quality-Cost Answer Router Preview",
    "",
    "## Purpose",
    "Build a provider-agnostic local routing preview that targets best possible answer quality with minimum necessary token cost.",
    "",
    "## Result",
    `- status: ${evidence.status}`,
    `- conclusion: ${evidence.conclusion}`,
    `- mode: ${evidence.mode}`,
    `- paidApiCallCount: ${evidence.paidApiCallCount}`,
    `- externalApiCalled: ${evidence.externalApiCalled}`,
    `- mimoApiCalled: ${evidence.mimoApiCalled}`,
    `- modelActuallyCalled: ${evidence.modelActuallyCalled}`,
    `- providerAgnostic: ${evidence.router.providerAgnostic}`,
    `- singleProviderLocked: ${evidence.router.singleProviderLocked}`,
    `- defaultPremiumProvider: ${evidence.router.defaultPremiumProvider}`,
    "",
    "## Summary",
    `- caseCount: ${summary.caseCount}`,
    `- ruleOnlyCount: ${summary.ruleOnlyCount}`,
    `- cacheOnlyCount: ${summary.cacheOnlyCount}`,
    `- ragLocalCount: ${summary.ragLocalCount}`,
    `- cheapModelCount: ${summary.cheapModelCount}`,
    `- standardModelCount: ${summary.standardModelCount}`,
    `- premiumModelRecommendationCount: ${summary.premiumModelRecommendationCount}`,
    `- expertModelRecommendationCount: ${summary.expertModelRecommendationCount}`,
    `- multiModelReviewRecommendationCount: ${summary.multiModelReviewRecommendationCount}`,
    `- requireApprovalCount: ${summary.requireApprovalCount}`,
    `- blockCount: ${summary.blockCount}`,
    `- paidApiRecommendationCount: ${summary.paidApiRecommendationCount}`,
    `- avoidedPaidApiCallCount: ${summary.avoidedPaidApiCallCount}`,
    `- estimatedTokensAvoided: ${summary.estimatedTokensAvoided}`,
    `- qualityGateRequiredCount: ${summary.qualityGateRequiredCount}`,
    `- progressiveEscalationCount: ${summary.progressiveEscalationCount}`,
    `- passCount: ${summary.passCount}`,
    `- warnCount: ${summary.warnCount}`,
    `- failCount: ${summary.failCount}`,
    "",
    "## Premium Candidates",
    ...evidence.router.premiumCandidates.map((candidate) => `- ${candidate}`),
    "",
    "## Case Matrix",
    "| caseId | answerPath | modelTier | provider | approval | qualityGate | status |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...evidence.cases.map((item) => `| ${item.caseId} | ${item.answerPath} | ${item.modelTier} | ${item.providerRecommendation} | ${item.requiresApproval} | ${item.qualityGateRequired} | ${item.status} |`),
    "",
    "## Current Gaps",
    ...evidence.gaps.map((gap) => `- ${gap}`),
    "",
    "## Safety",
    "- This phase calls no MiMo API.",
    "- This phase calls no paid API.",
    "- This phase calls no model, embedding, semantic model, or LLM judge.",
    "- This phase keeps MiMo as only one premium candidate.",
    "- This phase keeps the default NVIDIA /chat lane unchanged.",
    "- This phase is a routing preview, not production routing.",
  ];
  return `${lines.join("\n")}\n`;
}

function runCase(testCase, policy, catalog, upstream) {
  const queryForRouting = testCase.unsafeQueryForRoutingOnly ?? testCase.query;
  const route = routeQualityCostAnswer({
    ...testCase,
    query: queryForRouting,
    cacheHardeningAvailable: upstream.cacheHardeningAvailable,
    latestPhase: upstream.cacheHardeningAvailable ? "275A" : "274A",
    latestEvidenceStatus: "passed",
    latestVerifierStatus: "passed",
    currentBlocker: testCase.currentBlocker ?? "none",
    readyState: "preview-ready",
    workspaceDirtyState: "dirty",
  }, { policy, catalog });
  const warnings = evaluateCase(testCase, route, upstream);
  const estimatedTotalTokens = route.tokenEstimate.totalTokens;
  const avoided = route.paidApiCallCount === 0 ? Math.max(0, estimatedTotalTokens) : 0;

  return {
    caseId: testCase.caseId,
    query: testCase.query,
    mode: "local-quality-cost-routing-preview-only",
    answerPath: route.answerPath,
    modelTier: route.modelTier,
    providerAgnostic: route.providerAgnostic,
    singleProviderLocked: route.singleProviderLocked,
    providerRecommendation: route.providerRecommendation,
    modelRecommendation: route.modelRecommendation,
    premiumCandidates: route.premiumCandidates,
    defaultPremiumProvider: route.defaultPremiumProvider,
    requiresPaidApi: route.requiresPaidApi,
    requiresApproval: route.requiresApproval,
    shouldBlock: route.shouldBlock,
    blockReason: route.blockReason,
    routingReason: route.routingReason,
    confidence: route.confidence,
    qualityGateRequired: route.answerQualityGate.qualityGateRequired,
    qualityTarget: route.answerQualityGate.qualityTarget,
    progressiveEscalationEnabled: route.progressiveEscalation.progressiveEscalationEnabled,
    nextEscalationPath: route.progressiveEscalation.nextEscalationPath,
    cacheDecision: route.cacheDecision,
    cacheHitType: route.cacheHitType,
    cacheDependencyLimited: Boolean(testCase.cacheDependencyLimited),
    servedFromCache: route.servedFromCache,
    tokenGuardDecision: route.tokenGuard.decision,
    sourceSelectionUsed: route.sourceSelectionSummary.sourceSelectionUsed,
    estimatedInputTokens: route.tokenEstimate.inputTokens,
    estimatedOutputTokens: route.tokenEstimate.outputTokens,
    estimatedTotalTokens,
    estimatedCostUsd: route.costEstimate.totalCostUsd,
    estimatedTokensAvoided: avoided,
    paidApiCallCount: route.paidApiCallCount,
    externalApiCalled: route.externalApiCalled,
    mimoApiCalled: route.mimoApiCalled,
    modelActuallyCalled: route.modelActuallyCalled,
    defaultNvidiaChatLaneChanged: route.defaultNvidiaChatLaneChanged,
    mimoSetAsDefault: route.mimoSetAsDefault,
    reasonCodes: route.reasonCodes,
    recommendedActions: route.recommendedActions,
    intentSignature: route.intent.intentSignature,
    queryLanguage: route.intent.queryLanguage,
    selectedSourcesHash: route.cacheMetadata.selectedSourcesHash,
    latestEvidenceHash: route.cacheMetadata.latestEvidenceHash,
    answerContractHash: route.cacheMetadata.answerContractHash,
    status: warnings.length === 0 ? "pass" : "fail",
    warnings,
  };
}

function evaluateCase(testCase, route, upstream) {
  const expected = testCase.expected ?? {};
  const warnings = [];
  const expectedPaths = expected.answerPaths ?? (expected.answerPath ? [expected.answerPath] : []);

  if (expectedPaths.length > 0 && !expectedPaths.includes(route.answerPath)) warnings.push(`expected_answer_path_${expectedPaths.join("_or_")}_got_${route.answerPath}`);
  if (expected.modelTier && route.modelTier !== expected.modelTier) warnings.push(`expected_model_tier_${expected.modelTier}_got_${route.modelTier}`);
  if (expected.notModelTier && route.modelTier === expected.notModelTier) warnings.push(`unexpected_model_tier_${expected.notModelTier}`);
  if (expected.requiresPaidApi !== undefined && route.requiresPaidApi !== expected.requiresPaidApi) warnings.push("requires_paid_api_mismatch");
  if (expected.requiresApproval !== undefined && route.requiresApproval !== expected.requiresApproval) warnings.push("requires_approval_mismatch");
  if (expected.providerAgnostic !== undefined && route.providerAgnostic !== expected.providerAgnostic) warnings.push("provider_agnostic_mismatch");
  if (expected.blockReason && route.blockReason !== expected.blockReason) warnings.push(`expected_block_${expected.blockReason}_got_${route.blockReason}`);
  if (expected.notProvider && route.providerRecommendation === expected.notProvider) warnings.push(`unexpected_provider_${expected.notProvider}`);
  if (expected.servedFromCache !== undefined && route.servedFromCache !== expected.servedFromCache) warnings.push("served_from_cache_mismatch");
  if (expected.qualityGateRequired !== undefined && route.answerQualityGate.qualityGateRequired !== expected.qualityGateRequired) warnings.push("quality_gate_required_mismatch");
  if (expected.progressiveEscalationEnabled !== undefined && route.progressiveEscalation.progressiveEscalationEnabled !== expected.progressiveEscalationEnabled) warnings.push("progressive_escalation_mismatch");
  if (expected.modelActuallyCalled !== undefined && route.modelActuallyCalled !== expected.modelActuallyCalled) warnings.push("model_actually_called_mismatch");
  if (route.paidApiCallCount !== 0 || route.externalApiCalled || route.mimoApiCalled || route.modelActuallyCalled) warnings.push("external_paid_or_model_call_was_reported");
  if (route.defaultNvidiaChatLaneChanged || route.mimoSetAsDefault || route.singleProviderLocked) warnings.push("provider_boundary_changed");
  if (["premium_model", "expert_model", "multi_model_review"].includes(route.answerPath) && route.requiresApproval !== true) warnings.push("paid_or_advanced_path_without_required_approval");
  if (route.answerPath === "cache_only" && !upstream.cacheHardeningAvailable) warnings.push("cache_only_without_cache_hardening");
  if (["intent_soft_hit", "multilingual_intent_soft_hit", "semantic_soft_hit"].includes(route.cacheHitType) && route.answerPath === "cache_only") warnings.push("soft_hit_used_as_cache_only");
  if (route.providerAgnostic !== true) warnings.push("provider_agnostic_false");
  if (route.defaultPremiumProvider !== null) warnings.push("default_premium_provider_not_null");
  if (!route.premiumCandidates.includes("mimo-v2.5-pro") || route.premiumCandidates.length < 3) warnings.push("premium_candidates_incomplete");

  return warnings;
}

function summarizeCases(cases) {
  return {
    caseCount: cases.length,
    ruleOnlyCount: countPath(cases, "rule_only"),
    cacheOnlyCount: countPath(cases, "cache_only"),
    ragLocalCount: countPath(cases, "rag_local"),
    cheapModelCount: countPath(cases, "cheap_model"),
    standardModelCount: countPath(cases, "standard_model"),
    premiumModelRecommendationCount: countPath(cases, "premium_model"),
    expertModelRecommendationCount: countPath(cases, "expert_model"),
    multiModelReviewRecommendationCount: countPath(cases, "multi_model_review"),
    requireApprovalCount: cases.filter((item) => item.requiresApproval || item.answerPath === "require_approval").length,
    blockCount: cases.filter((item) => item.answerPath === "block" || item.shouldBlock).length,
    paidApiRecommendationCount: cases.filter((item) => item.requiresPaidApi).length,
    paidApiCallCount: 0,
    avoidedPaidApiCallCount: cases.filter((item) => item.paidApiCallCount === 0).length,
    estimatedTokensAvoided: cases.reduce((sum, item) => sum + Number(item.estimatedTokensAvoided ?? 0), 0),
    qualityGateRequiredCount: cases.filter((item) => item.qualityGateRequired).length,
    progressiveEscalationCount: cases.filter((item) => item.progressiveEscalationEnabled).length,
    passCount: cases.filter((item) => item.status === "pass").length,
    warnCount: cases.filter((item) => item.status === "warn").length,
    failCount: cases.filter((item) => item.status === "fail").length,
  };
}

function countPath(cases, path) {
  return cases.filter((item) => item.answerPath === path).length;
}

function readUpstreamStatus() {
  const evidence = Object.fromEntries(
    REQUIRED_UPSTREAM_EVIDENCE.map((relativePath) => [relativePath, readEvidence(relativePath)]),
  );
  const phase275 = readEvidence(PHASE_275A_EVIDENCE);

  return {
    requiredEvidence: REQUIRED_UPSTREAM_EVIDENCE,
    requiredEvidencePresent: REQUIRED_UPSTREAM_EVIDENCE.every((relativePath) => evidence[relativePath].exists),
    requiredEvidencePassed: REQUIRED_UPSTREAM_EVIDENCE.every((relativePath) => evidence[relativePath].json?.status === "passed"),
    tokenGuardAvailable: evidence["apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json"].json?.status === "passed",
    ragSourceSelectionAvailable: evidence["apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json"].json?.status === "passed",
    systemCapabilityBenchmarkAvailable: evidence["apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json"].json?.status === "passed",
    cacheHardeningAvailable: phase275.exists && phase275.json?.status === "passed",
    cacheHardeningDependencyStatus: phase275.exists && phase275.json?.status === "passed" ? "passed" : "not_available_or_not_sealed",
    cacheHardeningEvidencePath: PHASE_275A_EVIDENCE,
    cacheHardeningVerifierExpected: "verify:phase275a-response-cache-hardening",
  };
}

function readEvidence(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return { exists: false, json: null };

  try {
    return {
      exists: true,
      json: JSON.parse(readFileSync(absolutePath, "utf8")),
    };
  } catch {
    return {
      exists: true,
      json: null,
    };
  }
}
