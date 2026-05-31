export function buildProviderFallbackPolicy(scoredCandidates = [], selectedModelId = null) {
  const fallbackChain = scoredCandidates
    .filter((candidate) => candidate.runtimeEligible)
    .filter((candidate) => candidate.modelId !== selectedModelId)
    .slice(0, 5)
    .map((candidate) => ({
      modelId: candidate.modelId,
      providerId: candidate.providerId,
      reason: "selectable_smoke_passed_fallback",
    }));
  return {
    phase: "Phase813",
    providerFallbackPolicyReady: true,
    fallbackChain,
    providerCallsMade: false,
    secretRead: false,
  };
}
