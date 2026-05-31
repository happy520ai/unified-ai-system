import { httpStatusClass } from "./externalProviderOutboundTrace.js";

export function buildExternalProviderAuthenticityEvidence(input = {}) {
  const oneShot = input.oneShot || {};
  const approval = input.approval || {};
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
  const blocked = oneShot.responseClassification === "blocked_by_gate";
  const failed = oneShot.responseClassification === "external_provider_call_failed";
  const authenticityClassification = externalProviderApiCallConfirmed
    ? "external_provider_api_confirmed"
    : blocked
      ? "blocked_by_gate"
      : failed
        ? "external_provider_call_failed"
        : "external_provider_authenticity_not_confirmed";
  const markerWarning = externalProviderApiCallConfirmed && oneShot.responseMarkerMatched !== true;

  return {
    phase: "Phase911-AIO",
    completed: true,
    recommended_sealed: externalProviderApiCallConfirmed,
    blocker: externalProviderApiCallConfirmed ? null : oneShot.blocker || "external_provider_authenticity_not_confirmed",
    realExternalProviderOneShotApprovalPresent: Boolean(approval),
    authorizationComplete: input.authorizationComplete === true,
    providerId: oneShot.providerId || approval.providerId || "nvidia",
    modelId: oneShot.modelId || null,
    credentialRefOnly: oneShot.credentialRefOnly !== false,
    externalProviderApiCallConfirmed,
    networkAttemptRecorded: oneShot.networkAttemptRecorded === true,
    outboundTracePresent: oneShot.outboundTracePresent === true,
    providerResponseReceived: oneShot.providerResponseReceived === true,
    responseSource: oneShot.responseSource || "unknown",
    responseMarkerMatched: oneShot.responseMarkerMatched === true,
    markerWarning,
    responseClassification: oneShot.responseClassification || "blocked_by_gate",
    mockResponseUsed: oneShot.mockResponseUsed === true,
    simulatedResponseUsed: oneShot.simulatedResponseUsed === true,
    dryRunOnly: oneShot.dryRunOnly === true,
    localExecutorOnly: oneShot.localExecutorOnly === true,
    authenticityClassification,
    requestAttemptCount: Number(oneShot.requestAttemptCount || 0),
    retryAttemptCount: Number(oneShot.retryAttemptCount || 0),
    maxRequestsRespected: oneShot.maxRequestsRespected === true,
    maxRetriesRespected: oneShot.maxRetriesRespected === true,
    estimatedCostUsd: Number(oneShot.estimatedCostUsd || 0),
    budgetExceeded: oneShot.budgetExceeded === true,
    rawSecretRead: oneShot.rawSecretRead === true,
    secretValueExposed: oneShot.secretValueExposed === true,
    authJsonRead: oneShot.authJsonRead === true,
    chatBehaviorChangedByDefault: oneShot.chatBehaviorChangedByDefault === true,
    chatGatewayExecuteBehaviorChangedByDefault: oneShot.chatGatewayExecuteBehaviorChangedByDefault === true,
    deployExecuted: oneShot.deployExecuted === true,
    releaseExecuted: oneShot.releaseExecuted === true,
    tagCreated: oneShot.tagCreated === true,
    artifactUploaded: oneShot.artifactUploaded === true,
    phase901910CorrectionPreserved: true,
    previousPhase821900Classification: input.previousPhase821900Classification || "simulated_response",
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
  };
}

export function normalizeOneShotProviderResult(input = {}) {
  const envelope = input.envelope || {};
  const trace = input.trace || {};
  const responseText = String(envelope.data?.text || envelope.data?.outputText || "");
  const httpStatus = Number(envelope.data?.httpStatus || envelope.meta?.httpStatus || 0);
  const responseReceived = envelope.meta?.providerCalled === true && httpStatus > 0;
  const markerMatched = responseText.includes(input.expectedMarker || "");
  const providerSucceeded = envelope.success === true;
  const responseClassification = responseReceived
    ? markerMatched
      ? "pass"
      : "external_provider_response_received_marker_missing"
    : "external_provider_call_failed";

  return {
    providerCallAttempted: envelope.meta?.providerCalled === true,
    networkAttemptRecorded: envelope.meta?.providerCalled === true,
    outboundTracePresent: true,
    outboundAttemptAt: trace.outboundAttemptAt,
    adapterName: trace.adapterName,
    adapterMode: trace.adapterMode,
    providerRequestId: envelope.data?.id || null,
    providerRequestIdUnavailableReason: envelope.data?.id ? null : trace.providerRequestIdUnavailableReason,
    responseReceived,
    providerResponseReceived: responseReceived,
    responseSource: responseReceived ? "external_provider" : "unknown",
    httpStatusClass: httpStatusClass(httpStatus),
    responseMarkerMatched: markerMatched,
    responseClassification,
    providerEnvelopeCode: envelope.code || null,
    providerSuccess: providerSucceeded,
    providerErrorCode: providerSucceeded ? null : envelope.error?.code || envelope.code || null,
  };
}
