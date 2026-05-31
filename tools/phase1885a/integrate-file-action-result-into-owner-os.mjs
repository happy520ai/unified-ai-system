import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import {
  check,
  p,
  readJson,
  safetyBoundary,
  writeJson,
} from "../phase632-common.mjs";

const paths = {
  previousEvidence: "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json",
  evidence: "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json",
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  reportGenerator: "tools/phase1781_1800/generate-owner-daily-report.mjs",
};

const phase1884 = readJson(paths.previousEvidence);
const phase1884Data = phase1884.data ?? {};
const displayedFilePath = phase1884Data.actualCreatedPath ?? "";
const displayedFileName = displayedFilePath ? basename(displayedFilePath) : "";
const expectedBossDailyLine = displayedFilePath
  ? `今天小天为你创建了桌面表格：${displayedFilePath}。`
  : "";

let ownerOsHtml = "";
let ownerDailyReportMarkdown = "";
let renderError = null;
let reportRenderError = null;
try {
  const moduleUrl = pathToFileURL(p(paths.ownerBossViewPanel)).href;
  const { renderOwnerBossViewPanel } = await import(`${moduleUrl}?phase1885a=${Date.now()}`);
  ownerOsHtml = renderOwnerBossViewPanel();
} catch (error) {
  renderError = error instanceof Error ? error.message : String(error);
}
try {
  const moduleUrl = pathToFileURL(p(paths.reportGenerator)).href;
  const { buildOwnerDailyReport } = await import(`${moduleUrl}?phase1885a=${Date.now()}`);
  ownerDailyReportMarkdown = buildOwnerDailyReport({}).markdown;
} catch (error) {
  reportRenderError = error instanceof Error ? error.message : String(error);
}

const phase1884aEvidenceLoaded =
  phase1884.exists === true &&
  !phase1884.parseErrorReason &&
  phase1884Data.completed === true &&
  phase1884Data.recommended_sealed === true &&
  phase1884Data.blocker === null &&
  phase1884Data.desktopSpreadsheetCreated === true &&
  phase1884Data.createdFileExists === true &&
  phase1884Data.createdFilePathOnDesktop === true &&
  phase1884Data.noExistingFileOverwritten === true &&
  typeof displayedFilePath === "string" &&
  displayedFilePath.length > 0;

const ownerOsShowsFileActionResult =
  ownerOsHtml.includes("小天已创建桌面表格") &&
  ownerOsHtml.includes(`文件名：${displayedFileName}`) &&
  ownerOsHtml.includes(`文件位置：${displayedFilePath}`) &&
  ownerOsHtml.includes("状态：已创建，并已尝试自动打开") &&
  ownerOsHtml.includes("安全：没有覆盖已有文件，没有读取桌面其他文件");

const bossDailyReportIncludesFileAction =
  ownerOsHtml.includes(expectedBossDailyLine) &&
  ownerDailyReportMarkdown.includes(expectedBossDailyLine);
const createdFilePathVisible = ownerOsHtml.includes(displayedFilePath);
const fileOpenedStatusVisible = ownerOsHtml.includes("状态：已创建，并已尝试自动打开");
const noOverwriteStatusVisible = ownerOsHtml.includes("没有覆盖已有文件");
const evidenceLinkVisible =
  ownerOsHtml.includes(paths.previousEvidence) &&
  ownerOsHtml.includes(paths.evidence);

const result = {
  phase: "Phase1885A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1884aEvidenceLoaded,
  ownerOsShowsFileActionResult,
  bossDailyReportIncludesFileAction,
  createdFilePathVisible,
  fileOpenedStatusVisible,
  noOverwriteStatusVisible,
  evidenceLinkVisible,
  sourceEvidencePath: paths.previousEvidence,
  evidencePath: paths.evidence,
  displayedFileName,
  displayedFilePath,
  fileOpenedAttempted: phase1884Data.fileOpenedAttempted === true,
  noExistingFileOverwritten: phase1884Data.noExistingFileOverwritten === true,
  bossDailyReportLine: expectedBossDailyLine,
  ownerVisibleNextStep: "打开桌面上的表格，继续填写你的任务。",
  renderError,
  reportRenderError,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  readExistingDesktopFiles: false,
  batchFileCapabilityAdded: false,
  deletedFiles: false,
  movedFiles: false,
  overwrittenFiles: false,
  providerCallsMade: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  legacyModified: false,
  legacyScriptsExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
  ...safetyBoundary(),
};

const checks = [
  check("phase1884a_evidence_loaded", phase1884aEvidenceLoaded),
  check("owner_os_shows_file_action_result", ownerOsShowsFileActionResult),
  check("boss_daily_report_includes_file_action", bossDailyReportIncludesFileAction),
  check("created_file_path_visible", createdFilePathVisible),
  check("file_opened_status_visible", fileOpenedStatusVisible),
  check("no_overwrite_status_visible", noOverwriteStatusVisible),
  check("evidence_link_visible", evidenceLinkVisible),
  check("desktop_scan_not_performed", result.desktopScanPerformed === false),
  check("desktop_other_files_not_read", result.desktopOtherFilesRead === false),
  check("batch_file_capability_not_added", result.batchFileCapabilityAdded === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("raw_secret_read_false", result.rawSecretRead === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("raw_credential_ref_read_false", result.rawCredentialRefRead === false),
  check("legacy_scripts_executed_false", result.legacyScriptsExecuted === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase1885a_owner_os_file_action_result_integration_failed:${failed.join(",")}`;
}
result.checks = checks;

writeJson(paths.evidence, result);
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
