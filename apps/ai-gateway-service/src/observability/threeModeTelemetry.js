export function buildThreeModeTelemetry({ response = {}, source = "phase329a" } = {}) {
  const data = response.data || response.response?.data || response;
  const audit = data.auditTrace || {};
  const userId = String(data.userId || audit.userId || "anonymous");
  return {
    source,
    requestId: data.requestId || audit.requestId || "",
    userIdRef: hashUserId(userId),
    mode: data.mode || audit.mode || "",
    selectedModel: data.selectedModel?.modelId || audit.selectedModelId || null,
    participantModels: (data.participantModels || []).map((item) => item.modelId),
    plannerDecision: summarizeDecision(data.plannerDecision),
    supervisorDecision: summarizeDecision(data.supervisorDecision),
    providerCallsMade: audit.providerCallsMade === true,
    nonNvidiaProviderCallsMade: audit.nonNvidiaProviderCallsMade === true,
    failedProviderCalls: Number(audit.failedProviderCalls || 0),
    fallbackUsed: data.fallbackUsed === true || audit.fallbackUsed === true,
    latencyMs: Number(audit.durationMs || response.meta?.durationMs || 0),
    participantLatencyMs: audit.participantLatencyMs || [],
    supervisorLatencyMs: Number(audit.supervisorLatencyMs || 0),
    plannerLatencyMs: Number(audit.plannerLatencyMs || 0),
    estimatedTokenUsage: estimateTokens(data.finalAnswer),
    estimatedCost: audit.estimatedCost ?? null,
    quotaStatus: audit.quotaStatus || null,
    budgetStatus: audit.budgetStatus || null,
    policyDecision: audit.policyDecision || null,
    credentialGateDecision: audit.credentialGateDecision || null,
    errorCode: response.error?.code || "",
    retryCount: Number(audit.retryCount || 0),
    circuitBreakerStatus: audit.circuitBreakerStatus || "closed",
    safetyGateStatus: audit.secretValueExposed === true ? "failed" : "passed",
    secretValueExposed: audit.secretValueExposed === true,
  };
}

export function hashUserId(userId) {
  let hash = 0;
  for (const char of String(userId || "anonymous")) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return `user_${Math.abs(hash).toString(16)}`;
}

function summarizeDecision(value) {
  if (!value) return null;
  return {
    type: value.executionMode || value.synthesisStrategy || "decision",
    selectedModels: value.selectedModels || [],
    confidenceSummary: value.confidenceSummary || null,
  };
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}
