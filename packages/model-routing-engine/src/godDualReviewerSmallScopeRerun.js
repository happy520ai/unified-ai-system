import { inspectGodMarkerResponse } from "./godPromptMarkerContract.js";
import { PHASE966_970_EXPECTED_MARKER } from "./godMarkerRerunApprovalIntake.js";

export function buildGodRerunBlockedResult({ blocker = "phase966_970_approval_missing", contract = {} } = {}) {
  return {
    phase: "Phase968",
    completed: true,
    recommended_sealed: false,
    blocker,
    scenario: "god_dual_reviewer",
    providerId: "nvidia",
    modelId: contract.modelId || "nvidia/llama-3.3-nemotron-super-49b-v1",
    credentialRefOnly: true,
    networkAttemptRecorded: false,
    responseSource: "unknown",
    externalProviderApiCallConfirmed: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    responseReceived: false,
    reviewerAFound: false,
    reviewerBFound: false,
    synthesisFound: false,
    finalAnswerFound: false,
    markerFound: false,
    expectedMarker: PHASE966_970_EXPECTED_MARKER,
    responseClassification: blocker === "phase966_970_approval_missing" ? "not_executed_no_approval" : "blocked_by_gate",
    qualityScore: 0,
    estimatedCostUsd: 0,
    godModeSmallScopeRerunPassed: false,
    providerCallsMade: false,
    totalProviderRequests: 0,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
  };
}

export function normalizeGodDualReviewerRerunResult({
  envelope = {},
  contract = {},
  latencyMs = null,
} = {}) {
  const httpStatus = Number(envelope.data?.httpStatus || envelope.meta?.httpStatus || 0);
  const providerCallAttempted = envelope.meta?.providerCalled === true;
  const responseReceived = providerCallAttempted && httpStatus > 0;
  const responseText = String(envelope.data?.text || envelope.data?.outputText || "");
  const inspection = inspectGodMarkerResponse({
    responseText,
    expectedMarker: contract.markerContract?.expectedMarker || PHASE966_970_EXPECTED_MARKER,
  });
  const pass = responseReceived === true && envelope.success === true && inspection.responseClassification === "pass";
  return {
    phase: "Phase968",
    completed: true,
    recommended_sealed: pass,
    blocker: pass ? null : "god_dual_reviewer_marker_rerun_failed",
    scenario: "god_dual_reviewer",
    providerId: "nvidia",
    modelId: contract.modelId || "nvidia/llama-3.3-nemotron-super-49b-v1",
    credentialRefOnly: true,
    networkAttemptRecorded: providerCallAttempted,
    responseSource: responseReceived ? "external_provider" : "unknown",
    externalProviderApiCallConfirmed: responseReceived,
    requestAttemptCount: providerCallAttempted ? 1 : 0,
    retryAttemptCount: 0,
    responseReceived,
    reviewerAFound: inspection.reviewerAFound,
    reviewerBFound: inspection.reviewerBFound,
    synthesisFound: inspection.synthesisFound,
    finalAnswerFound: inspection.finalAnswerFound,
    markerFound: inspection.markerFound,
    expectedMarker: contract.markerContract?.expectedMarker || PHASE966_970_EXPECTED_MARKER,
    responseClassification: responseReceived ? inspection.responseClassification : "external_provider_call_failed",
    qualityScore: responseReceived ? inspection.qualityScore : 0,
    estimatedCostUsd: 0,
    latencyMs,
    godModeSmallScopeRerunPassed: pass,
    providerCallsMade: providerCallAttempted,
    totalProviderRequests: providerCallAttempted ? 1 : 0,
    responsePreview: responseText.slice(0, 240),
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    mockResponseUsed: false,
    simulatedResponseUsed: false,
    localExecutorOnly: false,
  };
}
