import { SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT } from "./safeInternalProviderExecutor.contract.js";
import {
  validateGuardedRealProviderCallAuthorizationPacket,
  validateGuardedNvidiaOneShotTimeoutRetryAuthorizationPacket,
  validateGuardedRealProviderOneShotRerunAuthorizationPacket,
  validateAlternativeProviderOwnerApprovalInput,
  validateProviderExecutionAuthorization,
} from "./providerExecutionAuthorizationGate.js";
import { normalizeSafeProviderRequestEnvelope } from "./safeProviderRequestEnvelope.js";
import { sanitizeSafeProviderResponse } from "./safeProviderResponseSanitizer.js";

export function createSafeInternalProviderExecutor(options = {}) {
  const mode = options.mode ?? SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.providerCallImplementationMode;
  const providerAdapter = options.providerAdapter ?? null;
  const providerAdapterName = options.providerAdapterName ?? providerAdapter?.adapterName ?? null;

  function validateExecutionRequest(request = {}) {
    const failures = [];
    const credentialRef = String(request.credentialRef ?? "");
    if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedProviderIds.includes(request.providerId)) failures.push("provider_not_allowlisted");
    if (!SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.allowedModelIds.includes(request.modelId)) failures.push("model_not_allowlisted");
    if (!credentialRef.startsWith("credentialRef:")) failures.push("credential_ref_required");
    if (Object.prototype.hasOwnProperty.call(request, ["api", "Key"].join(""))) failures.push("raw_secret_field_forbidden");
    if (Object.prototype.hasOwnProperty.call(request, "authorizationHeader")) failures.push("authorization_header_forbidden");
    if (Number(request.maxRequests ?? 0) !== 0) failures.push("phase1951_max_requests_must_be_zero");
    if (Number(request.maxEstimatedCostUsd ?? 0) !== 0) failures.push("phase1951_cost_must_be_zero");
    if (request.allowProviderCall !== false) failures.push("provider_call_not_authorized_this_phase");
    return {
      ok: failures.length === 0,
      failures,
    };
  }

  function runDryRun(request = {}) {
    const authorization = validateProviderExecutionAuthorization(request.authorization ?? request);
    const requestValidation = validateExecutionRequest(request);
    const ok = authorization.ok === true && requestValidation.ok === true;
    return {
      ok,
      dryRun: true,
      providerCallImplementationMode: mode,
      safeInternalProviderExecutorReady: true,
      safeProviderCallImplementationPrepared: true,
      acceptsCredentialRefOnly: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.acceptsCredentialRefOnly,
      acceptsRawSecret: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT.acceptsRawSecret,
      credentialRefRequired: true,
      rawSecretAccepted: false,
      authorizationGatePassed: authorization.ok,
      authorizationFailures: authorization.failures,
      requestValidationPassed: requestValidation.ok,
      requestValidationFailures: requestValidation.failures,
      allowProviderCall: false,
      requestAttemptCount: 0,
      providerCallsMade: false,
      rawSecretRead: false,
      secretValueExposed: false,
      authJsonRead: false,
      readsAuthJson: false,
      readsDotEnv: false,
      envDumped: false,
      rawKeyOutput: false,
      authHeaderLogged: false,
      printsAuthHeader: false,
      chatRouteModified: false,
      chatGatewayExecuteModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      providerStabilityVerified: false,
      providerStabilityNotVerifiedPreserved: true,
      blocker: ok ? null : "provider_execution_authorization_invalid",
    };
  }

  async function execute(request = {}) {
    const normalized = normalizeSafeProviderRequestEnvelope(request);
    const base = buildBridgeResult({
      providerCallImplementationMode: mode,
      providerAdapterName,
      ...normalized.gates,
    });

    if (!normalized.ok) {
      return {
        ...base,
        ok: false,
        blocker: normalized.failures[0],
        validationFailures: normalized.failures,
      };
    }

    if (!providerAdapter || typeof providerAdapter.execute !== "function") {
      return {
        ...base,
        ok: false,
        blocker: "safe_provider_adapter_missing",
        safeInternalProviderExecutorStillStub: false,
      };
    }

    if (normalized.envelope.dryRun === true || normalized.envelope.allowProviderCall !== true) {
      const adapterResult = await providerAdapter.execute(normalized.envelope);
      const sanitized = sanitizeSafeProviderResponse(adapterResult, normalized.envelope.expectedResponseContains);
      return {
        ...base,
        ok: sanitized.expectedResponseMatched === true,
        blocker: sanitized.expectedResponseMatched ? null : "synthetic_provider_response_marker_missing",
        safeInternalProviderExecutorStillStub: false,
        realSafeProviderExecutorBridgeReady: true,
        syntheticAdapterUsed: adapterResult.syntheticAdapterUsed === true,
        providerCallsMade: false,
        realProviderNetworkAttempted: adapterResult.realProviderNetworkAttempted === true,
        requestAttemptCount: 0,
        responseSanitized: sanitized.responseSanitized,
        expectedResponseMatched: sanitized.expectedResponseMatched,
        oneShotProviderCallPassed: false,
        sanitizedResponsePreview: sanitized.sanitizedResponsePreview,
        providerResponseMetadata: sanitized.providerResponseMetadata,
      };
    }

    const startedAt = Date.now();
    const adapterResult = await providerAdapter.execute(normalized.envelope);
    const sanitized = sanitizeSafeProviderResponse(adapterResult, normalized.envelope.expectedResponseContains);
    const providerCallsMade = adapterResult.providerCallsMade === true || adapterResult.realProviderNetworkAttempted === true;
    const markerMatched = sanitized.expectedResponseMatched === true;
    const ok = providerCallsMade && markerMatched;
    return {
      ...base,
      ok,
      dryRun: false,
      blocker: ok ? null : adapterResult.blocker ?? "provider_one_shot_failed",
      safeInternalProviderExecutorStillStub: false,
      realSafeProviderExecutorBridgeReady: true,
      syntheticAdapterUsed: adapterResult.syntheticAdapterUsed === true,
      guardedRealProviderCallExecuted: providerCallsMade,
      providerCallsMade,
      realProviderNetworkAttempted: adapterResult.realProviderNetworkAttempted === true,
      requestAttemptCount: providerCallsMade ? 1 : 0,
      responseSanitized: sanitized.responseSanitized,
      expectedResponseMatched: markerMatched,
      oneShotProviderCallPassed: ok,
      latencyMs: adapterResult.latencyMs ?? Date.now() - startedAt,
      sanitizedResponsePreview: sanitized.sanitizedResponsePreview,
      providerResponseMetadata: sanitized.providerResponseMetadata,
      providerStabilityVerified: false,
      providerStabilityNotVerifiedPreserved: true,
    };
  }

  async function executeProvider(request = {}) {
    return execute(request);
  }

  async function executeGuardedOneShot(request = {}) {
    const authorization = validateGuardedRealProviderCallAuthorizationPacket(request.authorization ?? request);
    if (!authorization.ok) {
      return {
        ok: false,
        dryRun: false,
        providerCallImplementationMode: mode,
        safeInternalProviderExecutorReady: true,
        guardedRealProviderCallExecuted: false,
        providerCallsMade: false,
        requestAttemptCount: 0,
        retryAttemptCount: 0,
        blocker: "owner_approval_input_missing_or_invalid",
        failureClassified: true,
        failureClassification: "authorization_invalid",
        providerStabilityVerified: false,
        multiProviderStabilityVerified: false,
        providerStabilityNotVerifiedPreserved: true,
        credentialRefOnly: true,
        rawSecretRead: false,
        secretValueExposed: false,
        authJsonRead: false,
        envDumped: false,
        authorizationHeaderLogged: false,
        chatGatewayExecuteModified: false,
        validationFailures: authorization.failures,
      };
    }

    const bridgeResult = await execute({
      phase: "Phase1953P",
      providerId: authorization.providerId,
      modelId: authorization.modelId,
      credentialRef: authorization.credentialRef,
      prompt: request.authorization?.prompt,
      expectedResponseContains: request.authorization?.expectedResponseContains,
      maxRequests: 1,
      maxEstimatedCostUsd: request.authorization?.maxEstimatedCostUsd,
      timeoutMs: request.authorization?.timeoutMs,
      allowProviderCall: true,
      dryRun: false,
    });

    return {
      ...bridgeResult,
      guardedRealProviderCallExecuted: bridgeResult.providerCallsMade === true,
      retryAttemptCount: 0,
      failureClassified: bridgeResult.ok !== true,
      failureClassification: bridgeResult.ok === true ? null : bridgeResult.blocker,
      requestLimitRespected: true,
      multiProviderStabilityVerified: false,
    };
  }

  async function executeGuardedOneShotRerun(request = {}) {
    const authorization = validateGuardedRealProviderOneShotRerunAuthorizationPacket(request.authorization ?? request);
    if (!authorization.ok) {
      return {
        ok: false,
        dryRun: false,
        providerCallImplementationMode: mode,
        safeInternalProviderExecutorReady: true,
        safeInternalProviderExecutorStillStub: false,
        guardedRealProviderCallExecuted: false,
        providerCallsMade: false,
        realProviderNetworkAttempted: false,
        requestAttemptCount: 0,
        retryAttemptCount: 0,
        blocker: "owner_approval_input_missing_or_invalid",
        failureClassified: true,
        failureClassification: "authorization_invalid",
        providerStabilityVerified: false,
        multiProviderStabilityVerified: false,
        providerStabilityNotVerifiedPreserved: true,
        credentialRefOnly: true,
        rawSecretRead: false,
        secretValueExposed: false,
        authJsonRead: false,
        dotEnvRead: false,
        envDumped: false,
        authorizationHeaderLogged: false,
        chatGatewayExecuteModified: false,
        validationFailures: authorization.failures,
      };
    }

    const approval = request.authorization ?? request;
    const bridgeResult = await execute({
      phase: "Phase1955P",
      providerId: authorization.providerId,
      modelId: authorization.modelId,
      credentialRef: authorization.credentialRef,
      prompt: approval.prompt,
      expectedResponseContains: approval.expectedResponseContains,
      maxRequests: 1,
      maxEstimatedCostUsd: approval.maxEstimatedCostUsd,
      timeoutMs: approval.timeoutMs,
      allowProviderCall: true,
      dryRun: false,
    });

    return {
      ...bridgeResult,
      guardedRealProviderCallExecuted: bridgeResult.providerCallsMade === true,
      retryAttemptCount: 0,
      failureClassified: bridgeResult.ok !== true,
      failureClassification: bridgeResult.ok === true ? null : bridgeResult.blocker,
      requestLimitRespected: true,
      multiProviderStabilityVerified: false,
    };
  }

  async function executeGuardedNvidiaOneShotTimeoutRetry(request = {}) {
    const authorization = validateGuardedNvidiaOneShotTimeoutRetryAuthorizationPacket(request.authorization ?? request);
    if (!authorization.ok) {
      return {
        ok: false,
        dryRun: false,
        providerCallImplementationMode: mode,
        safeInternalProviderExecutorReady: true,
        safeInternalProviderExecutorStillStub: false,
        guardedRealProviderCallExecuted: false,
        providerCallsMade: false,
        realProviderNetworkAttempted: false,
        requestAttemptCount: 0,
        retryAttemptCount: 0,
        blocker: "owner_approval_input_missing_or_invalid",
        failureClassified: true,
        failureClassification: "authorization_invalid",
        providerStabilityVerified: false,
        multiProviderStabilityVerified: false,
        providerStabilityNotVerifiedPreserved: true,
        credentialRefOnly: true,
        rawSecretRead: false,
        secretValueExposed: false,
        authJsonRead: false,
        dotEnvRead: false,
        envDumped: false,
        authorizationHeaderLogged: false,
        chatGatewayExecuteModified: false,
        validationFailures: authorization.failures,
      };
    }

    const approval = request.authorization ?? request;
    const bridgeResult = await execute({
      phase: "Phase1955P-Retry",
      providerId: authorization.providerId,
      modelId: authorization.modelId,
      credentialRef: authorization.credentialRef,
      prompt: approval.prompt,
      expectedResponseContains: approval.expectedResponseContains,
      maxRequests: 1,
      maxEstimatedCostUsd: approval.maxEstimatedCostUsd,
      timeoutMs: approval.timeoutMs,
      stream: false,
      allowProviderCall: true,
      dryRun: false,
    });

    return {
      ...bridgeResult,
      guardedRealProviderCallExecuted: bridgeResult.providerCallsMade === true,
      retryAttemptCount: 0,
      stream: false,
      timeoutMs: approval.timeoutMs,
      failureClassified: bridgeResult.ok !== true,
      failureClassification: bridgeResult.ok === true ? null : bridgeResult.blocker,
      requestLimitRespected: true,
      multiProviderStabilityVerified: false,
    };
  }

  async function executeGuardedAlternativeProviderOneShot(request = {}) {
    const authorization = validateAlternativeProviderOwnerApprovalInput(request.authorization ?? request);
    if (!authorization.ok) {
      return {
        ok: false,
        dryRun: false,
        providerCallImplementationMode: mode,
        safeInternalProviderExecutorReady: true,
        safeInternalProviderExecutorStillStub: false,
        guardedAlternativeProviderCallExecuted: false,
        providerCallsMade: false,
        realProviderNetworkAttempted: false,
        requestAttemptCount: 0,
        retryAttemptCount: 0,
        blocker: "owner_approval_text_missing_or_mismatch",
        failureClassified: true,
        failureClassification: "authorization_invalid",
        providerStabilityVerified: false,
        multiProviderStabilityVerified: false,
        providerStabilityNotVerifiedPreserved: true,
        credentialRefOnly: true,
        rawSecretRead: false,
        secretValueExposed: false,
        authJsonRead: false,
        dotEnvRead: false,
        envDumped: false,
        authorizationHeaderLogged: false,
        chatGatewayExecuteModified: false,
        validationFailures: authorization.failures,
      };
    }

    const approval = request.authorization ?? request;
    const bridgeResult = await execute({
      phase: "Phase1958P-AlternativeProvider-OneShot",
      providerId: authorization.providerId,
      modelId: authorization.modelId,
      credentialRef: authorization.credentialRef,
      prompt: approval.prompt,
      expectedResponseContains: approval.expectedResponseContains,
      maxRequests: 1,
      maxEstimatedCostUsd: approval.maxEstimatedCostUsd,
      timeoutMs: approval.timeoutMs,
      stream: false,
      allowProviderCall: true,
      dryRun: false,
    });

    return {
      ...bridgeResult,
      guardedAlternativeProviderCallExecuted: bridgeResult.providerCallsMade === true,
      retryAttemptCount: 0,
      stream: false,
      timeoutMs: approval.timeoutMs,
      failureClassified: bridgeResult.ok !== true,
      failureClassification: bridgeResult.ok === true ? null : bridgeResult.blocker,
      requestLimitRespected: true,
      multiProviderStabilityVerified: false,
    };
  }

  return {
    contract: SAFE_INTERNAL_PROVIDER_EXECUTOR_CONTRACT,
    providerCallImplementationMode: mode,
    safeInternalProviderExecutorReady: true,
    safeProviderCallImplementationPrepared: true,
    validateExecutionRequest,
    runDryRun,
    execute,
    executeProvider,
    executeGuardedOneShot,
    executeGuardedOneShotRerun,
    executeGuardedNvidiaOneShotTimeoutRetry,
    executeGuardedAlternativeProviderOneShot,
  };
}

function buildBridgeResult(overrides = {}) {
  return {
    ok: false,
    dryRun: true,
    providerCallImplementationMode: "real_bridge",
    safeInternalProviderExecutorReady: true,
    safeInternalProviderExecutorStillStub: false,
    realSafeProviderExecutorBridgeReady: false,
    providerAdapterName: null,
    credentialRefOnly: true,
    rawSecretAccepted: false,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    dotEnvRead: false,
    envDumped: false,
    rawKeyOutput: false,
    authorizationHeaderLogged: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    providerCallsMade: false,
    realProviderNetworkAttempted: false,
    requestAttemptCount: 0,
    requestEnvelopeNormalized: false,
    responseSanitized: false,
    maxRequestsGateEnforced: false,
    budgetGateEnforced: false,
    timeoutGateEnforced: false,
    providerAllowlistEnforced: false,
    modelAllowlistEnforced: false,
    providerStabilityVerified: false,
    oneShotProviderCallPassed: false,
    phase1955pRerunReady: false,
    blocker: null,
    ...overrides,
  };
}
