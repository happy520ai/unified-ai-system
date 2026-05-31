import { existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  has,
  p,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  previousEvidence: "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json",
  runner: "tools/phase1886a/run-owner-os-file-action-visual-smoke.mjs",
  verifier: "tools/phase1886a/validate-owner-os-file-action-visual-smoke.mjs",
  docs: "docs/automation/phase1886a-owner-os-file-action-visual-smoke.md",
  evidence: "apps/ai-gateway-service/evidence/phase1886a-owner-os-file-action-visual-smoke.json",
  screenshotDir: "apps/ai-gateway-service/evidence/phase1886a/screenshots",
  screenshot: "apps/ai-gateway-service/evidence/phase1886a/screenshots/owner-os-file-action-result.png",
  domSnapshot: "apps/ai-gateway-service/evidence/phase1886a/owner-os-file-action-result.html",
  packageJson: "package.json",
};

const runScriptName = "smoke:phase1886a-owner-os-file-action-visual-smoke";
const runScriptCommand = "node tools/phase1886a/run-owner-os-file-action-visual-smoke.mjs";
const verifyScriptName = "verify:phase1886a-owner-os-file-action-visual-smoke";
const verifyScriptCommand = "node tools/phase1886a/validate-owner-os-file-action-visual-smoke.mjs";

const previousEvidence = readJson(paths.previousEvidence);
const evidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const runnerText = readText(paths.runner);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const evidenceText = readText(paths.evidence);
const domText = readText(paths.domSnapshot);
const combinedText = [runnerText, verifierText, docsText, evidenceText, domText].join("\n");
const data = evidence.data ?? {};
const phase1885 = previousEvidence.data ?? {};
const expectedFilePath = phase1885.displayedFilePath ?? "";
const expectedBossLine = `今天小天为你创建了桌面表格：${expectedFilePath}。`;
const scripts = packageJson.data?.scripts ?? {};

function fileExists(relativePath) {
  return existsSync(p(relativePath));
}

function fileSize(relativePath) {
  return fileExists(relativePath) ? statSync(p(relativePath)).size : 0;
}

const previousPhaseReady =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  phase1885.completed === true &&
  phase1885.recommended_sealed === true &&
  phase1885.blocker === null &&
  phase1885.ownerOsShowsFileActionResult === true &&
  phase1885.bossDailyReportIncludesFileAction === true &&
  phase1885.createdFilePathVisible === true &&
  typeof expectedFilePath === "string" &&
  expectedFilePath.length > 0;

const packageScriptsPresent =
  scripts[runScriptName] === runScriptCommand && scripts[verifyScriptName] === verifyScriptCommand;

const checks = [
  check("previous_phase_ready", previousPhaseReady),
  check("runner_exists", has(runnerText, "Phase1886A") && has(runnerText, "data-owner-automation-result-card")),
  check("verifier_exists", has(verifierText, "Phase1886A") && has(verifierText, "fileActionResultCardVisible")),
  check("docs_exists", has(docsText, "Phase1886A") && has(docsText, "Owner OS File Action Result Visual Smoke")),
  check("evidence_exists", evidence.exists === true && !evidence.parseErrorReason),
  check("package_scripts_present", packageScriptsPresent),
  check("completed_true", data.completed === true),
  check("recommended_sealed_true", data.recommended_sealed === true),
  check("blocker_null", data.blocker === null),
  check("owner_os_opened", data.ownerOsOpened === true),
  check("ui_opened", data.uiOpened === true),
  check("file_action_result_card_visible", data.fileActionResultCardVisible === true),
  check("created_file_path_visible", data.createdFilePathVisible === true && data.displayedFilePath === expectedFilePath),
  check("file_opened_status_visible", data.fileOpenedStatusVisible === true),
  check("no_overwrite_status_visible", data.noOverwriteStatusVisible === true),
  check("evidence_link_visible", data.evidenceLinkVisible === true),
  check("boss_daily_report_file_action_visible", data.bossDailyReportFileActionVisible === true),
  check("desktop_file_list_visible_false", data.desktopFileListVisible === false),
  check("bulk_file_action_visible_false", data.bulkFileActionVisible === false),
  check("new_file_created_false", data.newFileCreated === false),
  check("desktop_scan_performed_false", data.desktopScanPerformed === false),
  check("desktop_other_files_read_false", data.desktopOtherFilesRead === false),
  check("screenshot_created", data.screenshotPath === paths.screenshot && fileExists(paths.screenshot) && fileSize(paths.screenshot) > 0),
  check("screenshot_png", extname(paths.screenshot).toLowerCase() === ".png"),
  check("dom_snapshot_created", data.domSnapshotPath === paths.domSnapshot && fileExists(paths.domSnapshot) && fileSize(paths.domSnapshot) > 0),
  check("dom_contains_owner_os", domText.includes('data-owner-os-shell="true"')),
  check("dom_contains_file_action_card", domText.includes('data-owner-automation-result-card="true"')),
  check("dom_contains_expected_file_path", domText.includes(expectedFilePath)),
  check("dom_contains_file_opened_status", domText.includes("状态：已创建，并已尝试自动打开")),
  check("dom_contains_no_overwrite_status", domText.includes("安全：没有覆盖已有文件，没有读取桌面其他文件")),
  check("dom_contains_boss_daily_line", domText.includes(expectedBossLine)),
  check("dom_does_not_contain_desktop_file_list", !/data-desktop-file-list|desktop-file-list|桌面文件列表/.test(domText)),
  check("dom_does_not_contain_bulk_file_action", !/data-bulk-file-action|bulk-file-action|批量文件|批量创建|批量操作/.test(domText)),
  check("provider_calls_made_false", data.providerCallsMade === false),
  check("raw_secret_read_false", data.rawSecretRead === false),
  check("auth_json_read_false", data.authJsonRead === false),
  check("raw_credential_ref_read_false", data.rawCredentialRefRead === false),
  check("legacy_modified_false", data.legacyModified === false),
  check("legacy_scripts_executed_false", data.legacyScriptsExecuted === false),
  check("chat_modified_false", data.chatModified === false),
  check("chat_gateway_execute_modified_false", data.chatGatewayExecuteModified === false),
  check("deploy_executed_false", data.deployExecuted === false),
  check("release_executed_false", data.releaseExecuted === false),
  check("tag_created_false", data.tagCreated === false),
  check("artifact_uploaded_false", data.artifactUploaded === false),
  check("push_executed_false", data.pushExecuted === false),
  check("commit_created_false", data.commitCreated === false),
  check("production_ready_claimed_false", data.productionReadyClaimed === false),
  check("workspace_clean_claimed_false", data.workspaceCleanClaimed === false),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1886A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseReady,
  ownerOsOpened: data.ownerOsOpened === true,
  fileActionResultCardVisible: data.fileActionResultCardVisible === true,
  displayedFilePath: data.displayedFilePath ?? null,
  fileOpenedStatusVisible: data.fileOpenedStatusVisible === true,
  noOverwriteStatusVisible: data.noOverwriteStatusVisible === true,
  evidenceLinkVisible: data.evidenceLinkVisible === true,
  bossDailyReportFileActionVisible: data.bossDailyReportFileActionVisible === true,
  desktopFileListVisible: data.desktopFileListVisible === true,
  bulkFileActionVisible: data.bulkFileActionVisible === true,
  newFileCreated: data.newFileCreated === true,
  screenshotPath: data.screenshotPath ?? paths.screenshot,
  screenshotsPath: paths.screenshotDir,
  evidencePath: paths.evidence,
  packageScriptsPresent,
  ...safetyBoundary(),
  providerCallsMade: data.providerCallsMade === false ? false : data.providerCallsMade,
  rawSecretRead: data.rawSecretRead === false ? false : data.rawSecretRead,
  authJsonRead: data.authJsonRead === false ? false : data.authJsonRead,
  rawCredentialRefRead: data.rawCredentialRefRead === false ? false : data.rawCredentialRefRead,
  legacyModified: data.legacyModified === false ? false : data.legacyModified,
  legacyScriptsExecuted: data.legacyScriptsExecuted === false ? false : data.legacyScriptsExecuted,
  chatModified: data.chatModified === false ? false : data.chatModified,
  chatGatewayExecuteModified: data.chatGatewayExecuteModified === false ? false : data.chatGatewayExecuteModified,
  deployExecuted: data.deployExecuted === false ? false : data.deployExecuted,
};

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase1886a_owner_os_file_action_visual_smoke_failed:${failed.join(",")}`;
}

result.checks = checks;
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
