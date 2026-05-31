import { join, normalize, resolve } from "node:path";
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
  previousEvidence: "apps/ai-gateway-service/evidence/phase1882a-owner-automation-contract.json",
  actionContract: "docs/automation/create-desktop-spreadsheet-action-contract.json",
  runScript: "tools/phase1883a/run-create-desktop-spreadsheet-dry-run.mjs",
  verifier: "tools/phase1883a/validate-create-desktop-spreadsheet-dry-run.mjs",
  docs: "docs/automation/phase1883a-create-desktop-spreadsheet-dry-run.md",
  evidence: "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json",
  packageJson: "package.json",
};

const verifyScriptName = "verify:phase1883a-create-desktop-spreadsheet-dry-run";
const verifyScriptCommand = "node tools/phase1883a/validate-create-desktop-spreadsheet-dry-run.mjs";
const dryRunScriptName = "dry-run:phase1883a-create-desktop-spreadsheet";
const dryRunScriptCommand = "node tools/phase1883a/run-create-desktop-spreadsheet-dry-run.mjs";

const previousEvidence = readJson(paths.previousEvidence);
const actionContract = readJson(paths.actionContract);
const evidence = readJson(paths.evidence);
const packageJson = readJson(paths.packageJson);
const runScriptText = readText(paths.runScript);
const docsText = readText(paths.docs);
const evidenceText = readText(paths.evidence);
const combinedText = [runScriptText, docsText, evidenceText].join("\n");
const data = evidence.data ?? {};
const scripts = packageJson.data?.scripts ?? {};

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function endsWithCsv(value) {
  return isString(value) && /\.csv$/i.test(value);
}

function pathIsUnderDesktopPreview(value, desktopPath) {
  if (!isString(value) || !isString(desktopPath)) return false;
  const normalizedValue = normalize(value).toLowerCase();
  const normalizedDesktop = normalize(desktopPath).toLowerCase();
  return normalizedValue === normalizedDesktop || normalizedValue.startsWith(`${normalizedDesktop}\\`);
}

const previousPhaseReady =
  previousEvidence.exists === true &&
  !previousEvidence.parseErrorReason &&
  previousEvidence.data?.completed === true &&
  previousEvidence.data?.recommended_sealed === true &&
  previousEvidence.data?.blocker === null &&
  previousEvidence.data?.ownerAutomationKernelContractReady === true &&
  previousEvidence.data?.createDesktopSpreadsheetContractReady === true &&
  previousEvidence.data?.safeLocalFileActionPolicyReady === true &&
  previousEvidence.data?.overwriteProtectionDefined === true &&
  previousEvidence.data?.realDesktopFileCreated === false;

const contractReady =
  actionContract.exists === true &&
  !actionContract.parseErrorReason &&
  actionContract.data?.action === "create_desktop_spreadsheet";

const evidenceGenerated = evidence.exists === true && !evidence.parseErrorReason;
const packageScriptsPresent =
  scripts[verifyScriptName] === verifyScriptCommand && scripts[dryRunScriptName] === dryRunScriptCommand;

const csvPreview = data.csvPreview ?? "";
const desktopPath = data.desktopPath ?? "";
const targetPathPreview = data.targetPathPreview ?? "";
const timestampFallbackPreview = data.timestampFallbackPreview ?? "";
const expectedHeader = "任务,状态,备注";
const expectedChinese = ["示例任务", "待处理", "这是小天创建的表格", "今天要做的事", "待填写", "你可以在这里继续编辑"];

const checks = [
  check("previous_phase_ready", previousPhaseReady),
  check("contract_ready", contractReady),
  check("run_script_exists", Boolean(runScriptText) && has(runScriptText, "create_desktop_spreadsheet")),
  check("docs_exists", Boolean(docsText) && has(docsText, "Phase1883A") && has(docsText, "CSV dry-run")),
  check("evidence_generated", evidenceGenerated),
  check("package_scripts_present", packageScriptsPresent),
  check("completed_true", data.completed === true),
  check("recommended_sealed_true", data.recommended_sealed === true),
  check("blocker_null", data.blocker === null),
  check("csv_dry_run_implemented", data.csvDryRunImplemented === true),
  check("ok_true", data.ok === true),
  check("dry_run_true", data.dryRun === true),
  check("action_create_desktop_spreadsheet", data.action === "create_desktop_spreadsheet"),
  check("desktop_path_detected", data.desktopPathDetected === true && isString(desktopPath)),
  check("desktop_path_not_scanned", data.desktopPathScanPerformed === false),
  check("exact_desktop_target_existence_not_checked", data.exactDesktopTargetExistenceChecked === false),
  check("target_path_preview_generated", endsWithCsv(targetPathPreview)),
  check("target_path_preview_under_desktop", pathIsUnderDesktopPreview(targetPathPreview, desktopPath)),
  check("target_file_name_generated", data.targetFileName === "小天任务表.csv"),
  check("safe_path_check_passed", data.safePathCheckPassed === true),
  check("would_create_file", data.wouldCreateFile === true),
  check("real_file_created_false", data.realFileCreated === false),
  check("would_open_after_create", data.wouldOpenAfterCreate === true),
  check("csv_preview_generated", data.csvPreviewGenerated === true && isString(csvPreview)),
  check("csv_header_valid", data.headersValid === true && csvPreview.split(/\r?\n/)[0] === expectedHeader),
  check("csv_preview_chinese_content_valid", data.chineseContentValid === true && expectedChinese.every((item) => csvPreview.includes(item))),
  check("csv_preview_has_no_replacement_char", !csvPreview.includes("�")),
  check("no_existing_file_would_be_overwritten", data.noExistingFileWouldBeOverwritten === true),
  check("timestamp_fallback_preview_generated", endsWithCsv(timestampFallbackPreview)),
  check("timestamp_fallback_differs_from_target", timestampFallbackPreview !== targetPathPreview),
  check("timestamp_fallback_under_desktop", pathIsUnderDesktopPreview(timestampFallbackPreview, desktopPath)),
  check("would_create_evidence", data.wouldCreateEvidence === true),
  check("evidence_path_self", data.evidencePath === paths.evidence),
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
  phase: "Phase1883A",
  routeChoice: "Route A / local_self_use_only",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previousPhaseReady,
  contractReady,
  csvDryRunImplemented: data.csvDryRunImplemented === true,
  desktopPathDetected: data.desktopPathDetected === true,
  desktopPath,
  targetPathPreview,
  timestampFallbackPreview,
  safePathCheckPassed: data.safePathCheckPassed === true,
  csvPreviewGenerated: data.csvPreviewGenerated === true,
  headersValid: data.headersValid === true,
  chineseContentValid: data.chineseContentValid === true,
  wouldCreateFile: data.wouldCreateFile === true,
  realFileCreated: data.realFileCreated === false ? false : data.realFileCreated,
  noExistingFileWouldBeOverwritten: data.noExistingFileWouldBeOverwritten === true,
  wouldOpenAfterCreate: data.wouldOpenAfterCreate === true,
  evidenceGenerated,
  evidencePath: paths.evidence,
  runScriptPath: paths.runScript,
  docsPath: paths.docs,
  packageScriptsPresent,
  normalizedTargetPathPreview: isString(targetPathPreview) ? resolve(targetPathPreview) : null,
  expectedEvidencePath: join("apps", "ai-gateway-service", "evidence", "phase1883a-create-desktop-spreadsheet-dry-run.json"),
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
  result.blocker = `phase1883a_create_desktop_spreadsheet_dry_run_failed:${failed.join(",")}`;
}

result.checks = checks;
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true || result.blocker) {
  process.exitCode = 1;
}
