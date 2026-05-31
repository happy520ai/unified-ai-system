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
  fallbackCmd: "tools/phase638r/run-nightly-safe-runner-once.cmd",
  fallbackPs1: "tools/phase638r/run-nightly-safe-runner-once.ps1",
  importDoc: "docs/phase639r-nightly-fallback-evidence-import.md",
  importEvidence: "apps/ai-gateway-service/evidence/phase639r-nightly/fallback-evidence-import-result.json",
  stateContract: "docs/phase639r-nightly-operator-panel-state-contract.md",
  operatorCopy: "docs/phase639r-nightly-operator-panel-copy.md",
  panelDoc: "docs/phase639r-nightly-runner-fallback-operator-panel.md",
  executionReport: "docs/phase639r-nightly-execution-report.md",
  uiPanel: "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
  uiCopy: "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
  packageJson: "package.json",
  evidence: "apps/ai-gateway-service/evidence/phase639r-nightly/nightly-runner-fallback-operator-panel-result.json",
};

const preflightRun = readJson(paths.preflightRun);
const registrationEvidence = readJson(paths.registrationEvidence);
const fallbackEvidence = readJson(paths.fallbackEvidence);
const importEvidence = readJson(paths.importEvidence);
const packageJson = readJson(paths.packageJson);

const fallbackCmdText = readText(paths.fallbackCmd);
const fallbackPs1Text = readText(paths.fallbackPs1);
const importDocText = readText(paths.importDoc);
const stateContractText = readText(paths.stateContract);
const operatorCopyText = readText(paths.operatorCopy);
const panelDocText = readText(paths.panelDoc);
const executionReportText = readText(paths.executionReport);
const uiPanelText = readText(paths.uiPanel);
const uiCopyText = readText(paths.uiCopy);

const phase638RegistrationEvidenceImported =
  registrationEvidence.exists === true &&
  !registrationEvidence.parseErrorReason &&
  registrationEvidence.data?.blocker === "windows_task_scheduler_access_denied" &&
  registrationEvidence.data?.scheduledTaskRegistered === false &&
  registrationEvidence.data?.taskExists === false;

const phase638FallbackEvidenceImported =
  fallbackEvidence.exists === true &&
  !fallbackEvidence.parseErrorReason &&
  fallbackEvidence.data?.completed === true &&
  fallbackEvidence.data?.recommended_sealed === true &&
  fallbackEvidence.data?.blocker === null &&
  fallbackEvidence.data?.originalBlocker === "windows_task_scheduler_access_denied" &&
  fallbackEvidence.data?.scheduledTaskRegistered === false;

const fallbackCmdAvailable =
  has(fallbackCmdText, "preflight:phase632-token-saving") &&
  has(fallbackCmdText, "nightly:phase638-safe-runner");

const fallbackPs1Available =
  has(fallbackPs1Text, "preflight:phase632-token-saving") &&
  has(fallbackPs1Text, "nightly:phase638-safe-runner");

const operatorPanelStateContractGenerated =
  has(stateContractText, '"panelId": "nightly_runner_fallback_operator_panel"') &&
  has(stateContractText, '"scheduledTaskRegistered": false') &&
  has(stateContractText, '"nightlyAutomationEnabled": false') &&
  has(stateContractText, '"originalBlocker": "windows_task_scheduler_access_denied"') &&
  has(stateContractText, '"fallbackLauncherAvailable": true') &&
  has(stateContractText, '"fallbackCmdPath": "tools/phase638r/run-nightly-safe-runner-once.cmd"') &&
  has(stateContractText, '"fallbackPs1Path": "tools/phase638r/run-nightly-safe-runner-once.ps1"') &&
  has(stateContractText, '"phase632PreflightRequired": true') &&
  has(stateContractText, '"providerCallsAllowed": false') &&
  has(stateContractText, '"secretAccessAllowed": false') &&
  has(stateContractText, '"chatModificationAllowed": false') &&
  has(stateContractText, '"chatGatewayExecuteModificationAllowed": false') &&
  has(stateContractText, '"deployAllowed": false');

const operatorCopyGenerated =
  has(operatorCopyText, "计划任务未注册") &&
  has(operatorCopyText, "fallback launcher 可用") &&
  has(operatorCopyText, "这不是后台 daemon") &&
  has(operatorCopyText, "这不是无限循环") &&
  has(operatorCopyText, "这不是 nightly automation enabled") &&
  has(operatorCopyText, "需要管理员/有权限会话才能重新注册 Task Scheduler");

const importEvidenceGenerated =
  importEvidence.exists === true &&
  !importEvidence.parseErrorReason &&
  importEvidence.data?.originalRegistrationAttempted === true &&
  importEvidence.data?.originalBlocker === "windows_task_scheduler_access_denied" &&
  importEvidence.data?.scheduledTaskRegistered === false &&
  importEvidence.data?.fallbackPackCompleted === true &&
  importEvidence.data?.fallbackCmdAvailable === true &&
  importEvidence.data?.fallbackPs1Available === true &&
  importEvidence.data?.phase632PreflightRequired === true &&
  importEvidence.data?.nightlyAutomationEnabled === false;

const uiReadOnlyPreviewGenerated =
  has(uiCopyText, "phase639r-nightly-fallback-panel") &&
  has(uiPanelText, "readPhase639RNightlyFallbackOperatorPanel") &&
  has(uiPanelText, "Task Scheduler status: not registered") &&
  has(uiPanelText, "blocker: windows_task_scheduler_access_denied") &&
  has(uiPanelText, "fallback cmd available") &&
  has(uiPanelText, "fallback ps1 available") &&
  has(uiPanelText, "Phase632 preflight required") &&
  has(uiPanelText, "admin/permissioned registration session or manual fallback launcher") &&
  has(uiPanelText, "no provider call") &&
  has(uiPanelText, "no secret access") &&
  has(uiPanelText, "no /chat modification") &&
  has(uiPanelText, "no /chat-gateway/execute modification");

const noRegisterButtonAdded =
  !has(uiCopyText, "phase639r-nightly-register") &&
  !has(uiPanelText, "立即注册计划任务");

const noRunNowButtonAdded =
  !has(uiCopyText, "phase639r-nightly-run-now") &&
  !has(uiPanelText, "立即运行 nightly runner");

const packageScriptGenerated =
  packageJson.data?.scripts?.["verify:phase639r-nightly-fallback-operator-panel"] ===
  "node tools/phase639r-nightly/validate-nightly-runner-fallback-operator-panel.mjs";

const combinedText = [
  importDocText,
  stateContractText,
  operatorCopyText,
  panelDocText,
  executionReportText,
  uiPanelText,
  uiCopyText,
].join("\n");

const result = {
  phase: "Phase639R-Nightly",
  name: "Nightly Runner Manual/Fallback Operator Panel",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632PreflightPassed: preflightRun.data?.preflightPassed === true,
  phase638RegistrationEvidenceImported,
  phase638FallbackEvidenceImported,
  originalRegistrationAttempted: phase638RegistrationEvidenceImported,
  originalBlocker: registrationEvidence.data?.blocker ?? fallbackEvidence.data?.originalBlocker ?? null,
  scheduledTaskRegistered: false,
  nightlyAutomationEnabled: false,
  fallbackPackCompleted: fallbackEvidence.data?.completed === true,
  fallbackCmdAvailable,
  fallbackPs1Available,
  fallbackLauncherAvailable: fallbackCmdAvailable && fallbackPs1Available,
  phase632PreflightRequired: fallbackEvidence.data?.phase632PreflightRequired === true,
  operatorPanelStateContractGenerated,
  operatorCopyGenerated,
  importEvidenceGenerated,
  uiReadOnlyPreviewGenerated,
  noRegisterButtonAdded,
  noRunNowButtonAdded,
  packageScriptGenerated,
  windowsTaskRegisteredByThisPhase: false,
  nightlyRunnerExecutedByThisPhase: false,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: [
    paths.importDoc,
    paths.stateContract,
    paths.operatorCopy,
    paths.panelDoc,
    paths.executionReport,
  ],
  importEvidenceJson: paths.importEvidence,
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("phase638_registration_evidence_imported", result.phase638RegistrationEvidenceImported),
  check("phase638_fallback_evidence_imported", result.phase638FallbackEvidenceImported),
  check("scheduled_task_registered_false", result.scheduledTaskRegistered === false),
  check("nightly_automation_enabled_false", result.nightlyAutomationEnabled === false),
  check("original_blocker_windows_task_scheduler_access_denied", result.originalBlocker === "windows_task_scheduler_access_denied"),
  check("fallback_cmd_available", result.fallbackCmdAvailable),
  check("fallback_ps1_available", result.fallbackPs1Available),
  check("import_evidence_generated", result.importEvidenceGenerated),
  check("operator_panel_state_contract_generated", result.operatorPanelStateContractGenerated),
  check("operator_copy_generated", result.operatorCopyGenerated),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated),
  check("no_register_button_added", result.noRegisterButtonAdded),
  check("no_run_now_button_added", result.noRunNowButtonAdded),
  check("package_script_generated", result.packageScriptGenerated),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("nightly_runner_executed_by_this_phase_false", result.nightlyRunnerExecutedByThisPhase === false),
  check("windows_task_registered_by_this_phase_false", result.windowsTaskRegisteredByThisPhase === false),
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

finalize(result, checks, paths.evidence, "phase639r_nightly_fallback_operator_panel_failed");
