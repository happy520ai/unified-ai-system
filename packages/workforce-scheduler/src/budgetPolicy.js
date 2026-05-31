export const dryRunBudgetPolicy = Object.freeze({
  maxBrainCalls: 0,
  maxBrainCallsFutureDefault: 2,
  maxEstimatedCostUsd: 0,
  requireApprovalForProviderCall: true,
});

export function assertDryRunBudget(policy = dryRunBudgetPolicy) {
  return policy.maxBrainCalls === 0 && policy.maxEstimatedCostUsd === 0;
}
