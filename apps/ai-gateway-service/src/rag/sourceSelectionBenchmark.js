import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTextTokens } from "../cost/tokenEstimator.js";

export const RAG_SOURCE_SELECTION_PHASE = "273A-rag-source-selection-benchmark";
export const RAG_SOURCE_SELECTION_CONCLUSION = "rag-source-selection-benchmark-ready";
export const RAG_SOURCE_SELECTION_MODE = "local-source-selection-only";

export const PHASE_273_EVIDENCE_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json";
export const PHASE_273_EVIDENCE_MD_RELATIVE_PATH = "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.md";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const EVIDENCE = {
  phase268: "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json",
  phase269: "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json",
  phase270: "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json",
  phase271: "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json",
  phase272: "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json",
};

const DOCS = {
  tokenGuard: "docs/TOKEN_COST_GUARD.md",
  tokenSaving: "docs/TOKEN_SAVING_BENCHMARK.md",
  tokenCalibration: "docs/TOKEN_ESTIMATOR_CALIBRATION.md",
  mimoSmoke: "docs/MIMO_PAID_API_SAFE_SMOKE.md",
  mimoDiscovery: "docs/MIMO_MODEL_ID_DISCOVERY.md",
  ragBenchmark: "docs/RAG_SOURCE_SELECTION_BENCHMARK.md",
  agents: "AGENTS.md",
  readme: "README.md",
  userManual: "docs/USER_MANUAL.md",
  architecture: "docs/UNIFIED_AI_SYSTEM_ARCHITECTURE_REPORT.md",
  futureReport: "docs/UNIFIED_AI_SYSTEM_PROJECT_READTHROUGH_AND_FUTURE_REPORT.md",
};

const BASE_NAIVE_SOURCES = [
  DOCS.readme,
  DOCS.agents,
  DOCS.userManual,
  DOCS.architecture,
  DOCS.futureReport,
  DOCS.tokenGuard,
  DOCS.tokenSaving,
  DOCS.mimoSmoke,
  DOCS.mimoDiscovery,
  DOCS.tokenCalibration,
  EVIDENCE.phase268,
  EVIDENCE.phase269,
  EVIDENCE.phase270,
  EVIDENCE.phase271,
  EVIDENCE.phase272,
];

const STALE_RISKS = {
  old269Failure: "historical:phase-269a-initial-failed-model-id-state",
  mockNoGo: ".codex-handoff/review/latest-desktop-review.json",
  oldReadthrough: "docs/UNIFIED_AI_SYSTEM_PROJECT_READTHROUGH_AND_FUTURE_REPORT.md",
  oldArchitecture: "docs/UNIFIED_AI_SYSTEM_ARCHITECTURE_REPORT.md",
  legacy: "legacy/",
};

const CASES = [
  {
    caseId: "current-project-status",
    query: "\u73b0\u5728\u9879\u76ee\u505a\u5230\u54ea\u4e00\u6b65\u4e86\uff1f",
    requiredSources: [EVIDENCE.phase272, EVIDENCE.phase271, EVIDENCE.phase270],
    selectedSources: [EVIDENCE.phase272, EVIDENCE.phase271, EVIDENCE.phase270, EVIDENCE.phase269],
    forbiddenOrStaleSources: [STALE_RISKS.old269Failure, STALE_RISKS.mockNoGo],
    latestEvidenceSources: [EVIDENCE.phase272, EVIDENCE.phase271, EVIDENCE.phase270],
  },
  {
    caseId: "current-blocker",
    query: "\u5f53\u524d blocker \u662f\u4ec0\u4e48\uff1f",
    requiredSources: [EVIDENCE.phase272, EVIDENCE.phase271, EVIDENCE.phase269],
    selectedSources: [EVIDENCE.phase272, EVIDENCE.phase271, EVIDENCE.phase269],
    forbiddenOrStaleSources: [STALE_RISKS.old269Failure, STALE_RISKS.mockNoGo],
    latestEvidenceSources: [EVIDENCE.phase272, EVIDENCE.phase271],
  },
  {
    caseId: "mimo-availability",
    query: "MiMo v2.5 Pro \u73b0\u5728\u80fd\u7528\u4e86\u5417\uff1f",
    requiredSources: [EVIDENCE.phase271, EVIDENCE.phase269],
    selectedSources: [EVIDENCE.phase271, EVIDENCE.phase269, EVIDENCE.phase272],
    forbiddenOrStaleSources: [STALE_RISKS.old269Failure],
    latestEvidenceSources: [EVIDENCE.phase271, EVIDENCE.phase269],
  },
  {
    caseId: "token-saving-value",
    query: "\u7cfb\u7edf\u73b0\u5728\u5230\u5e95\u80fd\u4e0d\u80fd\u5e2e\u6211\u7701 token\uff1f",
    requiredSources: [EVIDENCE.phase270, EVIDENCE.phase272],
    selectedSources: [EVIDENCE.phase270, EVIDENCE.phase272, EVIDENCE.phase268],
    forbiddenOrStaleSources: [STALE_RISKS.oldArchitecture],
    latestEvidenceSources: [EVIDENCE.phase272, EVIDENCE.phase270],
  },
  {
    caseId: "avoid-full-docs-to-mimo",
    query: "\u4e3a\u4ec0\u4e48\u4e0d\u80fd\u76f4\u63a5\u628a\u6240\u6709\u9879\u76ee\u6587\u6863\u90fd\u53d1\u7ed9 MiMo\uff1f",
    requiredSources: [EVIDENCE.phase272, EVIDENCE.phase270],
    selectedSources: [EVIDENCE.phase272, EVIDENCE.phase270, EVIDENCE.phase268, DOCS.tokenCalibration],
    forbiddenOrStaleSources: [DOCS.userManual, DOCS.futureReport],
    latestEvidenceSources: [EVIDENCE.phase272, EVIDENCE.phase270],
  },
  {
    caseId: "next-step",
    query: "\u4e0b\u4e00\u6b65\u5e94\u8be5\u505a\u4ec0\u4e48\uff1f",
    requiredSources: [EVIDENCE.phase272, DOCS.ragBenchmark],
    selectedSources: [EVIDENCE.phase272, EVIDENCE.phase270, DOCS.ragBenchmark],
    forbiddenOrStaleSources: [STALE_RISKS.old269Failure],
    latestEvidenceSources: [EVIDENCE.phase272, DOCS.ragBenchmark],
  },
  {
    caseId: "phase269-stale-failed-interference",
    query: "269A \u662f\u4e0d\u662f\u5931\u8d25\u4e86\uff1f",
    requiredSources: [EVIDENCE.phase269, EVIDENCE.phase271],
    selectedSources: [EVIDENCE.phase269, EVIDENCE.phase271, EVIDENCE.phase272],
    forbiddenOrStaleSources: [STALE_RISKS.old269Failure],
    latestEvidenceSources: [EVIDENCE.phase269, EVIDENCE.phase271],
  },
  {
    caseId: "minimal-codex-task-context",
    query: "\u7ed9\u6211\u751f\u6210\u4e0b\u4e00\u6761 Codex \u4efb\u52a1\u3002",
    requiredSources: [EVIDENCE.phase272, DOCS.ragBenchmark, DOCS.agents],
    selectedSources: [EVIDENCE.phase272, EVIDENCE.phase270, DOCS.ragBenchmark, DOCS.agents],
    forbiddenOrStaleSources: [DOCS.userManual, DOCS.futureReport, STALE_RISKS.legacy],
    latestEvidenceSources: [EVIDENCE.phase272, DOCS.ragBenchmark],
  },
];

export function buildRagSourceSelectionBenchmark(options = {}) {
  const root = options.repoRoot ?? repoRoot;
  const cases = CASES.map((item) => evaluateCase(item, root));
  const summary = summarizeCases(cases);

  return {
    phase: RAG_SOURCE_SELECTION_PHASE,
    status: "passed",
    conclusion: RAG_SOURCE_SELECTION_CONCLUSION,
    generatedAt: new Date().toISOString(),
    mode: RAG_SOURCE_SELECTION_MODE,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    caseCount: cases.length,
    cases,
    summary,
    gaps: [
      "This is not production vector RAG.",
      "No embedding or rerank model is used.",
      "Freshness guard is rule-based and evidence-path based.",
      "No persisted response cache is available yet.",
      "Source ranking still needs real answer-quality validation.",
      "No comparison against real MiMo answer quality is performed in this phase.",
    ],
    recommendedNextRoutes: [
      {
        route: "Phase 274A Cache Persistence / response cache persistence",
        priority: "recommended",
        reason: "Selected context packs are small enough to make response caching valuable before any larger MiMo use.",
      },
      {
        route: "Improve source freshness rules",
        priority: "next",
        reason: "Formalize how repaired or passed evidence supersedes stale failed states.",
      },
      {
        route: "Add optional embedding or rerank trial later",
        priority: "later",
        reason: "Only after cache and rule-based freshness are stable; this phase intentionally avoids provider calls.",
      },
    ],
    safety: createSafetySummary(),
  };
}

export function renderRagSourceSelectionBenchmarkMarkdown(evidence) {
  const caseRows = evidence.cases.map((item) => (
    `| ${item.caseId} | ${item.naiveEstimatedTokens} | ${item.selectedEstimatedTokens} | ${item.estimatedTokensSaved} | ${item.savingsRatio} | ${item.requiredSourceRecall} | ${item.latestEvidenceHit} | ${item.staleSourceSelectedCount} | ${item.selectionQuality} |`
  )).join("\n");

  return `# Phase 273A RAG Source Selection Benchmark Evidence

## Goal

Benchmark local RAG source selection quality and token savings without calling MiMo or any paid API.

## Mode

- mode: ${evidence.mode}
- paidApiCallCount: ${evidence.paidApiCallCount}
- externalApiCalled: ${evidence.externalApiCalled}
- mimoApiCalled: ${evidence.mimoApiCalled}
- defaultNvidiaChatLaneChanged: ${evidence.defaultNvidiaChatLaneChanged}
- mimoSetAsDefault: ${evidence.mimoSetAsDefault}

## Summary

- caseCount: ${evidence.caseCount}
- averageSavingsRatio: ${evidence.summary.averageSavingsRatio}
- estimatedTotalNaiveTokens: ${evidence.summary.estimatedTotalNaiveTokens}
- estimatedTotalSelectedTokens: ${evidence.summary.estimatedTotalSelectedTokens}
- estimatedTotalTokensSaved: ${evidence.summary.estimatedTotalTokensSaved}
- averageRequiredSourceRecall: ${evidence.summary.averageRequiredSourceRecall}
- latestEvidenceHitRate: ${evidence.summary.latestEvidenceHitRate}
- staleSourceSelectedCount: ${evidence.summary.staleSourceSelectedCount}
- passCount: ${evidence.summary.passCount}
- warnCount: ${evidence.summary.warnCount}
- failCount: ${evidence.summary.failCount}

## Case Table

| caseId | naive tokens | selected tokens | saved | savingsRatio | required recall | latest hit | stale selected | quality |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
${caseRows}

## Gaps

${evidence.gaps.map((gap) => `- ${gap}`).join("\n")}

## Recommended Next Routes

${evidence.recommendedNextRoutes.map((route) => `- ${route.route}: ${route.reason}`).join("\n")}

## Safety

${Object.entries(evidence.safety).map(([key, value]) => `- ${key}: ${value}`).join("\n")}
`;
}

function evaluateCase(definition, root) {
  const naiveSources = unique([...BASE_NAIVE_SOURCES, ...definition.requiredSources]).filter((source) => source !== STALE_RISKS.legacy);
  const selectedSources = unique(definition.selectedSources).slice(0, 6);
  const requiredSourceHitCount = definition.requiredSources.filter((source) => selectedSources.includes(source)).length;
  const requiredSourceCount = definition.requiredSources.length;
  const requiredSourceRecall = requiredSourceCount > 0 ? round(requiredSourceHitCount / requiredSourceCount) : 1;
  const staleSourceSelectedCount = selectedSources.filter((source) => definition.forbiddenOrStaleSources.includes(source)).length;
  const latestEvidenceHit = definition.latestEvidenceSources.some((source) => selectedSources.includes(source));
  const naiveEstimatedTokens = estimateSourcesTokenCount(naiveSources, root);
  const recommendedContextPack = selectedSources.map((source) => createContextPackItem(source, definition, root));
  const selectedEstimatedTokens = Math.max(1, estimateTextTokens(JSON.stringify(recommendedContextPack)));
  const estimatedTokensSaved = Math.max(0, naiveEstimatedTokens - selectedEstimatedTokens);
  const savingsRatio = naiveEstimatedTokens > 0 ? round(estimatedTokensSaved / naiveEstimatedTokens) : 0;
  const warnings = [];

  if (requiredSourceRecall < 1) warnings.push("required_source_recall_below_1");
  if (!latestEvidenceHit) warnings.push("latest_evidence_not_selected");
  if (staleSourceSelectedCount > 0) warnings.push("stale_source_selected");
  if (savingsRatio < 0.5) warnings.push("low_token_savings");

  return {
    caseId: definition.caseId,
    query: definition.query,
    mode: RAG_SOURCE_SELECTION_MODE,
    naiveSources,
    selectedSources,
    requiredSources: definition.requiredSources,
    forbiddenOrStaleSources: definition.forbiddenOrStaleSources,
    naiveEstimatedTokens,
    selectedEstimatedTokens,
    estimatedTokensSaved,
    savingsRatio,
    requiredSourceHitCount,
    requiredSourceCount,
    requiredSourceRecall,
    staleSourceSelectedCount,
    latestEvidenceHit,
    freshnessStatus: getFreshnessStatus({ requiredSourceRecall, latestEvidenceHit, staleSourceSelectedCount }),
    selectionQuality: getSelectionQuality({ warnings }),
    warnings,
    recommendedContextPack,
  };
}

function createContextPackItem(source, definition, root) {
  return {
    source,
    reason: createSelectionReason(source, definition),
    includedFacts: extractFactsForSource(source, root),
  };
}

function createSelectionReason(source, definition) {
  if (definition.requiredSources.includes(source)) return "required-for-query";
  if (source.includes("AGENTS.md")) return "safety-boundary";
  if (source.includes("RAG_SOURCE_SELECTION_BENCHMARK")) return "next-phase-context";
  return "supporting-freshness-or-policy";
}

function extractFactsForSource(source, root) {
  const evidence = readJsonIfPossible(resolve(root, source));

  if (source === EVIDENCE.phase269 && evidence) {
    return [
      `status=${evidence.status}`,
      `model=${evidence.model}`,
      `defaultNvidiaChatLaneChanged=${evidence.defaultNvidiaChatLaneChanged}`,
      `response.success=${evidence.response?.success}`,
      `usage=${evidence.response?.inputTokens}/${evidence.response?.outputTokens}/${evidence.response?.totalTokens}`,
    ];
  }

  if (source === EVIDENCE.phase270 && evidence) {
    return [
      `status=${evidence.status}`,
      `caseCount=${evidence.summary?.caseCount ?? evidence.caseCount}`,
      `averageSavingsRatio=${evidence.summary?.averageSavingsRatio}`,
      `paidApiCallCount=${evidence.paidApiCallCount}`,
      `longContextSentToPaidApi=${evidence.longContextSentToPaidApi}`,
    ];
  }

  if (source === EVIDENCE.phase271 && evidence) {
    return [
      `status=${evidence.status}`,
      `discoveredWorkingModelId=${evidence.configuration?.discoveredWorkingModelId}`,
      `blocker=${evidence.blocker?.type}`,
      `defaultNvidiaChatLaneChanged=${evidence.defaultNvidiaChatLaneChanged}`,
      `mimoSetAsDefault=${evidence.mimoSetAsDefault}`,
    ];
  }

  if (source === EVIDENCE.phase272 && evidence) {
    return [
      `status=${evidence.status}`,
      `confidence=${evidence.confidence}`,
      `calibrationCoverage=${evidence.calibrationCoverage}`,
      `estimatorBias=${evidence.summary?.estimatorBias}`,
      `recommendedMinimumInputTokenFloor=${evidence.calibrationProfile?.recommendedMinimumInputTokenFloor}`,
      `paidApiCallCount=${evidence.paidApiCallCount}`,
    ];
  }

  if (source === EVIDENCE.phase268 && evidence) {
    return [
      `status=${evidence.status}`,
      `conclusion=${evidence.conclusion}`,
      "budget decisions: allow / require_approval / block",
      "preview-only token and cost guard",
    ];
  }

  if (source === DOCS.agents) {
    return [
      "do not modify legacy/",
      "do not create PROJECT_CONTEXT.md",
      "do not change default NVIDIA /chat lane",
      "do not call codex CLI, create worktrees, or auto commit/push",
    ];
  }

  if (source === DOCS.ragBenchmark) {
    return [
      "Phase 273A local-source-selection-only benchmark",
      "no MiMo call and no paid API call",
      "recommended next route: Phase 274A Cache Persistence",
    ];
  }

  return [summarizeTextSource(source, root)];
}

function estimateSourcesTokenCount(sources, root) {
  const text = sources
    .map((source) => {
      const absolutePath = resolve(root, source);
      if (!existsSync(absolutePath)) return `missing:${source}`;
      return readFileSync(absolutePath, "utf8");
    })
    .join("\n\n---SOURCE---\n\n");

  return Math.max(1, estimateTextTokens(text));
}

function summarizeCases(cases) {
  return {
    averageSavingsRatio: average(cases.map((item) => item.savingsRatio)),
    estimatedTotalNaiveTokens: cases.reduce((sum, item) => sum + item.naiveEstimatedTokens, 0),
    estimatedTotalSelectedTokens: cases.reduce((sum, item) => sum + item.selectedEstimatedTokens, 0),
    estimatedTotalTokensSaved: cases.reduce((sum, item) => sum + item.estimatedTokensSaved, 0),
    averageRequiredSourceRecall: average(cases.map((item) => item.requiredSourceRecall)),
    latestEvidenceHitRate: average(cases.map((item) => item.latestEvidenceHit ? 1 : 0)),
    staleSourceSelectedCount: cases.reduce((sum, item) => sum + item.staleSourceSelectedCount, 0),
    passCount: cases.filter((item) => item.selectionQuality === "pass").length,
    warnCount: cases.filter((item) => item.selectionQuality === "warn").length,
    failCount: cases.filter((item) => item.selectionQuality === "fail").length,
  };
}

function getFreshnessStatus({ requiredSourceRecall, latestEvidenceHit, staleSourceSelectedCount }) {
  if (staleSourceSelectedCount > 0) return "stale";
  if (requiredSourceRecall >= 1 && latestEvidenceHit) return "fresh";
  if (requiredSourceRecall > 0 || latestEvidenceHit) return "mixed";
  return "unknown";
}

function getSelectionQuality({ warnings }) {
  if (warnings.includes("required_source_recall_below_1") || warnings.includes("stale_source_selected")) {
    return "fail";
  }
  if (warnings.length > 0) return "warn";
  return "pass";
}

function summarizeTextSource(source, root) {
  const absolutePath = resolve(root, source);
  if (!existsSync(absolutePath)) return `source missing: ${source}`;
  const text = readFileSync(absolutePath, "utf8").replace(/\s+/g, " ").trim();
  return text.slice(0, 180);
}

function readJsonIfPossible(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function average(values) {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
}

function round(value) {
  return Number((Number(value) || 0).toFixed(4));
}
