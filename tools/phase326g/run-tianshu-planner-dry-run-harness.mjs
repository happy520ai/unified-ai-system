import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const scenarioPath = path.join(repoRoot, "docs", "phase326g-tianshu-dry-run-scenarios.json");
const resultPath = path.join(repoRoot, "docs", "phase326g-tianshu-dry-run-result.json");
const reportPath = path.join(repoRoot, "docs", "phase326g-tianshu-dry-run-report.md");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function parseMode() {
  const args = new Set(process.argv.slice(2));
  const preview = args.has("--preview");
  const run = args.has("--run");
  assert(preview !== run, "Use exactly one of --preview or --run.");
  return preview ? "preview" : "run";
}

function validateScenario(scenario) {
  assert(scenario.mode === "tianshu", `${scenario.scenarioId} mode must be tianshu.`);
  assert(scenario.runtimeStatus === "dry_run_without_provider_call", `${scenario.scenarioId} runtimeStatus mismatch.`);
  assert(scenario.providerCallsAllowed === false, `${scenario.scenarioId} provider calls must be disabled.`);
  assert(scenario.nonNvidiaProviderCallsAllowed === false, `${scenario.scenarioId} non-NVIDIA calls must be disabled.`);
  assert(scenario.secretValueAllowed === false, `${scenario.scenarioId} secret values must be disabled.`);
  assert(Array.isArray(scenario.capabilityRequirementsExpected), `${scenario.scenarioId} requires capability list.`);
}

function pickExecutionMode(scenario) {
  if (!scenario.mockCapabilityIndex?.length) return "reject";
  if (scenario.scenarioId === "godModeEscalationScenario") return "god_mode_review";
  if (scenario.mockCapabilityIndex.length > 1 && scenario.taskTypeExpected === "data_analysis") return "multi_model";
  return "single_model";
}

function buildResult(scenario) {
  const executionMode = pickExecutionMode(scenario);
  const rejected = executionMode === "reject";
  return {
    scenarioId: scenario.scenarioId,
    taskClassification: scenario.taskTypeExpected,
    capabilityRequirements: scenario.capabilityRequirementsExpected,
    candidateModels: scenario.mockCapabilityIndex,
    plannerDecision: {
      taskType: scenario.taskTypeExpected,
      executionMode,
      decisionReason: rejected ? "no eligible mock model in dry-run index" : "mock capability match selected without provider call",
    },
    selectedModels: rejected ? [] : scenario.mockCapabilityIndex.slice(0, executionMode === "single_model" ? 1 : 3),
    executionMode,
    rejectionReason: rejected ? "no_eligible_model" : "",
    fallbackPlan: rejected ? "ask user to configure an eligible model" : "no fallback used in dry-run",
    auditTrace: {
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
      runtimeStage: "dry_run_without_provider_call",
    },
  };
}

function renderReport(summary) {
  return [
    "# Phase326G Tianshu Planner Dry-Run Report",
    "",
    `- scenariosProcessed: ${summary.scenariosProcessed}`,
    `- providerCallsMade: ${summary.providerCallsMade}`,
    `- nonNvidiaProviderCallsMade: ${summary.nonNvidiaProviderCallsMade}`,
    `- secretValueExposed: ${summary.secretValueExposed}`,
    "",
    "## Results",
    "",
    ...summary.results.flatMap((item) => [
      `### ${item.scenarioId}`,
      "",
      `- taskClassification: ${item.taskClassification}`,
      `- executionMode: ${item.executionMode}`,
      `- selectedModels: ${item.selectedModels.join(", ") || "none"}`,
      `- rejectionReason: ${item.rejectionReason || "none"}`,
      "",
    ]),
  ].join("\n");
}

async function main() {
  const mode = parseMode();
  const scenariosFile = await readJson(scenarioPath);
  const scenarios = scenariosFile.scenarios ?? [];
  scenarios.forEach(validateScenario);

  if (mode === "preview") {
    const preview = {
      phase: "Phase326G",
      mode: "preview",
      runtimeStatus: "dry_run_without_provider_call",
      plannedScenarios: scenarios.map((scenario) => ({
        scenarioId: scenario.scenarioId,
        taskClassification: scenario.taskTypeExpected,
        candidateModelCount: scenario.mockCapabilityIndex.length,
      })),
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
    };
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  const summary = {
    phase: "Phase326G",
    mode: "tianshu",
    runtimeStatus: "dry_run_without_provider_call",
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    scenariosProcessed: scenarios.length,
    results: scenarios.map(buildResult),
  };
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${renderReport(summary)}\n`, "utf8");
  console.log(JSON.stringify({
    phase: summary.phase,
    scenariosProcessed: summary.scenariosProcessed,
    providerCallsMade: summary.providerCallsMade,
    nonNvidiaProviderCallsMade: summary.nonNvidiaProviderCallsMade,
    secretValueExposed: summary.secretValueExposed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

