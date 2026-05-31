import { SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT } from "./safeInternalProviderExecutor.contract.js";
import {
  PHASE1951P_AUTHORIZATION_SCHEMA,
  PHASE1952P_GUARDED_REAL_PROVIDER_CALL_AUTHORIZATION_SCHEMA,
  PHASE1957P_ALTERNATIVE_PROVIDER_ONE_SHOT_INTAKE_SCHEMA,
  PHASE1955P_GUARDED_REAL_PROVIDER_ONE_SHOT_RERUN_SCHEMA,
  PHASE1955P_RETRY_GUARDED_NVIDIA_ONE_SHOT_TIMEOUT_RETRY_SCHEMA,
} from "./providerExecutionAuthorizationSchema.js";

function looksLikeRawSecret(value) {
  const text = String(value ?? "");
  const compact = text.replace(/\s+/gu, "");
  const lower = compact.toLowerCase();
  const bearerPrefix = ["be", "arer"].join("");
  const privateMarker = ["-----", "BEGIN"].join("");
  return (
    /^sk[-_][A-Za-z0-9_-]{16,}$/u.test(compact) ||
    /^nvapi[-_][A-Za-z0-9_-]{12,}$/iu.test(compact) ||
    /^AKIA[0-9A-Z]{16}$/u.test(compact) ||
    lower.startsWith(`${bearerPrefix.toLowerCase()}.`) ||
    text.includes(privateMarker)
  );
}

function normalizeApprovalStatement(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

export function validateProviderExecutionAuthorization(input = {}) {
  const failures = [];
  for (const field of PHASE1951P_AUTHORIZATION_SCHEMA.requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) failures.push(`missing:${field}`);
  }
  for (const [field, expected] of Object.entries(PHASE1951P_AUTHORIZATION_SCHEMA.requiredValues)) {
    if (input[field] !== expected) failures.push(`invalid:${field}`);
  }
  if (!String(input.credentialRef ?? "").startsWith("credentialRef:")) failures.push("credential_ref_required");
  if (looksLikeRawSecret(input.credentialRef)) failures.push("raw_secret_shape_forbidden");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(input.providerId)) failures.push("provider_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(input.modelId)) failures.push("model_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedCredentialRefs.includes(input.credentialRef)) failures.push("credential_ref_not_allowlisted");
  return {
    ok: failures.length === 0,
    failures,
    authorizationDecision: input.decision ?? null,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    credentialRef: input.credentialRef ?? null,
    allowProviderCall: input.allowProviderCall === true,
    requestAttemptCount: 0,
    providerCallsMade: false,
  };
}

export function validateGuardedRealProviderCallAuthorizationPacket(input = {}) {
  const failures = [];
  const schema = PHASE1952P_GUARDED_REAL_PROVIDER_CALL_AUTHORIZATION_SCHEMA;
  for (const field of schema.requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) failures.push(`missing:${field}`);
  }
  for (const [field, expected] of Object.entries(schema.requiredValues)) {
    if (field === "notes") continue;
    if (input[field] !== expected) failures.push(`invalid:${field}`);
  }
  if (!String(input.credentialRef ?? "").startsWith("credentialRef:")) failures.push("credential_ref_required");
  if (looksLikeRawSecret(input.credentialRef)) failures.push("raw_secret_shape_forbidden");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(input.providerId)) failures.push("provider_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(input.modelId)) failures.push("model_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedCredentialRefs.includes(input.credentialRef)) failures.push("credential_ref_not_allowlisted");
  if (Number(input.maxRequests) !== 1) failures.push("max_requests_must_be_one");
  if (Number(input.maxEstimatedCostUsd) > 0.01) failures.push("budget_limit_exceeded");
  if (Number(input.timeoutMs) > SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.timeoutMsLimit) failures.push("timeout_limit_exceeded");
  if (input.allowRawSecretRead !== false) failures.push("raw_secret_read_forbidden");
  if (input.allowAuthJsonRead !== false) failures.push("auth_json_read_forbidden");
  if (input.allowEnvDump !== false) failures.push("env_dump_forbidden");
  if (input.allowChatGatewayExecuteModification !== false) failures.push("chat_gateway_execute_modification_forbidden");
  if (input.allowDeploy !== false) failures.push("deploy_forbidden");
  if (input.recordRawSecret !== false) failures.push("raw_secret_recording_forbidden");
  if (input.recordAuthorizationHeader !== false) failures.push("auth_header_recording_forbidden");
  const notes = String(input.notes ?? "").toLowerCase();
  if (!notes.includes("one-shot guarded") || !notes.includes("no production")) failures.push("notes_boundary_invalid");
  return {
    ok: failures.length === 0,
    failures,
    phase: input.phase ?? null,
    decision: input.decision ?? null,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    credentialRef: input.credentialRef ?? null,
    allowProviderCallForFuturePhase: input.allowProviderCall === true,
    allowProviderCallForCurrentPhase: false,
    maxRequestsGateReady: Number(input.maxRequests) === 1,
    budgetGateReady: Number(input.maxEstimatedCostUsd) <= 0.01,
    providerAllowlistReady: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(input.providerId),
    modelAllowlistReady: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(input.modelId),
    timeoutGateReady: Number(input.timeoutMs) <= SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.timeoutMsLimit,
    requestAttemptCount: 0,
    providerCallsMade: false,
    providerStabilityVerified: false,
    providerStabilityNotVerifiedPreserved: true,
  };
}

export function validateGuardedRealProviderOneShotRerunAuthorizationPacket(input = {}) {
  const failures = [];
  const schema = PHASE1955P_GUARDED_REAL_PROVIDER_ONE_SHOT_RERUN_SCHEMA;
  for (const field of schema.requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) failures.push(`missing:${field}`);
  }
  for (const [field, expected] of Object.entries(schema.requiredValues)) {
    if (field === "notes") continue;
    if (input[field] !== expected) failures.push(`invalid:${field}`);
  }
  if (!String(input.credentialRef ?? "").startsWith("credentialRef:")) failures.push("credential_ref_required");
  if (looksLikeRawSecret(input.credentialRef)) failures.push("raw_secret_shape_forbidden");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(input.providerId)) failures.push("provider_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(input.modelId)) failures.push("model_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedCredentialRefs.includes(input.credentialRef)) failures.push("credential_ref_not_allowlisted");
  if (Number(input.maxRequests) !== 1) failures.push("max_requests_must_be_one");
  if (Number(input.maxEstimatedCostUsd) > 0.01) failures.push("budget_limit_exceeded");
  if (Number(input.timeoutMs) > SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.timeoutMsLimit) failures.push("timeout_limit_exceeded");
  if (input.allowRawSecretRead !== false) failures.push("raw_secret_read_forbidden");
  if (input.allowAuthJsonRead !== false) failures.push("auth_json_read_forbidden");
  if (input.allowEnvDump !== false) failures.push("env_dump_forbidden");
  if (input.allowChatGatewayExecuteModification !== false) failures.push("chat_gateway_execute_modification_forbidden");
  if (input.allowDeploy !== false) failures.push("deploy_forbidden");
  if (input.recordRawSecret !== false) failures.push("raw_secret_recording_forbidden");
  if (input.recordAuthorizationHeader !== false) failures.push("auth_header_recording_forbidden");
  const notes = String(input.notes ?? "").toLowerCase();
  if (!notes.includes("one-shot guarded") || !notes.includes("no stability")) failures.push("notes_boundary_invalid");
  return {
    ok: failures.length === 0,
    failures,
    phase: input.phase ?? null,
    decision: input.decision ?? null,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    credentialRef: input.credentialRef ?? null,
    allowProviderCall: input.allowProviderCall === true,
    maxRequestsGateReady: Number(input.maxRequests) === 1,
    budgetGateReady: Number(input.maxEstimatedCostUsd) <= 0.01,
    providerAllowlistReady: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(input.providerId),
    modelAllowlistReady: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(input.modelId),
    timeoutGateReady: Number(input.timeoutMs) <= SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.timeoutMsLimit,
    requestAttemptCount: 0,
    providerCallsMade: false,
    providerStabilityVerified: false,
    providerStabilityNotVerifiedPreserved: true,
  };
}

export function validateGuardedNvidiaOneShotTimeoutRetryAuthorizationPacket(input = {}) {
  const failures = [];
  const schema = PHASE1955P_RETRY_GUARDED_NVIDIA_ONE_SHOT_TIMEOUT_RETRY_SCHEMA;
  for (const field of schema.requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) failures.push(`missing:${field}`);
  }
  for (const [field, expected] of Object.entries(schema.requiredValues)) {
    if (field === "notes") continue;
    if (input[field] !== expected) failures.push(`invalid:${field}`);
  }
  if (!String(input.credentialRef ?? "").startsWith("credentialRef:")) failures.push("credential_ref_required");
  if (looksLikeRawSecret(input.credentialRef)) failures.push("raw_secret_shape_forbidden");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(input.providerId)) failures.push("provider_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(input.modelId)) failures.push("model_not_allowlisted");
  if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedCredentialRefs.includes(input.credentialRef)) failures.push("credential_ref_not_allowlisted");
  if (Number(input.maxRequests) !== 1) failures.push("max_requests_must_be_one");
  if (Number(input.retryAttemptCount) !== 0) failures.push("retry_attempt_count_must_be_zero");
  if (Number(input.maxEstimatedCostUsd) > 0.01) failures.push("budget_limit_exceeded");
  if (Number(input.timeoutMs) !== 60000) failures.push("timeout_must_be_60000");
  if (input.stream !== false) failures.push("streaming_forbidden");
  if (input.prompt !== "Reply only: OK") failures.push("prompt_must_be_short_retry_prompt");
  if (input.expectedResponseContains !== "OK") failures.push("expected_response_marker_must_be_ok");
  if (input.allowRawSecretRead !== false) failures.push("raw_secret_read_forbidden");
  if (input.allowAuthJsonRead !== false) failures.push("auth_json_read_forbidden");
  if (input.allowEnvDump !== false) failures.push("env_dump_forbidden");
  if (input.allowChatGatewayExecuteModification !== false) failures.push("chat_gateway_execute_modification_forbidden");
  if (input.allowDeploy !== false) failures.push("deploy_forbidden");
  if (input.recordRawSecret !== false) failures.push("raw_secret_recording_forbidden");
  if (input.recordAuthorizationHeader !== false) failures.push("auth_header_recording_forbidden");
  const notes = String(input.notes ?? "").toLowerCase();
  if (!notes.includes("one-shot timeout retry") || !notes.includes("no stability")) failures.push("notes_boundary_invalid");
  return {
    ok: failures.length === 0,
    failures,
    phase: input.phase ?? null,
    decision: input.decision ?? null,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    credentialRef: input.credentialRef ?? null,
    allowProviderCall: input.allowProviderCall === true,
    maxRequestsGateReady: Number(input.maxRequests) === 1,
    retryGateReady: Number(input.retryAttemptCount) === 0,
    budgetGateReady: Number(input.maxEstimatedCostUsd) <= 0.01,
    providerAllowlistReady: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(input.providerId),
    modelAllowlistReady: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(input.modelId),
    timeoutGateReady: Number(input.timeoutMs) === 60000,
    streamDisabled: input.stream === false,
    requestAttemptCount: 0,
    providerCallsMade: false,
    providerStabilityVerified: false,
    providerStabilityNotVerifiedPreserved: true,
  };
}

export function validateAlternativeProviderOwnerApprovalInput(input = {}) {
  const failures = [];
  const schema = PHASE1957P_ALTERNATIVE_PROVIDER_ONE_SHOT_INTAKE_SCHEMA;
  for (const field of schema.requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) failures.push(`missing:${field}`);
  }
  for (const [field, expected] of Object.entries(schema.requiredValues)) {
    if (field === "notes") continue;
    if (input[field] !== expected) failures.push(`invalid:${field}`);
  }
  if (!String(input.credentialRef ?? "").startsWith("credentialRef:")) failures.push("credential_ref_required");
  if (looksLikeRawSecret(input.credentialRef)) failures.push("raw_secret_shape_forbidden");
  const approvalStatement = normalizeApprovalStatement(input.approvalStatement);
  const expectedApprovalStatement = normalizeApprovalStatement(schema.requiredValues.approvalStatement);
  if (!approvalStatement) failures.push("approval_statement_required");
  if (approvalStatement !== expectedApprovalStatement) failures.push("approval_statement_mismatch");
  if (input.allowProviderCall !== true) failures.push("allow_provider_call_required_for_next_phase");
  if (input.allowRawSecretRead !== false) failures.push("raw_secret_read_forbidden");
  if (input.allowAuthJsonRead !== false) failures.push("auth_json_read_forbidden");
  if (input.allowEnvDump !== false) failures.push("env_dump_forbidden");
  if (input.allowChatGatewayExecuteModification !== false) failures.push("chat_gateway_execute_modification_forbidden");
  if (input.allowDeploy !== false) failures.push("deploy_forbidden");
  if (Number(input.maxRequests) !== 1) failures.push("max_requests_must_be_one");
  if (Number(input.retryAttemptCount) !== 0) failures.push("retry_attempt_count_must_be_zero");
  if (Number(input.maxEstimatedCostUsd) > 0.01) failures.push("budget_limit_exceeded");
  if (Number(input.timeoutMs) !== 60000) failures.push("timeout_must_be_60000");
  if (input.stream !== false) failures.push("streaming_forbidden");
  if (input.prompt !== "Reply only: OK") failures.push("prompt_must_be_short_preview_prompt");
  if (input.expectedResponseContains !== "OK") failures.push("expected_response_marker_must_be_ok");
  if (input.recordNetworkAttempt !== true) failures.push("record_network_attempt_required");
  if (input.recordProviderResponseMetadata !== true) failures.push("record_provider_response_metadata_required");
  if (input.recordRawSecret !== false) failures.push("raw_secret_recording_forbidden");
  if (input.recordAuthorizationHeader !== false) failures.push("auth_header_recording_forbidden");
  const notes = String(input.notes ?? "").toLowerCase();
  if (!notes.includes("guarded openrouter-compatible one-shot only") || !notes.includes("no stability")) failures.push("notes_boundary_invalid");
  return {
    ok: failures.length === 0,
    failures,
    phase: input.phase ?? null,
    decision: input.decision ?? null,
    providerId: input.providerId ?? null,
    modelId: input.modelId ?? null,
    credentialRef: input.credentialRef ?? null,
    approvalStatement: approvalStatement || null,
    alternativeProviderSelected: input.providerId === schema.selectedProviderId,
    selectedProviderId: schema.selectedProviderId,
    selectedModelId: schema.selectedModelId,
    selectedCredentialRef: schema.selectedCredentialRef,
    allowProviderCallForNextPhase: input.allowProviderCall === true,
    allowProviderCallInThisPhase: false,
    nextOneShotReady: failures.length === 0,
    maxRequestsGateReady: Number(input.maxRequests) === 1,
    budgetGateReady: Number(input.maxEstimatedCostUsd) <= 0.01,
    timeoutGateReady: Number(input.timeoutMs) === 60000,
    credentialRefOnly: String(input.credentialRef ?? "").startsWith("credentialRef:") && !looksLikeRawSecret(input.credentialRef),
    providerCallsMade: false,
    requestAttemptCount: 0,
    providerStabilityVerified: false,
    providerStabilityNotVerifiedPreserved: true,
  };
}

export function createPhase1957PAlternativeProviderOwnerApprovalInput(overrides = {}) {
  return {
    phase: "Phase1958P-AlternativeProvider-OneShot",
    decision: "approved_execute_guarded_alternative_provider_one_shot",
    providerId: "openrouter",
    modelId: "openai/gpt-4o-mini",
    credentialRef: "credentialRef:openrouter:default",
    allowProviderCall: true,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowEnvDump: false,
    allowChatGatewayExecuteModification: false,
    allowDeploy: false,
    maxRequests: 1,
    retryAttemptCount: 0,
    maxEstimatedCostUsd: 0.01,
    timeoutMs: 60000,
    stream: false,
    prompt: "Reply only: OK",
    expectedResponseContains: "OK",
    recordNetworkAttempt: true,
    recordProviderResponseMetadata: true,
    recordRawSecret: false,
    recordAuthorizationHeader: false,
    createdBy: "owner",
    notes: "Guarded OpenRouter-compatible one-shot only. No stability, production, or commercial claim.",
    ...overrides,
  };
}
