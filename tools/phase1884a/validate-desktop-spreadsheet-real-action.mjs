import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, normalize, resolve } from "node:path";
import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  has,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  previousEvidence: "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json",
  runner: "tools/phase1884a/create-desktop-spreadsheet-real-action.mjs",
  verifier: "tools/phase1884a/validate-desktop-spreadsheet-real-action.mjs",
  docs: "docs/automation/phase1884a-create-desktop-spreadsheet-real-action.md",
  evidence: "apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json",
  packageJson: "package.json",
};

const runScriptName = "real-action:phase1884a-create-desktop-spreadsheet";
const runScriptCommand = "node tools/phase1884a/create-desktop-spreadsheet-real-action.mjs";
const verifyScriptName = "verify:phase1884a-create-desktop-spreadsheet-real-action";
const verifyScriptCommand = "node tools/phase1884a/validate-desktop-spreadsheet-real-action.mjs";

const previousEvidence = readJson(paths.previousEvidence);
const evidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const runnerText = readText(paths.runner);
const docsText = readText(paths.docs);
const evidenceText = readText(paths.evidence);
const combinedText = [runnerText, docsText, evidenceText].join("\n");
const scripts = packageJson.data?.scripts ?? {};
const data = evidence.data ?? {};

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function isPathInside(parent, candidate) {
  if (!isString(parent) || !isString(candidate)) return false;
  const normalizedParent = normalize(parent).toLowerCase();
  const normalizedCandidate = normalize(candidate).toLowerCase();
  return normalizedCandidate === normalizedParent || normalizedCandidate.startsWith(`${normalizedParent}\\`);
}

function readCreatedCsv(path) {
  if (!isString(path) || !existsSync(path)) return "";
  const buffer = readFileSync(path);
  const text = buffer.toString("utf8");
  return text.replace(/^\uFEFF/, "");
}

function fileSize(path) {
  if (!isString(path) || !existsSync(path)) return 0;
  return statSync(path).size;
}

const csvText = readCreatedCsv(data.actualCreatedPath);
const expectedCsv = [
  "任务,状态,备注",
  "示例任务,待处理,这是小天创建的表格",
  "今天要做的事,待填写,你可以在这里继续编辑",
].join("\r\n");
const packageScriptsPresent =
  scripts[runScriptName] === runScriptCommand && scripts[verifyScriptName] === verifyScriptCommand;

const previousPhaseReady =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  previousEvidence.data?.completed === true &&
  previousEvidence.data?.recommended_sealed === true &&
  previousEvidence.data?.blocker === null &&
  previousEvidence.data?.csvDryRunImplemented === true &&
  previousEvidence.data?.desktopPathDetected === true &&
  previousEvidence.data?.safePathCheckPassed === true &&
  previousEvidence.data?.csvPreviewGenerated === true &&
  previousEvidence.data?.headersValid === true &&
  previousEvidence.data?.chineseContentValid === true &&
  previousEvidence.data?.wouldCreateFile === true &&
  previousEvidence.data?.realFileCreated === false &&
  previousEvidence.data?.noExistingFileWouldBeOverwritten === true;

const checks = [
  check("previous_phase_ready", previousPhaseReady),
  check("runner_exists", Boolean(runnerText) && has(runnerText, "create_desktop_spreadsheet")),
  check("docs_exists", Boolean(docsText) && has(docsText, "Phase1884A") && has(docsText, "real local action")),
  check("evidence_exists", evidence.exists === true && !evidence.parseErrorReason),
  check("package_scripts_present", packageScriptsPresent),
  check("completed_true", data.completed === true),
  check("recommended_sealed_true", data.recommended_sealed === true),
  check("blocker_null", data.blocker === null),
  check("owner_explicit_approval", data.ownerExplicitApproval?.allowRealDesktopFileCreate === true),
  check("approved_action", data.ownerExplicitApproval?.approvedAction === "create_desktop_spreadsheet"),
  check("approved_desktop_csv", data.ownerExplicitApproval?.approvedTargetDirectory === "desktop" && data.ownerExplicitApproval?.approvedFileType === "csv"),
  check("max_files_to_create_one", data.ownerExplicitApproval?.maxFilesToCreate === 1 && data.filesCreatedCount === 1),
  check("desktop_path_detected", data.desktopPathDetected === true && isString(data.desktopPath)),
  check("target_path_calculated", isString(data.targetPath)),
  check("actual_created_path_present", isString(data.actualCreatedPath)),
  check("created_file_exists", data.createdFileExists === true && existsSync(data.actualCreatedPath)),
  check("created_file_path_on_desktop", data.createdFilePathOnDesktop === true && isPathInside(data.desktopPath, data.actualCreatedPath)),
  check("created_file_extension_csv", data.createdFileExtension === "csv" && extname(data.actualCreatedPath).toLowerCase() === ".csv"),
  check("desktop_spreadsheet_created", data.desktopSpreadsheetCreated === true && data.fileCreated === true),
  check("file_size_bytes_positive", Number(data.fileSizeBytes) > 0 && fileSize(data.actualCreatedPath) === data.fileSizeBytes),
  check("csv_has_utf8_bom", data.utf8BomWritten === true && isString(data.actualCreatedPath) && existsSync(data.actualCreatedPath) && readFileSync(data.actualCreatedPath).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))),
  check("spreadsheet_headers_valid", data.spreadsheetHeadersValid === true && csvText.split(/\r?\n/)[0] === "任务,状态,备注"),
  check("spreadsheet_chinese_content_valid", data.spreadsheetChineseContentValid === true && csvText === expectedCsv),
  check("csv_content_preview_valid", data.csvContentPreview === expectedCsv),
  check("no_existing_file_overwritten", data.noExistingFileOverwritten === true && data.allowOverwrite === false),
  check("target_existence_checked", data.targetExistenceChecked === true),
  check("desktop_scan_not_performed", data.desktopScanPerformed === false),
  check("read_existing_desktop_files_false", data.readExistingDesktopFiles === false),
  check("file_open_attempted", data.fileOpenedAttempted === true),
  check("open_after_create_allowed", data.allowOpenAfterCreate === true),
  check("action_timestamps_present", isString(data.actionStartedAt) && isString(data.actionFinishedAt)),
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
  check("secret_value_exposed_false", containsSecretLikeValue(combinedText) === false),
  check("raw_base_url_value_exposed_false", containsRawBaseUrlValue(combinedText) === false),
  check("webhook_value_exposed_false", containsWebhookLikeValue(combinedText) === false),
];

const result = {
  phase: "Phase1884A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseReady,
  desktopSpreadsheetCreated: data.desktopSpreadsheetCreated === true,
  createdFileExists: data.createdFileExists === true,
  createdFilePathOnDesktop: data.createdFilePathOnDesktop === true,
  createdFileExtension: data.createdFileExtension ?? null,
  spreadsheetHeadersValid: data.spreadsheetHeadersValid === true,
  spreadsheetChineseContentValid: data.spreadsheetChineseContentValid === true,
  noExistingFileOverwritten: data.noExistingFileOverwritten === true,
  fileSizeBytes: data.fileSizeBytes ?? 0,
  desktopPath: data.desktopPath ?? null,
  actualCreatedPath: data.actualCreatedPath ?? null,
  csvContentPreview: data.csvContentPreview ?? null,
  fileOpenedAttempted: data.fileOpenedAttempted === true,
  evidencePath: paths.evidence,
  runnerPath: paths.runner,
  docsPath: paths.docs,
  normalizedActualCreatedPath: isString(data.actualCreatedPath) ? resolve(data.actualCreatedPath) : null,
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
  result.blocker = `phase1884a_desktop_spreadsheet_real_action_failed:${failed.join(",")}`;
}

result.checks = checks;
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
