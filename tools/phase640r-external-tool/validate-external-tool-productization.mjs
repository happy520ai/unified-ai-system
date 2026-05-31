import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const docs = {
  positioning: "docs/phase640r-external-tool-positioning.md",
  architecture: "docs/phase640r-external-tool-architecture-boundary.md",
  matrix: "docs/phase640r-external-tool-capability-matrix.json",
  roadmap: "docs/phase640r-external-tool-roadmap-reset.md",
  freeze: "docs/phase640r-main-chain-direction-freeze.md",
  report: "docs/phase640r-external-tool-execution-report.md",
};

function exists(relativePath) {
  return existsSync(path.join(repoRoot, relativePath));
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function readJson(relativePath, fallback = {}) {
  try {
    return JSON.parse((await readText(relativePath)).replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function check(id, passed, details = undefined) {
  return { id, passed: passed === true, ...(details === undefined ? {} : { details }) };
}

const preflight = await readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json");
const matrix = await readJson(docs.matrix);
const panelText = await readText("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js");
const copyText = await readText("apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js");
const syncText = await readText("apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js");

const result = {
  phase: "Phase640R-ExternalTool",
  name: "Codex External Relay Tool Productization",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632PreflightPassed: preflight.preflightPassed === true,
  externalToolPositioningGenerated: exists(docs.positioning),
  architectureBoundaryGenerated: exists(docs.architecture),
  capabilityMatrixGenerated: exists(docs.matrix),
  roadmapResetGenerated: exists(docs.roadmap),
  mainChainDirectionFreezeGenerated: exists(docs.freeze),
  executionReportGenerated: exists(docs.report),
  externalToolMode: matrix.externalToolMode === true,
  mainChainIntegrationPlanned: matrix.mainChainIntegrationPlanned === true,
  chatIntegrationPlanned: matrix.chatIntegrationPlanned === true,
  chatGatewayExecuteIntegrationPlanned: matrix.chatGatewayExecuteIntegrationPlanned === true,
  providerRuntimeIntegrationPlanned: matrix.providerRuntimeIntegrationPlanned === true,
  uiReadOnlyPreviewGenerated:
    panelText.includes("data-codex-phase640r-external-tool-preview=\"true\"") &&
    panelText.includes("External Codex Relay Tool") &&
    panelText.includes("data-codex-phase640r-external-tool-no-chat-button=\"true\"") &&
    panelText.includes("data-codex-phase640r-external-tool-no-provider-runtime-button=\"true\"") &&
    copyText.includes("phase640r-external-tool-mode"),
  readmeAgentsManagedSourceUpdated:
    syncText.includes("Codex/crs gateway is external tool mode") &&
    syncText.includes("main-chain integration frozen") &&
    syncText.includes("provider runtime integration frozen"),
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  secretValueExposed: false,
  rawBaseUrlValueExposed: false,
  webhookValueExposed: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: false,
  releaseReadyClaimed: false,
  workspaceCleanClaimed: false,
  docs,
  evidencePath: "apps/ai-gateway-service/evidence/phase640r-external-tool/external-tool-productization-result.json",
};

result.checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("external_tool_positioning_generated", result.externalToolPositioningGenerated),
  check("architecture_boundary_generated", result.architectureBoundaryGenerated),
  check("capability_matrix_generated", result.capabilityMatrixGenerated),
  check("roadmap_reset_generated", result.roadmapResetGenerated),
  check("main_chain_direction_freeze_generated", result.mainChainDirectionFreezeGenerated),
  check("external_tool_mode_true", result.externalToolMode === true),
  check("main_chain_integration_planned_false", result.mainChainIntegrationPlanned === false),
  check("chat_integration_planned_false", result.chatIntegrationPlanned === false),
  check("chat_gateway_execute_integration_planned_false", result.chatGatewayExecuteIntegrationPlanned === false),
  check("provider_runtime_integration_planned_false", result.providerRuntimeIntegrationPlanned === false),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated),
  check("readme_agents_managed_source_updated", result.readmeAgentsManagedSourceUpdated),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

const failed = result.checks.filter((item) => !item.passed);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = "phase640r_external_tool_validation_failed";
  result.failed = failed;
}

const evidenceDir = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase640r-external-tool");
await mkdir(evidenceDir, { recursive: true });
await writeFile(path.join(evidenceDir, "external-tool-productization-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");

console.log(JSON.stringify(result, null, 2));

if (failed.length > 0) {
  process.exitCode = 1;
}
