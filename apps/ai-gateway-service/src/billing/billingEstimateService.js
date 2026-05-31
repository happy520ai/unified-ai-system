export function buildBillingEstimate({ requestId, userIdRef, mode, providerId, modelId, estimatedInputTokens = 0, estimatedOutputTokens = 0 } = {}) {
  const estimatedCost = round((Number(estimatedInputTokens || 0) + Number(estimatedOutputTokens || 0)) * 0.000002);
  return {
    requestId,
    userIdRef,
    mode,
    providerId,
    modelId,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost,
    currency: "USD",
    estimateOnly: true,
    actualBillingConnected: false,
    costSource: "mock_estimate_formula",
    confidence: "low_to_medium",
    warning: providerId && providerId !== "nvidia" ? "userOwnedProviderCostMayApply" : "internal_test_cost_unknown",
  };
}

function round(value) {
  return Math.round(Number(value || 0) * 100000) / 100000;
}
