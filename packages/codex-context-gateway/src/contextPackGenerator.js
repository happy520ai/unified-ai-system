import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCodexPromptPack } from "./codexPromptBuilder.js";
import { buildContextHash, buildSnapshotPolicy } from "./contextHashPolicy.js";
import { buildContextPack } from "./contextPackSchema.js";
import { detectContextFreshness } from "./contextFreshnessDetector.js";
import { summarizeGitDiff } from "./gitDiffSummarizer.js";
import { compressLongContext } from "./longContextCompressor.js";
import { indexPhaseEvidence } from "./phaseEvidenceIndexer.js";
import { readProjectState } from "./projectStateReader.js";
import { selectRelevantFiles } from "./relevantFileSelector.js";
import { buildSafetyBoundaryReport, scanGeneratedOutputForSecrets } from "./safetyBoundaryChecker.js";
import { guardStaleContext } from "./staleContextGuard.js";
import { buildTokenBudgetReport } from "./tokenBudgetPolicy.js";

export async function generateContextPack({ repoRoot, task, profile, budgetName, outputDir }) {
  const architecture = buildArchitecture();
  const projectState = await readProjectState({ repoRoot });
  const phaseEvidence = await indexPhaseEvidence({ repoRoot });
  const gitDiff = await summarizeGitDiff({ repoRoot });
  const relevantSelection = selectRelevantFiles({ task, gitDiff, profile });
  const relevantFiles = relevantSelection.files;
  const longContextSummary = compressLongContext({ projectState, phaseEvidence, gitDiff });
  const snapshotPolicy = buildSnapshotPolicy({ projectState, phaseEvidence, gitDiff, relevantFiles, task });
  const tokenBudgetReport = buildTokenBudgetReport(
    {
      projectState,
      phaseEvidence: phaseEvidence.latestRefs,
      gitDiff,
      relevantFiles,
      longContextSummary,
      task,
    },
    budgetName,
  );
  const freshnessReport = await detectContextFreshness({ repoRoot, outputDir, currentHash: snapshotPolicy.hash });
  const staleGuard = guardStaleContext(freshnessReport);
  const safety = buildSafetyBoundaryReport();
  const contextPack = buildContextPack({
    task,
    architecture,
    projectState,
    phaseEvidence,
    gitDiff,
    relevantFiles,
    longContextSummary,
    tokenBudgetReport,
    freshnessReport,
    staleGuard,
    safety,
    hash: snapshotPolicy.hash,
  });
  const promptPack = buildCodexPromptPack({ task, relevantFiles, tokenBudgetReport, freshnessReport });
  const safetyScan = scanGeneratedOutputForSecrets([JSON.stringify(contextPack), promptPack.markdown]);
  const finalSafety = buildSafetyBoundaryReport(safetyScan);
  contextPack.safetyBoundary = finalSafety;

  const outputFiles = await writeContextOutputs({
    repoRoot,
    outputDir,
    contextPack,
    projectState,
    relevantFiles,
    tokenBudgetReport,
    promptPack,
    freshnessReport,
    longContextSummary,
  });

  return {
    architecture,
    projectState,
    phaseEvidence,
    gitDiff,
    relevantSelection,
    relevantFiles,
    longContextSummary,
    snapshotPolicy,
    tokenBudgetReport,
    freshnessReport,
    staleGuard,
    safety: finalSafety,
    contextPack,
    promptPack,
    outputFiles,
    outputs: Object.fromEntries(outputFiles.map((path) => [outputKey(path), { path, exists: existsSync(resolve(repoRoot, path)) }])),
    integrationPreview: {
      completed: true,
      codexConfigModified: false,
      codexBaseUrlModified: false,
      realCodexRunnerConnected: false,
      futureIntegrationOnly: true,
    },
    baseUrlCompatibilityStudy: {
      completed: true,
      realBaseUrlConnected: false,
      compatibility: "possible-future-study-only",
      requiredFutureGate: "explicit-user-authorization-and-separate-phase",
    },
    closure: {
      completed: true,
      recommended_sealed: finalSafety.providerCallsMade === false && finalSafety.secretValueExposed === false && tokenBudgetReport.budget.respected === true,
      blocker: null,
    },
  };
}

function buildArchitecture() {
  return {
    completed: true,
    description: "Independent read-only Codex context sub-gateway; not wired into main AI Gateway runtime.",
    components: [
      "Project State Reader",
      "Phase Evidence Indexer",
      "Git Diff Summarizer",
      "Relevant File Selector",
      "Long Context Compressor",
      "Token Budget Manager",
      "Context Freshness Detector",
      "Context Pack Builder",
      "Codex Prompt Builder",
      "Stale Context Guard",
      "Safety Boundary Checker",
    ],
    nonGoals: ["real Codex base_url", "provider calls", "secret reads", "main /chat runtime changes"],
  };
}

async function writeContextOutputs({
  repoRoot,
  outputDir,
  contextPack,
  projectState,
  relevantFiles,
  tokenBudgetReport,
  promptPack,
  freshnessReport,
  longContextSummary,
}) {
  const out = resolve(repoRoot, outputDir);
  await mkdir(out, { recursive: true });
  const files = {
    "current-context-pack.md": renderContextPackMarkdown(contextPack),
    "current-context-pack.json": `${JSON.stringify(contextPack, null, 2)}\n`,
    "phase-state-summary.md": renderPhaseStateSummary(projectState, longContextSummary),
    "relevant-files.json": `${JSON.stringify({ completed: true, selectionMode: "targeted-not-full-repo", files: relevantFiles }, null, 2)}\n`,
    "token-budget-report.json": `${JSON.stringify(tokenBudgetReport, null, 2)}\n`,
    "codex-prompt-pack.md": promptPack.markdown,
    "context-freshness-report.json": `${JSON.stringify(freshnessReport, null, 2)}\n`,
  };
  const written = [];
  for (const [name, content] of Object.entries(files)) {
    await writeFile(resolve(out, name), content, "utf8");
    written.push(`${outputDir}/${name}`);
  }
  return written;
}

function renderContextPackMarkdown(contextPack) {
  return [
    "# Current Codex Context Pack",
    "",
    `- schemaVersion: ${contextPack.schemaVersion}`,
    `- hash: ${contextPack.hash}`,
    `- task: ${contextPack.task}`,
    `- providerCalled: ${contextPack.providerCalled}`,
    `- codexBaseUrlConnected: ${contextPack.codexBaseUrlConnected}`,
    `- tokenBudget: ${contextPack.tokenBudget.budgetName}`,
    `- estimatedTokens: ${contextPack.tokenBudget.estimatedTokens}`,
    `- tokenBudgetRespected: ${contextPack.tokenBudget.respected}`,
    "",
    "## Relevant Files",
    ...contextPack.relevantFiles.map((item) => `- ${item.path} (${item.mode})`),
    "",
    "## Evidence Refs",
    ...contextPack.phaseEvidence.latestRefs.slice(-20).map((item) => `- ${item.phaseId}: ${item.path}`),
    "",
    "## Safety",
    `- providerCallsMade: ${contextPack.safetyBoundary.providerCallsMade}`,
    `- rawSecretAccessed: ${contextPack.safetyBoundary.rawSecretAccessed}`,
    `- secretValueExposed: ${contextPack.safetyBoundary.secretValueExposed}`,
    `- chatModified: ${contextPack.safetyBoundary.chatModified}`,
    `- chatGatewayExecuteModified: ${contextPack.safetyBoundary.chatGatewayExecuteModified}`,
    `- codexBaseUrlModified: ${contextPack.safetyBoundary.codexBaseUrlModified}`,
    `- codexConfigModified: ${contextPack.safetyBoundary.codexConfigModified}`,
    "",
  ].join("\n");
}

function renderPhaseStateSummary(projectState, longContextSummary) {
  return [
    "# Phase State Summary",
    "",
    `- packageName: ${projectState.packageName}`,
    `- packageVersion: ${projectState.packageVersion}`,
    `- packageScriptCount: ${projectState.packageScriptCount}`,
    `- readmeManagedBlockFound: ${projectState.readmeManagedBlockFound}`,
    `- agentsManagedBlockFound: ${projectState.agentsManagedBlockFound}`,
    `- phaseDocCount: ${projectState.phaseDocs.length}`,
    `- evidenceRefCount: ${longContextSummary.summary.evidenceRefCount}`,
    `- currentBlocker: ${longContextSummary.summary.currentBlocker}`,
    `- nextAction: ${longContextSummary.summary.nextAction}`,
    "",
  ].join("\n");
}

function outputKey(path) {
  const name = path.split("/").pop().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/\.[^.]+$/, "");
  if (name === "currentContextPack") return path.endsWith(".json") ? "contextPackJson" : "contextPackMarkdown";
  return name;
}
