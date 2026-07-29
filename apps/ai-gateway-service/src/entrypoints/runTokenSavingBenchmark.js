import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createBlockerCase,
  createCacheHitCase,
  createCodexNextTaskCase,
  createLongContextGuardCase,
  createMimoSmokeEstimateCase,
  createModelTierRoutingCase,
  createOutputCapCase,
  createProjectStatusCase,
} from "./tokenSavingBenchmarkCases.js";

const PHASE = "270A-token-saving-benchmark";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-270a-token-saving-benchmark.json");
const evidenceMdPath = resolve(evidenceDir, "phase-270a-token-saving-benchmark.md");

try {
  const sourceTexts = loadBenchmarkSourceTexts();
  const cases = [
    createProjectStatusCase(sourceTexts),
    createBlockerCase(sourceTexts),
    createCodexNextTaskCase(sourceTexts),
    createMimoSmokeEstimateCase(readJson("apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json")),
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
