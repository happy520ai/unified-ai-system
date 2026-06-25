import { SAFE_PROVIDER_CALL_IMPLEMENTATION_CONTRACT } from "./safeProviderCallImplementation.contract.js";
import { RAW_KEY_PATTERN } from "./securityPatterns.js";

export function createSafeProviderCallImplementation(options = {}) {
  const internalExecutor = typeof options.internalExecutor === "function" ? options.internalExecutor : null;
  const internalExecutorName = internalExecutor ? options.internalExecutorName || "provided_safe_internal_provider_executor" : null;

  function validateProviderCallRequest(request = {}) {
    const normalized = normalizeRequest(request);
    return {
      ok: normalized.failures.length === 0,
      failures: normalized.failures,
      normalized,
    };
  }

  async function runProviderCallDryRun(request = {}) {
    const validation = validateProviderCallRequest(request);
    if (!validation.ok) {
      return buildResult({
        ok: false,
        dryRun: true,
        blocker: validation.failures[0],
        validationFailures: validation.failures,
        providerCallImplementationReady: false,
        ...pickIdentity(validation.normalized),
      });
    }

    return buildResult({
      ok: true,
      dryRun: true,
      blocker: null,
      providerCallImplementationReady: true,
      internalExecutorReady: Boolean(internalExecutor),
      internalExecutorName,
      ...pickIdentity(validation.normalized),
      sanitizedProviderCallPreview: buildSanitizedProviderCallPreview(validation.normalized),
    });
  }

  async function executeProviderCall(request = {}) {
    const validation = validateProviderCallRequest(request);
    if (!validation.ok) {
      return buildResult({
        ok: false,
        dryRun: false,
        blocker: validation.failures[0],
        validationFailures: validation.failures,
        providerCallImplementationReady: true,
        ...pickIdentity(validation.normalized),
      });
    }

    if (!internalExecutor) {
      return buildResult({
        ok: false,
        dryRun: false,
        blocker: "safe_provider_call_implementation_missing",
        providerCallImplementationReady: true,
        internalExecutorReady: false,
        internalExecutorName: null,
        ...pickIdentity(validation.normalized),
        sanitizedProviderCallPreview: buildSanitizedProviderCallPreview(validation.normalized),
      });
    }

    try {
      const result = await internalExecutor({
        providerId: validation.normalized.providerId,
        modelId: validation.normalized.modelId,
        credentialRef: validation.normalized.credentialRef,
        prompt: validation.normalized.prompt,
        expectedResponseContains: validation.normalized.expectedResponseContains,
        timeoutMs: validation.normalized.timeoutMs,
        invocationPurpose: validation.normalized.invocationPurpose,
      });
      const responseText = String(result?.text ?? result?.responseText ?? "");
      const markerMatched = responseText.includes(validation.normalized.expectedResponseContains);
      return buildResult({
        ok: result?.providerCallsMade === true && markerMatched,
        dryRun: false,
        blocker: result?.blocker ?? (markerMatched ? null : "provider_response_marker_missing"),
        providerCallImplementationReady: true,
        internalExecutorReady: true,
        internalExecutorName,
        providerCallsMade: result?.providerCallsMade === true,
        realProviderCallExecuted: result?.providerCallsMade === true,
        responseContainsExpectedMarker: markerMatched,
        sanitizedResponsePreview: sanitizePreview(responseText || result?.sanitizedResponsePreview),
        ...pickIdentity(validation.normalized),
        sanitizedProviderCallPreview: buildSanitizedProviderCallPreview(validation.normalized),
      });
    } catch (error) {
      return buildResult({
        ok: false,
        dryRun: false,
        blocker: "provider_stability_attempt_failed",
        providerCallImplementationReady: true,
        internalExecutorReady: true,
        internalExecutorName,
        providerCallsMade: true,
        realProviderCallExecuted: true,
        responseContainsExpectedMarker: false,
        sanitizedResponsePreview: sanitizePreview(error instanceof Error ? error.message : String(error)),
        ...pickIdentity(validation.normalized),
        sanitizedProviderCallPreview: buildSanitizedProviderCallPreview(validation.normalized),
      });
    }
  }

  return {
    contract: SAFE_PROVIDER_CALL_IMPLEMENTATION_CONTRACT,
    providerCallImplementationReady: true,
    internalExecutorReady: Boolean(internalExecutor),
    internalExecutorName,
    validateProviderCallRequest,
    runProviderCallDryRun,
    executeProviderCall,
  };
}

function normalizeRequest(request) {
  const providerId = String(request.providerId ?? "").trim();
  const modelId = String(request.modelId ?? "").trim();
  const credentialRef = String(request.credentialRef ?? "").trim();
  const prompt = String(request.prompt ?? "").trim();
  const expectedResponseContains = String(request.expectedResponseContains ?? "").trim();
  const timeoutMs = Number(request.timeoutMs ?? SAFE_PROVIDER_CALL_IMPLEMENTATION_CONTRACT.timeoutMsLimit);
  const invocationPurpose = String(request.invocationPurpose ?? "").trim();
  const failures = [];

  if (!SAFE_PROVIDER_CALL_IMPLEMENTATION_CONTRACT.allowedProviderIds.includes(providerId)) failures.push("provider_not_allowed");
  if (!modelId) failures.push("model_id_required");
  if (!credentialRef.startsWith("credentialRef:")) failures.push("credential_ref_only_required");
  if (RAW_KEY_PATTERN.test(credentialRef)) failures.push("raw_key_shape_forbidden");
  if (!prompt) failures.push("prompt_required");
  if (!expectedResponseContains) failures.push("expected_response_marker_required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > SAFE_PROVIDER_CALL_IMPLEMENTATION_CONTRACT.timeoutMsLimit) {
    failures.push("timeout_invalid");
  }
  if (!isAllowedInvocationPurpose(invocationPurpose)) {
    failures.push("invocation_purpose_invalid");
  }
  for (const key of ["apiKey", "rawKey", "authorizationHeader", "env"]) {
    if (Object.prototype.hasOwnProperty.call(request, key)) failures.push(`${key}_forbidden`);
  }

  return {
    providerId,
    modelId,
    credentialRef,
    prompt,
    expectedResponseContains,
    timeoutMs,
    invocationPurpose,
    failures,
  };
}

function isAllowedInvocationPurpose(invocationPurpose) {
  const allowedPurposes = SAFE_PROVIDER_CALL_IMPLEMENTATION_CONTRACT.allowedInvocationPurposes
    ?? [SAFE_PROVIDER_CALL_IMPLEMENTATION_CONTRACT.allowedInvocationPurpose];
  return allowedPurposes.includes(invocationPurpose);
}

function buildResult(overrides = {}) {
  return {
    ok: false,
    dryRun: false,
    providerCallImplementationReady: false,
    internalExecutorReady: false,
    internalExecutorName: null,
    credentialRefOnly: true,
    providerCallsMade: false,
    realProviderCallExecuted: false,
    responseContainsExpectedMarker: false,
    blocker: null,
    providerId: null,
    modelId: null,
    credentialRef: null,
    timeoutMs: null,
    invocationPurpose: null,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    envDumped: false,
    rawKeyOutput: false,
    authHeaderLogged: false,
    chatGatewayExecuteModified: false,
    sanitizedProviderCallPreview: null,
    sanitizedResponsePreview: null,
    ...overrides,
  };
}

function pickIdentity(request) {
  return {
    providerId: request.providerId,
    modelId: request.modelId,
    credentialRef: request.credentialRef,
    timeoutMs: request.timeoutMs,
    invocationPurpose: request.invocationPurpose,
  };
}

function buildSanitizedProviderCallPreview(request) {
  return {
    providerId: request.providerId,
    modelId: request.modelId,
    credentialRef: request.credentialRef,
    promptLength: request.prompt.length,
    expectedResponseContains: request.expectedResponseContains,
    timeoutMs: request.timeoutMs,
    invocationPurpose: request.invocationPurpose,
  };
}

function sanitizePreview(value) {
  return String(value ?? "").replace(RAW_KEY_PATTERN, "[redacted]").slice(0, 300);
}
