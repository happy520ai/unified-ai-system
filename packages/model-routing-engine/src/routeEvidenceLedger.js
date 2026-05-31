export function buildRouteEvidenceLedger(input = {}) {
  const realRoutes = input.realRoutes || [];
  const surrogateRoutes = input.surrogateRoutes || [];
  const ensembleRoutes = input.ensembleRoutes || [];
  const entries = [...realRoutes, ...surrogateRoutes, ...ensembleRoutes].map((route, index) => ({
    evidenceId: route.evidenceId || `phase821-900-route-${String(index + 1).padStart(3, "0")}`,
    routeId: route.routeId,
    task: route.task || route.userTask || route.taskId,
    mode: route.mode,
    selectedModelId: route.selectedModelId || route.selected?.primaryModelId || null,
    providerId: route.providerId || route.selected?.providerId || null,
    score: route.score ?? null,
    reason: route.scoreReason || route.routeExplanation || null,
    fallback: route.fallbackChain || [],
    requestAttemptCount: route.requestAttemptCount || 0,
    responseClassification: route.responseClassification || "blocked_by_gate",
    estimatedCostUsd: route.estimatedCostUsd || 0,
    routeExplanation: route.routeExplanation || null,
    humanReviewed: false,
    codexSurrogateReviewed: route.codexSurrogateReviewed === true,
  }));
  return {
    phase: "Phase830",
    routeEvidenceLedgerReady: true,
    ledgerEntryCount: entries.length,
    entries,
    providerCallsMade: entries.some((entry) => entry.requestAttemptCount > 0),
    estimatedCostUsdTotal: Number(entries.reduce((sum, entry) => sum + entry.estimatedCostUsd, 0).toFixed(6)),
    secretRead: false,
  };
}
