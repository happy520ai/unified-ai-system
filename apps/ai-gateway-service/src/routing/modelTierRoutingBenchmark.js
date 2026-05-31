import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createModelTierRoutingCases } from "./modelTierRoutingCases.js";
import { routeAnswerPath } from "./modelTierRouter.js";
import { createModelTierRoutingPolicy, createRoutingSafety } from "./modelTierPolicy.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

export const PHASE_276A_JSON_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-276a-model-tier-routing-preview.json";
export const PHASE_276A_MD_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-276a-model-tier-routing-preview.md";

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

export function runModelTierRoutingBenchmark() {
  const generatedAt = new Date().toISOString();
  const policy = createModelTierRoutingPolicy();
  const upstream = readUpstreamStatus();
  const cases = createModelTierRoutingCases({
    cacheHardeningAvailable: upstream.cacheHardeningAvailable,
  }).map((testCase) => runCase(testCase, policy, upstream));
  const summary = summarizeCases(cases);

  return {
    phase: "276A-model-tier-routing-preview",
    status: summary.failCount === 0 ? "passed" : "failed",
    conclusion: summary.failCount === 0 ? "model-tier-routing-preview-ready" : "model-tier-routing-preview-needs-repair",
    generatedAt,
    mode: "local-routing-preview-only",
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    routingPolicy: {
      routingPolicyVersion: policy.routingPolicyVersion,
      defaultAnswerPath: policy.defaultAnswerPath,
      premiumProvider: policy.premiumProvider,
      premiumModel: policy.premiumModel,
      premiumModelDefault: policy.premiumModelDefault,
      requireApprovalForPaidApi: policy.requireApprovalForPaidApi,
      requireApprovalForPremiumModel: policy.requireApprovalForPremiumModel,
      preferCacheBeforeModel: policy.preferCacheBeforeModel,
      preferRagBeforeModel: policy.preferRagBeforeModel,
      preferRuleOnlyBeforeModel: policy.preferRuleOnlyBeforeModel,
    },
    upstream,
    summary,
    cases,
    gaps: [
      "This is not a production model router.",
      "There is no real cheap or standard external provider execution in this phase.",
      "There is no real answer quality gate or LLM judge.",
      "There is no embedding semantic confidence.",
      "There is no multi-model production cost reconciliation.",
      "There is no production policy engine or multi-user budget isolation.",
    ],
    recommendedNextRoutes: [
      {
        route: "Phase 277A Paid API Preflight Orchestrator",
        reason: "Connect cache, RAG source selection, Token Guard, model tier routing, and Approval Gate as one preview preflight before any paid call.",
        paidApiExpansionRecommended: false,
      },
      {
        route: "Answer Quality Gate Preview",
        reason: "Add deterministic answer-contract validation before allowing any future provider execution path.",
        paidApiExpansionRecommended: false,
      },
      {
        route: "Provider Cost Catalog Preview",
        reason: "Compare cheap, standard, and premium model cost metadata without calling providers.",
        paidApiExpansionRecommended: false,
      },
    ],
    safety: createRoutingSafety(),
  };
}

export function renderModelTierRoutingMarkdown(evidence) {
  const summary = evidence.summary;
  const lines = [
    "# Phase 276A Model Tier Routing Preview",
    "",
    "## Purpose",
    "Build an Answer Path Router that prefers rule_only, cache_only, and rag_local before recommending any model.",
    "",
    "## Result",
    `- status: ${evidence.status}`,
    `- conclusion: ${evidence.conclusion}`,
    `- mode: ${evidence.mode}`,
    `- paidApiCallCount: ${evidence.paidApiCallCount}`,
    `- externalApiCalled: ${evidence.externalApiCalled}`,
    `- mimoApiCalled: ${evidence.mimoApiCalled}`,
    `- defaultNvidiaChatLaneChanged: ${evidence.defaultNvidiaChatLaneChanged}`,
    `- mimoSetAsDefault: ${evidence.mimoSetAsDefault}`,
    "",
    "## Summary",
    `- caseCount: ${summary.caseCount}`,
    `- ruleOnlyCount: ${summary.ruleOnlyCount}`,
    `- cacheOnlyCount: ${summary.cacheOnlyCount}`,
    `- ragLocalCount: ${summary.ragLocalCount}`,
    `- cheapModelCount: ${summary.cheapModelCount}`,
    `- standardModelCount: ${summary.standardModelCount}`,
    `- premiumMimoRecommendationCount: ${summary.premiumMimoRecommendationCount}`,
    `- requireApprovalCount: ${summary.requireApprovalCount}`,
    `- blockCount: ${summary.blockCount}`,
    `- paidApiRecommendationCount: ${summary.paidApiRecommendationCount}`,
    `- avoidedPaidApiCallCount: ${summary.avoidedPaidApiCallCount}`,
    `- estimatedTokensAvoided: ${summary.estimatedTokensAvoided}`,
    `- passCount: ${summary.passCount}`,
    `- warnCount: ${summary.warnCount}`,
    `- failCount: ${summary.failCount}`,
    "",
    "## Cache / RAG / Token Guard Metadata",
    `- tokenGuardAvailable: ${evidence.upstream.tokenGuardAvailable}`,
    `- ragSourceSelectionAvailable: ${evidence.upstream.ragSourceSelectionAvailable}`,
    `- cacheHardeningAvailable: ${evidence.upstream.cacheHardeningAvailable}`,
    `- cacheHardeningDependencyStatus: ${evidence.upstream.cacheHardeningDependencyStatus}`,
    "",
    "## Case Matrix",
    "| caseId | answerPath | modelTier | requiresPaidApi | requiresApproval | shouldBlock | status |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...evidence.cases.map((item) => `| ${item.caseId} | ${item.answerPath} | ${item.modelTier} | ${item.requiresPaidApi} | ${item.requiresApproval} | ${item.shouldBlock} | ${item.status} |`),
    "",
    "## Current Gaps",
    ...evidence.gaps.map((gap) => `- ${gap}`),
    "",
    "## Next Route",
    "- Recommended: Phase 277A Paid API Preflight Orchestrator.",
    "- Reason: 276A decides the answer path; 277A should wire cache, RAG, Token Guard, Model Tier, and Approval Gate into one preflight without expanding paid API calls.",
    "",
    "## Safety",
    "- This phase does not call MiMo.",
    "- This phase does not call any paid API.",
    "- This phase does not call embedding or a semantic model.",
    "- This phase does not change the default NVIDIA /chat lane.",
    "- This phase does not set MiMo as default.",
    "- This phase is preview routing only and is not production routing.",
  ];
  return `${lines.join("\n")}\n`;
}

function runCase(testCase, policy, upstream) {
  const queryForRouting = testCase.unsafeQueryForRoutingOnly ?? testCase.query;
  const route = routeAnswerPath({
    ...testCase,
    query: queryForRouting,
    cacheHardeningAvailable: upstream.cacheHardeningAvailable,
    latestPhase: upstream.cacheHardeningAvailable ? "275A" : "274A",
    latestEvidenceStatus: "passed",
    latestVerifierStatus: "passed",
    currentBlocker: testCase.currentBlocker ?? "none",
    readyState: "preview-ready",
    workspaceDirtyState: "dirty",
  }, { policy });
  const warnings = evaluateCase(testCase, route, upstream);
  const estimatedTotalTokens = route.tokenEstimate.totalTokens;
  const avoided = route.paidApiCallCount === 0 ? Math.max(0, estimatedTotalTokens) : 0;

  return {
    caseId: testCase.caseId,
    query: testCase.query,
    mode: "local-routing-preview-only",
    answerPath: route.answerPath,
    modelTier: route.modelTier,
    providerRecommendation: route.providerRecommendation,
    modelRecommendation: route.modelRecommendation,
    requiresPaidApi: route.requiresPaidApi,
    requiresApproval: route.requiresApproval,
    shouldBlock: route.shouldBlock,
    blockReason: route.blockReason,
    routingReason: route.routingReason,
    confidence: route.confidence,
    cacheDecision: route.cacheDecision,
    cacheHitType: route.cacheHitType,
    tokenGuardDecision: route.tokenGuard.decision,
    sourceSelectionUsed: route.sourceSelectionSummary.sourceSelectionUsed,
    cacheDependencyLimited: Boolean(testCase.cacheDependencyLimited),
    servedFromCache: route.servedFromCache,
    servedFromCachePreviewOnly: route.servedFromCachePreviewOnly,
    estimatedInputTokens: route.tokenEstimate.inputTokens,
    estimatedOutputTokens: route.tokenEstimate.outputTokens,
    estimatedTotalTokens,
    estimatedCostUsd: route.costEstimate.totalCostUsd,
    estimatedTokensAvoided: avoided,
    paidApiCallCount: route.paidApiCallCount,
    externalApiCalled: route.externalApiCalled,
    mimoApiCalled: route.mimoApiCalled,
    defaultNvidiaChatLaneChanged: route.defaultNvidiaChatLaneChanged,
    mimoSetAsDefault: route.mimoSetAsDefault,
    reasonCodes: route.reasonCodes,
    requiredPreflight: route.requiredPreflight,
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

  if (expectedPaths.length > 0 && !expectedPaths.includes(route.answerPath)) {
    warnings.push(`expected_answer_path_${expectedPaths.join("_or_")}_got_${route.answerPath}`);
  }
  if (expected.modelTier && route.modelTier !== expected.modelTier) warnings.push(`expected_model_tier_${expected.modelTier}_got_${route.modelTier}`);
  if (expected.requiresPaidApi !== undefined && route.requiresPaidApi !== expected.requiresPaidApi) warnings.push("requires_paid_api_mismatch");
  if (expected.requiresApproval !== undefined && route.requiresApproval !== expected.requiresApproval) warnings.push("requires_approval_mismatch");
  if (expected.blockReason && route.blockReason !== expected.blockReason) warnings.push(`expected_block_${expected.blockReason}_got_${route.blockReason}`);
  if (expected.notProvider && route.providerRecommendation === expected.notProvider) warnings.push(`unexpected_provider_${expected.notProvider}`);
  if (expected.servedFromCache !== undefined && route.servedFromCache !== expected.servedFromCache) warnings.push("served_from_cache_mismatch");
  if (route.paidApiCallCount !== 0 || route.externalApiCalled || route.mimoApiCalled) warnings.push("external_or_paid_call_was_reported");
  if (route.defaultNvidiaChatLaneChanged || route.mimoSetAsDefault) warnings.push("default_provider_boundary_changed");
  if (route.answerPath === "premium_mimo" && route.requiresApproval !== true) warnings.push("premium_mimo_without_required_approval");
  if (route.answerPath === "cache_only" && !upstream.cacheHardeningAvailable) warnings.push("cache_only_without_cache_hardening");
  if (["intent_soft_hit", "multilingual_intent_soft_hit", "semantic_soft_hit"].includes(route.cacheHitType) && route.answerPath === "cache_only") warnings.push("soft_hit_used_as_cache_only");

  return warnings;
}

function summarizeCases(cases) {
  const summary = {
    caseCount: cases.length,
    ruleOnlyCount: countPath(cases, "rule_only"),
    cacheOnlyCount: countPath(cases, "cache_only"),
    ragLocalCount: countPath(cases, "rag_local"),
    cheapModelCount: countPath(cases, "cheap_model"),
    standardModelCount: countPath(cases, "standard_model"),
    premiumMimoRecommendationCount: countPath(cases, "premium_mimo"),
    requireApprovalCount: cases.filter((item) => item.requiresApproval).length,
    blockCount: cases.filter((item) => item.answerPath === "block" || item.shouldBlock).length,
    paidApiRecommendationCount: cases.filter((item) => item.requiresPaidApi).length,
    paidApiCallCount: 0,
    avoidedPaidApiCallCount: cases.filter((item) => item.paidApiCallCount === 0).length,
    estimatedTokensAvoided: cases.reduce((sum, item) => sum + Number(item.estimatedTokensAvoided ?? 0), 0),
    passCount: cases.filter((item) => item.status === "pass").length,
    warnCount: cases.filter((item) => item.status === "warn").length,
    failCount: cases.filter((item) => item.status === "fail").length,
  };
  return summary;
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
  if (!existsSync(absolutePath)) {
    return { exists: false, json: null };
  }

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
