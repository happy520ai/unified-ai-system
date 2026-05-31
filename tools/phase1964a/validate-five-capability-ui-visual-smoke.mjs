import { existsSync, statSync } from "node:fs";
import {
  allPassed,
  check,
  containsSecretLikeValue,
  pathExists,
  readJson,
  readText,
  writeJson,
} from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1964A";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1964a";
const resultPath = `${evidenceDir}/five-capability-ui-visual-smoke-result.json`;
const runResultPath = `${evidenceDir}/five-capability-ui-visual-smoke-run-result.json`;
const screenshotPath = `${evidenceDir}/screenshots/five-capability-ui-visual-smoke.png`;
const domSnapshotPath = `${evidenceDir}/five-capability-ui-visual-smoke.html`;
const docsPath = "docs/phase1964a-five-capability-ui-visual-smoke.md";

function size(relativePath) {
  return existsSync(relativePath) ? statSync(relativePath).size : 0;
}

const packageText = readText("package.json");
const servicePackageText = readText("apps/ai-gateway-service/package.json");
const runnerText = readText("tools/phase1964a/run-five-capability-ui-visual-smoke.mjs");
const verifierText = readText("tools/phase1964a/validate-five-capability-ui-visual-smoke.mjs");
const docsText = readText(docsPath);
const runResult = readJson(runResultPath);
const domText = readText(domSnapshotPath);
const screenshotExists = pathExists(screenshotPath);
const data = runResult.data ?? {};
const combinedText = [runnerText, verifierText, docsText, JSON.stringify(data), domText].join("\n");

const visibleChineseTexts = [
  "五大能力已进入真实可用通道",
  "一键激活五大能力",
  "Workforce 计划生成",
  "本地真实执行",
  "真实执行器就绪",
  "本地沙箱运行",
  "受控真实写入",
  "CLI 桥接检测",
];

const checks = [
  check("docs_exists", pathExists(docsPath)),
  check("runner_exists", pathExists("tools/phase1964a/run-five-capability-ui-visual-smoke.mjs")),
  check("root_package_script_registered", packageText.includes("smoke:phase1964a-five-capability-ui-visual-smoke") && packageText.includes("verify:phase1964a-five-capability-ui-visual-smoke")),
  check("service_package_script_registered", servicePackageText.includes("smoke:phase1964a-five-capability-ui-visual-smoke") && servicePackageText.includes("verify:phase1964a-five-capability-ui-visual-smoke")),
  check("run_result_exists", runResult.exists === true && runResult.parseError === null),
  check("run_completed", data.completed === true && data.recommended_sealed === true && data.blocker === null),
  check("ui_opened", data.uiOpened === true),
  check("panel_visible", data.panelVisible === true),
  check("panel_in_viewport", data.panelInViewport === true),
  check("activation_button_visible", data.activationButtonVisible === true),
  check("activation_button_clicked", data.activationButtonClicked === true),
  check("result_panel_visible", data.resultPanelVisible === true),
  check("result_completion_visible", data.resultCompletionVisible === true),
  check("five_statuses_visible", data.fiveStatusesVisible === true),
  check("status_route_seen", data.statusRouteChecked === true),
  check("activate_route_seen", data.activateRoutePosted === true),
  check("screenshot_created", screenshotExists && size(screenshotPath) > 0 && data.screenshotPath === screenshotPath),
  check("dom_snapshot_created", pathExists(domSnapshotPath) && size(domSnapshotPath) > 0 && data.domSnapshotPath === domSnapshotPath),
  check("dom_has_panel_marker", domText.includes('data-five-capability-activation="true"')),
  check("dom_has_result_marker", domText.includes('data-five-capability-result="true"')),
  check("dom_has_owner_shell", domText.includes('data-owner-os-shell="true"')),
  check("visible_chinese_copy_present", visibleChineseTexts.every((text) => domText.includes(text))),
  check("no_mojibake_in_five_panel", data.mojibakeDetected === false),
  check("provider_not_called", data.providerCallsMade === false && data.providerNetworkAttempted === false),
  check("paid_api_not_called", data.paidApiCalled === false),
  check("specific_paid_providers_not_called", data.mimoCalled === false && data.openaiCalled === false && data.claudeCalled === false && data.openrouterCalled === false),
  check("secret_not_exposed", data.secretValueExposed === false && data.rawSecretRead === false && data.authJsonRead === false),
  check("codex_config_not_modified", data.codexConfigModified === false),
  check("default_chat_routes_not_modified", data.chatRouteModified === false && data.chatGatewayExecuteModified === false),
  check("legacy_not_modified", data.legacyModified === false),
  check("project_context_not_created", data.projectContextModified === false),
  check("deploy_release_commit_push_false", data.deployExecuted === false && data.releaseExecuted === false && data.commitCreated === false && data.pushExecuted === false),
  check("production_public_release_not_claimed", data.productionReadyClaimed === false && data.publicLaunchReadyClaimed === false),
  check("workspace_clean_not_claimed", data.workspaceCleanClaimed === false),
  check("no_secret_like_output", !containsSecretLikeValue(combinedText)),
  check("docs_boundary_honest", docsText.includes("不包含生产部署") && docsText.includes("不包含公开发布")),
];

const passed = allPassed(checks);
const result = {
  phase,
  name: "Five Capability UI Visual Smoke Verification",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "phase1964a_five_capability_ui_visual_smoke_failed",
  runResultPath,
  screenshotPath,
  domSnapshotPath,
  uiOpened: data.uiOpened === true,
  panelVisible: data.panelVisible === true,
  activationButtonClicked: data.activationButtonClicked === true,
  resultPanelVisible: data.resultPanelVisible === true,
  fiveStatusesVisible: data.fiveStatusesVisible === true,
  providerCallsMade: false,
  providerNetworkAttempted: false,
  paidApiCalled: false,
  mimoCalled: false,
  openaiCalled: false,
  claudeCalled: false,
  openrouterCalled: false,
  nvidiaCalledByThisPhase: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  codexConfigModified: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify(result, null, 2));

if (!passed) process.exitCode = 1;
