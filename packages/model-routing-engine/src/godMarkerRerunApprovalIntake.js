export const PHASE966_970_APPROVAL_DECISION = "approved_execute_phase966_970_god_mode_marker_rerun";
export const PHASE966_970_TARGET_SCENARIO = "god_dual_reviewer";
export const PHASE966_970_EXPECTED_MARKER = "GOD_DUAL_REVIEWER_RERUN_OK";

export function evaluateGodMarkerRerunApproval({
  template = null,
  approval = null,
  phase961965Audit = {},
  phase961965Design = {},
} = {}) {
  const failures = [];
  if (!template) failures.push("phase966_970_template_missing");
  if (!approval) failures.push("phase966_970_approval_missing");
  if (phase961965Audit.markerMismatchRootCauseClassified !== true) failures.push("phase961_965_audit_missing");
  if (phase961965Design.godModePromptFixDesignReady !== true) failures.push("phase961_965_prompt_fix_design_missing");
  if (phase961965Design.godModeScoringFixDesignReady !== true) failures.push("phase961_965_scoring_fix_design_missing");
  if (approval) {
    if (approval.decision !== PHASE966_970_APPROVAL_DECISION) failures.push("approval_decision_invalid");
    if (approval.targetScenario !== PHASE966_970_TARGET_SCENARIO) failures.push("target_scenario_invalid");
    if (!Array.isArray(approval.providerAllowlist) || approval.providerAllowlist.length !== 1 || approval.providerAllowlist[0] !== "nvidia") failures.push("provider_allowlist_must_be_nvidia_only");
    if (approval.credentialRef !== "credentialRef:nvidia:default") failures.push("credential_ref_invalid");
    if (approval.credentialRefOnly !== true) failures.push("credential_ref_only_required");
    if (!Array.isArray(approval.allowedModes) || approval.allowedModes.length !== 1 || approval.allowedModes[0] !== "god") failures.push("allowed_modes_must_be_god_only");
    if (approval.maxTotalProviderRequests > 4) failures.push("max_total_provider_requests_exceeded");
    if (approval.maxRequestsPerModel > 2) failures.push("max_requests_per_model_exceeded");
    if (approval.maxRetriesPerRequest !== 0) failures.push("max_retries_per_request_must_be_zero");
    if (approval.maxEstimatedCostUsdTotal > 0.25) failures.push("max_estimated_cost_exceeded");
    if (approval.allowProviderCall !== true) failures.push("allow_provider_call_required");
    for (const key of [
      "allowSecretRead",
      "allowAuthJsonRead",
      "allowDeploy",
      "allowRelease",
      "allowTag",
      "allowArtifactUpload",
      "allowChatDefaultEnable",
      "allowChatGatewayExecuteDefaultEnable",
      "allowChatMutation",
      "allowChatGatewayExecuteMutation",
      "allowCodexConfigMutation",
    ]) {
      if (approval[key] !== false) failures.push(`${key}_must_be_false`);
    }
    const eligibility = approval.modelEligibility || {};
    for (const key of ["requireSelectable", "requireSmokePassed", "blockFailed", "blockHighRisk", "blockDeprecated", "blockCredentialMissing"]) {
      if (eligibility[key] !== true) failures.push(`model_eligibility_${key}_required`);
    }
    const acknowledgements = approval.acknowledgements || {};
    for (const key of [
      "notProductionTraffic",
      "notDeploy",
      "notRelease",
      "notHumanReview",
      "codexSurrogateTestingOnly",
      "credentialRefOnly",
      "rawSecretMustNotBePrinted",
      "authJsonMustNotBeRead",
      "externalProviderTraceRequired",
      "maxRequestsMustBeRespected",
      "maxRetriesMustBeZero",
      "budgetMustBeRespected",
      "failedBlockedHighRiskModelsExcluded",
      "selectableMustNotChange",
      "oldEvidenceMustNotBeMutated",
      "evidenceRequired",
      "rollbackRequired",
    ]) {
      if (acknowledgements[key] !== true) failures.push(`acknowledgement_${key}_required`);
    }
  }
  return {
    phase: "Phase966",
    completed: true,
    recommended_sealed: failures.length === 0,
    blocker: failures.length ? failures[0] : null,
    approvalPresent: Boolean(approval),
    templatePresent: Boolean(template),
    authorizationComplete: failures.length === 0,
    targetScenario: approval?.targetScenario || PHASE966_970_TARGET_SCENARIO,
    providerAllowlist: approval?.providerAllowlist || ["nvidia"],
    credentialRef: approval?.credentialRef || "credentialRef:nvidia:default",
    credentialRefOnly: true,
    maxTotalProviderRequests: approval?.maxTotalProviderRequests || 4,
    maxRequestsPerModel: approval?.maxRequestsPerModel || 2,
    maxRetriesPerRequest: approval?.maxRetriesPerRequest ?? 0,
    maxEstimatedCostUsdTotal: approval?.maxEstimatedCostUsdTotal || 0.25,
    failures,
  };
}

export function buildGodMarkerRerunBlockedFinalEvidence({ approvalGate = {}, contract = {}, blocker = null } = {}) {
  return {
    phaseRange: "Phase966-970",
    completed: true,
    recommended_sealed: false,
    blocker: blocker || approvalGate.blocker || "phase966_970_approval_missing",
    approvalPresent: approvalGate.approvalPresent === true,
    targetScenario: PHASE966_970_TARGET_SCENARIO,
    providerAllowlist: approvalGate.providerAllowlist || ["nvidia"],
    credentialRefOnly: true,
    promptMarkerContractReady: contract.promptMarkerContractReady === true,
    rootCauseFromPhase961965: contract.rootCauseFromPhase961965 || "prompt_marker_contract_mismatch",
    godDualReviewerRerunExecuted: false,
    providerCallsMade: false,
    totalProviderRequests: 0,
    maxTotalProviderRequestsRespected: true,
    maxRetriesRespected: true,
    estimatedCostUsdTotal: 0,
    budgetExceeded: false,
    externalProviderApiCallConfirmed: false,
    networkAttemptRecorded: false,
    responseSource: "unknown",
    reviewerAFound: false,
    reviewerBFound: false,
    synthesisFound: false,
    finalAnswerFound: false,
    markerFound: false,
    expectedMarker: PHASE966_970_EXPECTED_MARKER,
    responseClassification: "not_executed_no_approval",
    godModeSmallScopeRerunPassed: false,
    phase969RebindPerformed: false,
    phase941960OriginalEvidenceMutated: false,
    phase941960BlockerCanBeClearedBySupplement: false,
    routePolicyAppliedToRuntime: false,
    requiresFutureApprovalForRuntimePolicyChange: true,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    humanReviewed: false,
    codexSurrogateReviewed: true,
    realSevenDaySoakCompleted: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true,
  };
}
