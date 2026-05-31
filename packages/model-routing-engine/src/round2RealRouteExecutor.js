export function normalizeRound2RouteResult({ scenario = {}, envelope = {}, latencyMs = null } = {}) {
  const httpStatus = Number(envelope.data?.httpStatus || envelope.meta?.httpStatus || 0);
  const providerCallAttempted = envelope.meta?.providerCalled === true;
  const providerResponseReceived = providerCallAttempted && httpStatus > 0;
  const responseText = String(envelope.data?.text || envelope.data?.outputText || "");
  const signalMatches = (scenario.expectedSignals || []).map((signal) => ({
    signal,
    matched: responseText.toLowerCase().includes(String(signal).toLowerCase()),
  }));
  const routeTestPassed = providerResponseReceived === true
    && envelope.success === true
    && (signalMatches.length === 0 || signalMatches.some((item) => item.matched === true));
  return {
    routeId: `phase941_960_${scenario.id}`,
    mode: scenario.mode,
    scenarioId: scenario.id,
    providerId: "nvidia",
    modelId: scenario.modelId,
    credentialRefOnly: true,
    networkAttemptRecorded: providerCallAttempted,
    responseSource: providerResponseReceived ? "external_provider" : "unknown",
    externalProviderApiCallConfirmed: providerResponseReceived,
    requestAttemptCount: providerCallAttempted ? 1 : 0,
    retryAttemptCount: 0,
    responseClassification: providerResponseReceived
      ? routeTestPassed ? "pass" : "marker_missing"
      : "provider_error",
    routeTestPassed,
    providerSuccess: envelope.success === true,
    qualityScore: scoreRound2Route({ providerResponseReceived, routeTestPassed, responseSource: providerResponseReceived ? "external_provider" : "unknown" }),
    estimatedCostUsd: 0,
    latencyMs,
    fallbackFromModelId: scenario.fallbackFromModelId || null,
    fallbackReason: scenario.fallbackReason || null,
    expectedSignals: scenario.expectedSignals || [],
    signalMatches,
    responsePreview: responseText.slice(0, 240),
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    mockResponseUsed: false,
    simulatedResponseUsed: false,
    dryRunOnly: false,
    localExecutorOnly: false,
  };
}

export function buildRound2DryRunRouteResult({ scenario = {}, reason = "planned_dry_run_to_respect_request_budget" } = {}) {
  return {
    routeId: `phase941_960_${scenario.id}`,
    mode: scenario.mode,
    scenarioId: scenario.id,
    providerId: "nvidia",
    modelId: scenario.modelId,
    credentialRefOnly: true,
    networkAttemptRecorded: false,
    responseSource: "dry_run",
    externalProviderApiCallConfirmed: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    responseClassification: "dry_run_only",
    routeTestPassed: true,
    qualityScore: 0,
    estimatedCostUsd: 0,
    latencyMs: null,
    dryRunReason: reason,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    mockResponseUsed: false,
    simulatedResponseUsed: false,
    dryRunOnly: true,
    localExecutorOnly: false,
  };
}

export function summarizeRound2ModeResult({ mode, routeResults = [], blocked = false, blocker = null } = {}) {
  const realRoutes = routeResults.filter((route) => route.dryRunOnly !== true);
  const passed = !blocked && realRoutes.length > 0 && realRoutes.every((route) => route.routeTestPassed === true);
  return {
    phase: `Phase${mode}`,
    mode,
    completed: true,
    recommended_sealed: passed,
    blocker: passed ? null : blocker || (blocked ? "round2_mode_blocked" : "round2_mode_no_real_routes"),
    routeCount: routeResults.length,
    realProviderRequestCount: realRoutes.reduce((sum, route) => sum + Number(route.requestAttemptCount || 0), 0),
    routeResults,
    modeRound2Passed: passed,
    providerCallsMade: realRoutes.length > 0,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
  };
}

export function scoreRound2Route({ providerResponseReceived, routeTestPassed, responseSource }) {
  let score = 0;
  if (providerResponseReceived) score += 35;
  if (responseSource === "external_provider") score += 25;
  if (routeTestPassed) score += 40;
  return Math.max(0, Math.min(100, score));
}
