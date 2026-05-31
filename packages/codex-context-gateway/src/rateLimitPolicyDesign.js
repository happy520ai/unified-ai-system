export function buildRateLimitPolicyDesign() {
  return {
    completed: true,
    rateLimitPolicyDefined: true,
    budgetPolicyDefined: true,
    timeoutPolicyDefined: true,
    retryLimitDefined: true,
    circuitBreakerDefined: true,
    failClosedOnBudgetExceeded: true,
    maxRequestsPerTask: 3,
    maxConcurrentCodexTasks: 1,
    maxEstimatedCostUsd: 1,
    perRequestTimeoutMs: 120000,
    globalSessionTimeoutMs: 600000,
    retryLimit: 1,
    circuitBreaker: "open after repeated provider/relay failures or budget breach",
  };
}
