export const LIMITED_ENABLE_APPROVAL_FINALIZATION_SCHEMA_VERSION = "phase1256-1265.taiji-beidou-limited-enable-approval-finalization.v1";

export function buildLimitedEnableApprovalFinalization(input = {}) {
  const approval = normalizeLimitedEnableApproval(input.approval);
  const phases = {};
  const titles = [
    "Limited Enable Approval Draft Intake",
    "Owner Decision Schema Finalization",
    "Approval Field Completeness Review",
    "Limited Enable Scope Lock",
    "Provider / Secret / Deploy Deny Policy Lock",
    "Behind-flag Enable Boundary Contract",
    "Limited Enable Approval JSON Generation",
    "Final Approval Safety Brake",
    "Approval Finalization Evidence Ledger",
    "Limited Enable Approval Finalization Closure",
  ];
  for (let offset = 0; offset < titles.length; offset += 1) {
    const phaseNumber = 1256 + offset;
    phases[`phase${phaseNumber}`] = {
      phase: `Phase${phaseNumber}`,
      title: titles[offset],
      completed: approval.ownerApproved === true,
      recommended_sealed: approval.ownerApproved === true,
      blocker: approval.ownerApproved === true ? null : "limited_enable_approval_missing_or_invalid",
    };
  }

  return {
    schemaVersion: LIMITED_ENABLE_APPROVAL_FINALIZATION_SCHEMA_VERSION,
    batch: "Phase1256-1265",
    completed: approval.ownerApproved === true,
    recommended_sealed: approval.ownerApproved === true,
    blocker: approval.ownerApproved === true ? null : "limited_enable_approval_missing_or_invalid",
    ...phases,
    approvalFinalizationCompleted: approval.ownerApproved === true,
    limitedEnableApprovalJsonGenerated: true,
    limitedEnableExecutionAllowedForNextBatch: true,
    providerCallAllowed: false,
    secretReadAllowed: false,
    chatDefaultChangeAllowed: false,
    chatGatewayExecuteDefaultChangeAllowed: false,
    mainChainDefaultEnableAllowed: false,
    deploymentAllowed: false,
    approval,
  };
}

export function normalizeLimitedEnableApproval(approval = {}) {
  const ownerApproved = approval.phaseRange === "Phase1256-1305"
    && approval.decision === "approved_limited_enable_behind_flag_and_default_readiness_assessment_only"
    && approval.ownerApproved === true
    && approval.allowApprovalFinalization === true
    && approval.allowLimitedEnablePreparation === true
    && approval.allowGuardedLimitedEnableBehindFlag === true
    && approval.allowLimitedEnableResultClosure === true
    && approval.allowDefaultEnableReadinessAssessment === true
    && approval.allowDefaultEnableExecution === false
    && approval.allowProviderCall === false
    && approval.allowSecretRead === false
    && approval.allowAuthJsonRead === false
    && approval.allowRawCredentialRefRead === false
    && approval.allowCredentialRefBypass === false
    && approval.allowQuotaBypass === false
    && approval.allowBudgetBypass === false
    && approval.allowSelectableGateBypass === false
    && approval.allowChatDefaultChange === false
    && approval.allowChatGatewayExecuteDefaultChange === false
    && approval.allowMainChainDefaultEnable === false
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
    ownerApproved,
    valid: ownerApproved,
  };
}
