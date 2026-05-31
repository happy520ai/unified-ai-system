export const quotaBudgetPolicy = Object.freeze({
  maxRequestsPerTask: 0,
  maxEstimatedCostUsd: 0,
  providerCallsMade: false,
});

export function assertQuotaBudget(binding = {}) {
  return {
    withinBudget: Number(binding.maxRequestsPerTask || 0) <= quotaBudgetPolicy.maxRequestsPerTask &&
      Number(binding.maxEstimatedCostUsd || 0) <= quotaBudgetPolicy.maxEstimatedCostUsd,
    maxRequestsPerTask: quotaBudgetPolicy.maxRequestsPerTask,
    maxEstimatedCostUsd: quotaBudgetPolicy.maxEstimatedCostUsd,
  };
}

