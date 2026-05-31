import { createExternalProviderOutboundTrace, httpStatusClass } from "./externalProviderOutboundTrace.js";

export const PHASE913_MODEL_ID = "nvidia/nemotron-mini-4b-instruct";
export const PHASE913_EXPECTED_MARKER = "REAL_EXTERNAL_PROVIDER_AUTHENTICITY_OK";

export function isPhase913ModelEligible({ modelId = PHASE913_MODEL_ID, usabilityMatrix = {}, verificationState = {} } = {}) {
  const chatModels = new Set(Array.isArray(usabilityMatrix.chatDropdownModels) ? usabilityMatrix.chatDropdownModels : []);
  const record = verificationState.records?.[`nvidia:${modelId}`] || Object.values(verificationState.records || {}).find((item) => item.modelId === modelId);
  const blockedStatuses = new Set([
    "smoke_failed",
    "failed",
    "high_risk",
    "blocked",
    "deprecated",
    "credential_missing",
    "smoke_pending",
    "cataloged_only",
    "wrong_endpoint",
    "rate_limited",
    "not_supported",
    "manual_review_required",
  ]);
  const eligible = Boolean(
    record
      && record.providerId === "nvidia"
      && record.verificationStatus === "smoke_passed"
      && chatModels.has(modelId)
      && !blockedStatuses.has(record.verificationStatus),
  );
  return {
    eligible,
    modelId,
    providerId: "nvidia",
    verificationStatus: record?.verificationStatus || null,
    smokePassed: record?.verificationStatus === "smoke_passed",
    selectable: chatModels.has(modelId),
    blocker: eligible ? null : "phase913_model_not_selectable_smoke_passed",
  };
}

export function buildPhase913BlockedResult(input = {}) {
  const blocker = input.blocker || "blocked_by_gate";
  return {
    phase: "Phase913",
    providerId: "nvidia",
    modelId: input.modelId || PHASE913_MODEL_ID,
    credentialRef: input.credentialRef || "credentialRef:nvidia:default",
    credentialRefOnly: true,
    providerCallAttempted: false,
    networkAttemptRecorded: false,
    outboundTracePresent: false,
    outboundAttemptAt: null,
    adapterName: "phase913-credentialref-secure-nvidia-one-shot",
    adapterMode: "external_provider",
    providerRequestId: null,
    providerRequestIdUnavailableReason: null,
    responseReceived: false,
    providerResponseReceived: false,
    responseSource: "unknown",
    httpStatusClass: "unknown",
    expectedMarker: PHASE913_EXPECTED_MARKER,
    responseMarkerMatched: false,
    markerWarning: false,
    responseClassification: "blocked_by_gate",
    blocker,
    mockResponseUsed: false,
    simulatedResponseUsed: false,
    dryRunOnly: false,
    localExecutorOnly: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    maxRequestsRespected: true,
    maxRetriesRespected: true,
    estimatedCostUsd: 0,
    budgetExceeded: false,
    rawSecretRead: false,
    rawSecretReadByCallingProcess: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
  };
}

export function normalizePhase913ProviderEnvelope({ envelope = {}, trace = {}, credentialRef = "credentialRef:nvidia:default", modelId = PHASE913_MODEL_ID } = {}) {
  const responseText = String(envelope.data?.text || envelope.data?.outputText || "");
  const httpStatus = Number(envelope.data?.httpStatus || envelope.meta?.httpStatus || 0);
  const providerCallAttempted = envelope.meta?.providerCalled === true;
  const providerResponseReceived = providerCallAttempted && httpStatus > 0;
  const responseMarkerMatched = responseText.includes(PHASE913_EXPECTED_MARKER);
  const responseClassification = providerResponseReceived
    ? responseMarkerMatched
      ? "pass"
      : "external_provider_response_received_marker_missing"
    : "external_provider_call_failed";

  return {
    phase: "Phase913",
    providerId: "nvidia",
    modelId,
    credentialRef,
    credentialRefOnly: true,
    providerCallAttempted,
    networkAttemptRecorded: providerCallAttempted,
    outboundTracePresent: trace.outboundTracePresent === true,
    outboundAttemptAt: trace.outboundAttemptAt || envelope.meta?.startedAt || null,
    adapterName: trace.adapterName || "phase913-credentialref-secure-nvidia-one-shot",
    adapterMode: "external_provider",
    providerRequestId: envelope.data?.id || null,
    providerRequestIdUnavailableReason: envelope.data?.id
      ? null
      : "provider request id not exposed; adapter outbound trace recorded",
    responseReceived: providerResponseReceived,
    providerResponseReceived,
    responseSource: providerResponseReceived ? "external_provider" : "unknown",
    httpStatusClass: httpStatusClass(httpStatus),
    expectedMarker: PHASE913_EXPECTED_MARKER,
    responseMarkerMatched,
    markerWarning: providerResponseReceived && responseMarkerMatched !== true,
    responseClassification,
    providerEnvelopeCode: envelope.code || null,
    providerSuccess: envelope.success === true,
    providerErrorCode: envelope.success === true ? null : envelope.error?.code || envelope.code || null,
    mockResponseUsed: false,
    simulatedResponseUsed: false,
    dryRunOnly: false,
    localExecutorOnly: false,
    requestAttemptCount: providerCallAttempted ? 1 : 0,
    retryAttemptCount: 0,
    maxRequestsRespected: true,
    maxRetriesRespected: true,
    estimatedCostUsd: 0,
    budgetExceeded: false,
    rawSecretRead: false,
    rawSecretReadByCallingProcess: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
  };
}

export function createPhase913OutboundTrace(input = {}) {
  return createExternalProviderOutboundTrace({
    ...input,
    providerId: "nvidia",
    modelId: input.modelId || PHASE913_MODEL_ID,
    credentialRef: input.credentialRef || "credentialRef:nvidia:default",
    adapterName: "phase913-credentialref-secure-nvidia-one-shot",
    adapterMode: "external_provider",
    networkAttemptRecorded: input.networkAttemptRecorded === true,
    traceId: input.traceId || `phase913-${Date.now()}`,
  });
}

export function buildPhase913AuthenticityEvidence({ oneShot = {}, phase912 = {} } = {}) {
  const externalProviderApiCallConfirmed = oneShot.networkAttemptRecorded === true
    && oneShot.outboundTracePresent === true
    && oneShot.providerResponseReceived === true
    && oneShot.responseSource === "external_provider"
    && oneShot.mockResponseUsed === false
    && oneShot.simulatedResponseUsed === false
    && oneShot.dryRunOnly === false
    && oneShot.localExecutorOnly === false
    && oneShot.credentialRefOnly === true
    && oneShot.rawSecretRead === false
    && oneShot.authJsonRead === false;
  const authenticityClassification = externalProviderApiCallConfirmed
    ? "external_provider_api_confirmed"
    : oneShot.responseClassification === "blocked_by_gate"
      ? "blocked_by_gate"
      : oneShot.responseClassification === "external_provider_call_failed"
        ? "external_provider_call_failed"
        : "external_provider_authenticity_not_confirmed";

  return {
    phase: "Phase913",
    completed: true,
    recommended_sealed: externalProviderApiCallConfirmed,
    blocker: externalProviderApiCallConfirmed ? null : oneShot.blocker || "external_provider_authenticity_not_confirmed",
    phase912ReadyForPhase913: phase912.readyForPhase913 === true,
    providerId: oneShot.providerId || "nvidia",
    modelId: oneShot.modelId || PHASE913_MODEL_ID,
    credentialRef: oneShot.credentialRef || "credentialRef:nvidia:default",
    credentialRefOnly: true,
    externalProviderApiCallConfirmed,
    networkAttemptRecorded: oneShot.networkAttemptRecorded === true,
    outboundTracePresent: oneShot.outboundTracePresent === true,
    providerResponseReceived: oneShot.providerResponseReceived === true,
    responseSource: oneShot.responseSource || "unknown",
    responseMarkerMatched: oneShot.responseMarkerMatched === true,
    markerWarning: oneShot.markerWarning === true,
    responseClassification: oneShot.responseClassification || "blocked_by_gate",
    mockResponseUsed: oneShot.mockResponseUsed === true,
    simulatedResponseUsed: oneShot.simulatedResponseUsed === true,
    dryRunOnly: oneShot.dryRunOnly === true,
    localExecutorOnly: oneShot.localExecutorOnly === true,
    authenticityClassification,
    requestAttemptCount: Number(oneShot.requestAttemptCount || 0),
    retryAttemptCount: Number(oneShot.retryAttemptCount || 0),
    estimatedCostUsd: Number(oneShot.estimatedCostUsd || 0),
    budgetExceeded: oneShot.budgetExceeded === true,
    rawSecretRead: oneShot.rawSecretRead === true,
    secretValueExposed: oneShot.secretValueExposed === true,
    authJsonRead: oneShot.authJsonRead === true,
  };
}
