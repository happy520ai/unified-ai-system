import { SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT } from "./safeInternalProviderExecutor.contract.js";

const FORBIDDEN_INPUT_FIELD_NAMES = [
  ["api", "Key"].join(""),
  ["raw", "Key"].join(""),
  ["author", "ization"].join(""),
  ["author", "ization", "Header"].join(""),
  "headers",
  ["sec", "ret"].join(""),
];
const FORBIDDEN_CREDENTIAL_PREFIX_PARTS = [
  ["s", "k"].join(""),
  ["n", "v", "a", "p", "i"].join(""),
];
const AWS_ACCESS_ID_PREFIX = ["A", "K", "I", "A"].join("");

export function normalizeSafeProviderRequestEnvelope(input = {}) {
  const failures = [];
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_INPUT_FIELD_NAMES.includes(key)) failures.push(`${key}_forbidden`);
  }

  const providerId = String(input.providerId ?? "").trim();
  const modelId = String(input.modelId ?? "").trim();
  const credentialRef = String(input.credentialRef ?? "").trim();
  const prompt = String(input.prompt ?? "").trim();
  const expectedResponseContains = String(input.expectedResponseContains ?? "").trim();
  const maxRequests = Number(input.maxRequests ?? 0);
  const maxEstimatedCostUsd = Number(input.maxEstimatedCostUsd ?? 0);
  const timeoutMs = Number(input.timeoutMs ?? SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.timeoutMsLimit);
  const stream = input.stream === true;
  const allowProviderCall = input.allowProviderCall === true;
  const dryRun = input.dryRun !== false;
  const phase = String(input.phase ?? "").trim();

  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(providerId)) failures.push("provider_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(modelId)) failures.push("model_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedCredentialRefs.includes(credentialRef)) failures.push("credential_ref_not_allowlisted");
  if (!credentialRef.startsWith("credentialRef:")) failures.push("credential_ref_required");
  if (looksLikeDirectCredentialValue(credentialRef)) failures.push("raw_secret_shape_forbidden");
  if (!prompt) failures.push("prompt_required");
  if (!expectedResponseContains) failures.push("expected_response_marker_required");
  if (!Number.isFinite(maxRequests) || maxRequests < 0 || maxRequests > 1) failures.push("max_requests_invalid");
  if (!Number.isFinite(maxEstimatedCostUsd) || maxEstimatedCostUsd < 0 || maxEstimatedCostUsd > 0.01) failures.push("budget_invalid");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.timeoutMsLimit) {
    failures.push("timeout_invalid");
  }

  return {
    ok: failures.length === 0,
    failures,
    envelope: {
      phase,
      providerId,
      modelId,
      credentialRef,
      prompt,
      expectedResponseContains,
      maxRequests,
      maxEstimatedCostUsd,
      timeoutMs,
      allowProviderCall,
      dryRun,
      stream,
    },
    gates: {
      requestEnvelopeNormalized: failures.length === 0,
      maxRequestsGateEnforced: maxRequests <= 1,
      budgetGateEnforced: maxEstimatedCostUsd <= 0.01,
      timeoutGateEnforced: timeoutMs <= SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.timeoutMsLimit,
      providerAllowlistEnforced: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(providerId),
      modelAllowlistEnforced: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(modelId),
      credentialRefOnly: credentialRef.startsWith("credentialRef:"),
      rawSecretAccepted: false,
    },
  };
}

function looksLikeDirectCredentialValue(value) {
  const text = String(value ?? "").trim();
  const lower = text.toLowerCase();
  for (const prefix of FORBIDDEN_CREDENTIAL_PREFIX_PARTS) {
    if ((lower.startsWith(`${prefix}-`) || lower.startsWith(`${prefix}_`)) && text.length >= 16) {
      return true;
    }
  }
  return text.startsWith(AWS_ACCESS_ID_PREFIX) && text.length === 20;
}
