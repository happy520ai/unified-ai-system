import { SAFE_PROVIDER_EXECUTION_INVOKER_CONTRACT } from "./safeProviderExecutionInvoker.contract.js";
import { createSafeProviderCallImplementation } from "./safeProviderCallImplementation.js";
import { RAW_KEY_PATTERN } from "./securityPatterns.js";

export function createSafeProviderExecutionInvoker(options = {}) {
  const providerCallRuntime = options.safeProviderCallImplementation ?? createSafeProviderCallImplementation(options.providerCallImplementationOptions);
  const legacyProviderCallImplementation = typeof options.providerCallImplementation === "function"
    ? options.providerCallImplementation
    : null;
  const providerCallImplementationReady = providerCallRuntime?.providerCallImplementationReady === true || Boolean(legacyProviderCallImplementation);
  const providerCallImplementationName = options.providerCallImplementationName
    || providerCallRuntime?.internalExecutorName
    || "safeProviderCallImplementation.executeProviderCall";

  function validateInvocationRequest(request = {}) {
    const normalized = normalizeRequest(request);
    return {
      ok: normalized.failures.length === 0,
      failures: normalized.failures,
      normalized,
    };
  }

  async function runInvocationDryRun(request = {}) {
    const validation = validateInvocationRequest(request);
    if (!validation.ok) {
      return buildResult({
        ok: false,
        dryRun: true,
        blocker: validation.failures[0],
        validationFailures: validation.failures,
        ...pickIdentity(validation.normalized),
      });
    }

    const providerCallDryRun = providerCallRuntime?.runProviderCallDryRun
      ? await providerCallRuntime.runProviderCallDryRun(validation.normalized)
      : null;

    return buildResult({
      ok: true,
      dryRun: true,
      blocker: providerCallDryRun?.blocker ?? null,
      safeExecutionInvokerReady: true,
      providerCallImplementationReady: providerCallImplementationReady && providerCallDryRun?.providerCallImplementationReady !== false,
      providerCallImplementationName,
      internalExecutorReady: providerCallDryRun?.internalExecutorReady === true,
      ...pickIdentity(validation.normalized),
      sanitizedInvocationPreview: buildSanitizedInvocationPreview(validation.normalized),
    });
  }

  async function invokeProvider(request = {}) {
    const validation = validateInvocationRequest(request);
    if (!validation.ok) {
      return buildResult({
        ok: false,
        dryRun: false,
        blocker: validation.failures[0],
        validationFailures: validation.failures,
        ...pickIdentity(validation.normalized),
      });
    }

    if (!providerCallImplementationReady) {
      return buildResult({
        ok: false,
        dryRun: false,
        blocker: "safe_provider_call_implementation_missing",
        safeExecutionInvokerReady: true,
        providerCallImplementationReady: false,
        providerCallImplementationName: null,
        ...pickIdentity(validation.normalized),
        sanitizedInvocationPreview: buildSanitizedInvocationPreview(validation.normalized),
      });
    }

    try {
      const providerCallRequest = {
        providerId: validation.normalized.providerId,
        modelId: validation.normalized.modelId,
        credentialRef: validation.normalized.credentialRef,
        prompt: validation.normalized.prompt,
        expectedResponseContains: validation.normalized.expectedResponseContains,
        timeoutMs: validation.normalized.timeoutMs,
        maxRequests: validation.normalized.maxRequests,
        invocationPurpose: validation.normalized.invocationPurpose,
      };
      const result = providerCallRuntime?.executeProviderCall
        ? await providerCallRuntime.executeProviderCall(providerCallRequest)
        : await legacyProviderCallImplementation(providerCallRequest);
      const responseText = String(result?.text ?? result?.responseText ?? "");
      return buildResult({
        ok: result?.ok === true || (result?.providerCallsMade === true && responseText.includes(validation.normalized.expectedResponseContains)),
        dryRun: false,
        blocker: result?.blocker ?? (responseText.includes(validation.normalized.expectedResponseContains) ? null : "provider_response_marker_missing"),
        safeExecutionInvokerReady: true,
        providerCallImplementationReady: true,
        providerCallImplementationName,
        internalExecutorReady: result?.internalExecutorReady === true,
        providerCallsMade: result?.providerCallsMade === true,
        realProviderCallExecuted: result?.providerCallsMade === true,
        responseContainsExpectedMarker: result?.responseContainsExpectedMarker === true || responseText.includes(validation.normalized.expectedResponseContains),
        sanitizedResponsePreview: result?.sanitizedResponsePreview ?? sanitizePreview(responseText),
        ...pickIdentity(validation.normalized),
        sanitizedInvocationPreview: buildSanitizedInvocationPreview(validation.normalized),
      });
    } catch (error) {
      return buildResult({
        ok: false,
        dryRun: false,
        blocker: "provider_stability_attempt_failed",
        safeExecutionInvokerReady: true,
        providerCallImplementationReady: true,
        providerCallImplementationName,
        providerCallsMade: true,
        realProviderCallExecuted: true,
        responseContainsExpectedMarker: false,
        sanitizedResponsePreview: sanitizePreview(error instanceof Error ? error.message : String(error)),
        ...pickIdentity(validation.normalized),
        sanitizedInvocationPreview: buildSanitizedInvocationPreview(validation.normalized),
      });
    }
  }

  return {
    contract: SAFE_PROVIDER_EXECUTION_INVOKER_CONTRACT,
    safeExecutionInvokerReady: true,
    providerCallImplementationReady,
    providerCallImplementationName,
    validateInvocationRequest,
    runInvocationDryRun,
    invokeProvider,
  };
}

function normalizeRequest(request) {
  const providerId = String(request.providerId ?? "").trim();
  const modelId = String(request.modelId ?? "").trim();
  const credentialRef = String(request.credentialRef ?? "").trim();
  const prompt = String(request.prompt ?? "").trim();
  const expectedResponseContains = String(request.expectedResponseContains ?? "").trim();
  const timeoutMs = Number(request.timeoutMs ?? SAFE_PROVIDER_EXECUTION_INVOKER_CONTRACT.timeoutMsLimit);
  const maxRequests = Number(request.maxRequests ?? 1);
  const invocationPurpose = String(request.invocationPurpose ?? "").trim();
  const failures = [];

  if (!providerId) failures.push("provider_id_required");
  if (!modelId) failures.push("model_id_required");
  if (!credentialRef.startsWith("credentialRef:")) failures.push("credential_ref_only_required");
  if (RAW_KEY_PATTERN.test(credentialRef)) failures.push("raw_key_shape_forbidden");
  if (!prompt) failures.push("prompt_required");
  if (!expectedResponseContains) failures.push("expected_response_marker_required");
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > SAFE_PROVIDER_EXECUTION_INVOKER_CONTRACT.maxRequestsLimit) {
    failures.push("max_requests_invalid");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > SAFE_PROVIDER_EXECUTION_INVOKER_CONTRACT.timeoutMsLimit) {
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
    maxRequests,
    invocationPurpose,
    failures,
  };
}

function isAllowedInvocationPurpose(invocationPurpose) {
  const allowedPurposes = SAFE_PROVIDER_EXECUTION_INVOKER_CONTRACT.allowedInvocationPurposes
    ?? [SAFE_PROVIDER_EXECUTION_INVOKER_CONTRACT.allowedInvocationPurpose];
  return allowedPurposes.includes(invocationPurpose);
}

function buildResult(overrides = {}) {
  return {
    ok: false,
    dryRun: false,
    safeExecutionInvokerReady: false,
    providerCallImplementationReady: false,
    providerCallImplementationName: null,
    credentialRefOnly: true,
    providerCallsMade: false,
    realProviderCallExecuted: false,
    responseContainsExpectedMarker: false,
    blocker: null,
    providerId: null,
    modelId: null,
    credentialRef: null,
    maxRequests: null,
    timeoutMs: null,
    invocationPurpose: null,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    envDumped: false,
    rawKeyOutput: false,
    authHeaderLogged: false,
    chatGatewayExecuteModified: false,
    sanitizedInvocationPreview: null,
    sanitizedResponsePreview: null,
    ...overrides,
  };
}

function pickIdentity(request) {
  return {
    providerId: request.providerId,
    modelId: request.modelId,
    credentialRef: request.credentialRef,
    maxRequests: request.maxRequests,
    timeoutMs: request.timeoutMs,
    invocationPurpose: request.invocationPurpose,
  };
}

function buildSanitizedInvocationPreview(request) {
  return {
    providerId: request.providerId,
    modelId: request.modelId,
    credentialRef: request.credentialRef,
    promptLength: request.prompt.length,
    expectedResponseContains: request.expectedResponseContains,
    maxRequests: request.maxRequests,
    timeoutMs: request.timeoutMs,
    invocationPurpose: request.invocationPurpose,
  };
}

function sanitizePreview(value) {
  return String(value ?? "").replace(RAW_KEY_PATTERN, "[redacted]").slice(0, 300);
}
