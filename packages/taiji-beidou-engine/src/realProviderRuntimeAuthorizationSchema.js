export const REAL_PROVIDER_RUNTIME_ALLOWED_PROVIDERS = Object.freeze(["nvidia"]);

export const REAL_PROVIDER_RUNTIME_ALLOWED_NVIDIA_MODELS = Object.freeze([
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "nvidia/llama-3.1-nemotron-nano-8b-v1",
]);

export const REAL_PROVIDER_RUNTIME_BLOCKED_MODELS = Object.freeze([
  "nvidia/llama-3.1-nemotron-ultra-253b-v1",
]);

export function createRealProviderRuntimeApprovalTemplate(overrides = {}) {
  return {
    decision: "approved_execute_guarded_real_provider_runtime_v0",
    providerId: "nvidia",
    modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
    credentialRef: "credentialRef:nvidia:default",
    capabilityId: "trial-1",
    runtimeKind: "guarded_real_provider_v0",
    maxRequests: 1,
    maxRetries: 0,
    maxEstimatedCostUsd: 0,
    allowProviderCall: true,
    allowSecretRead: false,
    allowDeploy: false,
    allowChatMutation: false,
    allowChatGatewayExecuteMutation: false,
    allowCodexConfigMutation: false,
    approvalOwner: "human-user",
    approvalReason: "self-use guarded real provider runtime validation",
    expiresAt: "2099-12-31T23:59:59.000Z",
    acknowledgements: {
      notProductionRuntime: true,
      notMainChainRuntime: true,
      notDeployment: true,
      credentialRefOnly: true,
      rawSecretMustNotBePrinted: true,
      evidenceRequired: true,
      rollbackRequired: true,
    },
    ...overrides,
  };
}

export function validateRealProviderRuntimeApproval(packet = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const failures = [];
  if (packet.decision !== "approved_execute_guarded_real_provider_runtime_v0") failures.push("decision_invalid");
  if (!REAL_PROVIDER_RUNTIME_ALLOWED_PROVIDERS.includes(packet.providerId)) failures.push("provider_not_allowed");
  if (!REAL_PROVIDER_RUNTIME_ALLOWED_NVIDIA_MODELS.includes(packet.modelId)) failures.push("model_not_allowed_or_unverified");
  if (REAL_PROVIDER_RUNTIME_BLOCKED_MODELS.includes(packet.modelId)) failures.push("model_blocked");
  if (!isCredentialRef(packet.credentialRef)) failures.push("credential_ref_required");
  if (!packet.capabilityId) failures.push("capability_id_required");
  if (packet.runtimeKind !== "guarded_real_provider_v0") failures.push("runtime_kind_invalid");
  if (!Number.isInteger(packet.maxRequests) || packet.maxRequests < 1 || packet.maxRequests > 3) failures.push("max_requests_invalid");
  if (packet.maxRetries !== 0) failures.push("max_retries_must_be_0");
  if (typeof packet.maxEstimatedCostUsd !== "number" || packet.maxEstimatedCostUsd < 0) failures.push("max_estimated_cost_required");
  if (packet.allowProviderCall !== true) failures.push("allow_provider_call_must_be_true");
  for (const key of [
    "allowSecretRead",
    "allowDeploy",
    "allowChatMutation",
    "allowChatGatewayExecuteMutation",
    "allowCodexConfigMutation",
  ]) {
    if (packet[key] !== false) failures.push(`${key}_must_be_false`);
  }
  if (packet.approvalOwner !== "human-user") failures.push("human_approval_owner_required");
  if (!packet.approvalReason) failures.push("approval_reason_required");
  if (!packet.expiresAt || Number.isNaN(Date.parse(packet.expiresAt)) || new Date(packet.expiresAt) <= now) failures.push("approval_expired_or_invalid");
  for (const [key, expected] of Object.entries(createRealProviderRuntimeApprovalTemplate().acknowledgements)) {
    if (packet.acknowledgements?.[key] !== expected) failures.push(`ack_${key}_invalid`);
  }
  if ("rawSecret" in packet || "apiKey" in packet || "secret" in packet || "baseUrl" in packet || "base_url" in packet) {
    failures.push("raw_secret_or_base_url_field_forbidden");
  }
  return {
    authorizationComplete: failures.length === 0,
    failures,
    providerIdAllowedList: [...REAL_PROVIDER_RUNTIME_ALLOWED_PROVIDERS],
    credentialRefOnly: isCredentialRef(packet.credentialRef),
  };
}

export function isCredentialRef(value) {
  return typeof value === "string" && /^credentialRef:[a-z0-9_.:-]+$/i.test(value);
}
