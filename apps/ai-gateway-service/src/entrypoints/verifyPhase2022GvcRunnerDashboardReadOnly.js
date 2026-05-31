import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConsolePage } from "../ui/consolePage.js";
import { buildGvcRunnerDashboardSnapshot } from "../ui/components/GvcRunnerDashboardPanel.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase2022-gvc-runner-dashboard-readonly");
const evidenceJsonPath = resolve(evidenceDir, "runner-dashboard-readonly-result.json");
const evidenceMdPath = resolve(evidenceDir, "runner-dashboard-readonly-result.md");

const checks = [];

function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const componentPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/GvcRunnerDashboardPanel.js");
const missionPanelPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const docsPath = resolve(repoRoot, "docs/phase2022-gvc-runner-dashboard-readonly.md");
const statePath = resolve(repoRoot, "docs/project-brain/timed-runner-state.json");
const controlPath = resolve(repoRoot, "docs/project-brain/runner-control.json");
const historyPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/gvc-execution-history.json");

const componentSource = readText(componentPath);
const missionSource = readText(missionPanelPath);
const rootPackage = readJson(rootPackagePath) ?? {};
const servicePackage = readJson(servicePackagePath) ?? {};
const docs = readText(docsPath);
const html = createConsolePage();
const snapshot = buildGvcRunnerDashboardSnapshot();

expect(existsSync(componentPath), "component_exists", componentPath);
expect(componentSource.includes("buildGvcRunnerDashboardSnapshot"), "component_exports_snapshot_builder");
expect(componentSource.includes("renderGvcRunnerDashboardPanel"), "component_exports_renderer");
expect(componentSource.includes("docs/project-brain/timed-runner-state.json"), "component_reads_timed_runner_state");
expect(componentSource.includes("docs/project-brain/runner-control.json"), "component_reads_runner_control");
expect(componentSource.includes("gvc-execution-history.json"), "component_reads_execution_history");
expect(componentSource.includes("phase2021-gvc-owner-control-panel/runner-control-result.json"), "component_reads_latest_control_evidence");
expect(!componentSource.includes("spawnSync("), "component_no_spawn");
expect(!componentSource.includes("writeFile"), "component_no_write_file");
expect(!componentSource.includes("provider_call"), "component_no_provider_call_operation");

expect(missionSource.includes("renderGvcRunnerDashboardPanel"), "mission_imports_dashboard_panel");
expect(missionSource.includes("data-phase2022-gvc-runner-dashboard"), "mission_contains_phase2022_marker");

expect(html.includes('id="gvc-runner-dashboard-readonly-panel"'), "html_panel_id");
expect(html.includes('data-phase2022-gvc-runner-dashboard="true"'), "html_phase_marker");
expect(html.includes('data-gvc-runner-readonly="true"'), "html_readonly_marker");
expect(html.includes("runner 是否运行"), "html_running_label");
expect(html.includes("当前是否 paused"), "html_paused_label");
expect(html.includes("今日 loop 次数"), "html_loop_count_label");
expect(html.includes("最近执行任务"), "html_recent_task_label");
expect(html.includes("最近 blocker"), "html_blocker_label");
expect(html.includes("skipped approval_required"), "html_skipped_approval_label");
expect(html.includes("safety flags"), "html_safety_flags_label");
expect(html.includes("evidence 路径"), "html_evidence_path_label");
expect(!/data-gvc-runner-action|start runner|stop runner|pause runner|resume runner|真实启动|真实停止/i.test(html), "html_no_execution_buttons");

expect(snapshot.phaseId === "Phase2022-GVC-Runner-Dashboard-ReadOnly", "snapshot_phase_id", snapshot.phaseId);
expect(snapshot.readOnly === true, "snapshot_readonly_true");
expect(snapshot.stateSource === "docs/project-brain/timed-runner-state.json", "snapshot_state_source", snapshot.stateSource);
expect(snapshot.controlSource === "docs/project-brain/runner-control.json", "snapshot_control_source", snapshot.controlSource);
expect(snapshot.executionHistorySource === "apps/ai-gateway-service/evidence/gvc-execution-history.json", "snapshot_history_source", snapshot.executionHistorySource);
expect(typeof snapshot.runnerRunning === "boolean", "snapshot_runner_running_boolean");
expect(typeof snapshot.paused === "boolean", "snapshot_paused_boolean");
expect(Number.isInteger(snapshot.loopsCompletedToday), "snapshot_loop_count_integer");
expect(typeof snapshot.lastSelectedTaskId === "string" || snapshot.lastSelectedTaskId === null, "snapshot_recent_task_present");
expect(typeof snapshot.currentBlocker === "string", "snapshot_blocker_present");
expect(Array.isArray(snapshot.skippedApprovalRequiredTasks), "snapshot_skipped_approval_array");
expect(snapshot.safetyFlags?.noProvider === true, "snapshot_no_provider_true");
expect(snapshot.safetyFlags?.noSecret === true, "snapshot_no_secret_true");
expect(snapshot.safetyFlags?.noDeploy === true, "snapshot_no_deploy_true");
expect(snapshot.safetyFlags?.dryRunOnly === true, "snapshot_dry_run_only_true");
expect(snapshot.providerCallsMade === false, "snapshot_provider_calls_false");
expect(snapshot.secretRead === false, "snapshot_secret_read_false");
expect(snapshot.deployExecuted === false, "snapshot_deploy_false");
expect(snapshot.chatModified === false, "snapshot_chat_modified_false");
expect(snapshot.chatGatewayExecuteModified === false, "snapshot_chat_gateway_execute_false");
expect(snapshot.legacyModified === false, "snapshot_legacy_modified_false");
expect(snapshot.projectContextModified === false, "snapshot_project_context_modified_false");
expect(snapshot.executionActionsExposed === false, "snapshot_no_execution_actions");
expect(Array.isArray(snapshot.evidenceRefs) && snapshot.evidenceRefs.length > 0, "snapshot_evidence_refs_present");

expect(existsSync(statePath), "state_file_exists", statePath);
expect(existsSync(controlPath), "control_file_exists", controlPath);
expect(existsSync(historyPath), "history_file_exists", historyPath);
expect(existsSync(docsPath), "docs_exists", docsPath);
expect(docs.includes("Phase2022-GVC-Runner-Dashboard-ReadOnly"), "docs_phase_title");
expect(docs.includes("只读 UI"), "docs_readonly_boundary");
expect(docs.includes("不新增执行按钮"), "docs_no_exec_buttons");

expect(rootPackage.scripts?.["verify:phase2022-gvc-runner-dashboard-readonly"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase2022-gvc-runner-dashboard-readonly", "root_verify_script");
expect(servicePackage.scripts?.["verify:phase2022-gvc-runner-dashboard-readonly"] === "node ./src/entrypoints/verifyPhase2022GvcRunnerDashboardReadOnly.js", "service_verify_script");

const failedChecks = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2022-GVC-Runner-Dashboard-ReadOnly",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  readOnlyUi: true,
  missionControlPanelAdded: failedChecks.length === 0,
  ownerOsPanelAdded: failedChecks.length === 0,
  normalStateVisible: failedChecks.length === 0,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  executionActionsExposed: false,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((item) => item.id).join(", "),
  snapshot,
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(result), "utf8");

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  checksFailed: failedChecks.length,
  providerCallsMade: result.providerCallsMade,
  secretRead: result.secretRead,
  deployExecuted: result.deployExecuted,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readText(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function renderMarkdown(data) {
  return [
    "# Phase2022 GVC Runner Dashboard ReadOnly",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker}`,
    `- readOnlyUi: ${data.readOnlyUi}`,
    `- missionControlPanelAdded: ${data.missionControlPanelAdded}`,
    `- providerCallsMade: ${data.providerCallsMade}`,
    `- secretRead: ${data.secretRead}`,
    `- deployExecuted: ${data.deployExecuted}`,
    `- chatGatewayExecuteModified: ${data.chatGatewayExecuteModified}`,
    `- recommendedSealed: ${data.recommendedSealed}`,
    "",
  ].join("\n");
}
