export function buildProviderRetryFallbackAccountability(input = {}) {
  const httpStatus = normalizeHttpStatus(input.httpStatus);
  const code = String(input.code ?? input.failureCode ?? "").toLowerCase();
  const latencyRiskLevel = input.latencyRiskLevel ?? input.latency?.latencyRiskLevel ?? "normal";
  const timeoutType = input.timeoutType ?? input.latency?.timeoutType ?? "none";
  const success = input.success === true;
  const providerCalled = input.providerCalled === true;
  const realFallbackEnabled = input.realFallbackEnabled === true;
  const fallbackModel = input.fallbackModel ?? null;

  const rateLimited = httpStatus === 429 || code.includes("rate_limited") || code.includes("rate_limit");
  const retryable = providerCalled && !success && (
    rateLimited ||
    isHttp5xx(httpStatus) ||
    code.includes("request_failed") ||
    code.includes("network") ||
    code.includes("unavailable") ||
    latencyRiskLevel === "timeout_failed" ||
    ["client_timeout", "provider_timeout", "gateway_timeout", "unknown_timeout"].includes(timeoutType)
  );

  const retryRecommended = retryable === true;
  const fallbackEligible = retryable === true && !isHttp4xxNotRateLimited(httpStatus);
  const fallbackAttempted = fallbackEligible && realFallbackEnabled;

  return {
    retryable,
    retryRecommended,
    retryAttempted: false,
    retryCount: 0,
    fallbackEligible,
    fallbackAttempted,
    fallbackModel: fallbackAttempted ? fallbackModel : (fallbackEligible ? fallbackModel : null),
    fallbackReason: buildFallbackReason({
      fallbackEligible,
      fallbackAttempted,
      retryable,
      rateLimited,
      httpStatus,
      code,
      latencyRiskLevel,
      realFallbackEnabled,
    }),
  };
}

export function defaultFallbackModelFor(modelId) {
  if (modelId === "nvidia/llama-3.1-nemotron-nano-8b-v1") {
    return "nvidia/llama-3.3-nemotron-super-49b-v1";
  }
  if (modelId === "nvidia/llama-3.3-nemotron-super-49b-v1") {
    return "nvidia/llama-3.1-nemotron-nano-8b-v1";
  }
  return null;
}

function buildFallbackReason({ fallbackEligible, fallbackAttempted, retryable, rateLimited, httpStatus, code, latencyRiskLevel, realFallbackEnabled }) {
  if (!fallbackEligible) {
    if (isHttp4xxNotRateLimited(httpStatus)) return "HTTP 4xx is not retryable by default; fallback is not eligible.";
    if (!retryable) return "No retryable provider failure detected; fallback is not eligible.";
    return "Fallback is not eligible for this execution.";
  }
  if (!realFallbackEnabled) {
    if (rateLimited) return "Rate limit is retryable and fallback-eligible, but real fallback is disabled for Phase315A.";
    if (latencyRiskLevel === "timeout_failed") return "Timeout failure is fallback-eligible, but real fallback is disabled for Phase315A.";
    if (isHttp5xx(httpStatus)) return "HTTP 5xx is fallback-eligible, but real fallback is disabled for Phase315A.";
    if (code.includes("request_failed") || code.includes("network")) return "Network/provider failure is fallback-eligible, but real fallback is disabled for Phase315A.";
    return "Fallback policy says eligible, but real fallback is disabled for Phase315A.";
  }
  return fallbackAttempted ? "Real fallback was explicitly enabled and attempted." : "Fallback eligible but not attempted.";
}

function normalizeHttpStatus(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function isHttp5xx(status) {
  return Number.isInteger(status) && status >= 500 && status < 600;
}

function isHttp4xxNotRateLimited(status) {
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 429;
}
