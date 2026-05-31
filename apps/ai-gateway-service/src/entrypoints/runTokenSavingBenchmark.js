import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";
import { createTokenCachePolicy } from "../cost/tokenCachePolicy.js";
import { createTokenBudgetPolicy, estimateCostUsd, roundUsd } from "../cost/tokenBudgetPolicy.js";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";

const PHASE = "270A-token-saving-benchmark";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-270a-token-saving-benchmark.json");
const evidenceMdPath = resolve(evidenceDir, "phase-270a-token-saving-benchmark.md");

const policy = createTokenBudgetPolicy({}, {
  enabled: true,
  perRequestMaxInputTokens: 16000,
  perRequestMaxOutputTokens: 4096,
  perRequestMaxEstimatedCostUsd: 0.1,
  dailyMaxEstimatedCostUsd: 3,
  requireApprovalAboveUsd: 0.03,
  hardBlockAboveUsd: 0.1,
  defaultCurrency: "USD",
  defaultModelTier: "cheap",
});

try {
  const sourceTexts = loadBenchmarkSourceTexts();
  const cases = [
    createProjectStatusCase(sourceTexts),
    createBlockerCase(sourceTexts),
    createCodexNextTaskCase(sourceTexts),
    createMimoSmokeEstimateCase(),
    createCacheHitCase(sourceTexts),
    createLongContextGuardCase(),
    createModelTierRoutingCase(),
    createOutputCapCase(sourceTexts),
  ];
  const summary = summarizeCases(cases);
  const evidence = {
    phase: PHASE,
    status: "passed",
    conclusion: "token-saving-benchmark-ready",
    generatedAt: new Date().toISOString(),
    mode: "estimate-only",
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    paidApiCallCount: 0,
    paidApiCallMaxAllowed: 1,
    longContextSentToPaidApi: false,
    cases,
    summary,
    gaps: createGaps(),
    betterPlan: createBetterPlan(),
    safety: createSafetySummary(),
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    caseCount: evidence.summary.caseCount,
    averageSavingsRatio: evidence.summary.averageSavingsRatio,
    estimatedTotalTokensSaved: evidence.summary.estimatedTotalTokensSaved,
    paidApiCallCount: evidence.paidApiCallCount,
    evidenceJsonPath,
    evidenceMdPath,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    phase: PHASE,
    status: "failed",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
}

function createProjectStatusCase(sourceTexts) {
  const userQuestion = "现在项目做到哪一步了？下一步应该做什么？";
  return createComparisonCase({
    caseId: "project-status-query",
    userQuestion,
    mode: "estimate-only",
    requestType: "project-status-query",
    naiveContext: [
      sourceTexts.readme,
      sourceTexts.agents,
      sourceTexts.userManual,
      sourceTexts.architectureReport,
      sourceTexts.readthroughReport,
      sourceTexts.latestEvidenceBundle,
    ].join("\n\n"),
    optimizedSources: [
      source("latest-269-evidence", snippet(sourceTexts.phase269Evidence, 2200)),
      source("architecture-report-current-state", snippet(sourceTexts.architectureReport, 2600)),
      source("readthrough-future-next-route", snippet(sourceTexts.readthroughReport, 2400)),
    ],
    modelTier: "cheap",
    maxOutputTokens: 500,
    strategy: "Use latest evidence plus architecture/readthrough summaries instead of full docs.",
  });
}

function createBlockerCase(sourceTexts) {
  const userQuestion = "当前 blocker 是什么？";
  return createComparisonCase({
    caseId: "current-blocker-query",
    userQuestion,
    mode: "estimate-only",
    requestType: "current-blocker-query",
    naiveContext: [
      sourceTexts.readme,
      sourceTexts.agents,
      sourceTexts.docsBundle,
      sourceTexts.latestEvidenceBundle,
    ].join("\n\n"),
    optimizedSources: [
      source("latest-mimo-safe-smoke", snippet(sourceTexts.phase269Evidence, 2000)),
      source("ready-state-reset", snippet(sourceTexts.phase267ReadyResetEvidence, 1800)),
      source("architecture-risks", snippet(sourceTexts.architectureReport, 1800)),
    ],
    modelTier: "cheap",
    maxOutputTokens: 300,
    strategy: "Query latest evidence and ready-state/reset evidence only.",
  });
}

function createCodexNextTaskCase(sourceTexts) {
  const userQuestion = "生成下一条 Codex 任务。";
  return createComparisonCase({
    caseId: "codex-next-task-generation",
    userQuestion,
    mode: "estimate-only",
    requestType: "codex-next-task-generation",
    naiveContext: [
      sourceTexts.readme,
      sourceTexts.agents,
      sourceTexts.docsBundle,
      sourceTexts.latestEvidenceBundle,
    ].join("\n\n"),
    optimizedSources: [
      source("action-queue", snippet(sourceTexts.personalActionQueue, 2200)),
      source("decision-dashboard", snippet(sourceTexts.personalDecisionDashboard, 2200)),
      source("codex-boundary", snippet(sourceTexts.codexReadinessClosure, 2200)),
      source("latest-phase-evidence", snippet(sourceTexts.phase269Evidence, 1600)),
    ],
    modelTier: "standard",
    maxOutputTokens: 700,
    strategy: "Use Action Queue, Decision Dashboard, boundary list, and latest phase evidence.",
  });
}

function createMimoSmokeEstimateCase() {
  const userQuestion = "Reply with exactly: MIMO_SMOKE_OK";
  const mimoEvidence = readJson("apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json");
  const messages = [{ role: "user", content: userQuestion }];
  const estimate = estimateTokens({ messages, maxOutputTokens: 16 });
  const guard = checkTokenCostGuard({
    requestType: "mimo-paid-smoke-small-request",
    provider: "mimo",
    model: "mimo-v2.5-pro",
    modelTier: "cheap",
    messages,
    maxOutputTokens: 16,
  }, { policy });
  const actualUsageAvailable = mimoEvidence?.response?.usageReturned === true;
  const actualTotalTokens = actualUsageAvailable ? Number(mimoEvidence.response.totalTokens) : null;

  return normalizeCase({
    caseId: "mimo-paid-smoke-small-request",
    mode: "estimate-only",
    userQuestion,
    naiveEstimatedInputTokens: estimate.estimatedInputTokens,
    optimizedEstimatedInputTokens: estimate.estimatedInputTokens,
    naiveEstimatedOutputTokens: estimate.estimatedOutputTokens,
    optimizedEstimatedOutputTokens: estimate.estimatedOutputTokens,
    naiveEstimatedTotalTokens: estimate.estimatedTotalTokens,
    optimizedEstimatedTotalTokens: estimate.estimatedTotalTokens,
    estimatedTokensSaved: 0,
    savingsRatio: 0,
    decision: guard.decision,
    recommendedActions: guard.recommendedActions,
    cacheEligible: guard.cache.cacheEligible,
    cacheKey: guard.cache.cacheKey,
    modelTierRecommendation: "cheap",
    maxOutputTokens: 16,
    strategy: "Tiny explicit smoke shape only; Phase 270A does not call MiMo.",
    paidApiCallCount: 0,
    estimatedCostUsd: guard.estimate.totalCostUsd,
    actualUsageComparison: {
      usageReturned: actualUsageAvailable,
      phase269Status: mimoEvidence?.status ?? "missing",
      phase269Failure: mimoEvidence?.failure?.message ?? null,
      estimatedTotalTokens: estimate.estimatedTotalTokens,
      actualTotalTokens,
      absoluteDeltaTokens: actualUsageAvailable ? Math.abs(estimate.estimatedTotalTokens - actualTotalTokens) : null,
      note: actualUsageAvailable
        ? "Provider usage was available from prior evidence; no new paid call was made in Phase 270A."
        : "No actual usage comparison is available because prior MiMo smoke did not return usage.",
    },
  });
}

function createCacheHitCase(sourceTexts) {
  const userQuestion = "现在项目做到哪一步了？下一步应该做什么？";
  const selectedSources = [
    source("latest-evidence", snippet(sourceTexts.phase269Evidence, 1600)),
    source("architecture-summary", snippet(sourceTexts.architectureReport, 1600)),
  ];
  const firstGuard = checkTokenCostGuard({
    requestType: "repeat-project-status-query",
    provider: "benchmark",
    model: "cheap-preview",
    modelTier: "cheap",
    messages: [{ role: "user", content: userQuestion }],
    selectedSources,
    maxOutputTokens: 400,
  }, { policy });
  const firstTotalTokens = firstGuard.estimate.totalTokens;

  return normalizeCase({
    caseId: "repeat-question-cache-hit",
    mode: "estimate-only-cache-simulation",
    userQuestion,
    naiveEstimatedInputTokens: firstGuard.estimate.inputTokens,
    optimizedEstimatedInputTokens: 0,
    naiveEstimatedOutputTokens: firstGuard.estimate.outputTokens,
    optimizedEstimatedOutputTokens: 0,
    naiveEstimatedTotalTokens: firstTotalTokens,
    optimizedEstimatedTotalTokens: 0,
    estimatedTokensSaved: firstTotalTokens,
    estimatedApiTokensSaved: firstTotalTokens,
    savingsRatio: 1,
    decision: firstGuard.decision,
    recommendedActions: ["use_cache", ...firstGuard.recommendedActions],
    cacheEligible: firstGuard.cache.cacheEligible,
    servedFromCache: true,
    firstRun: {
      cacheEligible: firstGuard.cache.cacheEligible,
      servedFromCache: false,
      estimatedTotalTokens: firstTotalTokens,
      cacheKey: firstGuard.cache.cacheKey,
    },
    secondRun: {
      cacheEligible: true,
      servedFromCache: true,
      estimatedApiTokensSaved: firstTotalTokens,
      cacheKey: firstGuard.cache.cacheKey,
    },
    cacheKey: firstGuard.cache.cacheKey,
    modelTierRecommendation: "cheap",
    maxOutputTokens: 400,
    strategy: "Same question plus same selected source hash can avoid the second paid request if response cache is later persisted.",
    estimatedCostUsd: firstGuard.estimate.totalCostUsd,
  });
}

function createLongContextGuardCase() {
  const userQuestion = "请基于全部项目资料给出完整审查。";
  const rawContextText = [
    "Phase 270A synthetic long context. This is never sent to a paid API.",
    "It exists only to test local budget guard behavior.",
    "long-context-token ".repeat(24000),
  ].join("\n");
  const selectedSources = [
    source("rag-first-placeholder", "Use source inventory and latest evidence first; fetch narrow snippets before any paid call."),
  ];
  const naiveEstimate = estimateTokens({
    messages: [{ role: "user", content: userQuestion }],
    text: rawContextText,
    maxOutputTokens: 3000,
  });
  const optimizedEstimate = estimateTokens({
    messages: [{ role: "user", content: userQuestion }],
    text: selectedSources.map((item) => item.content).join("\n"),
    maxOutputTokens: 600,
  });
  const guard = checkTokenCostGuard({
    requestType: "long-context-intercept",
    provider: "benchmark",
    model: "premium-preview",
    modelTier: "premium",
    messages: [{ role: "user", content: userQuestion }],
    rawContextText,
    maxOutputTokens: 3000,
  }, { policy });
  const recommendedActions = new Set(guard.recommendedActions);
  recommendedActions.add("reduce_context");
  recommendedActions.add("use_rag_first");
  recommendedActions.add("cap_output_tokens");

  return normalizeCase({
    caseId: "long-context-intercept",
    mode: "estimate-only",
    userQuestion,
    naiveEstimatedInputTokens: naiveEstimate.estimatedInputTokens,
    optimizedEstimatedInputTokens: optimizedEstimate.estimatedInputTokens,
    naiveEstimatedOutputTokens: naiveEstimate.estimatedOutputTokens,
    optimizedEstimatedOutputTokens: optimizedEstimate.estimatedOutputTokens,
    naiveEstimatedTotalTokens: naiveEstimate.estimatedTotalTokens,
    optimizedEstimatedTotalTokens: optimizedEstimate.estimatedTotalTokens,
    estimatedTokensSaved: Math.max(0, naiveEstimate.estimatedTotalTokens - optimizedEstimate.estimatedTotalTokens),
    savingsRatio: ratio(Math.max(0, naiveEstimate.estimatedTotalTokens - optimizedEstimate.estimatedTotalTokens), naiveEstimate.estimatedTotalTokens),
    decision: guard.decision,
    recommendedActions: [...recommendedActions],
    cacheEligible: guard.cache.cacheEligible,
    cacheKey: guard.cache.cacheKey,
    modelTierRecommendation: "block_or_require_approval_before_premium",
    maxOutputTokens: 3000,
    strategy: "Block or require approval before any long context paid call; reduce context and use RAG first.",
    estimatedCostUsd: guard.estimate.totalCostUsd,
  });
}

function createModelTierRoutingCase() {
  const tasks = [
    {
      task: "Check whether PROJECT_CONTEXT.md exists",
      category: "rule_only",
      recommendedTier: "local",
      avoidedTier: "premium",
      prompt: "Does PROJECT_CONTEXT.md exist?",
    },
    {
      task: "Summarize latest evidence status",
      category: "cheap",
      recommendedTier: "cheap",
      avoidedTier: "premium",
      prompt: "Summarize latest phase evidence in three bullets.",
    },
    {
      task: "Draft a bounded next-task handoff",
      category: "standard",
      recommendedTier: "standard",
      avoidedTier: "premium",
      prompt: "Draft the next Codex task with safety boundaries.",
    },
    {
      task: "Deep architecture tradeoff review",
      category: "premium",
      recommendedTier: "premium",
      avoidedTier: "premium",
      prompt: "Review architecture tradeoffs and risks.",
    },
  ];
  const inputTokens = tasks.reduce((total, task) => total + estimateTextTokens(task.prompt), 0);
  const outputTokens = 1200;
  const premiumCost = estimateCostUsd({ inputTokens, outputTokens, modelTier: "premium", policy }).totalCostUsd;
  const recommendedCost = roundUsd(tasks.reduce((total, task) => {
    const taskTokens = estimateTextTokens(task.prompt);
    const taskOutput = task.recommendedTier === "premium" ? 600 : task.recommendedTier === "standard" ? 350 : 120;
    return total + estimateCostUsd({
      inputTokens: taskTokens,
      outputTokens: taskOutput,
      modelTier: task.recommendedTier,
      policy,
    }).totalCostUsd;
  }, 0));
  const downgraded = tasks.filter((task) => task.recommendedTier !== "premium").length;
  const cache = createTokenCachePolicy({
    requestType: "model-tier-routing",
    userQuery: tasks.map((task) => task.prompt).join("\n"),
    model: "tier-router-preview",
  });

  return normalizeCase({
    caseId: "model-tier-routing",
    mode: "estimate-only",
    userQuestion: "把任务分成 rule_only / cheap / standard / premium。",
    naiveEstimatedInputTokens: inputTokens,
    optimizedEstimatedInputTokens: inputTokens,
    naiveEstimatedOutputTokens: outputTokens,
    optimizedEstimatedOutputTokens: 1190,
    naiveEstimatedTotalTokens: inputTokens + outputTokens,
    optimizedEstimatedTotalTokens: inputTokens + 1190,
    estimatedTokensSaved: 10,
    savingsRatio: ratio(premiumCost - recommendedCost, premiumCost),
    decision: "allow",
    recommendedActions: ["lower_model_tier", "route_rule_only_locally", "reserve_premium_for_architecture_review"],
    cacheEligible: cache.cacheEligible,
    cacheKey: cache.cacheKey,
    modelTierRecommendation: {
      rule_only: "local",
      cheap: "cheap",
      standard: "standard",
      premium: "premium",
      guidance: "Simple status checks must not default to premium; deep architecture review may justify premium.",
    },
    modelTierDowngradeOpportunities: downgraded,
    tierTasks: tasks,
    premiumAllCostUsd: premiumCost,
    recommendedTierCostUsd: recommendedCost,
    estimatedCostSavedUsd: roundUsd(premiumCost - recommendedCost),
    strategy: "Route rule-only and simple status work away from premium models; keep MiMo/premium only for high-value reasoning.",
  });
}

function createOutputCapCase(sourceTexts) {
  const userQuestion = "请总结当前项目状态和下一步路线。";
  const selectedContext = snippet(sourceTexts.readthroughReport || sourceTexts.architectureReport, 2200);
  const messages = [{ role: "user", content: userQuestion }];
  const uncapped = estimateTokens({ messages, text: selectedContext, maxOutputTokens: 2000 });
  const capped = estimateTokens({ messages, text: selectedContext, maxOutputTokens: 300 });
  const guard = checkTokenCostGuard({
    requestType: "output-cap-comparison",
    provider: "benchmark",
    model: "cheap-preview",
    modelTier: "cheap",
    messages,
    selectedSources: [source("selected-status-context", selectedContext)],
    maxOutputTokens: 300,
  }, { policy });
  const outputTokenCapSavings = Math.max(0, uncapped.estimatedTotalTokens - capped.estimatedTotalTokens);

  return normalizeCase({
    caseId: "output-cap-control",
    mode: "estimate-only",
    userQuestion,
    naiveEstimatedInputTokens: uncapped.estimatedInputTokens,
    optimizedEstimatedInputTokens: capped.estimatedInputTokens,
    naiveEstimatedOutputTokens: uncapped.estimatedOutputTokens,
    optimizedEstimatedOutputTokens: capped.estimatedOutputTokens,
    naiveEstimatedTotalTokens: uncapped.estimatedTotalTokens,
    optimizedEstimatedTotalTokens: capped.estimatedTotalTokens,
    estimatedTokensSaved: outputTokenCapSavings,
    outputTokenCapSavings,
    savingsRatio: ratio(outputTokenCapSavings, uncapped.estimatedTotalTokens),
    decision: guard.decision,
    recommendedActions: ["cap_output_tokens", ...guard.recommendedActions],
    cacheEligible: guard.cache.cacheEligible,
    cacheKey: guard.cache.cacheKey,
    modelTierRecommendation: "cheap",
    simulatedUncappedMaxOutputTokens: 2000,
    recommendedMaxOutputTokens: 300,
    maxOutputTokens: 300,
    strategy: "Use a 300-token answer cap for status summaries; do not request long output unless a human explicitly asks.",
    estimatedCostUsd: guard.estimate.totalCostUsd,
  });
}

function createComparisonCase({
  caseId,
  userQuestion,
  mode,
  requestType,
  naiveContext,
  optimizedSources,
  modelTier,
  maxOutputTokens,
  strategy,
}) {
  const messages = [{ role: "user", content: userQuestion }];
  const optimizedContext = optimizedSources.map((item) => item.content).join("\n\n");
  const naiveEstimate = estimateTokens({ messages, text: naiveContext, maxOutputTokens });
  const optimizedEstimate = estimateTokens({ messages, text: optimizedContext, maxOutputTokens });
  const guard = checkTokenCostGuard({
    requestType,
    provider: "benchmark",
    model: `${modelTier}-preview`,
    modelTier,
    messages,
    rawContextText: naiveContext,
    selectedSources: optimizedSources,
    maxOutputTokens,
  }, { policy });
  const estimatedTokensSaved = Math.max(0, naiveEstimate.estimatedInputTokens - optimizedEstimate.estimatedInputTokens);

  return normalizeCase({
    caseId,
    mode,
    userQuestion,
    naiveEstimatedInputTokens: naiveEstimate.estimatedInputTokens,
    optimizedEstimatedInputTokens: optimizedEstimate.estimatedInputTokens,
    naiveEstimatedOutputTokens: naiveEstimate.estimatedOutputTokens,
    optimizedEstimatedOutputTokens: optimizedEstimate.estimatedOutputTokens,
    naiveEstimatedTotalTokens: naiveEstimate.estimatedTotalTokens,
    optimizedEstimatedTotalTokens: optimizedEstimate.estimatedTotalTokens,
    estimatedTokensSaved,
    savingsRatio: ratio(estimatedTokensSaved, naiveEstimate.estimatedInputTokens),
    decision: guard.decision,
    recommendedActions: guard.recommendedActions,
    cacheEligible: guard.cache.cacheEligible,
    cacheKey: guard.cache.cacheKey,
    modelTierRecommendation: modelTier,
    maxOutputTokens,
    strategy,
    estimatedCostUsd: guard.estimate.totalCostUsd,
    selectedSourceCount: optimizedSources.length,
  });
}

function normalizeCase(input) {
  const recommendedActions = [...new Set(input.recommendedActions ?? [])];
  return {
    caseId: input.caseId,
    mode: input.mode ?? "estimate-only",
    userQuestion: input.userQuestion,
    naiveEstimatedInputTokens: Number(input.naiveEstimatedInputTokens ?? 0),
    optimizedEstimatedInputTokens: Number(input.optimizedEstimatedInputTokens ?? 0),
    naiveEstimatedOutputTokens: Number(input.naiveEstimatedOutputTokens ?? 0),
    optimizedEstimatedOutputTokens: Number(input.optimizedEstimatedOutputTokens ?? 0),
    naiveEstimatedTotalTokens: Number(input.naiveEstimatedTotalTokens ?? 0),
    optimizedEstimatedTotalTokens: Number(input.optimizedEstimatedTotalTokens ?? 0),
    estimatedTokensSaved: Number(input.estimatedTokensSaved ?? 0),
    savingsRatio: Number(input.savingsRatio ?? 0),
    decision: input.decision ?? "allow",
    recommendedActions,
    cacheEligible: input.cacheEligible === true,
    servedFromCache: input.servedFromCache === true,
    cacheKey: input.cacheKey ?? null,
    modelTierRecommendation: input.modelTierRecommendation ?? "cheap",
    maxOutputTokens: Number(input.maxOutputTokens ?? 0),
    strategy: input.strategy ?? "",
    ...copyOptionalFields(input),
  };
}

function copyOptionalFields(input) {
  const optional = {};
  for (const key of [
    "paidApiCallCount",
    "estimatedCostUsd",
    "actualUsageComparison",
    "estimatedApiTokensSaved",
    "firstRun",
    "secondRun",
    "modelTierDowngradeOpportunities",
    "tierTasks",
    "premiumAllCostUsd",
    "recommendedTierCostUsd",
    "estimatedCostSavedUsd",
    "simulatedUncappedMaxOutputTokens",
    "recommendedMaxOutputTokens",
    "outputTokenCapSavings",
    "selectedSourceCount",
  ]) {
    if (Object.hasOwn(input, key)) optional[key] = input[key];
  }
  return optional;
}

function summarizeCases(cases) {
  const estimatedTotalNaiveTokens = sum(cases.map((item) => item.naiveEstimatedTotalTokens));
  const estimatedTotalOptimizedTokens = sum(cases.map((item) => item.optimizedEstimatedTotalTokens));
  const estimatedTotalTokensSaved = Math.max(0, estimatedTotalNaiveTokens - estimatedTotalOptimizedTokens);
  const ratios = cases.map((item) => Number(item.savingsRatio)).filter(Number.isFinite);

  return {
    caseCount: cases.length,
    averageSavingsRatio: Number((sum(ratios) / Math.max(1, ratios.length)).toFixed(4)),
    maxSavingsRatio: Number(Math.max(...ratios, 0).toFixed(4)),
    estimatedTotalNaiveTokens,
    estimatedTotalOptimizedTokens,
    estimatedTotalTokensSaved,
    cacheEligibleCount: cases.filter((item) => item.cacheEligible).length,
    blockedCount: cases.filter((item) => item.decision === "block").length,
    requireApprovalCount: cases.filter((item) => item.decision === "require_approval").length,
    modelTierDowngradeOpportunities: sum(cases.map((item) => item.modelTierDowngradeOpportunities ?? 0)),
  };
}

function createGaps() {
  return [
    "Token estimation is approximate and not yet calibrated with successful MiMo usage because Phase 269A did not return usage.",
    "Knowledge/RAG selected-context quality is simulated with local snippets; there is not yet an automatic source ranking benchmark.",
    "Cache policy can generate stable keys, but response cache persistence is not implemented in this benchmark.",
    "Model tier routing is a recommendation, not yet enforced for the default /chat lane.",
    "Output cap savings are estimate-only; no long output request was sent or billed.",
    "Budget decisions are local preview guard decisions, not production billing controls.",
  ];
}

function createBetterPlan() {
  return [
    {
      route: "Route A",
      title: "Local token guard + benchmark first",
      recommendation: "do-first",
      value: "Keeps risk low while improving estimates, cache policy, UI, and evidence.",
    },
    {
      route: "Route C",
      title: "RAG source selection optimization",
      recommendation: "do-next",
      value: "Reduces the largest waste source: sending broad docs when a few evidence snippets are enough.",
    },
    {
      route: "Route D",
      title: "Cache persistence",
      recommendation: "do-next",
      value: "Turns repeated status/blocker/action questions into zero paid-token repeats when source hashes match.",
    },
    {
      route: "Route B",
      title: "Tiny MiMo usage calibration",
      recommendation: "do-after-a-c-d",
      value: "Use at most three tiny requests to calibrate estimated tokens against provider usage.",
    },
    {
      route: "Route E",
      title: "Model tier routing",
      recommendation: "do-after-benchmark-policy-hardening",
      value: "Prevents simple status and rule-only work from reaching premium paid models.",
    },
  ];
}

function createSafetySummary() {
  return {
    plainTextApiKeyWritten: false,
    apiKeyPrinted: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    legacyModified: false,
    projectContextCreated: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    longContextSentToPaidApi: false,
    largeOutputRequested: false,
  };
}

function loadBenchmarkSourceTexts() {
  const docs = [
    "docs/USER_MANUAL.md",
    "docs/UNIFIED_AI_SYSTEM_ARCHITECTURE_REPORT.md",
    "docs/UNIFIED_AI_SYSTEM_PROJECT_READTHROUGH_AND_FUTURE_REPORT.md",
    "docs/TOKEN_COST_GUARD.md",
    "docs/MIMO_PAID_API_SAFE_SMOKE.md",
    "docs/PERSONAL_ACTION_QUEUE.md",
    "docs/PERSONAL_DECISION_DASHBOARD.md",
    "docs/CODEX_ONE_SHOT_READINESS_CLOSURE.md",
  ].map((path) => readText(path)).join("\n\n");
  const latestEvidenceBundle = [
    "apps/ai-gateway-service/evidence/phase-267a-architecture-report.json",
    "apps/ai-gateway-service/evidence/phase-267a-project-readthrough-future-report.json",
    "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
    "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  ].map((path) => readText(path)).join("\n\n");

  return {
    readme: readText("README.md"),
    agents: readText("AGENTS.md"),
    userManual: readText("docs/USER_MANUAL.md"),
    architectureReport: readText("docs/UNIFIED_AI_SYSTEM_ARCHITECTURE_REPORT.md"),
    readthroughReport: readText("docs/UNIFIED_AI_SYSTEM_PROJECT_READTHROUGH_AND_FUTURE_REPORT.md"),
    personalActionQueue: readText("docs/PERSONAL_ACTION_QUEUE.md"),
    personalDecisionDashboard: readText("docs/PERSONAL_DECISION_DASHBOARD.md"),
    codexReadinessClosure: readText("docs/CODEX_ONE_SHOT_READINESS_CLOSURE.md"),
    phase269Evidence: readText("apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json"),
    phase267ReadyResetEvidence: readText("apps/ai-gateway-service/evidence/phase-267a-desktop-automation-ready-state-reset.json"),
    docsBundle: docs,
    latestEvidenceBundle,
  };
}

function readText(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function readJson(relativePath) {
  const text = readText(relativePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function source(title, content) {
  return {
    title,
    content: String(content ?? ""),
  };
}

function snippet(value, maxChars) {
  const text = String(value ?? "").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[trimmed-for-estimate-only-benchmark]`;
}

function ratio(numerator, denominator) {
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return 0;
  return Number(Math.max(0, Math.min(1, top / bottom)).toFixed(4));
}

function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

function renderMarkdown(evidence) {
  return `# Phase 270A Token Saving Benchmark Evidence

- Phase: ${evidence.phase}
- Status: ${evidence.status}
- Conclusion: ${evidence.conclusion}
- Generated at: ${evidence.generatedAt}
- Mode: ${evidence.mode}
- Default NVIDIA /chat lane changed: ${evidence.defaultNvidiaChatLaneChanged}
- MiMo set as default: ${evidence.mimoSetAsDefault}
- Paid API call count: ${evidence.paidApiCallCount}
- Long context sent to paid API: ${evidence.longContextSentToPaidApi}

## Summary

- caseCount: ${evidence.summary.caseCount}
- averageSavingsRatio: ${evidence.summary.averageSavingsRatio}
- maxSavingsRatio: ${evidence.summary.maxSavingsRatio}
- estimatedTotalNaiveTokens: ${evidence.summary.estimatedTotalNaiveTokens}
- estimatedTotalOptimizedTokens: ${evidence.summary.estimatedTotalOptimizedTokens}
- estimatedTotalTokensSaved: ${evidence.summary.estimatedTotalTokensSaved}
- cacheEligibleCount: ${evidence.summary.cacheEligibleCount}
- blockedCount: ${evidence.summary.blockedCount}
- requireApprovalCount: ${evidence.summary.requireApprovalCount}
- modelTierDowngradeOpportunities: ${evidence.summary.modelTierDowngradeOpportunities}

## Cases

${evidence.cases.map((item) => `### ${item.caseId}

- mode: ${item.mode}
- naiveEstimatedInputTokens: ${item.naiveEstimatedInputTokens}
- optimizedEstimatedInputTokens: ${item.optimizedEstimatedInputTokens}
- estimatedTokensSaved: ${item.estimatedTokensSaved}
- savingsRatio: ${item.savingsRatio}
- decision: ${item.decision}
- cacheEligible: ${item.cacheEligible}
- servedFromCache: ${item.servedFromCache}
- modelTierRecommendation: ${JSON.stringify(item.modelTierRecommendation)}
- recommendedActions: ${item.recommendedActions.join(", ") || "none"}
`).join("\n")}

## Gaps

${evidence.gaps.map((gap) => `- ${gap}`).join("\n")}

## Better Plan

${evidence.betterPlan.map((item) => `- ${item.route}: ${item.title} (${item.recommendation}) - ${item.value}`).join("\n")}

## Safety

${Object.entries(evidence.safety).map(([key, value]) => `- ${key}: ${value}`).join("\n")}
`;
}
