import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const scenarioPath = path.join(repoRoot, "docs", "phase326i-participant-selector-scenarios.json");
const resultPath = path.join(repoRoot, "docs", "phase326i-participant-selector-result.json");
const reportPath = path.join(repoRoot, "docs", "phase326i-participant-selector-report.md");

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

function scoreModel(model) {
  const caps = model.capabilities ?? {};
  const latencyBonus = model.latencyTier === "fast" ? 0.1 : model.latencyTier === "normal" ? 0.05 : 0;
  const costBonus = model.costTier === "low" ? 0.1 : model.costTier === "medium" ? 0.05 : 0;
  return Number((
    ((caps.coding ?? 0) * 0.15)
    + ((caps.reasoning ?? 0) * 0.2)
    + ((caps.critique ?? 0) * 0.2)
    + ((caps.safety ?? 0) * 0.15)
    + ((model.reliabilityScore ?? 0) * 0.2)
    + latencyBonus
    + costBonus
  ).toFixed(4));
}

function roleFor(index, model) {
  if (index === 0) return "primary_responder";
  if ((model.capabilities?.safety ?? 0) >= 0.85) return "safety_guard";
  if ((model.capabilities?.critique ?? 0) >= 0.85) return "critic";
  return index === 2 ? "supervisor" : "fact_checker";
}

function processScenario(scenario) {
  const rejectedCandidates = [];
  const eligible = [];
  for (const model of scenario.candidateModels ?? []) {
    const reasons = [];
    if (!model.credentialRefPresent) reasons.push("credential_missing");
    if (!model.providerEnabled) reasons.push("provider_disabled");
    if (model.highRisk) reasons.push("high_risk_not_eligible");
    if (reasons.length) rejectedCandidates.push({ modelId: model.modelId, reasons });
    else eligible.push({ ...model, score: scoreModel(model) });
  }
  const selected = eligible.sort((a, b) => b.score - a.score).slice(0, 5);
  if (selected.length < 2) {
    return {
      scenarioId: scenario.scenarioId,
      selectedParticipants: [],
      assignedRoles: [],
      rejectedCandidates,
      scoringBreakdown: selected.map((model) => ({ modelId: model.modelId, score: model.score })),
      finalSelectionReason: "insufficient_eligible_participants",
      auditTrace: {
        providerCallsMade: false,
        nonNvidiaProviderCallsMade: false,
        secretValueExposed: false,
        runtimeStage: "dry_run_without_provider_call",
      },
    };
  }
  const assignedRoles = selected.map((model, index) => ({ modelId: model.modelId, role: roleFor(index, model) }));
  if (!assignedRoles.some((item) => item.role === "supervisor")) {
    assignedRoles[assignedRoles.length - 1].role = "supervisor";
  }
  return {
    scenarioId: scenario.scenarioId,
    selectedParticipants: selected.map((model) => model.modelId),
    assignedRoles,
    rejectedCandidates,
    scoringBreakdown: selected.map((model) => ({
      modelId: model.modelId,
      score: model.score,
      capabilityFit: model.capabilities,
      reliabilityScore: model.reliabilityScore,
      latencyTier: model.latencyTier,
      costTier: model.costTier,
      governanceStatus: "mock_allowed",
    })),
    finalSelectionReason: "selected highest-scoring eligible mock participants with role coverage",
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
    "# Phase326I God Mode Participant Selector Report",
    "",
    `- scenariosProcessed: ${summary.scenariosProcessed}`,
    `- providerCallsMade: ${summary.providerCallsMade}`,
    `- nonNvidiaProviderCallsMade: ${summary.nonNvidiaProviderCallsMade}`,
    `- secretValueExposed: ${summary.secretValueExposed}`,
    "",
    ...summary.results.flatMap((item) => [
      `## ${item.scenarioId}`,
      "",
      `- selectedParticipants: ${item.selectedParticipants.join(", ") || "none"}`,
      `- finalSelectionReason: ${item.finalSelectionReason}`,
      "",
    ]),
  ].join("\n");
}

async function main() {
  const mode = parseMode();
  const file = await readJson(scenarioPath);
  const scenarios = file.scenarios ?? [];
  for (const scenario of scenarios) {
    assert(scenario.mode === "god", `${scenario.scenarioId} mode must be god`);
    assert(scenario.providerCallsAllowed === false, `${scenario.scenarioId} provider calls must be false`);
    assert(scenario.nonNvidiaProviderCallsAllowed === false, `${scenario.scenarioId} non-NVIDIA calls must be false`);
    assert(scenario.secretValueAllowed === false, `${scenario.scenarioId} secret values must be false`);
  }
  if (mode === "preview") {
    console.log(JSON.stringify({
      phase: "Phase326I",
      mode: "preview",
      plannedScenarios: scenarios.map((scenario) => scenario.scenarioId),
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
    }, null, 2));
    return;
  }
  const summary = {
    phase: "Phase326I",
    mode: "god",
    runtimeStatus: "dry_run_without_provider_call",
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    scenariosProcessed: scenarios.length,
    results: scenarios.map(processScenario),
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

