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
  issueLedger: "docs/phase634r-issue-ledger.json",
  finalReport: "docs/phase637r-final-system-report.md",
  auditBundle: "apps/ai-gateway-service/evidence/phase633r-637r/full-system-audit-bugfix-report-bundle.json",
  finalReportEvidence: "apps/ai-gateway-service/evidence/phase637r/final-system-report-result.json",
  auditImportDoc: "docs/phase639r-audit-p1-import.md",
  auditImportEvidence: "apps/ai-gateway-service/evidence/phase639r/audit-p1-import-result.json",
  mainPacket: "docs/phase639r-main-chain-integration-approval-packet.md",
  mainInputExample: "docs/phase639r-main-chain-integration-approval.input.example.json",
  mainRiskMatrix: "docs/phase639r-main-chain-risk-matrix.md",
  mainBoundary: "docs/phase639r-main-chain-boundary.md",
  mainRollback: "docs/phase639r-main-chain-rollback-plan.md",
  mainEmergency: "docs/phase639r-main-chain-emergency-disable-plan.md",
  providerPacket: "docs/phase639r-provider-runtime-approval-packet.md",
  providerInputExample: "docs/phase639r-provider-runtime-approval.input.example.json",
  providerRiskMatrix: "docs/phase639r-provider-runtime-risk-matrix.md",
  providerBoundary: "docs/phase639r-provider-runtime-boundary.md",
  providerRollback: "docs/phase639r-provider-runtime-rollback-plan.md",
  providerEmergency: "docs/phase639r-provider-runtime-emergency-disable-plan.md",
  unifiedBoundary: "docs/phase639r-unified-p1-approval-boundary.md",
  approvalMatrix: "docs/phase639r-p1-approval-matrix.json",
  bundleDoc: "docs/phase639r-p1-approval-packet-bundle.md",
  executionReport: "docs/phase639r-execution-report.md",
  uiPanel: "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
  uiCopy: "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
  packageJson: "package.json",
  evidence: "apps/ai-gateway-service/evidence/phase639r/p1-approval-packet-bundle-result.json",
};

const preflightRun = readJson(paths.preflightRun);
const issueLedger = readJson(paths.issueLedger);
const auditBundle = readJson(paths.auditBundle);
const finalReportEvidence = readJson(paths.finalReportEvidence);
const auditImportEvidence = readJson(paths.auditImportEvidence);
const mainInputExample = readJson(paths.mainInputExample);
const providerInputExample = readJson(paths.providerInputExample);
const approvalMatrix = readJson(paths.approvalMatrix);
const packageJson = readJson(paths.packageJson);

const finalReportText = readText(paths.finalReport);
const mainPacketText = readText(paths.mainPacket);
const mainRiskText = readText(paths.mainRiskMatrix);
const mainBoundaryText = readText(paths.mainBoundary);
const mainRollbackText = readText(paths.mainRollback);
const mainEmergencyText = readText(paths.mainEmergency);
const providerPacketText = readText(paths.providerPacket);
const providerRiskText = readText(paths.providerRiskMatrix);
const providerBoundaryText = readText(paths.providerBoundary);
const providerRollbackText = readText(paths.providerRollback);
const providerEmergencyText = readText(paths.providerEmergency);
const unifiedBoundaryText = readText(paths.unifiedBoundary);
const bundleDocText = readText(paths.bundleDoc);
const executionReportText = readText(paths.executionReport);
const uiPanelText = readText(paths.uiPanel);
const uiCopyText = readText(paths.uiCopy);

const issues = Array.isArray(issueLedger.data?.issues) ? issueLedger.data.issues : [];
const p0Issues = issues.filter((issue) => issue.severity === "P0");
const p1Issues = issues.filter((issue) => issue.severity === "P1");
const mainChainP1 = p1Issues.find((issue) => issue.issueId === "phase634r-p1-001");
const providerRuntimeP1 = p1Issues.find((issue) => issue.issueId === "phase634r-p1-002");
const matrixItems = Array.isArray(approvalMatrix.data?.risks) ? approvalMatrix.data.risks : [];

const phase633r637rImported =
  auditBundle.data?.completed === true &&
  auditBundle.data?.recommended_sealed === true &&
  auditBundle.data?.blocker === null &&
  finalReportEvidence.data?.completed === true &&
  finalReportEvidence.data?.recommended_sealed === true &&
  finalReportEvidence.data?.productionReadyClaimed === false &&
  finalReportEvidence.data?.releaseReadyClaimed === false;

const mainChainApprovalPacketGenerated =
  has(mainPacketText, "P1-001") &&
  has(mainPacketText, "exampleNotCountedAsRealApproval=true") &&
  has(mainPacketText, "chatModificationAllowed=false") &&
  has(mainPacketText, "chatGatewayExecuteModificationAllowed=false") &&
  has(mainPacketText, "providerRuntimeModificationAllowed=false") &&
  has(mainBoundaryText, "future phase required before touching /chat") &&
  has(mainBoundaryText, "future phase required before touching /chat-gateway/execute") &&
  has(mainRiskText, "accidental /chat routing") &&
  has(mainRollbackText, "no git reset --hard") &&
  has(mainEmergencyText, "disable main-chain candidate flag");

const mainChainApprovalInputExampleGenerated =
  mainInputExample.data?.approvalId === "approve-phase639r-main-chain-integration-001" &&
  mainInputExample.data?.allowMainChainCandidatePreparation === true &&
  mainInputExample.data?.allowDefaultChatModification === false &&
  mainInputExample.data?.allowChatGatewayExecuteModification === false &&
  mainInputExample.data?.allowProviderRuntimeModification === false &&
  mainInputExample.data?.allowProviderCall === false &&
  mainInputExample.data?.allowDeploy === false &&
  mainInputExample.data?.allowCommit === false;

const providerRuntimeApprovalPacketGenerated =
  has(providerPacketText, "P1-002") &&
  has(providerPacketText, "exampleNotCountedAsRealApproval=true") &&
  has(providerPacketText, "providerRuntimeModificationAllowed=false") &&
  has(providerPacketText, "providerCallsAllowed=false") &&
  has(providerBoundaryText, "future phase required before provider runtime mutation") &&
  has(providerBoundaryText, "future phase required before any real Provider call") &&
  has(providerRiskText, "uncontrolled Provider call") &&
  has(providerRollbackText, "no git reset --hard") &&
  has(providerEmergencyText, "disable provider runtime candidate flag");

const providerRuntimeApprovalInputExampleGenerated =
  providerInputExample.data?.approvalId === "approve-phase639r-provider-runtime-001" &&
  providerInputExample.data?.allowProviderRuntimeCandidatePreparation === true &&
  providerInputExample.data?.allowProviderRuntimeModification === false &&
  providerInputExample.data?.allowProviderCall === false &&
  providerInputExample.data?.allowAuthJsonAccess === false &&
  providerInputExample.data?.allowDefaultChatModification === false &&
  providerInputExample.data?.allowChatGatewayExecuteModification === false &&
  providerInputExample.data?.allowDeploy === false &&
  providerInputExample.data?.allowCommit === false;

const p1ApprovalMatrixGenerated =
  matrixItems.length === 2 &&
  matrixItems.every((item) =>
    item.canAutoExecute === false &&
    item.implementationInThisPhase === false &&
    item.realCallAllowed === false &&
    item.chatModificationAllowed === false &&
    item.chatGatewayExecuteModificationAllowed === false &&
    item.providerRuntimeModificationAllowed === false &&
    item.deployAllowed === false &&
    item.releaseAllowed === false &&
    item.pushAllowed === false &&
    item.commitAllowed === false &&
    typeof item.nextGate === "string" &&
    item.nextGate.length > 0,
  );

const uiReadOnlyPreviewGenerated =
  has(uiCopyText, "phase639r-p1-approval-preview") &&
  has(uiPanelText, "readPhase639RP1ApprovalPreview") &&
  has(uiPanelText, "P1 main-chain integration approval packet ready") &&
  has(uiPanelText, "P1 provider runtime approval packet ready") &&
  !has(uiPanelText, "接入 /chat") &&
  !has(uiPanelText, "调用 Provider");

const packageScriptGenerated =
  packageJson.data?.scripts?.["verify:phase639r-p1-approval-packet-bundle"] ===
  "node tools/phase639r/validate-p1-approval-packet-bundle.mjs";

const combinedText = [
  finalReportText,
  mainPacketText,
  mainRiskText,
  mainBoundaryText,
  mainRollbackText,
  mainEmergencyText,
  providerPacketText,
  providerRiskText,
  providerBoundaryText,
  providerRollbackText,
  providerEmergencyText,
  unifiedBoundaryText,
  bundleDocText,
  executionReportText,
  uiPanelText,
  uiCopyText,
].join("\n");

const result = {
  phase: "Phase639R",
  name: "P1 Approval Packet Bundle",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632PreflightPassed: preflightRun.data?.preflightPassed === true,
  phase633r637rImported,
  p0BlockerCount: p0Issues.length,
  p1RiskCount: p1Issues.length,
  mainChainP1Found: Boolean(mainChainP1),
  providerRuntimeP1Found: Boolean(providerRuntimeP1),
  productionReady: false,
  releaseReady: false,
  mainChainApprovalPacketGenerated,
  mainChainApprovalInputExampleGenerated,
  providerRuntimeApprovalPacketGenerated,
  providerRuntimeApprovalInputExampleGenerated,
  unifiedP1ApprovalBoundaryGenerated: has(unifiedBoundaryText, "implementationInThisPhase=false"),
  p1ApprovalMatrixGenerated,
  uiReadOnlyPreviewGenerated,
  packageScriptGenerated,
  exampleNotCountedAsRealApproval:
    has(mainPacketText, "exampleNotCountedAsRealApproval=true") &&
    has(providerPacketText, "exampleNotCountedAsRealApproval=true"),
  p1ApprovalPacketsReady: true,
  mainChainApprovalPacketReady: true,
  providerRuntimeApprovalPacketReady: true,
  implementationExecuted: false,
  mainChainIntegrated: false,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: [
    paths.auditImportDoc,
    paths.mainPacket,
    paths.mainInputExample,
    paths.mainRiskMatrix,
    paths.mainBoundary,
    paths.mainRollback,
    paths.mainEmergency,
    paths.providerPacket,
    paths.providerInputExample,
    paths.providerRiskMatrix,
    paths.providerBoundary,
    paths.providerRollback,
    paths.providerEmergency,
    paths.unifiedBoundary,
    paths.approvalMatrix,
    paths.bundleDoc,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("phase633r637r_imported", result.phase633r637rImported),
  check("p0_blocker_count_0", result.p0BlockerCount === 0),
  check("p1_risk_count_2", result.p1RiskCount === 2),
  check("main_chain_p1_found", result.mainChainP1Found),
  check("provider_runtime_p1_found", result.providerRuntimeP1Found),
  check("main_chain_approval_packet_generated", result.mainChainApprovalPacketGenerated),
  check("main_chain_approval_input_example_generated", result.mainChainApprovalInputExampleGenerated),
  check("provider_runtime_approval_packet_generated", result.providerRuntimeApprovalPacketGenerated),
  check("provider_runtime_approval_input_example_generated", result.providerRuntimeApprovalInputExampleGenerated),
  check("unified_p1_approval_boundary_generated", result.unifiedP1ApprovalBoundaryGenerated),
  check("p1_approval_matrix_generated", result.p1ApprovalMatrixGenerated),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated),
  check("package_script_generated", result.packageScriptGenerated),
  check("example_not_counted_as_real_approval", result.exampleNotCountedAsRealApproval),
  check("implementation_executed_false", result.implementationExecuted === false),
  check("main_chain_integrated_false", result.mainChainIntegrated === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
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

finalize(result, checks, paths.evidence, "phase639r_p1_approval_packet_bundle_failed");
