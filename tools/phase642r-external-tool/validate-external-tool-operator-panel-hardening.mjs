import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  exists,
  finalize,
  loadPreflightEvidence,
  readText,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase642r-external-tool/external-tool-operator-panel-hardening-result.json";
const preflight = loadPreflightEvidence();
const panelText = readText("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js");
const copyText = readText("apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js");
const docsText = [
  readText("docs/phase642r-external-tool-operator-panel-hardening.md"),
  readText("docs/phase642r-external-tool-panel-state-contract.json"),
  readText("docs/phase642r-external-tool-execution-report.md"),
].join("\n");

const result = {
  phase: "Phase642R-ExternalTool",
  name: "External Tool Operator Panel Hardening",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632PreflightPassed: preflight.data?.preflightPassed === true,
  operatorPanelHardened: panelText.includes("data-codex-phase641r-645r-external-tool-bundle=\"true\""),
  uiReadOnlyPreviewGenerated:
    panelText.includes("data-codex-phase641r-645r-read-only-preview=\"true\"") &&
    panelText.includes("data-codex-phase641r-645r-no-execution-button=\"true\""),
  externalToolModeVisible: panelText.includes("toolMode=external_tool") || panelText.includes("toolMode=${phase641R645RExternalToolBundle.toolMode}"),
  phase632PreflightVisible: panelText.includes("Phase632 preflight mandatory"),
  crsRepeatedPassVisible: panelText.includes("model_provider=crs repeated_pass"),
  notChatIntegratedVisible: panelText.includes("Not /chat integrated"),
  notChatGatewayExecuteIntegratedVisible: panelText.includes("Not /chat-gateway/execute integrated"),
  noExecutionButtonAdded:
    panelText.includes("data-codex-phase641r-645r-no-execution-button=\"true\"") &&
    !copyText.includes("Run Codex Exec Now"),
  noProviderCallButtonAdded:
    panelText.includes("data-codex-phase641r-645r-no-provider-call-button=\"true\"") &&
    !copyText.includes("Call Provider"),
  noDeployButtonAdded:
    panelText.includes("data-codex-phase641r-645r-no-deploy-button=\"true\"") &&
    !copyText.includes("Deploy Now"),
  panelStateContractGenerated: exists("docs/phase642r-external-tool-panel-state-contract.json"),
  ...safetyBoundary(),
  docs: [
    "docs/phase642r-external-tool-operator-panel-hardening.md",
    "docs/phase642r-external-tool-panel-state-contract.json",
    "docs/phase642r-external-tool-execution-report.md",
  ],
  evidencePath,
};

result.secretValueExposed = containsSecretLikeValue(docsText);
result.rawBaseUrlValueExposed = containsRawBaseUrlValue(docsText);
result.webhookValueExposed = containsWebhookLikeValue(docsText);

const checks = [
  check("operator_panel_hardened", result.operatorPanelHardened),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated),
  check("external_tool_mode_visible", result.externalToolModeVisible),
  check("phase632_preflight_visible", result.phase632PreflightVisible),
  check("crs_repeated_pass_visible", result.crsRepeatedPassVisible),
  check("not_chat_integrated_visible", result.notChatIntegratedVisible),
  check("not_chat_gateway_execute_integrated_visible", result.notChatGatewayExecuteIntegratedVisible),
  check("no_execution_button_added", result.noExecutionButtonAdded),
  check("no_provider_call_button_added", result.noProviderCallButtonAdded),
  check("no_deploy_button_added", result.noDeployButtonAdded),
  check("panel_state_contract_generated", result.panelStateContractGenerated),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, evidencePath, "phase642r_external_tool_operator_panel_failed");
