export const PHASE315A_TIMEOUT_TYPES = Object.freeze([
  "none",
  "client_timeout",
  "provider_timeout",
  "gateway_timeout",
  "handled_slow_response",
  "unknown_timeout",
]);

export const PHASE315A_LATENCY_RISK_LEVELS = Object.freeze([
  "normal",
  "slow",
  "timeout_handled",
  "timeout_failed",
  "provider_unavailable",
]);

export const PHASE315A_COMPLETION_CONFIDENCE = Object.freeze([
  "high",
  "medium",
  "low",
  "failed",
]);

export const DEFAULT_PROVIDER_TIMEOUT_MS = 60_000;
export const DEFAULT_SLOW_RESPONSE_MS = 12_000;
export const DEFAULT_HANDLED_TIMEOUT_MS = 30_000;

export const LATENCY_DRY_RUN_CASES = Object.freeze([
  {
    caseId: "normal_http_200_fast",
    simulatedExecution: {
      providerCalled: true,
      success: true,
      httpStatus: 200,
      durationMs: 840,
      responseShapeOk: true,
      nonEmptyOutput: true,
    },
    expected: {
      latencyRiskLevel: "normal",
      completionConfidence: "high",
      retryable: false,
      retryRecommended: false,
      fallbackEligible: false,
      completionVerified: true,
    },
  },
  {
    caseId: "http_200_slow_no_timeout",
    simulatedExecution: {
      providerCalled: true,
      success: true,
      httpStatus: 200,
      durationMs: 16_000,
      responseShapeOk: true,
      nonEmptyOutput: true,
    },
    expected: {
      latencyRiskLevel: "slow",
      completionConfidence: "medium",
      retryable: false,
      retryRecommended: false,
      fallbackEligible: false,
      completionVerified: true,
    },
  },
  {
    caseId: "http_200_timeout_handled",
    simulatedExecution: {
      providerCalled: true,
      success: true,
      httpStatus: 200,
      durationMs: 35_000,
      timeoutHit: true,
      timeoutType: "handled_slow_response",
      responseShapeOk: true,
      nonEmptyOutput: true,
    },
    expected: {
      latencyRiskLevel: "timeout_handled",
      completionConfidence: "medium",
      retryable: false,
      retryRecommended: false,
      fallbackEligible: false,
      completionVerified: true,
    },
  },
  {
    caseId: "client_timeout_no_response",
    simulatedExecution: {
      providerCalled: true,
      success: false,
      code: "nvidia_request_timeout",
      httpStatus: null,
      durationMs: 60_000,
      timeoutHit: true,
      timeoutType: "client_timeout",
      responseShapeOk: false,
      nonEmptyOutput: false,
    },
    expected: {
      latencyRiskLevel: "timeout_failed",
      completionConfidence: "failed",
      retryable: true,
      retryRecommended: true,
      fallbackEligible: true,
      completionVerified: false,
    },
  },
  {
    caseId: "provider_404_not_retryable",
    simulatedExecution: {
      providerCalled: true,
      success: false,
      code: "nvidia_http_404",
      httpStatus: 404,
      durationMs: 520,
      responseShapeOk: false,
      nonEmptyOutput: false,
    },
    expected: {
      latencyRiskLevel: "provider_unavailable",
      completionConfidence: "failed",
      retryable: false,
      retryRecommended: false,
      fallbackEligible: false,
      completionVerified: false,
    },
  },
  {
    caseId: "provider_500_retryable",
    simulatedExecution: {
      providerCalled: true,
      success: false,
      code: "nvidia_http_500",
      httpStatus: 500,
      durationMs: 1_400,
      responseShapeOk: false,
      nonEmptyOutput: false,
    },
    expected: {
      latencyRiskLevel: "provider_unavailable",
      completionConfidence: "failed",
      retryable: true,
      retryRecommended: true,
      fallbackEligible: true,
      completionVerified: false,
    },
  },
  {
    caseId: "rate_limited_retryable",
    simulatedExecution: {
      providerCalled: true,
      success: false,
      code: "rate_limited",
      httpStatus: 429,
      durationMs: 690,
      responseShapeOk: false,
      nonEmptyOutput: false,
    },
    expected: {
      latencyRiskLevel: "provider_unavailable",
      completionConfidence: "failed",
      retryable: true,
      retryRecommended: true,
      fallbackEligible: true,
      completionVerified: false,
    },
  },
  {
    caseId: "fallback_eligible_but_not_attempted",
    simulatedExecution: {
      providerCalled: true,
      success: false,
      code: "nvidia_request_failed",
      httpStatus: null,
      durationMs: 2_100,
      responseShapeOk: false,
      nonEmptyOutput: false,
    },
    expected: {
      latencyRiskLevel: "provider_unavailable",
      completionConfidence: "failed",
      retryable: true,
      retryRecommended: true,
      fallbackEligible: true,
      completionVerified: false,
    },
  },
]);

export function buildProviderLatencyAccountability(input = {}) {
  const durationMs = normalizeNonNegativeInteger(input.durationMs);
  const providerTimeoutMs = normalizePositiveInteger(input.providerTimeoutMs, DEFAULT_PROVIDER_TIMEOUT_MS);
  const slowResponseMs = normalizePositiveInteger(input.slowResponseMs, DEFAULT_SLOW_RESPONSE_MS);
  const handledTimeoutMs = normalizePositiveInteger(input.handledTimeoutMs, DEFAULT_HANDLED_TIMEOUT_MS);
  const httpStatus = normalizeHttpStatus(input.httpStatus);
  const providerCalled = input.providerCalled === true;
  const code = String(input.code ?? "");
  const success = input.success === true;
  const responseComplete = input.responseShapeOk === true && input.nonEmptyOutput === true;
  const inputTimeoutType = normalizeTimeoutType(input.timeoutType);
  const timeoutByError = /timeout/i.test(code) || input.timeoutHit === true || inputTimeoutType !== "none";
  const handledBySlowThreshold = success && isHttpOk(httpStatus) && durationMs >= handledTimeoutMs;

  let timeoutType = "none";
  if (inputTimeoutType !== "none") {
    timeoutType = inputTimeoutType;
  } else if (/client.*timeout|request_timeout/i.test(code)) {
    timeoutType = "client_timeout";
  } else if (/provider.*timeout/i.test(code)) {
    timeoutType = "provider_timeout";
  } else if (/gateway.*timeout/i.test(code)) {
    timeoutType = "gateway_timeout";
  } else if (handledBySlowThreshold) {
    timeoutType = "handled_slow_response";
  } else if (timeoutByError) {
    timeoutType = isHttpOk(httpStatus) ? "handled_slow_response" : "unknown_timeout";
  }

  const timeoutHit = timeoutType !== "none";
  const lateResponseReceived = timeoutHit && isHttpOk(httpStatus) && responseComplete;
  const risk = decideLatencyRisk({
    providerCalled,
    success,
    httpStatus,
    durationMs,
    slowResponseMs,
    timeoutHit,
    timeoutType,
    responseComplete,
  });
  const completionConfidence = decideCompletionConfidence({ risk, success, responseComplete, httpStatus });

  return {
    startedAt: normalizeTimestamp(input.startedAt, durationMs, "start"),
    completedAt: normalizeTimestamp(input.completedAt, durationMs, "complete"),
    durationMs,
    providerTimeoutMs,
    timeoutHit,
    timeoutType,
    lateResponseReceived,
    httpStatus,
    latencyRiskLevel: risk,
    completionConfidence,
    userVisibleLatencySummary: userVisibleLatencySummary({ risk, timeoutHit, durationMs }),
  };
}

export function completionVerifiedForLatency({ baseCompletionVerified, latency, responseShapeOk, nonEmptyOutput, success } = {}) {
  if (latency?.completionConfidence === "failed") return false;
  if (success !== true) return false;
  if (responseShapeOk !== true || nonEmptyOutput !== true) return false;
  if (latency?.latencyRiskLevel === "timeout_failed" || latency?.latencyRiskLevel === "provider_unavailable") return false;
  return baseCompletionVerified === true;
}

export function latencyVerificationReasonSuffix(latency = {}) {
  if (latency.timeoutHit && latency.latencyRiskLevel === "timeout_handled") {
    return " Slow response or timeout protection was handled; completion is valid but latency risk remains.";
  }
  if (latency.latencyRiskLevel === "slow") {
    return " Provider returned usable output, but response latency was slow.";
  }
  if (latency.latencyRiskLevel === "timeout_failed") {
    return " Provider did not return usable output before timeout.";
  }
  if (latency.latencyRiskLevel === "provider_unavailable") {
    return " Provider was unavailable or returned a non-success status.";
  }
  return "";
}

function decideLatencyRisk({ providerCalled, success, httpStatus, durationMs, slowResponseMs, timeoutHit, timeoutType, responseComplete }) {
  if (!providerCalled) return "normal";
  if (timeoutHit && timeoutType !== "handled_slow_response" && !isHttpOk(httpStatus)) return "timeout_failed";
  if (isRateLimited(httpStatus) || isHttp5xx(httpStatus) || (!httpStatus && !success)) return "provider_unavailable";
  if (isHttp4xx(httpStatus)) return "provider_unavailable";
  if (isHttpOk(httpStatus) && timeoutHit && responseComplete) return "timeout_handled";
  if (isHttpOk(httpStatus) && durationMs >= slowResponseMs) return "slow";
  if (isHttpOk(httpStatus) && success) return "normal";
  return success ? "slow" : "provider_unavailable";
}

function decideCompletionConfidence({ risk, success, responseComplete, httpStatus }) {
  if (!success || !responseComplete) return "failed";
  if (!isHttpOk(httpStatus)) return "failed";
  if (risk === "normal") return "high";
  if (risk === "slow" || risk === "timeout_handled") return "medium";
  if (risk === "provider_unavailable") return "low";
  return "failed";
}

function userVisibleLatencySummary({ risk, timeoutHit, durationMs }) {
  if (risk === "normal") return `已完成，响应耗时 ${durationMs}ms。`;
  if (risk === "slow") return `已完成，但响应较慢，耗时 ${durationMs}ms。`;
  if (risk === "timeout_handled") {
    return timeoutHit
      ? `已完成，但触发慢响应/超时保护，耗时 ${durationMs}ms。`
      : `已完成，但响应存在延迟风险，耗时 ${durationMs}ms。`;
  }
  if (risk === "timeout_failed") return `未完成，请稍后重试，耗时 ${durationMs}ms。`;
  if (risk === "provider_unavailable") return `模型服务暂不可用，耗时 ${durationMs}ms。`;
  return `执行状态未知，耗时 ${durationMs}ms。`;
}

function normalizeHttpStatus(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0;
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : fallback;
}

function normalizeTimeoutType(value) {
  return PHASE315A_TIMEOUT_TYPES.includes(value) ? value : "none";
}

function normalizeTimestamp(value, durationMs, mode) {
  if (typeof value === "string" && value.trim()) return value;
  const now = Date.now();
  const ts = mode === "start" ? now - durationMs : now;
  return new Date(ts).toISOString();
}

function isHttpOk(status) {
  return Number.isInteger(status) && status >= 200 && status < 300;
}

function isHttp4xx(status) {
  return Number.isInteger(status) && status >= 400 && status < 500;
}

function isHttp5xx(status) {
  return Number.isInteger(status) && status >= 500 && status < 600;
}

function isRateLimited(status) {
  return status === 429;
}
