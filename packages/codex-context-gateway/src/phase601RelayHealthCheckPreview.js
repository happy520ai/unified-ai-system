export function buildPhase601RelayHealthCheckPreview(options = {}) {
  const relayRef = options.relayRef || "relayRef.codex-context-gateway.guarded-test";
  return {
    completed: true,
    relayHealthCheckPreviewGenerated: true,
    relayRef,
    healthCheckPlan: [
      "Confirm relayRef registration exists in authorization evidence.",
      "Confirm health endpoint ref is mapped by operator outside Phase601.",
      "Abort before any curl or network connection in Phase601.",
      "Record result in Phase602 evidence only if later explicitly authorized.",
    ],
    curlCommandPreview: `curl "<redacted-health:${relayRef}>"`,
    curlExecuted: false,
    relayStarted: false,
    realRelayConnectionMade: false,
    upstreamProviderCalled: false,
    providerCallsMade: false,
  };
}
