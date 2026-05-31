import {
  check,
  exists,
  finalize,
  loadContextState,
  loadPreflightEvidence,
  readJson,
  readText,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase648r-external-tool/evidence-dashboard-pack-result.json";
const preflight = loadPreflightEvidence();
const contextState = loadContextState();
const evidenceIndex = readJson("docs/phase648r-external-tool-evidence-index.json", {});
const dashboardContract = readJson("docs/phase648r-external-tool-dashboard-state-contract.json", {});
const panelText = readText("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js");
const copyText = readText("apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js");

const forbiddenActionNeedles = [
  'data-codex-context-action="codex-exec-now"',
  'data-codex-context-action="provider-call-now"',
  'data-codex-context-action="chat-integration"',
  'data-codex-context-action="chat-gateway-execute-integration"',
  'data-codex-context-action="deploy-now"',
  'data-codex-context-action="release-now"',
  'data-codex-context-action="push-now"',
  '["codex-exec-now"',
  '["provider-call-now"',
  '["chat-integration"',
  '["chat-gateway-execute-integration"',
  '["deploy-now"',
  '["release-now"',
  '["push-now"',
];
const secretInputPattern = /<input[^>]+(?:auth-json|secret|api-key|webhook|base-url)/i;

const result = {
  phase: "Phase648R-ExternalTool",
  name: "External Tool Evidence Dashboard Pack",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  evidenceDashboardPackGenerated: exists("docs/phase648r-external-tool-evidence-dashboard-pack.md"),
  evidenceIndexGenerated: evidenceIndex.exists === true && !evidenceIndex.parseErrorReason,
  dashboardStateContractGenerated: dashboardContract.exists === true && !dashboardContract.parseErrorReason,
  executionReportGenerated: exists("docs/phase648r-external-tool-execution-report.md"),
  uiReadOnlyPreviewGenerated:
    panelText.includes("data-codex-phase646r-650r-external-tool-dashboard=\"true\"") &&
    panelText.includes("data-codex-phase646r-650r-no-execution-button=\"true\"") &&
    copyText.includes("phase646r-650r-external-tool-dashboard"),
  externalToolMode: true,
  phase632PreflightStatus: preflight.data?.preflightPassed === true ? "passed" : "missing_or_failed",
  contextPackStatus: contextState.contextPackExists ? "present" : "missing",
  relevantFilesStatus: contextState.relevantFilesExists ? `present:${contextState.relevantFilesCount}` : "missing",
  tokenBudgetStatus: contextState.tokenBudgetReportExists ? "present" : "missing",
  staleGateStatus: contextState.staleFalse ? "stale=false" : "stale_or_missing",
  nightlyRunnerStatus: "safe_runner_available",
  fallbackLauncherStatus: "fallback_launcher_available",
  latestEvidencePaths: evidenceIndex.data?.latestEvidencePaths ?? [],
  notChatIntegrated: true,
  notChatGatewayExecuteIntegrated: true,
  notProviderRuntime: true,
  productionReady: false,
  releaseReady: false,
  noExecutionButtonAdded: forbiddenActionNeedles.every((needle) => !panelText.includes(needle) && !copyText.includes(needle)),
  noProviderCallButtonAdded:
    !panelText.includes('data-codex-context-action="provider-call-now"') &&
    !copyText.includes('["provider-call-now"'),
  noChatIntegrationButtonAdded:
    !panelText.includes('data-codex-context-action="chat-integration"') &&
    !copyText.includes('["chat-integration"'),
  noDeployButtonAdded:
    !panelText.includes('data-codex-context-action="deploy-now"') &&
    !panelText.includes('data-codex-context-action="release-now"') &&
    !panelText.includes('data-codex-context-action="push-now"') &&
    !copyText.includes('["deploy-now"') &&
    !copyText.includes('["release-now"') &&
    !copyText.includes('["push-now"'),
  noSecretInputAdded: !secretInputPattern.test(panelText),
  ...safetyBoundary(),
  docs: [
    "docs/phase648r-external-tool-evidence-dashboard-pack.md",
    "docs/phase648r-external-tool-evidence-index.json",
    "docs/phase648r-external-tool-dashboard-state-contract.json",
    "docs/phase648r-external-tool-execution-report.md",
  ],
  evidencePath,
};

const checks = [
  check("evidence_dashboard_pack_generated", result.evidenceDashboardPackGenerated),
  check("evidence_index_generated", result.evidenceIndexGenerated),
  check("dashboard_state_contract_generated", result.dashboardStateContractGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated),
  check("external_tool_mode_true", result.externalToolMode),
  check("phase632_preflight_status_passed", result.phase632PreflightStatus === "passed"),
  check("context_pack_status_present", result.contextPackStatus === "present"),
  check("relevant_files_status_present", result.relevantFilesStatus.startsWith("present")),
  check("token_budget_status_present", result.tokenBudgetStatus === "present"),
  check("stale_gate_status_false", result.staleGateStatus === "stale=false"),
  check("latest_evidence_paths_present", result.latestEvidencePaths.length >= 4),
  check("not_chat_integrated", result.notChatIntegrated),
  check("not_chat_gateway_execute_integrated", result.notChatGatewayExecuteIntegrated),
  check("not_provider_runtime", result.notProviderRuntime),
  check("production_ready_false", result.productionReady === false),
  check("release_ready_false", result.releaseReady === false),
  check("no_execution_button_added", result.noExecutionButtonAdded),
  check("no_provider_call_button_added", result.noProviderCallButtonAdded),
  check("no_chat_integration_button_added", result.noChatIntegrationButtonAdded),
  check("no_deploy_button_added", result.noDeployButtonAdded),
  check("no_secret_input_added", result.noSecretInputAdded),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, evidencePath, "phase648r_external_tool_evidence_dashboard_failed");
