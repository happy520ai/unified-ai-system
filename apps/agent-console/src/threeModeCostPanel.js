export function buildThreeModeCostPanelState(payload = {}) {
  const data = payload.data || payload;
  const audit = data.auditTrace || {};
  const estimatedTokenUsage = Math.ceil(String(data.finalAnswer || "").length / 4);
  return {
    estimatedTokenUsage,
    estimatedCost: audit.estimatedCost ?? "estimatedOnly",
    costSource: audit.estimatedCost ? "runtime_estimate" : "internal_test_cost_unknown",
    billingClaimed: false,
    userOwnedProviderCostMayApply: audit.nonNvidiaProviderCallsMade === true,
  };
}
