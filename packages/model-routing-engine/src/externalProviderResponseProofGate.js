import { detectRouteFlags } from "./mockSimulatedDryRunDetector.js";

export function evaluateExternalProviderResponseProof(input = {}) {
  const routeEvidence = Array.isArray(input.routeEvidence) ? input.routeEvidence : [];
  const perRoute = routeEvidence.map((route) => evaluateRouteProof(route));
  const confirmedCount = perRoute.filter((item) => item.externalProviderApiCallConfirmed).length;
  const attemptedCount = perRoute.filter((item) => item.providerCallClaimed).length;
  const aggregate = selectAggregateClassification(perRoute);
  return {
    phase: "Phase905",
    externalProviderResponseProofGateReady: true,
    routeEvidenceCount: routeEvidence.length,
    providerCallClaimCount: attemptedCount,
    externalProviderConfirmedCount: confirmedCount,
    externalProviderApiCallConfirmed: confirmedCount > 0 && confirmedCount === attemptedCount && attemptedCount > 0,
    networkAttemptRecorded: perRoute.some((item) => item.networkAttemptRecorded),
    providerResponseReceived: perRoute.some((item) => item.providerResponseReceived),
    responseSource: aggregate.responseSource,
    mockResponseUsed: perRoute.some((item) => item.mockResponseUsed),
    simulatedResponseUsed: perRoute.some((item) => item.simulatedResponseUsed),
    dryRunOnly: perRoute.every((item) => item.dryRunOnly) && perRoute.length > 0,
    localExecutorOnly: perRoute.some((item) => item.localExecutorOnly),
    authenticityClassification: aggregate.authenticityClassification,
    perRoute,
  };
}

export function evaluateRouteProof(route = {}) {
  const flags = detectRouteFlags(route);
  const providerCallClaimed = route.providerCallsMade === true || Number(route.requestAttemptCount || 0) > 0;
  const networkAttemptRecorded = route.networkAttemptRecorded === true;
  const providerRequestIdPresent = Boolean(route.providerRequestId);
  const outboundTracePresent = Boolean(route.outboundTraceId || route.outboundTracePresent);
  const providerResponseReceived = route.responseReceived === true || route.providerResponseReceived === true;
  const responseSource = route.responseSource || inferProofResponseSource(flags, providerCallClaimed);
  const externalProviderApiCallConfirmed = providerCallClaimed
    && networkAttemptRecorded
    && providerResponseReceived
    && responseSource === "external_provider"
    && (providerRequestIdPresent || outboundTracePresent)
    && flags.mockResponseUsed === false
    && flags.simulatedResponseUsed === false
    && flags.dryRunOnly === false
    && flags.localExecutorOnly === false
    && route.credentialRefOnly !== false
    && route.rawSecretRead !== true
    && route.authJsonRead !== true;
  return {
    routeId: route.routeId || null,
    providerCallClaimed,
    externalProviderApiCallConfirmed,
    networkAttemptRecorded,
    providerRequestIdPresent,
    outboundTracePresent,
    providerResponseReceived,
    responseSource,
    ...flags,
    authenticityClassification: externalProviderApiCallConfirmed
      ? "external_provider_api_confirmed"
      : classifyUnconfirmed({ providerCallClaimed, networkAttemptRecorded, responseSource, flags, route }),
  };
}

function inferProofResponseSource(flags, providerCallClaimed) {
  if (flags.mockResponseUsed) return "mock";
  if (flags.simulatedResponseUsed) return "simulated";
  if (flags.dryRunOnly) return "dry_run";
  if (flags.localExecutorOnly || providerCallClaimed) return "local_executor";
  return "unknown";
}

function classifyUnconfirmed({ providerCallClaimed, networkAttemptRecorded, responseSource, flags, route }) {
  if (route.responseClassification === "blocked_by_gate") return "blocked_by_gate";
  if (flags.mockResponseUsed) return "mock_response";
  if (flags.simulatedResponseUsed) return "simulated_response";
  if (flags.dryRunOnly && !providerCallClaimed) return "dry_run_only";
  if (flags.localExecutorOnly || responseSource === "local_executor") return "local_guarded_executor_only";
  if (providerCallClaimed || networkAttemptRecorded) return "external_provider_attempt_unconfirmed";
  return "authenticity_unknown";
}

function selectAggregateClassification(perRoute) {
  if (perRoute.length === 0) return { authenticityClassification: "authenticity_unknown", responseSource: "unknown" };
  const priority = [
    "mock_response",
    "simulated_response",
    "local_guarded_executor_only",
    "external_provider_attempt_unconfirmed",
    "dry_run_only",
    "blocked_by_gate",
    "authenticity_unknown",
    "external_provider_api_confirmed",
  ];
  for (const classification of priority) {
    const match = perRoute.find((item) => item.authenticityClassification === classification);
    if (match) return { authenticityClassification: classification, responseSource: match.responseSource };
  }
  return { authenticityClassification: "authenticity_unknown", responseSource: "unknown" };
}
