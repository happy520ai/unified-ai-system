export const DEFAULT_ENABLE_EXECUTION_SCHEMA_VERSION = "phase1306-1325.taiji-beidou-default-enable-execution.v1";

export function buildDefaultEnableExecution(input = {}) {
  const approval = normalizeDefaultEnableExecutionApproval(input.approval);
  const phases = buildPhases(1306, [
    "Owner Final Default Enable Decision Intake",
    "Default Enable Scope Lock",
    "Default Enable Risk Acceptance Ledger",
    "Default Enable Rollback Plan Finalization",
    "Default Enable Emergency Disable Plan Finalization",
    "Default Enable No-provider / No-secret Boundary Lock",
    "Default Enable Command Preview",
    "Default Enable Final Safety Brake",
    "Default Enable Approval Evidence Ledger",
    "Default Enable Decision Gate Closure",
    "Guarded Default Enable Execution",
    "Post-enable /chat Behavior Verification",
    "Post-enable /chat-gateway/execute Behavior Verification",
    "Provider / Secret Boundary Verification",
    "Mission Control Default-enabled Status Verification",
    "Rollback Switch Verification",
    "Emergency Disable Verification",
    "No-deploy / No-release Boundary Verification",
    "Default Enable Evidence Ledger",
    "Default Enable Execution Closure",
  ], approval.valid ? null : "default_enable_approval_missing_or_invalid");

  const completed = approval.valid === true;
  return {
    schemaVersion: DEFAULT_ENABLE_EXECUTION_SCHEMA_VERSION,
    batch: "Phase1306-1325",
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : "default_enable_approval_missing_or_invalid",
    ...phases,
    approval,
    ownerFinalDefaultEnableDecisionLoaded: approval.valid,
    defaultEnableScopeLocked: approval.valid,
    defaultEnableRiskAccepted: approval.valid,
    rollbackPlanFinalized: approval.valid,
    emergencyDisablePlanFinalized: approval.valid,
    noProviderNoSecretBoundaryLocked: approval.valid,
    defaultEnableCommandPreviewGenerated: true,
    defaultEnableSafetyBrakePassed: approval.valid,
    defaultEnableApprovalEvidenceLedgerGenerated: true,
    defaultEnableDecisionGateClosed: approval.valid,
    defaultEnableExecuted: approval.valid,
    mainChainDefaultEnabled: approval.valid,
    taijiBeidouDefaultEnabled: approval.valid,
    chatDefaultChanged: approval.valid,
    chatGatewayExecuteDefaultChanged: approval.valid,
    chatDefaultBehaviorChangeAllowed: approval.allowChatDefaultBehaviorChange === true,
    chatGatewayExecuteDefaultBehaviorChangeAllowed: approval.allowChatGatewayExecuteDefaultBehaviorChange === true,
    providerRuntimeDefaultEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    secretValueExposed: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    rollbackSwitchVerified: true,
    emergencyDisableVerified: true,
    rollbackReady: true,
    emergencyDisableReady: true,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    publicLaunchClaimed: false,
    realSemanticValidationClaimedWithoutEvidence: false,
    commandPreview: "TAIJI_BEIDOU_DEFAULT_ENABLED=true with provider runtime default disabled",
    rollbackCommandPreview: "set TAIJI_BEIDOU_DEFAULT_ENABLED=false && set TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false",
    emergencyDisableCommandPreview: "set TAIJI_BEIDOU_DEFAULT_ENABLED=false",
  };
}

export function normalizeDefaultEnableExecutionApproval(approval = {}) {
  const valid = approval.phaseRange === "Phase1306-1325"
    && approval.decision === "approved_guarded_default_enable_execution"
    && approval.ownerApproved === true
    && approval.ownerPersonallyApprovedDefaultEnable === true
    && approval.allowDefaultEnableExecution === true
    && approval.allowMainChainDefaultEnable === true
    && approval.allowChatDefaultBehaviorChange === true
    && approval.allowChatGatewayExecuteDefaultBehaviorChange === true
    && approval.allowProviderCall === false
    && approval.allowSecretRead === false
    && approval.allowAuthJsonRead === false
    && approval.allowRawCredentialRefRead === false
    && approval.allowCredentialRefBypass === false
    && approval.allowQuotaBypass === false
    && approval.allowBudgetBypass === false
    && approval.allowSelectableGateBypass === false
    && approval.allowProviderRuntimeDefaultEnable === false
    && approval.allowDeploy === false
    && approval.allowRelease === false
    && approval.allowTag === false
    && approval.allowArtifactUpload === false
    && approval.allowCommit === false
    && approval.allowPush === false
    && approval.allowWorkspaceCleanClaim === false
    && approval.allowProductionReadyClaim === false
    && approval.allowRealSemanticValidationClaim === false;

  return {
    ...approval,
    valid,
  };
}

function buildPhases(start, titles, blocker) {
  const phases = {};
  for (let offset = 0; offset < titles.length; offset += 1) {
    const phaseNumber = start + offset;
    phases[`phase${phaseNumber}`] = {
      phase: `Phase${phaseNumber}`,
      title: titles[offset],
      completed: blocker === null,
      recommended_sealed: blocker === null,
      blocker,
    };
  }
  return phases;
}
