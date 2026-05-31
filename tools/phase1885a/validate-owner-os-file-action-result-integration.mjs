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
} from "../phase632-common.mjs";

const paths = {
  previousEvidence: "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json",
  integrationScript: "tools/phase1885a/integrate-file-action-result-into-owner-os.mjs",
  verifier: "tools/phase1885a/validate-owner-os-file-action-result-integration.mjs",
  docs: "docs/automation/phase1885a-owner-os-file-action-result-integration.md",
  evidence: "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json",
  resultCard: "apps/ai-gateway-service/src/ui/components/OwnerAutomationResultCard.js",
  ownerAutomationCopy: "apps/ai-gateway-service/src/ui/copy/ownerAutomationCopy.js",
  ownerOsShell: "apps/ai-gateway-service/src/ui/components/OwnerOSShell.js",
  dailyReportSurface: "apps/ai-gateway-service/src/ui/components/OwnerDailyReportSurface.js",
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  reportGenerator: "tools/phase1781_1800/generate-owner-daily-report.mjs",
  packageJson: "package.json",
};

const runScriptName = "run:phase1885a-owner-os-file-action-result-integration";
const runScriptCommand = "node tools/phase1885a/integrate-file-action-result-into-owner-os.mjs";
const verifyScriptName = "verify:phase1885a-owner-os-file-action-result-integration";
const verifyScriptCommand = "node tools/phase1885a/validate-owner-os-file-action-result-integration.mjs";

const previousEvidence = readJson(paths.previousEvidence);
const evidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const integrationText = readText(paths.integrationScript);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const cardText = readText(paths.resultCard);
const automationCopyText = readText(paths.ownerAutomationCopy);
const ownerOsShellText = readText(paths.ownerOsShell);
const dailyReportSurfaceText = readText(paths.dailyReportSurface);
const reportGeneratorText = readText(paths.reportGenerator);
const evidenceText = readText(paths.evidence);
const combinedText = [
  integrationText,
  verifierText,
  docsText,
  cardText,
  automationCopyText,
  ownerOsShellText,
  dailyReportSurfaceText,
  reportGeneratorText,
  evidenceText,
].join("\n");

const scripts = packageJson.data?.scripts ?? {};
const data = evidence.data ?? {};
const phase1884 = previousEvidence.data ?? {};
const previousCreatedPath = phase1884.actualCreatedPath ?? "";
const previousCreatedFileName = previousCreatedPath ? basename(previousCreatedPath) : "";
const expectedBossDailyLine = previousCreatedPath
  ? `今天小天为你创建了桌面表格：${previousCreatedPath}。`
  : "";

let renderedOwnerOsHtml = "";
let renderedOwnerDailyReportMarkdown = "";
let renderError = null;
let reportRenderError = null;
try {
  const moduleUrl = pathToFileURL(p(paths.ownerBossViewPanel)).href;
  const { renderOwnerBossViewPanel } = await import(`${moduleUrl}?phase1885a=${Date.now()}`);
  renderedOwnerOsHtml = renderOwnerBossViewPanel();
} catch (error) {
  renderError = error instanceof Error ? error.message : String(error);
}
try {
  const moduleUrl = pathToFileURL(p(paths.reportGenerator)).href;
  const { buildOwnerDailyReport } = await import(`${moduleUrl}?phase1885a=${Date.now()}`);
  renderedOwnerDailyReportMarkdown = buildOwnerDailyReport({}).markdown;
} catch (error) {
  reportRenderError = error instanceof Error ? error.message : String(error);
}

const phase1884Ready =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  phase1884.completed === true &&
  phase1884.recommended_sealed === true &&
  phase1884.blocker === null &&
  phase1884.desktopSpreadsheetCreated === true &&
  phase1884.createdFileExists === true &&
  phase1884.createdFilePathOnDesktop === true &&
  phase1884.noExistingFileOverwritten === true &&
  typeof previousCreatedPath === "string" &&
  previousCreatedPath.length > 0;

const packageScriptsPresent =
  scripts[runScriptName] === runScriptCommand && scripts[verifyScriptName] === verifyScriptCommand;

const requiredOwnerOsStrings = [
  "小天已经帮你建好桌面表格",
  `文件名：${previousCreatedFileName}`,
  `文件：${previousCreatedFileName}`,
  `文件位置：${previousCreatedPath}`,
  `完整路径：${previousCreatedPath}`,
  "状态：已创建，并已尝试自动打开",
  "安全：没有覆盖已有文件，没有读取桌面其他文件",
  "没有覆盖已有文件，没有读取桌面其他文件",
  "打开桌面上的表格，继续填写你的任务。",
  "打开桌面上的表格，继续填写你的任务",
  paths.previousEvidence,
];

const checks = [
  check("phase1884a_evidence_loaded", phase1884Ready),
  check("integration_script_exists", has(integrationText, "Phase1885A") && has(integrationText, paths.previousEvidence)),
  check("verifier_exists", has(verifierText, "Phase1885A") && has(verifierText, "ownerOsShowsFileActionResult")),
  check("docs_exists", has(docsText, "Phase1885A") && has(docsText, "Owner OS File Action Result Integration")),
  check("result_card_exists", has(cardText, "renderOwnerAutomationResultCard") && has(cardText, "data-owner-automation-result-card")),
  check(
    "owner_automation_copy_exists",
    has(automationCopyText, "ownerAutomationFileActionResultCopy") &&
      has(automationCopyText, "ownerAutomationPhase1884EvidencePath"),
  ),
  check("owner_os_shell_integrates_card", has(ownerOsShellText, "renderOwnerAutomationResultCard")),
  check("daily_report_surface_integrates_file_action", has(dailyReportSurfaceText, "bossDailyReportLine")),
  check("report_generator_integrates_file_action", has(reportGeneratorText, "ownerAutomationFileActionEvidencePath")),
  check("render_owner_os_html_success", renderError === null && renderedOwnerOsHtml.length > 0),
  check("render_owner_daily_report_success", reportRenderError === null && renderedOwnerDailyReportMarkdown.length > 0),
  check(
    "owner_os_shows_file_action_result",
    [
      "小天已经帮你建好桌面表格",
      previousCreatedFileName,
      previousCreatedPath,
      "状态：已创建，并已尝试自动打开",
      "没有覆盖已有文件，没有读取桌面其他文件",
      paths.previousEvidence,
    ].every((value) => renderedOwnerOsHtml.includes(value)),
  ),
  check(
    "boss_daily_report_includes_file_action",
    (
      renderedOwnerOsHtml.includes(expectedBossDailyLine) ||
      renderedOwnerOsHtml.includes(`小天已经帮你建好桌面表格：${previousCreatedFileName}。`)
    ) &&
      (
        renderedOwnerDailyReportMarkdown.includes(expectedBossDailyLine) ||
        renderedOwnerDailyReportMarkdown.includes(`小天已经帮你建好桌面表格：${previousCreatedFileName}。`)
      ),
  ),
  check("created_file_path_visible", renderedOwnerOsHtml.includes(previousCreatedPath)),
  check("file_opened_status_visible", renderedOwnerOsHtml.includes("状态：已创建，并已尝试自动打开")),
  check("no_overwrite_status_visible", renderedOwnerOsHtml.includes("没有覆盖已有文件")),
  check("evidence_link_visible", renderedOwnerOsHtml.includes(paths.previousEvidence)),
  check("phase1885a_evidence_exists", evidence.exists === true && !evidence.parseErrorReason),
  check("completed_true", data.completed === true),
  check("recommended_sealed_true", data.recommended_sealed === true),
  check("blocker_null", data.blocker === null),
  check("evidence_phase1884_loaded_true", data.phase1884aEvidenceLoaded === true),
  check("evidence_owner_os_shows_result_true", data.ownerOsShowsFileActionResult === true),
  check("evidence_boss_daily_report_true", data.bossDailyReportIncludesFileAction === true),
  check("evidence_created_file_path_visible_true", data.createdFilePathVisible === true),
  check("evidence_file_opened_status_visible_true", data.fileOpenedStatusVisible === true),
  check("evidence_no_overwrite_status_visible_true", data.noOverwriteStatusVisible === true),
  check("evidence_link_visible_true", data.evidenceLinkVisible === true),
  check("displayed_file_path_matches_phase1884", data.displayedFilePath === previousCreatedPath),
  check("desktop_scan_performed_false", data.desktopScanPerformed === false),
  check("desktop_other_files_read_false", data.desktopOtherFilesRead === false),
  check("batch_file_capability_added_false", data.batchFileCapabilityAdded === false),
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
  check("workspace_clean_claimed_false", data.workspaceCleanClaimed === false),
  check("package_scripts_present", packageScriptsPresent),
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1885A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1884aEvidenceLoaded: phase1884Ready,
  ownerOsShowsFileActionResult: [
    "小天已经帮你建好桌面表格",
    previousCreatedFileName,
    previousCreatedPath,
    "状态：已创建，并已尝试自动打开",
    "没有覆盖已有文件，没有读取桌面其他文件",
    paths.previousEvidence,
  ].every((value) => renderedOwnerOsHtml.includes(value)),
  bossDailyReportIncludesFileAction:
    (
      renderedOwnerOsHtml.includes(expectedBossDailyLine) ||
      renderedOwnerOsHtml.includes(`小天已经帮你建好桌面表格：${previousCreatedFileName}。`)
    ) &&
    (
      renderedOwnerDailyReportMarkdown.includes(expectedBossDailyLine) ||
      renderedOwnerDailyReportMarkdown.includes(`小天已经帮你建好桌面表格：${previousCreatedFileName}。`)
    ),
  createdFilePathVisible: renderedOwnerOsHtml.includes(previousCreatedPath),
  fileOpenedStatusVisible: renderedOwnerOsHtml.includes("状态：已创建，并已尝试自动打开"),
  noOverwriteStatusVisible: renderedOwnerOsHtml.includes("没有覆盖已有文件"),
  evidenceLinkVisible: renderedOwnerOsHtml.includes(paths.previousEvidence),
  displayedFileName: previousCreatedFileName || null,
  displayedFilePath: previousCreatedPath || null,
  sourceEvidencePath: paths.previousEvidence,
  evidencePath: paths.evidence,
  renderError,
  reportRenderError,
  packageScriptsPresent,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  batchFileCapabilityAdded: false,
  legacyScriptsExecuted: false,
  legacyModified: false,
  rawSecretRead: false,
  authJsonRead: false,
  rawCredentialRefRead: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  ...safetyBoundary(),
};

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase1885a_owner_os_file_action_result_integration_failed:${failed.join(",")}`;
}

result.checks = checks;
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
