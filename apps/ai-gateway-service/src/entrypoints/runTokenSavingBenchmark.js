import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTokenBudgetPolicy } from "../cost/tokenBudgetPolicy.js";
import {
  createProjectStatusCase,
  createBlockerCase,
  createCodexNextTaskCase,
  createMimoSmokeEstimateCase,
  createCacheHitCase,
  createLongContextGuardCase,
  createModelTierRoutingCase,
  createOutputCapCase,
} from "./benchmarkHelpers.js";
import {
  summarizeCases,
  loadBenchmarkSourceTexts,
  renderMarkdown,
  createGaps,
  createBetterPlan,
  createSafetySummary,
} from "./benchmarkUtils.js";

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

