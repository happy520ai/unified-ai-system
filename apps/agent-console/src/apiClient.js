export async function threeModeExecute({ baseUrl = "", fetchImpl = globalThis.fetch, request } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is required for threeModeExecute.");
  }
  const response = await fetchImpl(`${String(baseUrl).replace(/\/+$/, "")}/three-mode/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request ?? {}),
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    const error = new Error(payload?.error?.message || payload?.message || "threeModeExecute failed.");
    error.responseBody = payload;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

export function extractThreeModeTelemetry(payload = {}) {
  const data = payload.data || payload;
  const audit = data.auditTrace || {};
  return {
    mode: data.mode || audit.mode || "unknown",
    selectedModel: data.selectedModel?.modelId || audit.selectedModelId || null,
    participantModels: (data.participantModels || []).map((item) => item.modelId),
    selectedModels: data.plannerDecision?.selectedModels || audit.selectedModels || [],
    providerCallsMade: audit.providerCallsMade === true,
    nonNvidiaProviderCallsMade: audit.nonNvidiaProviderCallsMade === true,
    fallbackUsed: data.fallbackUsed === true || audit.fallbackUsed === true,
    latencyMs: Number(payload.meta?.durationMs || audit.durationMs || 0),
    participantCallCount: Number(audit.participantCallCount || 0),
    supervisorCallCount: Number(audit.supervisorCallCount || 0),
    estimatedTokenUsage: estimateTokens(data.finalAnswer),
    estimatedCost: audit.estimatedCost ?? "estimatedOnly",
    quotaStatus: audit.quotaStatus || null,
    budgetStatus: audit.budgetStatus || null,
    policyStatus: audit.policyDecision?.policyStatus || "unknown",
    credentialStatus: audit.credentialRefOnly === true ? "credentialRefOnly" : "not_applicable",
    safetyWarnings: audit.nonNvidiaProviderCallsMade === true ? ["userOwnedProviderCostMayApply"] : [],
  };
}

export function validateProviderBetaCredentialRef({ providerId, credentialRefType, credentialRef }) {
  const text = String(credentialRef || "");
  if (!providerId || !["nvidia", "openai", "claude", "openrouter", "mimo"].includes(String(providerId))) {
    return { allowed: false, code: "UNSUPPORTED_PROVIDER" };
  }
  if (!credentialRefType || !["env_key_name", "encrypted_reference", "vault_reference", "user_secret_store_reference"].includes(String(credentialRefType))) {
    return { allowed: false, code: "UNSUPPORTED_CREDENTIAL_REF_TYPE" };
  }
  if (!text.trim()) {
    return { allowed: false, code: "CREDENTIAL_REF_MISSING" };
  }
  if (/sk-|nvapi-|api[_-]?key|secret|token|bearer\s+/i.test(text) && credentialRefType === "env_key_name" && !/^[A-Z0-9_]+$/.test(text)) {
    return { allowed: false, code: "SECRET_LIKE_INPUT_REJECTED" };
  }
  return {
    allowed: true,
    code: "CREDENTIAL_REF_ACCEPTED_FOR_BACKEND_VALIDATION",
    credentialRefOnly: true,
    secretValueAllowed: false,
    directProviderCallFromUi: false,
  };
}

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}
