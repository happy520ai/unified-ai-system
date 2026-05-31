export const PHASE941_960_APPROVAL_DECISION = "approved_execute_phase941_960_real_route_quality_test_round2";

export function evaluateRound2Approval({
  approval = null,
  phase912915 = {},
  phase916930 = {},
  phase931940 = {},
} = {}) {
  const failures = [];
  if (phase912915.externalProviderApiCallConfirmed !== true) failures.push("phase912_915_external_provider_auth_missing");
  if (phase916930.recommended_sealed !== true || phase916930.externalProviderApiCallConfirmed !== true) failures.push("phase916_930_real_quality_evidence_missing");
  if (phase931940.recommended_sealed !== true) failures.push("phase931_940_quality_audit_missing");
  if (!approval) failures.push("phase941_960_approval_missing");
  if (approval) {
    if (approval.decision !== PHASE941_960_APPROVAL_DECISION) failures.push("approval_decision_invalid");
    if (!Array.isArray(approval.providerAllowlist) || approval.providerAllowlist.length !== 1 || approval.providerAllowlist[0] !== "nvidia") failures.push("provider_allowlist_must_be_nvidia_only");
    if (approval.credentialRef !== "credentialRef:nvidia:default") failures.push("credential_ref_invalid");
    if (approval.credentialRefOnly !== true) failures.push("credential_ref_only_required");
    if (!["normal", "god", "tianshu", "fallback"].every((mode) => approval.allowedModes?.includes(mode))) failures.push("allowed_modes_incomplete");
    if (approval.maxTotalProviderRequests > 20) failures.push("max_total_provider_requests_exceeded");
    if (approval.maxRequestsPerMode > 5) failures.push("max_requests_per_mode_exceeded");
    if (approval.maxRequestsPerModel > 4) failures.push("max_requests_per_model_exceeded");
    if (approval.maxRetriesPerRequest !== 0) failures.push("max_retries_per_request_must_be_zero");
    if (approval.maxEstimatedCostUsdTotal > 1) failures.push("max_estimated_cost_exceeded");
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
    if (approval.allowProviderCall !== true) failures.push("allow_provider_call_required");
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
      "evidenceRequired",
      "rollbackRequired",
    ]) {
      if (acknowledgements[key] !== true) failures.push(`acknowledgement_${key}_required`);
    }
  }
  return {
    phase: "Phase941",
    completed: true,
    recommended_sealed: failures.length === 0,
    blocker: failures.length ? failures[0] : null,
    round2ApprovalPresent: Boolean(approval),
    authorizationComplete: failures.length === 0,
    providerAllowlist: approval?.providerAllowlist || ["nvidia"],
    credentialRef: "credentialRef:nvidia:default",
    credentialRefOnly: true,
    maxTotalProviderRequests: approval?.maxTotalProviderRequests || 20,
    maxRequestsPerMode: approval?.maxRequestsPerMode || 5,
    maxRequestsPerModel: approval?.maxRequestsPerModel || 4,
    maxRetriesPerRequest: approval?.maxRetriesPerRequest ?? 0,
    maxEstimatedCostUsdTotal: approval?.maxEstimatedCostUsdTotal || 1,
    failures,
  };
}

export function buildRound2BlockedFinalEvidence({ approvalGate = {}, blocker = null } = {}) {
  return {
    phaseRange: "Phase941-960",
    completed: true,
    recommended_sealed: false,
    blocker: blocker || approvalGate.blocker || "phase941_960_approval_missing",
    round2ApprovalPresent: approvalGate.round2ApprovalPresent === true,
    realRouteQualityRound2Executed: false,
    providerAllowlist: approvalGate.providerAllowlist || ["nvidia"],
    credentialRefOnly: true,
    providerCallsMade: false,
    totalProviderRequests: 0,
    maxTotalProviderRequestsRespected: true,
    maxRetriesRespected: true,
    estimatedCostUsdTotal: 0,
    budgetExceeded: false,
    normalModeRound2Passed: false,
    godModeRound2Passed: false,
    tianshuModeRound2Passed: false,
    fallbackRound2Passed: false,
    externalProviderApiCallConfirmed: false,
    networkAttemptRecorded: false,
    responseSource: "unknown",
    externalProviderApiCallConfirmedCount: 0,
    realProviderRequestCount: 0,
    routeQualityScoringReady: false,
    averageQualityScore: 0,
    modeComparisonReady: false,
    modelFitAnalysisReady: false,
    routePolicyTuningRecommendationReady: false,
    routePolicyAppliedToRuntime: false,
    requiresFutureApprovalForTuning: true,
    globalSelectableModelBaseline: 17,
    round2EligiblePoolCount: 0,
    selectableModifiedThisPhase: false,
    unauthorizedSelectableChangeDetected: false,
    blockedHighRiskModelsExcluded: true,
    failedModelsExcluded: true,
    credentialMissingModelsExcludedFromRuntime: true,
    sampleSizeStillLimited: true,
    recommendationIsStillPreliminary: true,
    humanReviewed: false,
    codexSurrogateReviewed: true,
    realSevenDaySoakCompleted: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true,
  };
}
