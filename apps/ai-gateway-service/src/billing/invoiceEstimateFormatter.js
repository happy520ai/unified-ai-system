export function formatInvoiceLineItem(item = {}) {
  return {
    mode: item.mode || "normal",
    providerId: item.providerId || "nvidia",
    modelId: item.modelId || "unknown",
    requestCount: Number(item.requestCount || 0),
    estimatedInputTokens: Number(item.estimatedInputTokens || 0),
    estimatedOutputTokens: Number(item.estimatedOutputTokens || 0),
    estimatedCost: Number(item.estimatedCost || 0),
    costSource: item.costSource || "mock_estimate_formula",
    estimateConfidence: item.estimateConfidence || "low_to_medium",
  };
}
