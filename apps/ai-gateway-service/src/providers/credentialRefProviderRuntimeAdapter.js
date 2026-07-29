import { createCredentialRefResolverRuntime } from "./credentialRefResolverRuntime.js";
import { createSafeProviderExecutionInvoker } from "./safeProviderExecutionInvoker.js";

const RAW_KEY_PATTERN =
  /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|api[_-]?key|bearer\s+[a-z0-9._-]{16,})/i;

export function createCredentialRefProviderRuntimeAdapter(options = {}) {
  const safeInvoker = options.safeExecutionInvoker ?? createSafeProviderExecutionInvoker();
  const resolverRuntime = options.resolverRuntime ?? createCredentialRefResolverRuntime({
    safeExecutionInvoker: safeInvoker.invokeProvider ?? options.safeRuntimeEntry,
    safeExecutionInvokerName: safeInvoker.invokeProvider ? "safeProviderExecutionInvoker.invokeProvider" : options.safeRuntimeEntryName,
  });
  const safeRuntimeEntryDetected = resolverRuntime?.safeExecutionInvokerDetected === true;
  const safeRuntimeEntryName = resolverRuntime?.safeExecutionInvokerName ?? null;

  return {
    safeRuntimeEntryDetected,
    safeRuntimeEntryName,

    async runGuardedProviderStabilityRequest(input = {}) {
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
          expectedResponseContains: normalized.expectedResponseContains,
          timeoutMs: normalized.timeoutMs,
          readyForGuardedExecution: false,
        });
      }

      if (input.dryRun === true) {
        const runtimeResult = await resolverRuntime.run({
          ...normalized,
          maxRequests: input.maxRequests,
          invocationPurpose: input.invocationPurpose,
          dryRun: true,
        });
        return mapResolverResult(runtimeResult, normalized);
      }

      const runtimeResult = await resolverRuntime.run({
        ...normalized,
        maxRequests: input.maxRequests,
        invocationPurpose: input.invocationPurpose,
        dryRun: false,
      });
      return mapResolverResult(runtimeResult, normalized);
    },
  };
}

function normalizeRequest(input) {
  const providerId = String(input.providerId ?? "").trim();
  const modelId = String(input.modelId ?? "").trim();
  const credentialRef = String(input.credentialRef ?? "").trim();
  const prompt = String(input.prompt ?? "").trim();
  const expectedResponseContains = String(input.expectedResponseContains ?? "").trim();
  const timeoutMs = Number(input.timeoutMs ?? 30000);
  const failures = [];

  if (!providerId) failures.push("provider_id_required");
  if (!modelId) failures.push("model_id_required");
  if (!credentialRef) failures.push("credential_ref_required");
  if (credentialRef && !credentialRef.startsWith("credentialRef:")) failures.push("credential_ref_only_required");
  if (RAW_KEY_PATTERN.test(credentialRef)) failures.push("raw_key_shape_forbidden");
  if (!prompt) failures.push("prompt_required");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) failures.push("timeout_invalid");

  return {
    providerId,
    modelId,
    credentialRef,
    prompt,
    expectedResponseContains,
    timeoutMs,
    failures,
  };
}

function buildResult(overrides = {}) {
  return {
    ok: false,
    dryRun: false,
    providerCallsMade: false,
    realProviderCallExecuted: false,
    credentialRefOnly: true,
    readyForGuardedExecution: false,
    blocker: null,
    providerId: null,
    modelId: null,
    credentialRef: null,
    expectedResponseContains: null,
    timeoutMs: null,
    responseReceived: false,
    responseContainsExpectedMarker: false,
    sanitizedResponsePreview: null,
    safeRuntimeEntryDetected: false,
    safeRuntimeEntryName: null,
    resolvedCredentialRef: false,
    providerRuntimeCoreReady: false,
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

function mapResolverResult(runtimeResult, normalized) {
  return buildResult({
    ok: runtimeResult.ok === true,
    dryRun: runtimeResult.dryRun === true,
    blocker: runtimeResult.blocker ?? null,
    providerId: normalized.providerId,
    modelId: normalized.modelId,
    credentialRef: normalized.credentialRef,
    expectedResponseContains: normalized.expectedResponseContains,
    timeoutMs: normalized.timeoutMs,
    readyForGuardedExecution: runtimeResult.readyForGuardedExecution === true,
    providerCallsMade: runtimeResult.providerCallsMade === true,
    realProviderCallExecuted: runtimeResult.realProviderCallExecuted === true,
    responseReceived: Boolean(runtimeResult.sanitizedResponsePreview),
    responseContainsExpectedMarker: runtimeResult.responseContainsExpectedMarker === true,
    sanitizedResponsePreview: runtimeResult.sanitizedResponsePreview ?? null,
    safeRuntimeEntryDetected: runtimeResult.safeExecutionInvokerDetected === true,
    safeRuntimeEntryName: runtimeResult.safeExecutionInvokerName ?? null,
    resolvedCredentialRef: runtimeResult.resolvedCredentialRef === true,
    providerRuntimeCoreReady: runtimeResult.providerRuntimeCoreReady === true,
  });
}

function sanitizePreview(value) {
  const text = String(value ?? "").replace(RAW_KEY_PATTERN, "[redacted]");
  return text.slice(0, 300);
}
