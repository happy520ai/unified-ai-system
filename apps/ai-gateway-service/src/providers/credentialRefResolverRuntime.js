import { CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT } from "./credentialRefResolverRuntime.contract.js";
import { RAW_KEY_PATTERN } from "./securityPatterns.js";

export function createCredentialRefResolverRuntime(options = {}) {
  const safeExecutionInvoker = typeof options.safeExecutionInvoker === "function" ? options.safeExecutionInvoker : null;
  const safeExecutionInvokerName = safeExecutionInvoker ? options.safeExecutionInvokerName || "provided_safe_execution_invoker" : null;

  return {
    runtimeName: CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT.runtimeName,
    safeExecutionInvokerDetected: Boolean(safeExecutionInvoker),
    safeExecutionInvokerName,

    async run(input = {}) {
      const normalized = normalizeRequest(input);
      if (normalized.failures.length > 0) {
        return buildResult({
          ok: false,
          dryRun: Boolean(input.dryRun),
          blocker: normalized.failures[0],
          validationFailures: normalized.failures,
          providerId: normalized.providerId,
          modelId: normalized.modelId,
          credentialRef: normalized.credentialRef,
          timeoutMs: normalized.timeoutMs,
        });
      }

      const resolution = resolveCredentialRef(normalized);
      if (!resolution.ok) {
        return buildResult({
          ok: false,
          dryRun: Boolean(input.dryRun),
          blocker: resolution.blocker,
          providerId: normalized.providerId,
          modelId: normalized.modelId,
          credentialRef: normalized.credentialRef,
          timeoutMs: normalized.timeoutMs,
          resolvedCredentialRef: false,
          resolvedProviderId: null,
        });
      }

      if (input.dryRun === true) {
        return buildResult({
          ok: true,
          dryRun: true,
          blocker: null,
          providerId: normalized.providerId,
          modelId: normalized.modelId,
          credentialRef: normalized.credentialRef,
          timeoutMs: normalized.timeoutMs,
          resolvedCredentialRef: true,
          resolvedProviderId: resolution.providerId,
          readyForGuardedExecution: Boolean(safeExecutionInvoker),
          providerRuntimeCoreReady: true,
          safeExecutionInvokerDetected: Boolean(safeExecutionInvoker),
          safeExecutionInvokerName,
          sanitizedRequestPreview: buildSanitizedRequestPreview(normalized),
        });
      }

      if (!safeExecutionInvoker) {
        return buildResult({
          ok: false,
          dryRun: false,
          blocker: "safe_execution_invoker_missing",
          providerId: normalized.providerId,
          modelId: normalized.modelId,
          credentialRef: normalized.credentialRef,
          timeoutMs: normalized.timeoutMs,
          resolvedCredentialRef: true,
          resolvedProviderId: resolution.providerId,
          providerRuntimeCoreReady: true,
          readyForGuardedExecution: false,
          safeExecutionInvokerDetected: false,
          safeExecutionInvokerName: null,
          sanitizedRequestPreview: buildSanitizedRequestPreview(normalized),
        });
      }

      try {
        const invocationResult = await safeExecutionInvoker({
          providerId: normalized.providerId,
          modelId: normalized.modelId,
          credentialRef: normalized.credentialRef,
          prompt: normalized.prompt,
          expectedResponseContains: normalized.expectedResponseContains,
          timeoutMs: normalized.timeoutMs,
          maxRequests: normalized.maxRequests,
          invocationPurpose: normalized.invocationPurpose,
        });
        const responseText = String(invocationResult?.text ?? invocationResult?.responseText ?? "");
        const markerMatched = responseText.includes(normalized.expectedResponseContains);
        return buildResult({
          ok: invocationResult?.ok === true || markerMatched,
          dryRun: false,
          blocker: invocationResult?.blocker ?? (markerMatched ? null : "provider_response_marker_missing"),
          providerId: normalized.providerId,
          modelId: normalized.modelId,
          credentialRef: normalized.credentialRef,
          timeoutMs: normalized.timeoutMs,
          resolvedCredentialRef: true,
          resolvedProviderId: resolution.providerId,
          providerRuntimeCoreReady: true,
          readyForGuardedExecution: true,
          providerCallsMade: invocationResult?.providerCallsMade === true,
          realProviderCallExecuted: invocationResult?.providerCallsMade === true,
          responseContainsExpectedMarker: invocationResult?.responseContainsExpectedMarker === true || markerMatched,
          sanitizedResponsePreview: invocationResult?.sanitizedResponsePreview ?? sanitizePreview(responseText),
          safeExecutionInvokerDetected: true,
          safeExecutionInvokerName,
          sanitizedRequestPreview: buildSanitizedRequestPreview(normalized),
        });
      } catch (error) {
        return buildResult({
          ok: false,
          dryRun: false,
          blocker: "provider_stability_attempt_failed",
          providerId: normalized.providerId,
          modelId: normalized.modelId,
          credentialRef: normalized.credentialRef,
          timeoutMs: normalized.timeoutMs,
          resolvedCredentialRef: true,
          resolvedProviderId: resolution.providerId,
          providerRuntimeCoreReady: true,
          readyForGuardedExecution: true,
          providerCallsMade: true,
          realProviderCallExecuted: true,
          responseContainsExpectedMarker: false,
          sanitizedResponsePreview: sanitizePreview(error instanceof Error ? error.message : String(error)),
          safeExecutionInvokerDetected: true,
          safeExecutionInvokerName,
          sanitizedRequestPreview: buildSanitizedRequestPreview(normalized),
        });
      }
    },
  };
}

function normalizeRequest(input) {
  const providerId = String(input.providerId ?? "").trim();
  const modelId = String(input.modelId ?? "").trim();
  const credentialRef = String(input.credentialRef ?? "").trim();
  const prompt = String(input.prompt ?? "").trim();
  const expectedResponseContains = String(input.expectedResponseContains ?? "").trim();
  const timeoutMs = Number(input.timeoutMs ?? CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT.maxTimeoutMs);
  const maxRequests = Number(input.maxRequests ?? 1);
  const invocationPurpose = String(input.invocationPurpose ?? "").trim();
  const failures = [];

  if (!providerId) failures.push("provider_id_required");
  if (!modelId) failures.push("model_id_required");
  if (!credentialRef) failures.push("credential_ref_required");
  if (credentialRef && !credentialRef.startsWith(CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT.credentialRefPrefix)) {
    failures.push("credential_ref_only_required");
  }
  if (RAW_KEY_PATTERN.test(credentialRef)) failures.push("raw_key_shape_forbidden");
  if (!prompt) failures.push("prompt_required");
  if (!expectedResponseContains) failures.push("expected_response_marker_required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT.maxTimeoutMs) {
    failures.push("timeout_invalid");
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

function resolveCredentialRef(input) {
  const match = CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT.supportedProviderRefs.find((candidate) => {
    return candidate.providerId === input.providerId && candidate.credentialRef === input.credentialRef;
  });
  if (!match) {
    return { ok: false, blocker: "credential_ref_not_registered_for_provider" };
  }
  if (!match.allowedModelIds.includes(input.modelId)) {
    return { ok: false, blocker: "model_not_authorized_for_credential_ref" };
  }
  return { ok: true, providerId: match.providerId };
}

function buildResult(overrides = {}) {
  return {
    ok: false,
    dryRun: false,
    credentialRefOnly: true,
    providerCallsMade: false,
    realProviderCallExecuted: false,
    blocker: null,
    providerId: null,
    modelId: null,
    credentialRef: null,
    timeoutMs: null,
    resolvedCredentialRef: false,
    resolvedProviderId: null,
    providerRuntimeCoreReady: false,
    readyForGuardedExecution: false,
    safeExecutionInvokerDetected: false,
    safeExecutionInvokerName: null,
    responseContainsExpectedMarker: false,
    sanitizedRequestPreview: null,
    sanitizedResponsePreview: null,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    envDumped: false,
    rawKeyOutput: false,
    authHeaderLogged: false,
    chatGatewayExecuteModified: false,
    ...overrides,
  };
}

function buildSanitizedRequestPreview(input) {
  return {
    providerId: input.providerId,
    modelId: input.modelId,
    credentialRef: input.credentialRef,
    promptLength: input.prompt.length,
    expectedResponseContains: input.expectedResponseContains,
    timeoutMs: input.timeoutMs,
    maxRequests: input.maxRequests,
    invocationPurpose: input.invocationPurpose,
  };
}

function sanitizePreview(value) {
  const text = String(value ?? "").replace(RAW_KEY_PATTERN, "[redacted]");
  return text.slice(0, 300);
}
