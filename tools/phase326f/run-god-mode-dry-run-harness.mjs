import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const scenarioPath = path.join(repoRoot, "docs", "phase326f-god-mode-dry-run-scenarios.json");
const resultPath = path.join(repoRoot, "docs", "phase326f-god-mode-dry-run-result.json");
const reportPath = path.join(repoRoot, "docs", "phase326f-god-mode-dry-run-report.md");

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
  assert(scenario.mode === "god", `${scenario.scenarioId} mode must be god.`);
  assert(scenario.runtimeStatus === "dry_run_without_provider_call", `${scenario.scenarioId} runtimeStatus mismatch.`);
  assert(scenario.providerCallsAllowed === false, `${scenario.scenarioId} provider calls must be disabled.`);
  assert(scenario.nonNvidiaProviderCallsAllowed === false, `${scenario.scenarioId} non-NVIDIA calls must be disabled.`);
  assert(scenario.secretValueAllowed === false, `${scenario.scenarioId} secret values must be disabled.`);
  assert(Array.isArray(scenario.participantModelsStub) && scenario.participantModelsStub.length >= 2, `${scenario.scenarioId} requires at least two stub participants.`);
}

function buildResult(scenario) {
  return {
    scenarioId: scenario.scenarioId,
    pipelineExecuted: scenario.expectedPipeline,
    simulatedModelContributions: scenario.participantModelsStub.map((modelId, index) => ({
      modelId,
      role: index === 0 ? "primary_responder" : index === 1 ? "critic" : "safety_guard",
      contributionSummary: `Simulated ${scenario.scenarioId} contribution from ${modelId}`,
    })),
    simulatedDisagreements: [
      {
        disagreementId: `${scenario.scenarioId}-disagreement-1`,
        summary: "Simulated disagreement for contract shape validation.",
      },
    ],
    simulatedResolvedConflicts: [
      {
        conflictId: `${scenario.scenarioId}-conflict-1`,
        resolution: "Supervisor keeps uncertainty and selects the safer supported claim.",
      },
    ],
    simulatedSupervisorDecision: {
      synthesisStrategy: "preserve_uncertainty_and_resolve_supported_conflicts",
      confidenceSummary: "medium",
    },
    finalAnswerStub: `Dry-run God Mode final answer stub for ${scenario.scenarioId}.`,
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
    "# Phase326F God Mode Dry-Run Report",
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
      `- pipelineSteps: ${item.pipelineExecuted.length}`,
      `- finalAnswerStub: ${item.finalAnswerStub}`,
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
      phase: "Phase326F",
      mode: "preview",
      runtimeStatus: "dry_run_without_provider_call",
      plannedScenarios: scenarios.map((scenario) => scenario.scenarioId),
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
    };
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  const summary = {
    phase: "Phase326F",
    mode: "god",
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

