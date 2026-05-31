export function createExternalProviderOutboundTrace(input = {}) {
  const attemptAt = input.outboundAttemptAt || new Date().toISOString();
  const traceId = input.traceId || `phase911-${Date.parse(attemptAt) || Date.now()}`;
  return {
    traceId,
    requestId: input.requestId || traceId,
    providerId: input.providerId || "nvidia",
    modelId: input.modelId || null,
    credentialRef: input.credentialRef || "credentialRef:nvidia:default",
    credentialRefOnly: input.credentialRefOnly !== false,
    networkAttemptRecorded: input.networkAttemptRecorded === true,
    outboundTracePresent: true,
    outboundAttemptAt: attemptAt,
    adapterName: input.adapterName || "phase911-nvidia-one-shot-authenticity",
    adapterMode: input.adapterMode || "external_provider",
    providerRequestId: input.providerRequestId || null,
    providerRequestIdUnavailableReason: input.providerRequestId
      ? null
      : input.providerRequestIdUnavailableReason || "provider request id not exposed; adapter outbound trace recorded",
  };
}

export function httpStatusClass(status) {
  const code = Number(status || 0);
  if (code >= 200 && code < 300) return "2xx";
  if (code >= 400 && code < 500) return "4xx";
  if (code >= 500 && code < 600) return "5xx";
  return "unknown";
}
