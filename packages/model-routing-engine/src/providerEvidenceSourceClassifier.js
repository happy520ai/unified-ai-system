const RESPONSE_SOURCES = Object.freeze([
  "external_provider",
  "mock",
  "simulated",
  "local_executor",
  "dry_run",
  "unknown",
]);

export function classifyProviderEvidenceSources(input = {}) {
  const evidenceFiles = Array.isArray(input.evidenceFiles) ? input.evidenceFiles : [];
  const routeEvidence = Array.isArray(input.routeEvidence) ? input.routeEvidence : [];
  const sourceBreakdown = Object.fromEntries(RESPONSE_SOURCES.map((source) => [source, 0]));
  const missingAuthenticityFields = new Set();
  let providerCallClaimCount = 0;

  for (const route of routeEvidence) {
    if (route.providerCallsMade === true || Number(route.requestAttemptCount || 0) > 0) {
      providerCallClaimCount += 1;
    }
    const source = inferResponseSource(route);
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
    for (const field of [
      "networkAttemptRecorded",
      "responseSource",
      "responseReceived",
      "mockResponseUsed",
      "simulatedResponseUsed",
      "localExecutorOnly",
    ]) {
      if (!(field in route)) missingAuthenticityFields.add(field);
    }
  }

  return {
    phase: "Phase902",
    providerEvidenceSourceClassifierReady: true,
    evidenceFileCount: evidenceFiles.length,
    routeExecutionEvidenceCount: routeEvidence.length,
    providerCallClaimCount,
    responseSourceBreakdown: sourceBreakdown,
    missingAuthenticityFields: [...missingAuthenticityFields].sort(),
  };
}

export function inferResponseSource(route = {}) {
  if (route.responseSource) return normalizeSource(route.responseSource);
  if (route.mockResponseUsed || route.mockResponse || route.mocked || route.mock === true) return "mock";
  if (route.simulatedResponseUsed || route.simulatedProviderResponse || route.simulated === true) return "simulated";
  if (route.dryRunOnly === true || route.dryRun === true) return "dry_run";
  if (route.providerCallsMade === true || Number(route.requestAttemptCount || 0) > 0) return "local_executor";
  if (route.responseClassification === "blocked_by_gate") return "dry_run";
  return "unknown";
}

function normalizeSource(value) {
  const source = String(value || "").trim();
  return RESPONSE_SOURCES.includes(source) ? source : "unknown";
}
