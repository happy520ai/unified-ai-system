const DETECTOR_KEYS = Object.freeze({
  mock: ["mock", "mocked", "mockResponse", "mockResponseUsed"],
  simulated: ["simulated", "simulatedResponse", "simulatedResponseUsed", "simulatedProviderResponse"],
  dryRun: ["dryRun", "dryRunOnly"],
  local: ["localExecutorOnly"],
  synthetic: ["fixtureResponse", "staticResponse", "syntheticResponse"],
});

export function detectMockSimulatedDryRun(input = {}) {
  const routeEvidence = Array.isArray(input.routeEvidence) ? input.routeEvidence : [];
  const detections = routeEvidence.map((route) => {
    const flags = detectRouteFlags(route);
    return {
      routeId: route.routeId || null,
      mode: route.mode || null,
      ...flags,
    };
  });
  const counts = detections.reduce((acc, item) => {
    for (const key of ["mockResponseUsed", "simulatedResponseUsed", "dryRunOnly", "localExecutorOnly", "syntheticResponseUsed"]) {
      if (item[key] === true) acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});
  return {
    phase: "Phase904",
    mockSimulatedDryRunDetectorReady: true,
    routeEvidenceCount: routeEvidence.length,
    detections,
    counts,
    externalProviderConfirmationBlocked: detections.some((item) => (
      item.mockResponseUsed || item.simulatedResponseUsed || item.dryRunOnly || item.localExecutorOnly || item.syntheticResponseUsed
    )),
  };
}

export function detectRouteFlags(route = {}) {
  return {
    mockResponseUsed: hasAny(route, DETECTOR_KEYS.mock),
    simulatedResponseUsed: hasAny(route, DETECTOR_KEYS.simulated),
    dryRunOnly: hasAny(route, DETECTOR_KEYS.dryRun),
    localExecutorOnly: hasAny(route, DETECTOR_KEYS.local) || (
      (route.providerCallsMade === true || Number(route.requestAttemptCount || 0) > 0)
      && !route.networkAttemptRecorded
    ),
    syntheticResponseUsed: hasAny(route, DETECTOR_KEYS.synthetic),
  };
}

function hasAny(route, keys) {
  return keys.some((key) => {
    const value = route[key];
    if (value === true) return true;
    if (value === false || value == null) return false;
    return String(value).length > 0;
  });
}
