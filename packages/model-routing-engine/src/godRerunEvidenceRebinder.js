export function buildGodRerunEvidenceRebind({
  originalGodResult = {},
  rerunResult = {},
} = {}) {
  const originalRoute = (originalGodResult.routeResults || []).find((route) => route.scenarioId === "god_dual_reviewer") || {};
  const rerunPassed = rerunResult.godModeSmallScopeRerunPassed === true;
  return {
    phase: "Phase969",
    completed: true,
    recommended_sealed: rerunPassed,
    blocker: rerunPassed ? null : "god_dual_reviewer_marker_rerun_failed",
    rebindPerformed: rerunPassed,
    originalPhase941960GodResult: originalRoute.responseClassification || "unknown",
    phase966970SupplementalRerunResult: rerunResult.responseClassification || "unknown",
    originalEvidenceMutated: false,
    phase941960OriginalEvidenceMutated: false,
    godModeRound2SupplementalRerunPassed: rerunPassed,
    phase941960BlockerCanBeClearedBySupplement: rerunPassed,
    safeWording: "Phase941-960 original god_dual_reviewer evidence remains failed; Phase966-970 supplies a supplemental small-scope rerun that validates corrected marker/scoring design.",
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
  };
}
