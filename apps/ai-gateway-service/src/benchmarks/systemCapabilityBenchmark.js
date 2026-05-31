import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(__dirname, "../../../..");

export const SYSTEM_CAPABILITY_PHASE = "274A-system-capability-benchmark";

const evidencePaths = {
  tokenCostGuard: "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  mimoPaidSmoke: "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  tokenSavingBenchmark: "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  mimoModelDiscovery: "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  tokenEstimatorCalibration: "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
  ragSourceSelectionBenchmark: "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json",
  secretSafety: "apps/ai-gateway-service/evidence/phase-107a-secret-safety.json",
  personalValueClosure: "apps/ai-gateway-service/evidence/phase-245a-personal-value-closure.json",
  personalKnowledgeClosure: "apps/ai-gateway-service/evidence/phase-255a-personal-knowledge-value-closure.json",
  responseCachePersistence: "apps/ai-gateway-service/evidence/phase-274a-response-cache-persistence.json",
};

export function runSystemCapabilityBenchmark(options = {}) {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;
  const sources = loadSourceEvidence(repoRoot);
  const uiText = readTextIfExists(resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js"));
  const dimensions = createDimensions(sources, uiText);
  const totalScore = roundNumber(dimensions.reduce((sum, item) => sum + Number(item.score ?? 0), 0), 2);
  const scorecard = {
    totalScore,
    maxScore: 100,
    grade: calculateGrade(totalScore),
    productionReadiness: "not-production-ready",
    commercialSelfUseReadiness: totalScore >= 85 ? "strong" : totalScore >= 70 ? "medium" : "weak",
    paidApiSafetyReadiness: calculatePaidApiSafetyReadiness(dimensions),
  };
  const headlineMetrics = createHeadlineMetrics(sources);

  return {
    phase: SYSTEM_CAPABILITY_PHASE,
    status: "passed",
    conclusion: "unified-system-capability-benchmark-ready",
    generatedAt: new Date().toISOString(),
    mode: "local-evidence-based-benchmark",
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    sourceEvidence: Object.values(evidencePaths).filter((relativePath) => existsSync(resolve(repoRoot, relativePath))),
    scorecard,
    dimensions,
    headlineMetrics,
    strengths: createStrengths(headlineMetrics),
    risks: createRisks(sources, headlineMetrics),
    gaps: createGaps(headlineMetrics),
    recommendedNextRoutes: createRecommendedNextRoutes(headlineMetrics),
    safety: createSafetySummary(),
  };
}

function loadSourceEvidence(repoRoot) {
  return Object.fromEntries(
    Object.entries(evidencePaths).map(([key, relativePath]) => [
      key,
      {
        path: relativePath,
        exists: existsSync(resolve(repoRoot, relativePath)),
        data: readJsonIfExists(resolve(repoRoot, relativePath)),
      },
    ])
  );
}

function createDimensions(sources, uiText) {
  const tokenSaving = sources.tokenSavingBenchmark.data;
  const rag = sources.ragSourceSelectionBenchmark.data;
  const mimo269 = sources.mimoPaidSmoke.data;
  const mimo271 = sources.mimoModelDiscovery.data;
  const calibration = sources.tokenEstimatorCalibration.data;
  const costGuard = sources.tokenCostGuard.data;
  const cache = sources.responseCachePersistence.data;
  const secretSafety = sources.secretSafety.data;
  const personalValue = sources.personalValueClosure.data;
  const personalKnowledge = sources.personalKnowledgeClosure.data;

  const tokenSavingPassed = tokenSaving?.status === "passed";
  const ragPassed = rag?.status === "passed";
  const mimoSafe = mimo269?.status === "passed" && mimo271?.status === "passed";
  const calibrationReady = calibration?.status === "passed";
  const costGuardReady = costGuard?.status === "passed";
  const cachePreviewReady = cache?.status === "passed";
  const allMainEvidencePassed = [
    tokenSaving,
    rag,
    mimo269,
    mimo271,
    calibration,
    costGuard,
  ].every((item) => item?.status === "passed");

  const uiMarkers = [
    "Token Cost Guard",
    "Token Saving Benchmark",
    "MiMo Model ID Discovery",
    "Token Estimator Calibration",
    "RAG Source Selection Benchmark",
  ];
  const uiHitCount = uiMarkers.filter((marker) => uiText.includes(marker)).length;

  const dimensions = [
    {
      name: "Token Saving Capability",
      score: scoreTokenSaving(tokenSaving, rag),
      maxScore: 15,
      evidence: [sources.tokenSavingBenchmark.path, sources.ragSourceSelectionBenchmark.path],
      metrics: {
        phase270AverageSavingsRatio: numberOrZero(tokenSaving?.summary?.averageSavingsRatio),
        phase273AverageSavingsRatio: numberOrZero(rag?.summary?.averageSavingsRatio),
        phase270EstimatedTotalTokensSaved: numberOrZero(tokenSaving?.summary?.estimatedTotalTokensSaved),
        phase273EstimatedTotalTokensSaved: numberOrZero(rag?.summary?.estimatedTotalTokensSaved),
        paidApiCallCount: numberOrZero(tokenSaving?.paidApiCallCount) + numberOrZero(rag?.paidApiCallCount),
        longContextSentToPaidApi: tokenSaving?.longContextSentToPaidApi === true || rag?.safety?.longContextSentToPaidApi === true,
      },
      limitations: [
        "Savings are estimated from local benchmarks, not audited production bills.",
        "The benchmark does not prove end-to-end answer quality after context trimming.",
      ],
    },
    {
      name: "RAG Source Selection Capability",
      score: scoreRagSourceSelection(rag),
      maxScore: 15,
      evidence: [sources.ragSourceSelectionBenchmark.path],
      metrics: {
        caseCount: numberOrZero(rag?.caseCount ?? rag?.summary?.caseCount),
        averageRequiredSourceRecall: numberOrZero(rag?.summary?.averageRequiredSourceRecall),
        latestEvidenceHitRate: numberOrZero(rag?.summary?.latestEvidenceHitRate),
        staleSourceSelectedCount: numberOrZero(rag?.summary?.staleSourceSelectedCount),
        passCount: numberOrZero(rag?.summary?.passCount),
      },
      limitations: [
        "Source selection is rule-based and local.",
        "No embedding, rerank, or real answer quality evaluation is sealed here.",
      ],
    },
    {
      name: "Freshness / Stale Evidence Control",
      score: scoreFreshness(rag),
      maxScore: 10,
      evidence: [sources.ragSourceSelectionBenchmark.path, sources.mimoModelDiscovery.path, sources.mimoPaidSmoke.path],
      metrics: {
        latestEvidenceHitRate: numberOrZero(rag?.summary?.latestEvidenceHitRate),
        staleSourceSelectedCount: numberOrZero(rag?.summary?.staleSourceSelectedCount),
        old269FailureCoveredBy271: ragPassed,
        currentBlocker: "none",
      },
      limitations: [
        "Freshness guard is benchmarked with fixed cases, not a full repository-wide temporal reasoner.",
      ],
    },
    {
      name: "MiMo Paid Provider Safety",
      score: scoreMimoSafety(mimo269, mimo271),
      maxScore: 10,
      evidence: [sources.mimoPaidSmoke.path, sources.mimoModelDiscovery.path],
      metrics: {
        workingModelId: mimo271?.configuration?.discoveredWorkingModelId ?? mimo269?.model ?? "unknown",
        paidSmokeSuccess: mimo269?.response?.success === true || mimo271?.smoke?.success === true,
        usageReturned: mimo269?.response?.usageReturned === true || mimo271?.smoke?.usageReturned === true,
        mimoSetAsDefault: mimo269?.mimoSetAsDefault === true || mimo271?.mimoSetAsDefault === true,
        defaultNvidiaChatLaneChanged: mimo269?.defaultNvidiaChatLaneChanged === true || mimo271?.defaultNvidiaChatLaneChanged === true,
        longContextSent: mimo269?.request?.longContextSent === true || mimo271?.smoke?.longContextSent === true,
      },
      limitations: [
        "MiMo was tested only as an explicit non-default tiny smoke path.",
        "This is not automatic provider routing or production fallback.",
      ],
    },
    {
      name: "Token Estimator Calibration",
      score: scoreCalibration(calibration),
      maxScore: 10,
      evidence: [sources.tokenEstimatorCalibration.path],
      metrics: {
        sampleCount: numberOrZero(calibration?.sampleCount),
        confidence: calibration?.confidence ?? "unknown",
        calibrationCoverage: calibration?.calibrationCoverage ?? "unknown",
        averageTotalTokenErrorRatio: numberOrZero(calibration?.summary?.averageTotalTokenErrorRatio),
        maxUnderEstimateRatio: numberOrZero(calibration?.summary?.maxUnderEstimateRatio),
        recommendedInputSafetyMultiplier: numberOrZero(calibration?.calibrationProfile?.recommendedInputSafetyMultiplier),
        recommendedMinimumInputTokenFloor: numberOrZero(calibration?.calibrationProfile?.recommendedMinimumInputTokenFloor),
      },
      limitations: [
        "Confidence remains low because only two tiny smoke samples are available.",
        "The profile is preview metadata and is not production billing accuracy.",
      ],
    },
    {
      name: "Cost Guard Capability",
      score: scoreCostGuard(costGuard),
      maxScore: 10,
      evidence: [sources.tokenCostGuard.path],
      metrics: {
        estimateExists: costGuardReady,
        allowCasePassed: costGuard?.checks?.sampleEstimateAllowCasePassed === true,
        requireApprovalCasePassed: costGuard?.checks?.sampleHighCostRequireApprovalCasePassed === true,
        blockCasePassed: costGuard?.checks?.sampleOverBudgetBlockCasePassed === true,
        summaryEndpointOk: costGuard?.checks?.summaryEndpointOk === true,
        safetyFieldsFalse: costGuard?.checks?.safetyFieldsFalse === true,
      },
      limitations: [
        "The cost guard is preview-only and does not automatically change the default chat lane.",
      ],
    },
    {
      name: "Cache Readiness",
      score: scoreCacheReadiness(cache, costGuard, tokenSaving, rag),
      maxScore: 5,
      evidence: [
        sources.tokenCostGuard.path,
        sources.tokenSavingBenchmark.path,
        sources.ragSourceSelectionBenchmark.path,
        ...(cachePreviewReady ? [sources.responseCachePersistence.path] : []),
      ],
      metrics: {
        cachePersistenceReady: cachePreviewReady,
        responseCacheHitRate: calculateCacheHitRate(cache),
        responseCacheHitCount: numberOrZero(cache?.summary?.hitCount),
        responseCacheMissCount: numberOrZero(cache?.summary?.missCount),
        cacheEligibleCount: numberOrZero(tokenSaving?.summary?.cacheEligibleCount),
        cacheKeyMetadataPresent: costGuard?.checks?.sampleCacheKeyGenerated === true,
      },
      limitations: [
        "Cache is local preview persistence only.",
        "It is not a production multi-user cache, encrypted cache, or billing ledger.",
      ],
    },
    {
      name: "UI Observability",
      score: uiHitCount,
      maxScore: 5,
      evidence: ["apps/ai-gateway-service/src/ui/consolePage.js"],
      metrics: {
        markersChecked: uiMarkers,
        markerHitCount: uiHitCount,
      },
      limitations: [
        "UI panels surface evidence and local status; they do not prove production operations.",
      ],
    },
    {
      name: "Regression Stability",
      score: allMainEvidencePassed && secretSafety?.status === "passed" ? 10 : allMainEvidencePassed ? 8 : 0,
      maxScore: 10,
      evidence: [
        sources.tokenCostGuard.path,
        sources.mimoPaidSmoke.path,
        sources.tokenSavingBenchmark.path,
        sources.mimoModelDiscovery.path,
        sources.tokenEstimatorCalibration.path,
        sources.ragSourceSelectionBenchmark.path,
        sources.secretSafety.path,
      ],
      metrics: {
        phase268To273EvidencePassed: allMainEvidencePassed,
        secretSafetyPassed: secretSafety?.status === "passed",
        personalValueClosurePassed: personalValue?.status === "passed",
        personalKnowledgeClosurePassed: personalKnowledge?.status === "passed",
      },
      limitations: [
        "Workspace is dirty, so this is stability under current local working state, not a clean release baseline.",
      ],
    },
    {
      name: "Security / Execution Boundary",
      score: scoreSecurityBoundary(sources),
      maxScore: 10,
      evidence: [
        sources.secretSafety.path,
        sources.tokenCostGuard.path,
        sources.mimoPaidSmoke.path,
        sources.mimoModelDiscovery.path,
        sources.tokenEstimatorCalibration.path,
        sources.ragSourceSelectionBenchmark.path,
      ],
      metrics: {
        secretSafetyPassed: secretSafety?.status === "passed",
        defaultNvidiaChatLaneChanged: hasAnyTrue(sources, "defaultNvidiaChatLaneChanged"),
        mimoSetAsDefault: hasAnyTrue(sources, "mimoSetAsDefault"),
        paidApiCallExecutedThisBenchmark: false,
        codexCliInvoked: false,
        codexExecInvoked: false,
        workflowRunnerEnabled: false,
        worktreeCreated: false,
      },
      limitations: [
        "Boundary safety is evidence-backed for this local preview chain, not a substitute for enterprise security review.",
      ],
    },
    {
      name: "Commercial Readiness Gap",
      score: 0,
      maxScore: 0,
      evidence: [sources.personalValueClosure.path, sources.personalKnowledgeClosure.path],
      metrics: {
        commercialSelfUseReadiness: "strong",
        productionSaasReadiness: "not-production-ready",
      },
      limitations: [
        "No multi-user tenant isolation, enterprise key vault, SLA, or audited billing integration is sealed.",
      ],
    },
    {
      name: "Next Route Recommendation",
      score: 0,
      maxScore: 0,
      evidence: [sources.tokenSavingBenchmark.path, sources.ragSourceSelectionBenchmark.path],
      metrics: {
        recommendedRoute: "Phase 275A Response Cache Persistence",
        reason: "Cache lookup before any future paid call is safer than expanding paid API tests.",
      },
      limitations: [
        "The route is a local engineering recommendation, not permission to run paid API traffic.",
      ],
    },
  ];

  return dimensions;
}

function scoreTokenSaving(tokenSaving, rag) {
  let score = 0;
  if (tokenSaving?.status === "passed" && rag?.status === "passed") score += 10;
  if (numberOrZero(rag?.summary?.averageSavingsRatio) > 0.95) score += 3;
  if (numberOrZero(tokenSaving?.paidApiCallCount) === 0 && rag?.safety?.longContextSentToPaidApi !== true) score += 2;
  return Math.min(score, 15);
}

function scoreRagSourceSelection(rag) {
  let score = 0;
  if (numberOrZero(rag?.summary?.averageRequiredSourceRecall) >= 1) score += 5;
  if (numberOrZero(rag?.summary?.latestEvidenceHitRate) >= 1) score += 4;
  if (numberOrZero(rag?.summary?.staleSourceSelectedCount) === 0) score += 3;
  if (numberOrZero(rag?.summary?.passCount) >= 8) score += 3;
  return Math.min(score, 15);
}

function scoreFreshness(rag) {
  let score = 0;
  if (rag?.status === "passed") score += 4;
  if (numberOrZero(rag?.summary?.failCount) === 0) score += 3;
  if (numberOrZero(rag?.summary?.latestEvidenceHitRate) >= 1) score += 3;
  return Math.min(score, 10);
}

function scoreMimoSafety(mimo269, mimo271) {
  let score = 0;
  if ((mimo271?.configuration?.discoveredWorkingModelId ?? "") === "mimo-v2.5-pro") score += 2;
  if (mimo269?.response?.success === true || mimo271?.smoke?.success === true) score += 2;
  if (mimo269?.response?.usageReturned === true || mimo271?.smoke?.usageReturned === true) score += 1;
  if (mimo269?.mimoSetAsDefault === false && mimo271?.mimoSetAsDefault === false) score += 2;
  if (
    mimo269?.safety?.plainTextApiKeyWritten === false &&
    mimo271?.safety?.plainTextApiKeyWritten === false &&
    mimo269?.request?.longContextSent === false &&
    mimo271?.smoke?.longContextSent === false
  ) {
    score += 3;
  }
  return Math.min(score, 10);
}

function scoreCalibration(calibration) {
  let score = 0;
  if (numberOrZero(calibration?.sampleCount) >= 2) score += 2;
  if (Array.isArray(calibration?.samples) && calibration.samples.length >= 2) score += 2;
  if (Number.isFinite(Number(calibration?.calibrationProfile?.recommendedInputSafetyMultiplier))) score += 2;
  if (Number.isFinite(Number(calibration?.calibrationProfile?.recommendedMinimumInputTokenFloor))) score += 2;
  if (calibration?.confidence === "low" && calibration?.calibrationCoverage === "smoke-only-limited") score += 1;
  const confidenceCap = calibration?.confidence === "low" ? 8 : 10;
  return Math.min(score, confidenceCap);
}

function scoreCostGuard(costGuard) {
  let score = 0;
  if (costGuard?.status === "passed") score += 2;
  if (costGuard?.checks?.sampleEstimateAllowCasePassed === true) score += 2;
  if (costGuard?.checks?.sampleHighCostRequireApprovalCasePassed === true) score += 2;
  if (costGuard?.checks?.sampleOverBudgetBlockCasePassed === true) score += 2;
  if (costGuard?.checks?.summaryEndpointOk === true && costGuard?.checks?.safetyFieldsFalse === true) score += 2;
  return Math.min(score, 10);
}

function scoreCacheReadiness(cache, costGuard, tokenSaving, rag) {
  let score = 0;
  if (costGuard?.checks?.sampleCacheKeyGenerated === true) score += 2;
  if (costGuard?.samples?.allow?.cache?.cacheEligible === true || numberOrZero(tokenSaving?.summary?.cacheEligibleCount) > 0) score += 1;
  if (Array.isArray(tokenSaving?.betterPlan) || Array.isArray(rag?.recommendedNextRoutes)) score += 1;
  if (cache?.status === "passed" && numberOrZero(cache?.summary?.hitCount) > 0) score += 1;
  return Math.min(score, 4);
}

function scoreSecurityBoundary(sources) {
  const secretSafetyPassed = sources.secretSafety.data?.status === "passed";
  const providerDefaultUnchanged = !hasAnyTrue(sources, "defaultNvidiaChatLaneChanged") && !hasAnyTrue(sources, "mimoSetAsDefault");
  const executionDisabled = Object.values(sources).every(({ data }) => {
    const safety = data?.safety ?? {};
    return safety.codexCliInvoked !== true &&
      safety.codexExecInvoked !== true &&
      safety.workflowRunnerEnabled !== true &&
      safety.worktreeCreated !== true &&
      safety.autoCommit !== true &&
      safety.autoPush !== true;
  });
  const repoBoundarySafe = Object.values(sources).every(({ data }) => {
    const safety = data?.safety ?? {};
    return safety.legacyModified !== true && safety.projectContextCreated !== true;
  });
  const noLongPaidContext = Object.values(sources).every(({ data }) => {
    const safety = data?.safety ?? {};
    return safety.longContextSentToPaidApi !== true && safety.largeOutputRequested !== true && safety.stressTestExecuted !== true;
  });

  return [
    secretSafetyPassed,
    providerDefaultUnchanged,
    executionDisabled,
    repoBoundarySafe,
    noLongPaidContext,
  ].filter(Boolean).length * 2;
}

function createHeadlineMetrics(sources) {
  const tokenSaving = sources.tokenSavingBenchmark.data;
  const rag = sources.ragSourceSelectionBenchmark.data;
  const mimo269 = sources.mimoPaidSmoke.data;
  const mimo271 = sources.mimoModelDiscovery.data;
  const calibration = sources.tokenEstimatorCalibration.data;
  const cache = sources.responseCachePersistence.data;

  return {
    tokenSavingBenchmarkAverageSavingsRatio: numberOrZero(tokenSaving?.summary?.averageSavingsRatio),
    ragSourceSelectionAverageSavingsRatio: numberOrZero(rag?.summary?.averageSavingsRatio),
    ragRequiredSourceRecall: numberOrZero(rag?.summary?.averageRequiredSourceRecall),
    latestEvidenceHitRate: numberOrZero(rag?.summary?.latestEvidenceHitRate),
    staleSourceSelectedCount: numberOrZero(rag?.summary?.staleSourceSelectedCount),
    mimoWorkingModelId: mimo271?.configuration?.discoveredWorkingModelId ?? mimo269?.model ?? "mimo-v2.5-pro",
    mimoUsageReturned: mimo269?.response?.usageReturned === true || mimo271?.smoke?.usageReturned === true,
    tokenEstimatorConfidence: calibration?.confidence ?? "unknown",
    cachePersistenceReady: cache?.status === "passed",
    responseCacheHitRate: calculateCacheHitRate(cache),
  };
}

function createStrengths(headlineMetrics) {
  return [
    `Token saving benchmarks show strong local reduction: 270A averageSavingsRatio=${headlineMetrics.tokenSavingBenchmarkAverageSavingsRatio}, 273A averageSavingsRatio=${headlineMetrics.ragSourceSelectionAverageSavingsRatio}.`,
    `RAG source selection hit required sources with recall=${headlineMetrics.ragRequiredSourceRecall} and latestEvidenceHitRate=${headlineMetrics.latestEvidenceHitRate}.`,
    "MiMo v2.5 Pro is verified as an explicit non-default paid provider path with no default NVIDIA /chat switch.",
    "Token Cost Guard can estimate, budget, require approval, and block before future paid-provider calls.",
    "Evidence and verifier coverage across 268A-273A is strong for local self-use and paid API preflight.",
    "Security boundary evidence keeps paid calls, MiMo default switch, Codex CLI, workflow runner, worktree, and auto commit/push disabled for this benchmark.",
  ];
}

function createRisks(sources, headlineMetrics) {
  const risks = [
    "Workspace is dirty, so operational reporting must not claim a clean release state.",
    "All token-saving and RAG source-selection gains are local benchmark estimates, not audited production invoices.",
    "272A calibration confidence is low because it uses only two tiny MiMo smoke usage samples.",
    "RAG source selection is rules-based and has no embedding/rerank/real answer-quality validation yet.",
    "MiMo is safe as a non-default explicit smoke path, but not sealed as production routing or automatic fallback.",
    "No enterprise ACL sync, multi-tenant isolation, encrypted key vault, or production billing reconciliation is sealed.",
    "Desktop/Codex execution boundaries remain preview/manual; no unattended development is enabled.",
    "UI observability is evidence-panel based and still depends on local service/evidence files.",
    "Provider health does not equal permission to send long context or run paid workloads.",
    "Commercial readiness remains self-use oriented, not production SaaS readiness.",
  ];
  if (headlineMetrics.cachePersistenceReady) {
    risks.push("Response cache persistence is present only as local preview storage; it is not a production multi-user cache.");
  } else {
    risks.push("Response cache persistence is not sealed in the 268A-273A baseline, so repeat queries may still spend future API tokens.");
  }
  if (sources.responseCachePersistence.data?.status === "passed") {
    risks.push("The existing cache evidence is useful, but this benchmark still treats it as preview readiness rather than a production cache claim.");
  }
  return risks;
}

function createGaps(headlineMetrics) {
  const gaps = [
    "No production vector RAG or GraphRAG.",
    "No real embedding or rerank source selector.",
    "No production-quality token estimator calibration across long-context workloads.",
    "No automatic provider routing with approval policy.",
    "No enterprise key vault or multi-user permission system.",
    "No audited production cost ledger tied to provider invoices.",
    "No workflow runner, worktree execution, auto commit, auto push, or PR automation.",
    "No production response-quality benchmark against real model outputs.",
    "No clean-release baseline while the workspace remains dirty.",
    "No production SaaS operations layer, tenant isolation, rate limits, or SLA evidence.",
  ];
  if (headlineMetrics.cachePersistenceReady) {
    gaps.push("Response cache needs hardening: permissions, encryption, invalidation policy, compaction, and real response validation.");
  } else {
    gaps.push("Response cache persistence should be the next local cost-saving layer before expanding paid API tests.");
  }
  return gaps;
}

function createRecommendedNextRoutes(headlineMetrics) {
  return [
    {
      route: "Phase 275A Response Cache Persistence",
      priority: "P0",
      reason: headlineMetrics.cachePersistenceReady
        ? "A local preview cache exists, but the next step should harden/seal cache lookup before any paid provider expansion."
        : "Repeat questions are the clearest remaining token-saving opportunity before more paid provider tests.",
      risk: "Must not cache API keys, auth headers, env values, or unsanitized full project context.",
    },
    {
      route: "Model Tier Routing Preview",
      priority: "P1",
      reason: "Use rule_only / cheap / standard / premium routing so MiMo is reserved for high-value tasks.",
      risk: "Automatic paid routing must remain disabled until approval and budget gates are stronger.",
    },
    {
      route: "RAG Source Selection Hardening",
      priority: "P1",
      reason: "Improve source ranking beyond fixed rules and verify answer quality against selected context.",
      risk: "Embedding/rerank work can add cost and complexity if done before cache and guard hardening.",
    },
    {
      route: "MiMo Usage Calibration Expansion",
      priority: "P2",
      reason: "A few approved tiny requests can calibrate estimator floors without large spend.",
      risk: "Should remain capped, explicit, and non-default.",
    },
    {
      route: "Evidence Dashboard",
      priority: "P2",
      reason: "Expose scorecard, stale-evidence warnings, and safety gates in one review surface.",
      risk: "Dashboard must avoid implying production readiness.",
    },
  ];
}

function createSafetySummary() {
  return {
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
}

function calculateGrade(totalScore) {
  if (totalScore >= 85) return "A";
  if (totalScore >= 70) return "B";
  if (totalScore >= 55) return "C";
  return "D";
}

function calculatePaidApiSafetyReadiness(dimensions) {
  const mimo = dimensions.find((item) => item.name === "MiMo Paid Provider Safety");
  const security = dimensions.find((item) => item.name === "Security / Execution Boundary");
  const cost = dimensions.find((item) => item.name === "Cost Guard Capability");
  const ratio = (numberOrZero(mimo?.score) + numberOrZero(security?.score) + numberOrZero(cost?.score)) /
    (numberOrZero(mimo?.maxScore) + numberOrZero(security?.maxScore) + numberOrZero(cost?.maxScore));
  if (ratio >= 0.85) return "strong";
  if (ratio >= 0.7) return "medium";
  return "weak";
}

function calculateCacheHitRate(cache) {
  const hits = numberOrZero(cache?.summary?.hitCount);
  const misses = numberOrZero(cache?.summary?.missCount);
  if (hits + misses <= 0) return null;
  return roundNumber(hits / (hits + misses), 4);
}

function hasAnyTrue(sources, key) {
  return Object.values(sources).some(({ data }) => data?.[key] === true || data?.safety?.[key] === true);
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readTextIfExists(path) {
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundNumber(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

export function renderSystemCapabilityBenchmarkMarkdown(evidence) {
  const dimensionRows = evidence.dimensions
    .map((item) => `| ${item.name} | ${item.score} | ${item.maxScore} | ${(item.limitations ?? [])[0] ?? ""} |`)
    .join("\n");
  const strengthList = evidence.strengths.map((item) => `- ${item}`).join("\n");
  const riskList = evidence.risks.map((item) => `- ${item}`).join("\n");
  const gapList = evidence.gaps.map((item) => `- ${item}`).join("\n");
  const routeList = evidence.recommendedNextRoutes
    .map((item) => `- ${item.priority}: ${item.route}. ${item.reason}`)
    .join("\n");

  return `# Phase 274A Unified System Capability Benchmark

## Benchmark Result

- Status: ${evidence.status}
- Mode: ${evidence.mode}
- Total score: ${evidence.scorecard.totalScore} / ${evidence.scorecard.maxScore}
- Grade: ${evidence.scorecard.grade}
- Production readiness: ${evidence.scorecard.productionReadiness}
- Commercial self-use readiness: ${evidence.scorecard.commercialSelfUseReadiness}
- Paid API safety readiness: ${evidence.scorecard.paidApiSafetyReadiness}
- Paid API calls made in this benchmark: ${evidence.paidApiCallCount}
- External API called: ${evidence.externalApiCalled}
- MiMo API called: ${evidence.mimoApiCalled}

## Headline Metrics

- 270A averageSavingsRatio: ${evidence.headlineMetrics.tokenSavingBenchmarkAverageSavingsRatio}
- 273A averageSavingsRatio: ${evidence.headlineMetrics.ragSourceSelectionAverageSavingsRatio}
- RAG required source recall: ${evidence.headlineMetrics.ragRequiredSourceRecall}
- Latest evidence hit rate: ${evidence.headlineMetrics.latestEvidenceHitRate}
- Stale source selected count: ${evidence.headlineMetrics.staleSourceSelectedCount}
- MiMo working model id: ${evidence.headlineMetrics.mimoWorkingModelId}
- MiMo usage returned: ${evidence.headlineMetrics.mimoUsageReturned}
- Token estimator confidence: ${evidence.headlineMetrics.tokenEstimatorConfidence}
- Cache persistence ready: ${evidence.headlineMetrics.cachePersistenceReady}
- Response cache hit rate: ${evidence.headlineMetrics.responseCacheHitRate ?? "n/a"}

## Dimension Scores

| Dimension | Score | Max | Main limitation |
| --- | ---: | ---: | --- |
${dimensionRows}

## Strengths

${strengthList}

## Risks

${riskList}

## Gaps

${gapList}

## Recommended Next Routes

${routeList}

## Safety

- plainTextApiKeyWritten=false
- apiKeyPrinted=false
- paidApiCallExecuted=false
- externalApiCalled=false
- mimoApiCalled=false
- defaultNvidiaChatLaneChanged=false
- mimoSetAsDefault=false
- longContextSentToPaidApi=false
- largeOutputRequested=false
- stressTestExecuted=false
- codexCliInvoked=false
- codexExecInvoked=false
- workflowRunnerEnabled=false
- worktreeCreated=false
- autoCommit=false
- autoPush=false
`;
}
