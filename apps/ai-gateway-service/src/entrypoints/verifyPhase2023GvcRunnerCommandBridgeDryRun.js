import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConsolePage } from "../ui/consolePage.js";
import { buildRunnerCommandDryRun, buildRunnerCommandDryRunMatrix } from "../gvc/runnerCommandBridgeDryRun.js";
import { readJson, readText } from "./entrypointUtils.js"

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase2023-gvc-runner-command-bridge-dryrun");
const evidenceJsonPath = resolve(evidenceDir, "runner-command-bridge-dryrun-result.json");
const evidenceMdPath = resolve(evidenceDir, "runner-command-bridge-dryrun-result.md");

const checks = [];

function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const bridgePath = resolve(repoRoot, "apps/ai-gateway-service/src/gvc/runnerCommandBridgeDryRun.js");
const panelPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/GvcRunnerDashboardPanel.js");
const consolePagePath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const docsPath = resolve(repoRoot, "docs/phase2023-gvc-runner-command-bridge-dryrun.md");

const bridgeSource = readText(bridgePath);
const panelSource = readText(panelPath);
const consoleSource = readText(consolePagePath);
const rootPackage = readJson(rootPackagePath) ?? {};
const servicePackage = readJson(servicePackagePath) ?? {};
const docs = readText(docsPath);
const html = createConsolePage();
const commandPreviews = buildRunnerCommandDryRunMatrix({
  now: "2026-05-23T00:00:00.000Z",
  currentControl: {
    paused: false,
    stopRequested: false,
    maxTasksPerLoop: 1,
  },
});
const unsupportedPreview = buildRunnerCommandDryRun("restart", {
  now: "2026-05-23T00:00:00.000Z",
});

expect(existsSync(bridgePath), "bridge_module_exists", bridgePath);
expect(bridgeSource.includes("buildRunnerCommandDryRun"), "bridge_exports_builder");
expect(bridgeSource.includes("buildRunnerCommandDryRunMatrix"), "bridge_exports_matrix");
expect(bridgeSource.includes("SUPPORTED_COMMANDS"), "bridge_has_supported_commands");
expect(!bridgeSource.includes("writeFile"), "bridge_no_write_file");
expect(!bridgeSource.includes("spawn(") && !bridgeSource.includes("spawnSync("), "bridge_no_spawn");
expect(!bridgeSource.includes("exec(") && !bridgeSource.includes("execSync("), "bridge_no_exec");
expect(!bridgeSource.includes("kill("), "bridge_no_process_kill");
expect(!/callProvider|ProviderAdapter|providerRuntime|fetch\(/.test(bridgeSource), "bridge_no_provider_runtime_call");

for (const commandIntent of ["pause", "resume", "stop"]) {
  const preview = commandPreviews.find((entry) => entry.commandIntent === commandIntent);
  expect(Boolean(preview), `command_${commandIntent}_preview_exists`);
  expect(preview?.status === "dry-run-preview", `command_${commandIntent}_status_dry_run`, preview?.status);
  expect(preview?.wouldWriteControlFile === true, `command_${commandIntent}_would_write_true`);
  expect(preview?.realWritePerformed === false, `command_${commandIntent}_real_write_false`);
  expect(preview?.processSignalSent === false, `command_${commandIntent}_process_signal_false`);
  expect(preview?.providerCallsMade === false, `command_${commandIntent}_provider_false`);
  expect(preview?.secretRead === false, `command_${commandIntent}_secret_false`);
  expect(preview?.deployExecuted === false, `command_${commandIntent}_deploy_false`);
  expect(preview?.chatModified === false, `command_${commandIntent}_chat_false`);
  expect(preview?.chatGatewayExecuteModified === false, `command_${commandIntent}_chat_gateway_execute_false`);
  expect(preview?.legacyModified === false, `command_${commandIntent}_legacy_false`);
  expect(preview?.projectContextModified === false, `command_${commandIntent}_project_context_false`);
}

const pausePreview = commandPreviews.find((entry) => entry.commandIntent === "pause");
const resumePreview = commandPreviews.find((entry) => entry.commandIntent === "resume");
const stopPreview = commandPreviews.find((entry) => entry.commandIntent === "stop");
expect(pausePreview?.targetControlPatch?.paused === true, "pause_targets_paused_true");
expect(pausePreview?.targetControlPatch?.stopRequested === false, "pause_targets_stop_false");
expect(resumePreview?.targetControlPatch?.paused === false, "resume_targets_paused_false");
expect(resumePreview?.targetControlPatch?.stopRequested === false, "resume_targets_stop_false");
expect(stopPreview?.targetControlPatch?.stopRequested === true, "stop_targets_stop_true");
expect(unsupportedPreview.status === "rejected", "unsupported_command_rejected");
expect(unsupportedPreview.wouldWriteControlFile === false, "unsupported_command_no_write");

expect(panelSource.includes("buildRunnerCommandDryRunMatrix"), "panel_uses_bridge_matrix");
expect(panelSource.includes("data-phase2023-gvc-runner-command-bridge"), "panel_phase2023_marker");
expect(panelSource.includes("data-gvc-runner-command-bridge-dry-run"), "panel_dry_run_marker");
expect(panelSource.includes('data-gvc-runner-command-intent="pause"'), "panel_pause_button");
expect(panelSource.includes('data-gvc-runner-command-intent="resume"'), "panel_resume_button");
expect(panelSource.includes('data-gvc-runner-command-intent="stop"'), "panel_stop_button");
expect(panelSource.includes("gvc-runner-command-preview-result"), "panel_preview_result");
expect(panelSource.includes("realWritePerformed=false"), "panel_real_write_false_visible");
expect(panelSource.includes("processSignalSent=false"), "panel_process_signal_false_visible");
expect(panelSource.includes("providerCallsMade=false"), "panel_provider_false_visible");
expect(!panelSource.includes("writeFile"), "panel_no_write_file");
expect(!panelSource.includes("spawnSync("), "panel_no_spawn");

expect(consoleSource.includes("showGvcRunnerCommandPreview"), "console_has_preview_handler");
expect(consoleSource.includes("data-gvc-runner-command-intent"), "console_delegates_command_click");
expect(consoleSource.includes("未写控制文件"), "console_user_copy_no_control_write");
expect(consoleSource.includes("未停止进程"), "console_user_copy_no_process_stop");
expect(!consoleSource.includes("/gvc/runner-command"), "console_no_command_api_call");

expect(html.includes('data-phase2023-gvc-runner-command-bridge="true"'), "html_phase2023_marker");
expect(html.includes('data-gvc-runner-command-bridge-dry-run="true"'), "html_dry_run_marker");
expect(html.includes('id="gvc-runner-command-bridge-dry-run-panel"'), "html_command_panel");
expect(html.includes('data-gvc-runner-command-intent="pause"'), "html_pause_button");
expect(html.includes('data-gvc-runner-command-intent="resume"'), "html_resume_button");
expect(html.includes('data-gvc-runner-command-intent="stop"'), "html_stop_button");
expect(html.includes('id="gvc-runner-command-preview-result"'), "html_preview_result");
expect(html.includes("realWritePerformed=false"), "html_real_write_false");
expect(html.includes("processSignalSent=false"), "html_process_signal_false");
expect(html.includes("wouldWriteControlFile=true"), "html_would_write_control_file");
expect(!html.includes("realWritePerformed=true"), "html_no_real_write_true");

expect(existsSync(docsPath), "docs_exists", docsPath);
expect(docs.includes("Phase2023-GVC-Runner-Command-Bridge-DryRun"), "docs_phase_title");
expect(docs.includes("dry-run command bridge"), "docs_dry_run_bridge");
expect(docs.includes("不真实写控制文件"), "docs_no_real_control_write");
expect(docs.includes("不真实停止 runner"), "docs_no_real_runner_stop");
expect(docs.includes("realWritePerformed=false"), "docs_real_write_false");

expect(rootPackage.scripts?.["verify:phase2023-gvc-runner-command-bridge-dryrun"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase2023-gvc-runner-command-bridge-dryrun", "root_verify_script");
expect(servicePackage.scripts?.["verify:phase2023-gvc-runner-command-bridge-dryrun"] === "node ./src/entrypoints/verifyPhase2023GvcRunnerCommandBridgeDryRun.js", "service_verify_script");

const failedChecks = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2023-GVC-Runner-Command-Bridge-DryRun",
  status: failedChecks.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  commandBridgeDryRun: true,
  uiCommandPreviewAdded: failedChecks.length === 0,
  commandIntentsCovered: commandPreviews.map((entry) => entry.commandIntent),
  commandPreviews,
  unsupportedPreview,
  wouldWriteControlFile: commandPreviews.every((entry) => entry.wouldWriteControlFile === true),
  realWritePerformed: false,
  processSignalSent: false,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  backgroundServiceRegistered: false,
  startupAutoRunRegistered: false,
  recommendedSealed: failedChecks.length === 0,
  blocker: failedChecks.length === 0 ? "none" : failedChecks.map((item) => item.id).join(", "),
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(result), "utf8");

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  checksFailed: failedChecks.length,
  commandIntentsCovered: result.commandIntentsCovered,
  realWritePerformed: result.realWritePerformed,
  processSignalSent: result.processSignalSent,
  providerCallsMade: result.providerCallsMade,
  secretRead: result.secretRead,
  deployExecuted: result.deployExecuted,
}, null, 2));

if (failedChecks.length > 0) {
  process.exitCode = 1;
}



function renderMarkdown(data) {
  return [
    "# Phase2023 GVC Runner Command Bridge DryRun",
    "",
    `- status: ${data.status}`,
    `- blocker: ${data.blocker}`,
    `- commandBridgeDryRun: ${data.commandBridgeDryRun}`,
    `- commandIntentsCovered: ${data.commandIntentsCovered.join(", ")}`,
    `- wouldWriteControlFile: ${data.wouldWriteControlFile}`,
    `- realWritePerformed: ${data.realWritePerformed}`,
    `- processSignalSent: ${data.processSignalSent}`,
    `- providerCallsMade: ${data.providerCallsMade}`,
    `- secretRead: ${data.secretRead}`,
    `- deployExecuted: ${data.deployExecuted}`,
    `- chatGatewayExecuteModified: ${data.chatGatewayExecuteModified}`,
    `- recommendedSealed: ${data.recommendedSealed}`,
    "",
  ].join("\n");
}
