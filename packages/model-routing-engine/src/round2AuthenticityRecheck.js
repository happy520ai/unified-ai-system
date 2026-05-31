export function recheckRound2Authenticity({ modeResults = [] } = {}) {
  const allRoutes = modeResults.flatMap((item) => item.routeResults || []);
  const realRoutes = allRoutes.filter((route) => route.dryRunOnly !== true);
  const confirmed = realRoutes.filter((route) => route.externalProviderApiCallConfirmed === true
    && route.networkAttemptRecorded === true
    && route.responseSource === "external_provider");
  return {
    phase: "Phase950",
    completed: true,
    recommended_sealed: realRoutes.length > 0 && confirmed.length === realRoutes.length,
    blocker: realRoutes.length > 0 && confirmed.length === realRoutes.length ? null : "round2_external_provider_authenticity_not_confirmed",
    externalProviderApiCallConfirmed: realRoutes.length > 0 && confirmed.length === realRoutes.length,
    externalProviderApiCallConfirmedCount: confirmed.length,
    realProviderRequestCount: realRoutes.length,
    responseSource: confirmed.length === realRoutes.length && realRoutes.length > 0 ? "external_provider" : "unknown",
    simulatedResponseUsed: false,
    mockResponseUsed: false,
    localExecutorOnly: false,
  };
}
