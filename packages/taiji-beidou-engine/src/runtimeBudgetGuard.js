export function evaluateRuntimeBudget(input = {}) {
  const lease = input.lease || {};
  const requestCount = Number(input.requestCount ?? 1);
  const tokenEstimate = Number(input.tokenEstimate ?? 800);
  const runtimeMs = Number(input.runtimeMs ?? 0);
  const ttlSeconds = Number(input.ttlSeconds ?? lease.ttlSeconds ?? 300);

  if (ttlSeconds > Number(lease.ttlSeconds ?? 300)) {
    return blocked("ttl_exceeded");
  }
  if (requestCount > Number(lease.maxRequests ?? 3)) {
    return blocked("request_budget_exceeded");
  }
  if (tokenEstimate > Number(lease.maxTokenBudget ?? 4000)) {
    return blocked("token_budget_exceeded");
  }
  if (runtimeMs > Number(lease.maxRuntimeMs ?? 30000)) {
    return blocked("runtime_timeout");
  }

  return {
    allowed: true,
    blockedReason: null,
    requestCount,
    tokenEstimate,
    runtimeMs,
  };
}

function blocked(blockedReason) {
  return {
    allowed: false,
    blockedReason,
  };
}
