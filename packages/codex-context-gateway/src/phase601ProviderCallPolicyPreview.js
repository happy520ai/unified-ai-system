export function buildPhase601ProviderCallPolicyPreview() {
  return {
    completed: true,
    providerCallPolicyPreviewGenerated: true,
    providerCallsMade: false,
    phase601ProviderCallAllowed: false,
    phase602ProviderCallAllowed: false,
    phase602RequiresExplicitProviderApproval: true,
    laterPhaseMaxRequests: 1,
    laterPhaseMaxEstimatedCostUsd: 0,
  };
}
