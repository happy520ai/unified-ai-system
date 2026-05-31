export const PROVIDER_CALL_AUTHENTICITY_CLASSES = Object.freeze([
  "external_provider_api_confirmed",
  "external_provider_attempt_unconfirmed",
  "local_guarded_executor_only",
  "dry_run_only",
  "simulated_response",
  "mock_response",
  "blocked_by_gate",
  "authenticity_unknown",
]);

export function buildProviderCallAuthenticityContract(input = {}) {
  return {
    phase: "Phase901",
    contractName: "provider-call-authenticity-contract",
    providerCallClaimed: input.providerCallClaimed === true,
    providerCallsMade: input.providerCallsMade === true,
    externalProviderApiCallConfirmed: false,
    networkAttemptRecorded: input.networkAttemptRecorded === true,
    providerRequestIdPresent: Boolean(input.providerRequestId || input.providerRequestIdPresent),
    outboundTracePresent: Boolean(input.outboundTraceId || input.outboundTracePresent),
    providerResponseReceived: input.providerResponseReceived === true || input.responseReceived === true,
    responseSource: input.responseSource || "unknown",
    mockResponseUsed: input.mockResponseUsed === true,
    simulatedResponseUsed: input.simulatedResponseUsed === true,
    dryRunOnly: input.dryRunOnly === true,
    localExecutorOnly: input.localExecutorOnly === true,
    credentialRefOnly: input.credentialRefOnly !== false,
    rawSecretRead: input.rawSecretRead === true,
    authJsonRead: input.authJsonRead === true,
    authenticityClassification: input.authenticityClassification || "authenticity_unknown",
    allowedClassifications: PROVIDER_CALL_AUTHENTICITY_CLASSES,
  };
}
