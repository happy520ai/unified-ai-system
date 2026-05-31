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
  previousEvidence: "apps/ai-gateway-service/evidence/phase1887a-file-action-copy-polish.json",
  runner: "tools/phase1888a/run-file-action-copy-visual-recheck.mjs",
  verifier: "tools/phase1888a/validate-file-action-copy-visual-recheck.mjs",
  docs: "docs/automation/phase1888a-file-action-copy-visual-recheck.md",
  evidence: "apps/ai-gateway-service/evidence/phase1888a-file-action-copy-visual-recheck.json",
  screenshotDir: "apps/ai-gateway-service/evidence/phase1888a/screenshots",
  screenshot: "apps/ai-gateway-service/evidence/phase1888a/screenshots/file-action-copy-visual-recheck.png",
  domSnapshot: "apps/ai-gateway-service/evidence/phase1888a/file-action-copy-visual-recheck.html",
};

const expected = {
  title: "小天已经帮你建好桌面表格",
  description: "任务表已经放到桌面，可以直接打开继续填写。",
  nextStep: "打开桌面上的表格，继续填写你的任务",
  safety: "没有覆盖已有文件，没有读取桌面其他文件",
  sourceEvidencePath: "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json",
  integrationEvidencePath: "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json",
};

const previousEvidence = readJson(paths.previousEvidence);
const evidence = readJson(paths.evidence);
const previous = previousEvidence.data ?? {};
const data = evidence.data ?? {};
const runnerText = readText(paths.runner);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const evidenceText = readText(paths.evidence);
const domText = readText(paths.domSnapshot);
const combinedText = [runnerText, verifierText, docsText, evidenceText, domText].join("\n");
const displayedFilePath = previous.displayedFilePath ?? data.displayedFilePath ?? "";

function fileExists(relativePath) {
  return existsSync(p(relativePath));
}

function fileSize(relativePath) {
  return fileExists(relativePath) ? statSync(p(relativePath)).size : 0;
}

function extractBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex < 0) return text.slice(startIndex);
  return text.slice(startIndex, endIndex);
}

const cardHtml = extractBetween(domText, 'data-owner-automation-result-card="true"', "</section>");
const beforeAdvancedRecord = cardHtml.split('data-owner-automation-advanced-record="true"')[0] ?? "";
const advancedRecordHtml = cardHtml.includes('data-owner-automation-advanced-record="true"')
  ? cardHtml.slice(cardHtml.indexOf('data-owner-automation-advanced-record="true"'))
  : "";

const previousPhaseReady =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  previous.completed === true &&
  previous.recommended_sealed === true &&
  previous.blocker === null &&
  previous.ownerReadableFileActionCopy === true &&
  previous.nextStepClear === true &&
  previous.filePathAvailableButNotDominant === true &&
  previous.evidenceLinkMovedToAdvancedRecord === true &&
  typeof displayedFilePath === "string" &&
  displayedFilePath.length > 0;

const polishedFileActionCopyVisible =
  domText.includes(expected.title) &&
  domText.includes(expected.description) &&
  domText.includes(expected.nextStep);

const titleVisible = domText.includes(expected.title);
const descriptionVisible = domText.includes(expected.description);
const nextStepVisible = domText.includes(expected.nextStep);
const filePathInAdvancedRecord =
  domText.includes(displayedFilePath) &&
  advancedRecordHtml.includes(displayedFilePath) &&
  !beforeAdvancedRecord.includes(displayedFilePath);
const evidenceInAdvancedRecord =
  advancedRecordHtml.includes(expected.sourceEvidencePath) &&
  advancedRecordHtml.includes(expected.integrationEvidencePath) &&
  !beforeAdvancedRecord.includes(expected.sourceEvidencePath) &&
  !beforeAdvancedRecord.includes(expected.integrationEvidencePath);
const safetyCopyVisible = domText.includes(expected.safety) && beforeAdvancedRecord.includes(expected.safety);

const checks = [
  check("previous_phase_ready", previousPhaseReady),
  check("runner_exists", has(runnerText, "Phase1888A") && has(runnerText, "filePathInAdvancedRecord")),
  check("verifier_exists", has(verifierText, "Phase1888A") && has(verifierText, "polishedFileActionCopyVisible")),
  check("docs_exists", has(docsText, "Phase1888A") && has(docsText, "File Action Copy Visual Recheck")),
  check("evidence_exists", evidence.exists === true && !evidence.parseErrorReason),
  check("completed_true", data.completed === true),
  check("recommended_sealed_true", data.recommended_sealed === true),
  check("blocker_null", data.blocker === null),
  check("owner_os_opened", data.ownerOsOpened === true),
  check("ui_opened", data.uiOpened === true),
  check("polished_file_action_copy_visible", data.polishedFileActionCopyVisible === true && polishedFileActionCopyVisible),
  check("title_visible", data.titleVisible === true && titleVisible),
  check("description_visible", data.descriptionVisible === true && descriptionVisible),
  check("next_step_visible", data.nextStepVisible === true && nextStepVisible),
  check("file_path_in_advanced_record", data.filePathInAdvancedRecord === true && filePathInAdvancedRecord),
  check("evidence_in_advanced_record", data.evidenceInAdvancedRecord === true && evidenceInAdvancedRecord),
  check("safety_copy_visible", data.safetyCopyVisible === true && safetyCopyVisible),
  check("desktop_file_list_visible_false", data.desktopFileListVisible === false),
  check("bulk_file_action_visible_false", data.bulkFileActionVisible === false),
  check("new_file_created_false", data.newFileCreated === false),
  check("desktop_scan_performed_false", data.desktopScanPerformed === false),
  check("desktop_other_files_read_false", data.desktopOtherFilesRead === false),
  check("screenshot_created", data.screenshotPath === paths.screenshot && fileExists(paths.screenshot) && fileSize(paths.screenshot) > 0),
  check("screenshot_png", extname(paths.screenshot).toLowerCase() === ".png"),
  check("dom_snapshot_created", data.domSnapshotPath === paths.domSnapshot && fileExists(paths.domSnapshot) && fileSize(paths.domSnapshot) > 0),
  check("dom_contains_owner_os", domText.includes('data-owner-os-shell="true"')),
  check("dom_contains_result_card", domText.includes('data-owner-automation-result-card="true"')),
  check("dom_contains_advanced_record", domText.includes('data-owner-automation-advanced-record="true"')),
  check("dom_does_not_contain_desktop_file_list", !/data-desktop-file-list|desktop-file-list|桌面文件列表/.test(domText)),
  check("dom_does_not_contain_bulk_file_action", !/data-bulk-file-action|bulk-file-action|批量文件|批量创建|批量操作/.test(domText)),
  check("provider_calls_made_false", data.providerCallsMade === false),
  check("legacy_scripts_executed_false", data.legacyScriptsExecuted === false),
  check("chat_modified_false", data.chatModified === false),
  check("chat_gateway_execute_modified_false", data.chatGatewayExecuteModified === false),
  check("deploy_executed_false", data.deployExecuted === false),
  check("raw_secret_read_false", data.rawSecretRead === false),
  check("auth_json_read_false", data.authJsonRead === false),
  check("raw_credential_ref_read_false", data.rawCredentialRefRead === false),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1888A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseReady,
  ownerOsOpened: data.ownerOsOpened === true,
  polishedFileActionCopyVisible,
  titleVisible,
  descriptionVisible,
  nextStepVisible,
  filePathInAdvancedRecord,
  evidenceInAdvancedRecord,
  safetyCopyVisible,
  desktopFileListVisible: data.desktopFileListVisible === true,
  bulkFileActionVisible: data.bulkFileActionVisible === true,
  newFileCreated: data.newFileCreated === true,
  desktopScanPerformed: data.desktopScanPerformed === true,
  desktopOtherFilesRead: data.desktopOtherFilesRead === true,
  displayedFilePath,
  screenshotPath: data.screenshotPath ?? paths.screenshot,
  screenshotsPath: paths.screenshotDir,
  evidencePath: paths.evidence,
  ...safetyBoundary(),
  providerCallsMade: data.providerCallsMade === false ? false : data.providerCallsMade,
  legacyScriptsExecuted: data.legacyScriptsExecuted === false ? false : data.legacyScriptsExecuted,
  chatModified: data.chatModified === false ? false : data.chatModified,
  chatGatewayExecuteModified: data.chatGatewayExecuteModified === false ? false : data.chatGatewayExecuteModified,
  deployExecuted: data.deployExecuted === false ? false : data.deployExecuted,
  rawSecretRead: data.rawSecretRead === false ? false : data.rawSecretRead,
  authJsonRead: data.authJsonRead === false ? false : data.authJsonRead,
  rawCredentialRefRead: data.rawCredentialRefRead === false ? false : data.rawCredentialRefRead,
};

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase1888a_file_action_copy_visual_recheck_failed:${failed.join(",")}`;
}

result.checks = checks;
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
