export function buildPhase601BudgetRequestLimitPreview() {
  return {
    completed: true,
    budgetLimitPreviewGenerated: true,
    maxRequests: 1,
    maxEstimatedCostUsd: 0,
    maxDurationMinutes: 10,
    retryLimit: 0,
    failClosedOnAnyError: true,
    maxRequestsLimited: true,
    durationLimited: true,
    retryLimitZero: true,
    providerCallsMade: false,
  };
}
