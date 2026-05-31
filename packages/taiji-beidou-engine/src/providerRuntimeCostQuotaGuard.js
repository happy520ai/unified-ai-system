export function evaluateProviderRuntimeCostQuota(input = {}) {
  const maxRequests = Number(input.maxRequests ?? 1);
  const actualRequests = Number(input.actualRequests ?? 0);
  const maxRetries = Number(input.maxRetries ?? 0);
  const retryAttemptCount = Number(input.retryAttemptCount ?? 0);
  const maxEstimatedCostUsd = Number(input.maxEstimatedCostUsd ?? 0);
  const estimatedCostUsd = Number(input.estimatedCostUsd ?? 0);
  const timeoutMs = Number(input.timeoutMs ?? 30000);

  return {
    maxRequests,
    actualRequests,
    maxRetries,
    retryAttemptCount,
    maxEstimatedCostUsd,
    estimatedCostUsd,
    timeoutMs,
    maxRequestsRespected: actualRequests <= maxRequests && maxRequests <= 3,
    maxRetriesRespected: retryAttemptCount <= maxRetries && maxRetries === 0,
    budgetExceeded: estimatedCostUsd > maxEstimatedCostUsd,
    budgetGuardAttached: true,
    quotaGuardAttached: true,
    timeoutGuardAttached: true,
  };
}
