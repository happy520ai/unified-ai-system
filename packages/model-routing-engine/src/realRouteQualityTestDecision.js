export function buildRealRouteQualityTestDecision({ phase913 = {}, rebind = {} } = {}) {
  const readyForRealRouteQualityTest = phase913.externalProviderApiCallConfirmed === true
    && rebind.rebindPerformed === true;
  return {
    phase: "Phase915",
    readyForRealRouteQualityTest,
    blocker: readyForRealRouteQualityTest ? null : phase913.blocker || rebind.blocker || "external_provider_authenticity_not_confirmed",
    recommendedNextPhase: "Phase916-930",
    requiresNewApproval: true,
    suggestedMaxProviderRequests: 20,
    suggestedMaxEstimatedCostUsd: 1,
    allowedProvider: "nvidia",
    credentialRefOnly: true,
    stillNoDeploy: true,
    stillNoChatDefaultEnable: true,
    stillNoChatGatewayExecuteDefaultEnable: true,
    humanReviewRequiredForBroaderTest: true,
  };
}
