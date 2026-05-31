export function buildProviderRuntimeBridgeDryRun(input = {}) {
  return {
    wouldCallProvider: true,
    actualProviderCallMade: false,
    providerId: input.providerId || "nvidia",
    modelId: input.modelId || "nvidia/llama-3.3-nemotron-super-49b-v1",
    credentialRefUsed: true,
    rawSecretRead: false,
    requestShapeValid: true,
    responseShapeExpected: true,
    budgetGuardAttached: true,
    evidenceLedgerAttached: true,
    rollbackAttached: true,
    maxRequests: Number(input.maxRequests ?? 1),
    maxRetries: 0,
    promptPreview: "Reply with exactly: TAIJI_BEIDOUREAL_PROVIDER_RUNTIME_OK",
  };
}
