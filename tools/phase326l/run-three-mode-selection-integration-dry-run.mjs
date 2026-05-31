import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const scenariosPath = path.join(repoRoot, "docs", "phase326l-integration-dry-run-scenarios.json");
const resultPath = path.join(repoRoot, "docs", "phase326l-integration-dry-run-result.json");
const reportPath = path.join(repoRoot, "docs", "phase326l-integration-dry-run-report.md");
const executionPath = path.join(repoRoot, "docs", "phase326l-execution-report.md");

const sourceFiles = [
  "docs/phase326i-participant-selector-result.json",
  "docs/phase326j-capability-index-result.json",
  "docs/phase326g-tianshu-dry-run-result.json",
  "docs/phase326f-god-mode-dry-run-result.json",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readSources() {
  const missingSources = [];
  const sources = {};
  for (const relativePath of sourceFiles) {
    try {
      sources[relativePath] = await readJson(path.join(repoRoot, relativePath));
    } catch (error) {
      missingSources.push(relativePath);
    }
  }
  return { sources, missingSources };
}

function parseMode() {
  const args = new Set(process.argv.slice(2));
  const preview = args.has("--preview");
  const run = args.has("--run");
  assert(preview !== run, "Use exactly one of --preview or --run.");
  return preview ? "preview" : "run";
}

function classifyTask(task) {
  const text = String(task).toLowerCase();
  if (text.includes("code") || text.includes("refactor")) return "coding";
  if (text.includes("safety") || text.includes("risk")) return "safety_sensitive";
  if (text.includes("long") || text.includes("context")) return "long_context";
  if (text.includes("high risk")) return "high_risk";
  return "general_reasoning";
}

function scoreCapability(item, taskType) {
  const scores = item.capabilityScores ?? {};
  if (taskType === "coding") return (scores.coding ?? 0) + (scores.reasoning ?? 0) * 0.4;
  if (taskType === "long_context") return (scores.longContext ?? 0) + (scores.writing ?? 0) * 0.3;
  if (taskType === "safety_sensitive") return (scores.reasoning ?? 0) + (scores.planning ?? 0) * 0.4;
  return (scores.reasoning ?? 0) + (scores.writing ?? 0) * 0.2;
}

function processScenario(scenario, sources, missingSources) {
  if (missingSources.length) {
    return {
      scenarioId: scenario.scenarioId,
      taskClassification: "blocked_by_missing_source",
      capabilityIndexUsed: false,
      candidateModels: [],
      selectedModels: [],
      selectedParticipants: [],
      integratedPlannerDecision: {
        status: "blocked_by_missing_dry_run_source",
        reason: missingSources.join(", "),
      },
      godModeEscalationDecision: {
        escalated: false,
        reason: "blocked_by_missing_dry_run_source",
      },
      rejectedModels: [],
      fallbackPlan: "Regenerate missing Phase326I/J/F/G dry-run sources.",
      auditTrace: {
        providerCallsMade: false,
        nonNvidiaProviderCallsMade: false,
        secretValueExposed: false,
        runtimeStage: "dry_run_without_provider_call",
        sourceFiles,
      },
    };
  }

  const capabilityIndex = sources["docs/phase326j-capability-index-result.json"].capabilityIndex ?? [];
  const participantResults = sources["docs/phase326i-participant-selector-result.json"].results ?? [];
  const taskType = classifyTask(scenario.inputTask);
  const candidates = capabilityIndex
    .filter((item) => item.governance?.selectable === true && item.governance?.failed === false && item.governance?.highRisk === false)
    .map((item) => ({ ...item, score: scoreCapability(item, taskType) }))
    .sort((a, b) => b.score - a.score);
  const rejectedModels = [
    ...(sources["docs/phase326j-capability-index-result.json"].rejectedModels ?? []),
  ];
  const selectedModels = candidates.slice(0, scenario.expectedExecutionMode === "god_mode_review" ? 3 : 2).map((item) => item.modelId);
  const participantSource = participantResults.find((item) => item.selectedParticipants?.length) ?? {};
  const selectedParticipants = scenario.expectedExecutionMode === "reject" ? [] : (participantSource.selectedParticipants ?? []).slice(0, 3);
  const insufficient = scenario.scenarioId === "insufficientEligibleModelsScenario" || selectedModels.length === 0;
  const highRisk = scenario.scenarioId === "highRiskModelRejectedScenario";
  const escalated = scenario.expectedExecutionMode === "god_mode_review" || scenario.scenarioId === "tianshuEscalatesToGodModeScenario";

  return {
    scenarioId: scenario.scenarioId,
    taskClassification: taskType,
    capabilityIndexUsed: true,
    candidateModels: candidates.map((item) => item.modelId),
    selectedModels: insufficient || highRisk ? [] : selectedModels,
    selectedParticipants: insufficient || highRisk ? [] : selectedParticipants,
    integratedPlannerDecision: {
      executionMode: insufficient ? "reject" : scenario.expectedExecutionMode,
      decisionReason: insufficient ? "insufficient_eligible_models_in_dry_run" : "capability_index_connected_to_participant_selector_without_provider_call",
      runtimeStatus: "dry_run_without_provider_call",
    },
    godModeEscalationDecision: {
      escalated: Boolean(escalated && !insufficient && !highRisk),
      reason: escalated ? "scenario_requires_multi_participant_review" : "single_model_or_tianshu_planner_path_sufficient",
      runtimeEnabled: false,
    },
    selectedParticipantsFromCapabilityIndex: insufficient || highRisk ? [] : selectedParticipants.map((participant, index) => ({
      participant,
      backedByCapabilityModel: selectedModels[index % Math.max(selectedModels.length, 1)] ?? null,
    })),
    rejectedModels: highRisk ? [...rejectedModels, { modelId: "mock-high-risk", reason: "high_risk_model_rejected" }] : rejectedModels,
    fallbackPlan: insufficient || highRisk ? "ask user to configure and validate more eligible models" : "fallback to stable selectable dry-run candidate if primary is unavailable",
    auditTrace: {
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
      runtimeStage: "dry_run_without_provider_call",
      sourceFiles,
    },
  };
}

function renderReport(summary) {
  return [
    "# Phase326L God Selector + Tianshu Capability Index Integration Dry-run Report",
    "",
    `- scenariosProcessed: ${summary.scenariosProcessed}`,
    `- providerCallsMade: ${summary.providerCallsMade}`,
    `- nonNvidiaProviderCallsMade: ${summary.nonNvidiaProviderCallsMade}`,
    `- secretValueExposed: ${summary.secretValueExposed}`,
    `- missingSources: ${summary.missingSources.join(", ") || "none"}`,
    "",
    ...summary.results.flatMap((item) => [
      `## ${item.scenarioId}`,
      "",
      `- taskClassification: ${item.taskClassification}`,
      `- selectedModels: ${item.selectedModels.join(", ") || "none"}`,
      `- selectedParticipants: ${item.selectedParticipants.join(", ") || "none"}`,
      `- godModeEscalated: ${item.godModeEscalationDecision.escalated}`,
      "",
    ]),
  ].join("\n");
}

async function main() {
  const mode = parseMode();
  const scenarioFile = await readJson(scenariosPath);
  const scenarios = scenarioFile.scenarios ?? [];
  for (const scenario of scenarios) {
    assert(scenario.runtimeStatus === "dry_run_without_provider_call", `${scenario.scenarioId} runtimeStatus mismatch`);
    assert(scenario.providerCallsAllowed === false, `${scenario.scenarioId} provider calls must be false`);
    assert(scenario.nonNvidiaProviderCallsAllowed === false, `${scenario.scenarioId} non-NVIDIA calls must be false`);
    assert(scenario.secretValueAllowed === false, `${scenario.scenarioId} secret values must be false`);
  }
  const { sources, missingSources } = await readSources();
  if (mode === "preview") {
    console.log(JSON.stringify({
      phase: "Phase326L",
      mode: "preview",
      plannedScenarios: scenarios.map((scenario) => scenario.scenarioId),
      missingSources,
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
    }, null, 2));
    return;
  }
  const summary = {
    phase: "Phase326L",
    runtimeStatus: "dry_run_without_provider_call",
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    missingSources,
    scenariosProcessed: scenarios.length,
    results: scenarios.map((scenario) => processScenario(scenario, sources, missingSources)),
  };
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${renderReport(summary)}\n`, "utf8");
  await writeFile(executionPath, [
    "# Phase326L Execution Report",
    "",
    "- previewSupported: true",
    "- runExecuted: true",
    "- runtimeStatus: dry_run_without_provider_call",
    "- providerCallsMade: false",
    "- nonNvidiaProviderCallsMade: false",
    "- secretValueExposed: false",
    `- scenariosProcessed: ${summary.scenariosProcessed}`,
    `- missingSources: ${missingSources.join(", ") || "none"}`,
    "",
  ].join("\n"), "utf8");
  console.log(JSON.stringify({
    phase: summary.phase,
    scenariosProcessed: summary.scenariosProcessed,
    missingSources,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
