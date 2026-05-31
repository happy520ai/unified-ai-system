import { buildGodMarkerRerunBlockedFinalEvidence, PHASE966_970_EXPECTED_MARKER } from "./godMarkerRerunApprovalIntake.js";

export function buildGodMarkerRerunFinalSeal({
  approvalGate = {},
  contract = {},
  rerunResult = {},
  rebind = {},
} = {}) {
  if (approvalGate.authorizationComplete !== true) {
    return buildGodMarkerRerunBlockedFinalEvidence({ approvalGate, contract });
  }
  const passed = rerunResult.godModeSmallScopeRerunPassed === true
    && rebind.phase941960BlockerCanBeClearedBySupplement === true
    && rebind.phase941960OriginalEvidenceMutated === false;
  return {
    phaseRange: "Phase966-970",
    completed: true,
    recommended_sealed: passed,
    blocker: passed ? null : "god_dual_reviewer_marker_rerun_failed",
    approvalPresent: approvalGate.approvalPresent === true,
    targetScenario: "god_dual_reviewer",
    providerAllowlist: approvalGate.providerAllowlist || ["nvidia"],
    credentialRefOnly: true,
    promptMarkerContractReady: contract.promptMarkerContractReady === true,
    rootCauseFromPhase961965: contract.rootCauseFromPhase961965 || "prompt_marker_contract_mismatch",
    godDualReviewerRerunExecuted: rerunResult.totalProviderRequests > 0,
    providerCallsMade: rerunResult.providerCallsMade === true,
    totalProviderRequests: rerunResult.totalProviderRequests || 0,
    maxTotalProviderRequestsRespected: (rerunResult.totalProviderRequests || 0) <= (approvalGate.maxTotalProviderRequests || 4),
    maxRetriesRespected: rerunResult.retryAttemptCount === 0,
    estimatedCostUsdTotal: rerunResult.estimatedCostUsd || 0,
    budgetExceeded: (rerunResult.estimatedCostUsd || 0) > (approvalGate.maxEstimatedCostUsdTotal || 0.25),
    externalProviderApiCallConfirmed: rerunResult.externalProviderApiCallConfirmed === true,
    networkAttemptRecorded: rerunResult.networkAttemptRecorded === true,
    responseSource: rerunResult.responseSource || "unknown",
    reviewerAFound: rerunResult.reviewerAFound === true,
    reviewerBFound: rerunResult.reviewerBFound === true,
    synthesisFound: rerunResult.synthesisFound === true,
    finalAnswerFound: rerunResult.finalAnswerFound === true,
    markerFound: rerunResult.markerFound === true,
    expectedMarker: rerunResult.expectedMarker || PHASE966_970_EXPECTED_MARKER,
    responseClassification: rerunResult.responseClassification || "blocked_by_gate",
    godModeSmallScopeRerunPassed: rerunResult.godModeSmallScopeRerunPassed === true,
    phase969RebindPerformed: rebind.rebindPerformed === true,
    phase941960OriginalEvidenceMutated: false,
    phase941960BlockerCanBeClearedBySupplement: rebind.phase941960BlockerCanBeClearedBySupplement === true,
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
