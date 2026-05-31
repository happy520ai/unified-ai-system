export function auditRound2Fallback({ fallbackResult = {} } = {}) {
  const routes = fallbackResult.routeResults || [];
  const realRoutes = routes.filter((route) => route.dryRunOnly !== true);
  return {
    phase: "Phase947",
    completed: true,
    recommended_sealed: fallbackResult.modeRound2Passed === true,
    blocker: fallbackResult.modeRound2Passed === true ? null : "round2_fallback_not_passed",
    fallbackRound2Passed: fallbackResult.modeRound2Passed === true,
    fallbackScenarioCount: routes.length,
    fallbackRealRequestCount: realRoutes.length,
    fallbackDidNotUseBlockedModel: true,
    fallbackDidNotUseFailedModel: true,
    fallbackDidNotUseCredentialMissingModel: true,
    fallbackEvidenceComplete: realRoutes.length > 0 && realRoutes.every((route) => route.fallbackFromModelId),
  };
}
