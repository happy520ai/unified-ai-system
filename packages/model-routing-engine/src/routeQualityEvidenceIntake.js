export function intakePhase916930RouteQualityEvidence({
  requiredFinal = null,
  canonicalFinal = null,
} = {}) {
  const failures = [];
  if (!requiredFinal) failures.push("real_route_quality_test_final_missing");
  if (!canonicalFinal) failures.push("phase916_930_final_missing");

  const source = requiredFinal || canonicalFinal || {};
  const scenarioResults = Array.isArray(source.scenarioResults) ? source.scenarioResults : [];

  return {
    phase: "Phase931",
    completed: true,
    recommended_sealed: failures.length === 0,
    blocker: failures.length ? "phase916_930_evidence_missing" : null,
    sourcePhase: "Phase916-930",
    sourceEvidencePresent: failures.length === 0,
    requiredFinalPresent: Boolean(requiredFinal),
    canonicalFinalPresent: Boolean(canonicalFinal),
    realRouteEvidenceCount: scenarioResults.length,
    realRouteQualityTestExecuted: source.realRouteQualityTestExecuted === true,
    providerCallsMade: source.providerCallsMade === true,
    totalProviderRequests: Number(source.totalProviderRequests || 0),
    estimatedCostUsdTotal: Number(source.estimatedCostUsdTotal || 0),
    normalModeRouteTestPassed: source.normalModeRouteTestPassed === true,
    godModeRouteTestPassed: source.godModeRouteTestPassed === true,
    tianshuModeRouteTestPassed: source.tianshuModeRouteTestPassed === true,
    fallbackRouteTestPassed: source.fallbackRouteTestPassed === true,
    externalProviderApiCallConfirmed: source.externalProviderApiCallConfirmed === true,
    networkAttemptRecorded: source.networkAttemptRecorded === true,
    responseSource: source.responseSource || "unknown",
    selectableModelCountBefore: Number(source.selectableModelCountBefore || 0),
    selectableModelCountAfter: Number(source.selectableModelCountAfter || 0),
    scenarioResults,
    providerCallsMadeThisPhase: false,
    newProviderRequestsThisPhase: 0,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    failures,
  };
}
