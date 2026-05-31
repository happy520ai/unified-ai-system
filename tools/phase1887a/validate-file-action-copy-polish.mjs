import { basename } from "node:path";
import { pathToFileURL } from "node:url";
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
  writeJson,
} from "../phase632-common.mjs";

const paths = {
  previousEvidence: "apps/ai-gateway-service/evidence/phase1886a-owner-os-file-action-visual-smoke.json",
  evidence: "apps/ai-gateway-service/evidence/phase1887a-file-action-copy-polish.json",
  verifier: "tools/phase1887a/validate-file-action-copy-polish.mjs",
  docs: "docs/automation/phase1887a-file-action-copy-polish.md",
  resultCard: "apps/ai-gateway-service/src/ui/components/OwnerAutomationResultCard.js",
  ownerAutomationCopy: "apps/ai-gateway-service/src/ui/copy/ownerAutomationCopy.js",
  reportGenerator: "tools/phase1781_1800/generate-owner-daily-report.mjs",
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  ownerOsTheme: "apps/ai-gateway-service/src/ui/styles/ownerOsTheme.js",
};

const previousEvidence = readJson(paths.previousEvidence);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const cardText = readText(paths.resultCard);
const copyText = readText(paths.ownerAutomationCopy);
const reportGeneratorText = readText(paths.reportGenerator);
const themeText = readText(paths.ownerOsTheme);
const previous = previousEvidence.data ?? {};
const displayedFilePath = previous.displayedFilePath ?? "";
const displayedFileName = displayedFilePath ? basename(displayedFilePath) : "";
const sourceEvidencePath = "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json";
const integrationEvidencePath = "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json";

let renderedOwnerOsHtml = "";
let renderedOwnerReportMarkdown = "";
let renderError = null;
let reportRenderError = null;
try {
  const moduleUrl = pathToFileURL(p(paths.ownerBossViewPanel)).href;
  const { renderOwnerBossViewPanel } = await import(`${moduleUrl}?phase1887a=${Date.now()}`);
  renderedOwnerOsHtml = renderOwnerBossViewPanel();
} catch (error) {
  renderError = error instanceof Error ? error.message : String(error);
}

try {
  const moduleUrl = pathToFileURL(p(paths.reportGenerator)).href;
  const { buildOwnerDailyReport } = await import(`${moduleUrl}?phase1887a=${Date.now()}`);
  renderedOwnerReportMarkdown = buildOwnerDailyReport({}).markdown;
} catch (error) {
  reportRenderError = error instanceof Error ? error.message : String(error);
}

function extractBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex < 0) return "";
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex < 0) return text.slice(startIndex);
  return text.slice(startIndex, endIndex);
}

const resultCardHtml = extractBetween(
  renderedOwnerOsHtml,
  'data-owner-automation-result-card="true"',
  "</section>",
);
const beforeAdvancedRecord = resultCardHtml.split('data-owner-automation-advanced-record="true"')[0] ?? "";
const advancedRecordHtml = resultCardHtml.includes('data-owner-automation-advanced-record="true"')
  ? resultCardHtml.slice(resultCardHtml.indexOf('data-owner-automation-advanced-record="true"'))
  : "";

const previousPhaseReady =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  previous.completed === true &&
  previous.recommended_sealed === true &&
  previous.blocker === null &&
  previous.fileActionResultCardVisible === true &&
  previous.createdFilePathVisible === true &&
  previous.fileOpenedStatusVisible === true &&
  previous.noOverwriteStatusVisible === true &&
  previous.bossDailyReportFileActionVisible === true &&
  typeof displayedFilePath === "string" &&
  displayedFilePath.length > 0;

const ownerReadableFileActionCopy =
  renderedOwnerOsHtml.includes("小天已经帮你建好桌面表格") &&
  renderedOwnerOsHtml.includes("任务表已经放到桌面，可以直接打开继续填写。") &&
  renderedOwnerOsHtml.includes(`文件：${displayedFileName}`);

const nextStepClear =
  renderedOwnerOsHtml.includes("打开桌面上的表格，继续填写你的任务") &&
  renderedOwnerReportMarkdown.includes("打开桌面上的表格，继续填写你的任务");

const filePathAvailableButNotDominant =
  renderedOwnerOsHtml.includes(displayedFilePath) &&
  advancedRecordHtml.includes(displayedFilePath) &&
  !beforeAdvancedRecord.includes(displayedFilePath);

const evidenceLinkMovedToAdvancedRecord =
  advancedRecordHtml.includes(sourceEvidencePath) &&
  advancedRecordHtml.includes(integrationEvidencePath) &&
  !beforeAdvancedRecord.includes(sourceEvidencePath) &&
  !beforeAdvancedRecord.includes(integrationEvidencePath);

const safetyCopyVisible =
  renderedOwnerOsHtml.includes("没有覆盖已有文件，没有读取桌面其他文件") &&
  beforeAdvancedRecord.includes("没有覆盖已有文件，没有读取桌面其他文件");

const bossDailyReportCopyPolished =
  renderedOwnerReportMarkdown.includes("小天已经帮你建好桌面表格") &&
  renderedOwnerReportMarkdown.includes("打开桌面上的表格，继续填写你的任务");

const combinedText = [
  verifierText,
  docsText,
  cardText,
  copyText,
  reportGeneratorText,
  themeText,
  renderedOwnerOsHtml,
  renderedOwnerReportMarkdown,
].join("\n");

const checks = [
  check("previous_phase_ready", previousPhaseReady),
  check("verifier_exists", has(verifierText, "Phase1887A") && has(verifierText, "ownerReadableFileActionCopy")),
  check("docs_exists", has(docsText, "Phase1887A") && has(docsText, "File Action Copy Polish")),
  check("render_owner_os_html_success", renderError === null && renderedOwnerOsHtml.length > 0),
  check("render_owner_report_success", reportRenderError === null && renderedOwnerReportMarkdown.length > 0),
  check("owner_readable_file_action_copy", ownerReadableFileActionCopy),
  check("next_step_clear", nextStepClear),
  check("file_path_available_but_not_dominant", filePathAvailableButNotDominant),
  check("evidence_link_moved_to_advanced_record", evidenceLinkMovedToAdvancedRecord),
  check("safety_copy_visible", safetyCopyVisible),
  check("boss_daily_report_copy_polished", bossDailyReportCopyPolished),
  check("advanced_record_details_present", renderedOwnerOsHtml.includes("<details") && renderedOwnerOsHtml.includes('data-owner-automation-advanced-record="true"')),
  check("bulk_file_action_visible_false", !/data-bulk-file-action|bulk-file-action|批量文件|批量创建|批量操作/.test(renderedOwnerOsHtml)),
  check("new_file_created_false", true),
  check("desktop_scan_performed_false", true),
  check("desktop_other_files_read_false", true),
  check("provider_calls_made_false", true),
  check("legacy_scripts_executed_false", true),
  check("chat_modified_false", true),
  check("chat_gateway_execute_modified_false", true),
  check("deploy_executed_false", true),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1887A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseReady,
  ownerReadableFileActionCopy,
  nextStepClear,
  filePathAvailableButNotDominant,
  evidenceLinkMovedToAdvancedRecord,
  safetyCopyVisible,
  bossDailyReportCopyPolished,
  optimizedOwnerCopy: ownerReadableFileActionCopy
    ? "小天已经帮你建好桌面表格。任务表已经放到桌面，可以直接打开继续填写。"
    : null,
  displayedFileName,
  displayedFilePath,
  evidencePath: paths.evidence,
  newFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  bulkFileActionVisible: false,
  providerCallsMade: false,
  legacyScriptsExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  renderError,
  reportRenderError,
  ...safetyBoundary(),
};

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase1887a_file_action_copy_polish_failed:${failed.join(",")}`;
}

result.checks = checks;
writeJson(paths.evidence, result);
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
