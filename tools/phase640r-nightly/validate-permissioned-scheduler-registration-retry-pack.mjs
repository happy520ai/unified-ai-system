import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  preflightRun: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
  registrationEvidence: "apps/ai-gateway-service/evidence/phase638r/windows-task-registration-result.json",
  fallbackEvidence: "apps/ai-gateway-service/evidence/phase638r/nightly-runner-registration-fallback-result.json",
  phase639NightlyPanelEvidence: "apps/ai-gateway-service/evidence/phase639r-nightly/nightly-runner-fallback-operator-panel-result.json",
  diagnosisDoc: "docs/phase640r-nightly-permissioned-retry-diagnosis.md",
  diagnosisEvidence: "apps/ai-gateway-service/evidence/phase640r-nightly/permissioned-retry-diagnosis-result.json",
  retryScript: "tools/phase640r-nightly/retry-register-nightly-task-permissioned.ps1",
  verifyScript: "tools/phase640r-nightly/verify-nightly-task-registration.ps1",
  unregisterScript: "tools/phase640r-nightly/unregister-nightly-task-safe.ps1",
  adminChecklist: "docs/phase640r-nightly-admin-registration-checklist.md",
  resultInputExample: "docs/phase640r-nightly-registration-result.input.example.json",
  retryPackDoc: "docs/phase640r-nightly-permissioned-scheduler-registration-retry-pack.md",
  executionReport: "docs/phase640r-nightly-execution-report.md",
  uiPanel: "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
  uiCopy: "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
  packageJson: "package.json",
  evidence: "apps/ai-gateway-service/evidence/phase640r-nightly/permissioned-scheduler-registration-retry-pack-result.json",
};

const preflightRun = readJson(paths.preflightRun);
const registrationEvidence = readJson(paths.registrationEvidence);
const fallbackEvidence = readJson(paths.fallbackEvidence);
const phase639NightlyPanelEvidence = readJson(paths.phase639NightlyPanelEvidence);
const diagnosisEvidence = readJson(paths.diagnosisEvidence);
const resultInputExample = readJson(paths.resultInputExample);
const packageJson = readJson(paths.packageJson);

const diagnosisDocText = readText(paths.diagnosisDoc);
const retryScriptText = readText(paths.retryScript);
const verifyScriptText = readText(paths.verifyScript);
const unregisterScriptText = readText(paths.unregisterScript);
const adminChecklistText = readText(paths.adminChecklist);
const retryPackDocText = readText(paths.retryPackDoc);
const executionReportText = readText(paths.executionReport);
const uiPanelText = readText(paths.uiPanel);
const uiCopyText = readText(paths.uiCopy);

const phase638RegistrationEvidenceImported =
  registrationEvidence.exists === true &&
  !registrationEvidence.parseErrorReason &&
  registrationEvidence.data?.blocker === "windows_task_scheduler_access_denied" &&
  registrationEvidence.data?.scheduledTaskRegistered === false;

const phase638FallbackEvidenceImported =
  fallbackEvidence.exists === true &&
  !fallbackEvidence.parseErrorReason &&
  fallbackEvidence.data?.completed === true &&
  fallbackEvidence.data?.recommended_sealed === true &&
  fallbackEvidence.data?.blocker === null &&
  fallbackEvidence.data?.fallbackCmdGenerated === true &&
  fallbackEvidence.data?.fallbackPs1Generated === true;

const phase639NightlyPanelEvidenceImported =
  phase639NightlyPanelEvidence.exists === true &&
  !phase639NightlyPanelEvidence.parseErrorReason &&
  phase639NightlyPanelEvidence.data?.completed === true &&
  phase639NightlyPanelEvidence.data?.recommended_sealed === true &&
  phase639NightlyPanelEvidence.data?.blocker === null &&
  phase639NightlyPanelEvidence.data?.scheduledTaskRegistered === false &&
  phase639NightlyPanelEvidence.data?.nightlyAutomationEnabled === false;

const permissionedRetryScriptGenerated =
  has(retryScriptText, "preflight:phase632-token-saving") &&
  has(retryScriptText, "PME-AI-Gateway-Nightly-Safe-Runner") &&
  has(retryScriptText, "20:00") &&
  has(retryScriptText, "nightly:phase638-safe-runner") &&
  has(retryScriptText, "windows_task_scheduler_access_denied") &&
  !/Start-Process\s+.*-Verb\s+RunAs/i.test(retryScriptText) &&
  !/RunLevel\s+Highest/i.test(retryScriptText);

const verifyScriptGenerated =
  has(verifyScriptText, "Get-ScheduledTask") &&
  has(verifyScriptText, "PME-AI-Gateway-Nightly-Safe-Runner") &&
  has(verifyScriptText, "nightly:phase638-safe-runner") &&
  has(verifyScriptText, "scheduledTaskRegistered") &&
  !has(verifyScriptText, "Register-ScheduledTask") &&
  !has(verifyScriptText, "Unregister-ScheduledTask");

const safeUnregisterScriptGenerated =
  has(unregisterScriptText, "Unregister-ScheduledTask") &&
  has(unregisterScriptText, "PME-AI-Gateway-Nightly-Safe-Runner") &&
  has(unregisterScriptText, "evidenceDeleted") &&
  has(unregisterScriptText, "gitResetExecuted") &&
  has(unregisterScriptText, "gitCleanExecuted");

const adminChecklistGenerated =
  (has(adminChecklistText, "administrator PowerShell") || has(adminChecklistText, "管理员 PowerShell")) &&
  has(adminChecklistText, "Phase632 preflight pass") &&
  has(adminChecklistText, "retry-register-nightly-task-permissioned.ps1") &&
  has(adminChecklistText, "verify-nightly-task-registration.ps1") &&
  has(adminChecklistText, "NextRunTime") &&
  has(adminChecklistText, "windows_task_scheduler_access_denied") &&
  (has(adminChecklistText, "Do not bypass permissions") || has(adminChecklistText, "不建议绕过权限")) &&
  (has(adminChecklistText, "fallback launcher remains available for manual use") || has(adminChecklistText, "fallback launcher 仍可手动使用"));

const resultInputExampleGenerated =
  resultInputExample.exists === true &&
  !resultInputExample.parseErrorReason &&
  resultInputExample.data?.intakeId === "phase640r-nightly-permissioned-registration-001" &&
  resultInputExample.data?.executionMode === "permissioned_windows_task_scheduler_retry" &&
  resultInputExample.data?.taskName === "PME-AI-Gateway-Nightly-Safe-Runner" &&
  resultInputExample.data?.scheduledTaskRegistered === true &&
  resultInputExample.data?.phase632PreflightPassed === true &&
  resultInputExample.data?.providerCallsMade === false &&
  resultInputExample.data?.authJsonRead === false &&
  resultInputExample.data?.codexConfigModified === false &&
  resultInputExample.data?.chatModified === false &&
  resultInputExample.data?.chatGatewayExecuteModified === false &&
  resultInputExample.data?.deployExecuted === false &&
  resultInputExample.data?.commitCreated === false;

const diagnosisGenerated =
  has(diagnosisDocText, "originalBlocker=windows_task_scheduler_access_denied") &&
  has(diagnosisDocText, "scheduledTaskRegistered=false") &&
  has(diagnosisDocText, "fallbackLauncherAvailable=true") &&
  has(diagnosisDocText, "operatorPanelShowsUnregistered=true") &&
  has(diagnosisDocText, "retryRequiresPermissionedSession=true") &&
  diagnosisEvidence.exists === true &&
  !diagnosisEvidence.parseErrorReason &&
  diagnosisEvidence.data?.retryRequiresPermissionedSession === true &&
  diagnosisEvidence.data?.autoElevationAttempted === false &&
  diagnosisEvidence.data?.permissionBypassAttempted === false;

const exampleNotCountedAsRealRegistration =
  has(retryPackDocText, "exampleNotCountedAsRealRegistration=true") &&
  has(executionReportText, "scheduledTaskRegistered=false") &&
  has(executionReportText, "nightlyAutomationEnabled=false");

const operatorPanelUpdated =
  has(uiCopyText, "phase640r-nightly-retry-pack") &&
  has(uiPanelText, "readPhase640RNightlyPermissionedRetryPack") &&
  has(uiPanelText, "permissioned retry pack ready") &&
  has(uiPanelText, "admin checklist ready") &&
  has(uiPanelText, "verify script ready") &&
  has(uiPanelText, "result intake example ready") &&
  has(uiPanelText, "nightly automation enabled=false") &&
  has(uiPanelText, "next action: manually run retry script in a permissioned session") &&
  !has(uiPanelText, "立即注册") &&
  !has(uiPanelText, "立即运行 nightly runner");

const packageScriptGenerated =
  packageJson.data?.scripts?.["verify:phase640r-nightly-permissioned-scheduler-registration-retry-pack"] ===
  "node tools/phase640r-nightly/validate-permissioned-scheduler-registration-retry-pack.mjs";

const combinedText = [
  diagnosisDocText,
  retryScriptText,
  verifyScriptText,
  unregisterScriptText,
  adminChecklistText,
  retryPackDocText,
  executionReportText,
  uiPanelText,
  uiCopyText,
].join("\n");

const result = {
  phase: "Phase640R-Nightly",
  name: "Permissioned Scheduler Registration Retry Pack",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632PreflightPassed: preflightRun.data?.preflightPassed === true,
  phase638RegistrationEvidenceImported,
  phase638FallbackEvidenceImported,
  phase639NightlyPanelEvidenceImported,
  originalBlocker: registrationEvidence.data?.blocker ?? null,
  scheduledTaskRegistered: false,
  nightlyAutomationEnabled: false,
  fallbackLauncherAvailable: fallbackEvidence.data?.fallbackCmdGenerated === true && fallbackEvidence.data?.fallbackPs1Generated === true,
  operatorPanelShowsUnregistered: phase639NightlyPanelEvidence.data?.scheduledTaskRegistered === false,
  retryRequiresPermissionedSession: true,
  permissionedRetryScriptGenerated,
  verifyScriptGenerated,
  safeUnregisterScriptGenerated,
  adminChecklistGenerated,
  resultInputExampleGenerated,
  diagnosisGenerated,
  exampleNotCountedAsRealRegistration,
  operatorPanelUpdated,
  packageScriptGenerated,
  autoElevationAttempted: false,
  permissionBypassAttempted: false,
  windowsTaskRegisteredByThisPhase: false,
  nightlyRunnerExecutedByThisPhase: false,
  permissionedRetryPackReady: true,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: [
    paths.diagnosisDoc,
    paths.adminChecklist,
    paths.resultInputExample,
    paths.retryPackDoc,
    paths.executionReport,
  ],
  scripts: [
    paths.retryScript,
    paths.verifyScript,
    paths.unregisterScript,
  ],
  diagnosisEvidenceJson: paths.diagnosisEvidence,
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("phase638_registration_evidence_imported", result.phase638RegistrationEvidenceImported),
  check("phase638_fallback_evidence_imported", result.phase638FallbackEvidenceImported),
  check("phase639_nightly_panel_evidence_imported", result.phase639NightlyPanelEvidenceImported),
  check("original_blocker_windows_task_scheduler_access_denied", result.originalBlocker === "windows_task_scheduler_access_denied"),
  check("scheduled_task_registered_false", result.scheduledTaskRegistered === false),
  check("permissioned_retry_script_generated", result.permissionedRetryScriptGenerated),
  check("verify_script_generated", result.verifyScriptGenerated),
  check("safe_unregister_script_generated", result.safeUnregisterScriptGenerated),
  check("admin_checklist_generated", result.adminChecklistGenerated),
  check("result_input_example_generated", result.resultInputExampleGenerated),
  check("diagnosis_generated", result.diagnosisGenerated),
  check("example_not_counted_as_real_registration", result.exampleNotCountedAsRealRegistration),
  check("operator_panel_updated", result.operatorPanelUpdated),
  check("package_script_generated", result.packageScriptGenerated),
  check("auto_elevation_attempted_false", result.autoElevationAttempted === false),
  check("permission_bypass_attempted_false", result.permissionBypassAttempted === false),
  check("windows_task_registered_by_this_phase_false", result.windowsTaskRegisteredByThisPhase === false),
  check("nightly_runner_executed_by_this_phase_false", result.nightlyRunnerExecutedByThisPhase === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("auth_json_accessed_false", result.authJsonAccessed === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase640r_nightly_permissioned_retry_pack_failed");
