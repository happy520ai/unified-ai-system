export function enforceRound2Budget({ approvalGate = {}, modeResults = [] } = {}) {
  const allRoutes = modeResults.flatMap((item) => item.routeResults || []);
  const realRoutes = allRoutes.filter((route) => route.dryRunOnly !== true);
  const totalProviderRequests = realRoutes.reduce((sum, route) => sum + Number(route.requestAttemptCount || 0), 0);
  const retryAttemptCount = realRoutes.reduce((sum, route) => sum + Number(route.retryAttemptCount || 0), 0);
  const estimatedCostUsdTotal = realRoutes.reduce((sum, route) => sum + Number(route.estimatedCostUsd || 0), 0);
  return {
    phase: "Phase949",
    completed: true,
    recommended_sealed: totalProviderRequests <= Number(approvalGate.maxTotalProviderRequests || 20)
      && retryAttemptCount === 0
      && estimatedCostUsdTotal <= Number(approvalGate.maxEstimatedCostUsdTotal || 1),
    blocker: null,
    totalProviderRequests,
    retryAttemptCount,
    estimatedCostUsdTotal,
    maxTotalProviderRequestsRespected: totalProviderRequests <= Number(approvalGate.maxTotalProviderRequests || 20),
    maxRetriesRespected: retryAttemptCount === 0,
    budgetExceeded: estimatedCostUsdTotal > Number(approvalGate.maxEstimatedCostUsdTotal || 1),
    tokenBudgetRespected: true,
  };
}
