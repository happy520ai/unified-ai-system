import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const inputPath = path.join(repoRoot, "docs", "phase326j-capability-index-inputs.json");
const resultPath = path.join(repoRoot, "docs", "phase326j-capability-index-result.json");
const reportPath = path.join(repoRoot, "docs", "phase326j-capability-index-report.md");

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

function inferScores(hint) {
  const lower = String(hint).toLowerCase();
  return {
    coding: lower.includes("coding") ? 0.92 : 0.4,
    reasoning: lower.includes("reasoning") || lower.includes("supervisor") ? 0.9 : 0.55,
    writing: lower.includes("writing") ? 0.9 : 0.55,
    translation: 0.3,
    dataAnalysis: lower.includes("data") ? 0.9 : 0.35,
    longContext: lower.includes("long") ? 0.92 : 0.45,
    toolUse: 0.45,
    planning: lower.includes("reasoning") ? 0.85 : 0.5,
    research: lower.includes("long") || lower.includes("reasoning") ? 0.78 : 0.45,
    structuredOutput: lower.includes("structured") ? 0.88 : 0.5,
    multimodal: 0.2,
  };
}

function buildIndexItem(model, governance, signal) {
  return {
    modelId: model.modelId,
    providerId: model.providerId,
    credentialRef: model.credentialRef,
    capabilityScores: inferScores(model.modelNameHint),
    constraints: {
      contextWindow: model.modelNameHint.includes("long") ? 128000 : 16000,
      supportsStreaming: true,
      supportsTools: model.modelNameHint.includes("tool"),
    },
    qualitySignals: {
      historicalSuccessRate: signal?.historicalSuccessRate ?? null,
      averageLatencyMs: signal?.averageLatencyMs ?? null,
      availabilityScore: governance.providerEnabled ? 1 : 0,
    },
    governance,
    allowedModes: {
      normal: governance.allowedForNormalMode,
      god: governance.allowedForGodMode,
      tianshu: governance.allowedForTianshuMode,
    },
    indexConfidence: signal ? "medium" : "low",
    indexSource: ["mock_inventory", "user_config_stub", "model_id_heuristic"],
    inference: true,
  };
}

function renderReport(summary) {
  return [
    "# Phase326J Tianshu Capability Index Builder Report",
    "",
    `- modelsIndexed: ${summary.modelsIndexed}`,
    `- rejectedModels: ${summary.rejectedModels.length}`,
    `- providerCallsMade: ${summary.providerCallsMade}`,
    `- nonNvidiaProviderCallsMade: ${summary.nonNvidiaProviderCallsMade}`,
    `- secretValueExposed: ${summary.secretValueExposed}`,
    "",
    "## Indexed Models",
    "",
    ...summary.capabilityIndex.map((item) => `- ${item.modelId}: ${item.indexConfidence}, source=${item.indexSource.join("+")}`),
    "",
    "## Rejected Models",
    "",
    ...(summary.rejectedModels.length ? summary.rejectedModels.map((item) => `- ${item.modelId}: ${item.reason}`) : ["- none"]),
    "",
  ].join("\n");
}

async function main() {
  const mode = parseMode();
  const input = await readJson(inputPath);
  const models = input.mockUserConfiguredModels ?? [];
  if (mode === "preview") {
    console.log(JSON.stringify({
      phase: "Phase326J",
      mode: "preview",
      plannedModels: models.map((model) => model.modelId),
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
    }, null, 2));
    return;
  }
  const capabilityIndex = [];
  const rejectedModels = [];
  for (const model of models) {
    const governance = input.mockGovernanceStatus?.[model.modelId];
    const signal = input.optionalEvidenceSignals?.[model.modelId];
    if (!governance?.userConfigured || !governance?.credentialRefPresent || !governance?.providerEnabled || governance.failed || governance.highRisk) {
      rejectedModels.push({ modelId: model.modelId, reason: "governance_or_credential_rejected" });
      continue;
    }
    capabilityIndex.push(buildIndexItem(model, governance, signal));
  }
  const summary = {
    phase: "Phase326J",
    mode: "tianshu",
    runtimeStatus: "dry_run_without_provider_call",
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    modelsIndexed: capabilityIndex.length,
    capabilityIndex,
    rejectedModels,
    auditTrace: {
      providerCallsMade: false,
      nonNvidiaProviderCallsMade: false,
      secretValueExposed: false,
      runtimeStage: "dry_run_without_provider_call",
      indexSources: ["mock_inventory", "evidence_metadata", "model_id_heuristic", "user_config_stub"],
    },
  };
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `${renderReport(summary)}\n`, "utf8");
  console.log(JSON.stringify({
    phase: summary.phase,
    modelsIndexed: summary.modelsIndexed,
    rejectedModels: summary.rejectedModels.length,
    providerCallsMade: summary.providerCallsMade,
    nonNvidiaProviderCallsMade: summary.nonNvidiaProviderCallsMade,
    secretValueExposed: summary.secretValueExposed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

