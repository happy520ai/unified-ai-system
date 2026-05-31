export function evaluateProviderCostQuotaGuard(input = {}) {
  const maxRequests = Number(input.maxRequests ?? 0);
  const maxEstimatedCostUsd = Number(input.maxEstimatedCostUsd ?? 0);
  const failures = [];
  if (maxRequests < 0 || maxRequests > Number(input.maxAllowedRequests ?? 5)) failures.push("max_requests_out_of_bounds");
  if (maxEstimatedCostUsd !== 0) failures.push("cost_must_be_zero_for_this_phase");
  return {
    phase: "Phase791",
    costQuotaGuardReady: true,
    allowed: failures.length === 0,
    failures,
    maxRequests,
    maxEstimatedCostUsd,
    providerCallsMade: false,
    secretRead: false,
  };
}
