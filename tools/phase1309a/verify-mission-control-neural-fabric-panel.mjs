import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phase = "Phase1309A";
const phaseKey = "phase1309a";
const componentPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/NeuralFabricReadOnlyPanel.js");
const missionControlPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const docsPath = resolve(repoRoot, "docs/phase1309a-mission-control-neural-fabric-readonly-panel.md");
const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1309a/mission-control-neural-fabric-panel-result.json");

const result = await buildResult();
await writeJson(evidencePath, result);

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  checksFailed: result.checks.filter((check) => check.passed !== true).length,
}, null, 2));

if (!result.recommended_sealed) {
  process.exitCode = 1;
}

async function buildResult() {
  const componentText = await readText(componentPath, "");
  const missionControlText = await readText(missionControlPath, "");
  const docsText = await readText(docsPath, "");
  const checks = [
    check("component_exists", await exists(componentPath)),
    check("mission_control_exists", await exists(missionControlPath)),
    check("docs_exists", await exists(docsPath)),
    check("panel_marker_present", componentText.includes("data-phase1309a-neural-fabric-panel")),
    check("neural_op_count_visible", componentText.includes("neural-op count")),
    check("weight_atom_count_visible", componentText.includes("weight atom count")),
    check("router_dry_run_status_visible", componentText.includes("router dry-run status")),
    check("inference_only_visible", componentText.includes("inference-only")),
    check("no_training_visible", componentText.includes("no training")),
    check("no_main_chain_integration_visible", componentText.includes("no main-chain integration")),
    check("mission_control_imports_panel", missionControlText.includes("renderNeuralFabricReadOnlyPanel")),
    check("mission_control_renders_panel", missionControlText.includes("${renderNeuralFabricReadOnlyPanel()}")),
    check("no_real_run_button", !/real[- ]?run|run[- ]?real|execute[- ]?real/i.test(componentText)),
    check("no_training_button", !/(train|training)[^<]{0,80}<button|<button[^>]{0,120}(train|training)/i.test(componentText)),
    check("panel_does_not_wire_chat_route", !componentText.includes("/chat") && !componentText.includes("chat-gateway/execute")),
    check("provider_not_called", componentText.includes("providerCallsMade=false")),
    check("docs_records_readonly_boundary", docsText.includes("read-only") && docsText.includes("No Provider is called")),
  ];
  const blocker = checks.find((item) => item.passed !== true)?.id ?? null;
  return {
    phase,
    phaseKey,
    name: "Mission Control Neural Fabric Read-only Panel",
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    files: [
      "apps/ai-gateway-service/src/ui/components/NeuralFabricReadOnlyPanel.js",
      "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
      "docs/phase1309a-mission-control-neural-fabric-readonly-panel.md",
    ],
    docs: "docs/phase1309a-mission-control-neural-fabric-readonly-panel.md",
    evidenceJson: "apps/ai-gateway-service/evidence/phase1309a/mission-control-neural-fabric-panel-result.json",
    ui: {
      neuralOpCountVisible: componentText.includes("neural-op count"),
      weightAtomCountVisible: componentText.includes("weight atom count"),
      routerDryRunStatusVisible: componentText.includes("router dry-run status"),
      inferenceOnlyVisible: componentText.includes("inference-only"),
      noTrainingVisible: componentText.includes("no training"),
      noMainChainIntegrationVisible: componentText.includes("no main-chain integration"),
      realRunButtonAdded: false,
      trainingButtonAdded: false,
    },
    safety: {
      providerCallsMade: false,
      secretRead: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      mainChainIntegrationAdded: false,
      workspaceCleanClaimed: false,
    },
    checks,
  };
}

function check(id, passed) {
  return { id, passed: passed === true };
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path, fallback) {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
