export const PHASE911_APPROVAL_DECISION = "approved_execute_real_external_provider_one_shot_authenticity";

export const PHASE911_APPROVAL_TEMPLATE = Object.freeze({
  decision: PHASE911_APPROVAL_DECISION,
  approvalOwner: "human-user",
  approvalReason: "Confirm actual external Provider API call authenticity after Phase901-910 classified previous route evidence as simulated_response.",
  providerId: "nvidia",
  providerFamily: "nvidia",
  credentialRef: "credentialRef:nvidia:default",
  credentialRefOnly: true,
  modelEligibility: {
    requireSelectable: true,
    requireSmokePassed: true,
    blockFailed: true,
    blockHighRisk: true,
    blockDeprecated: true,
    blockCredentialMissing: true,
  },
  allowedModelsSource: "phase313a_selectable_smoke_passed",
  preferredModelId: null,
  fallbackSelectableModelsAllowed: true,
  maxRequests: 1,
  maxRetries: 0,
  maxEstimatedCostUsd: 0.01,
  allowProviderCall: true,
  allowSecretRead: false,
  allowAuthJsonRead: false,
  allowDeploy: false,
  allowRelease: false,
  allowTag: false,
  allowArtifactUpload: false,
  allowChatDefaultEnable: false,
  allowChatGatewayExecuteDefaultEnable: false,
  allowChatMutation: false,
  allowChatGatewayExecuteMutation: false,
  allowCodexConfigMutation: false,
  expiresAt: "2026-05-13T23:59:00+09:00",
  oneShotPrompt: "Reply with exactly: REAL_EXTERNAL_PROVIDER_AUTHENTICITY_OK",
  expectedMarker: "REAL_EXTERNAL_PROVIDER_AUTHENTICITY_OK",
  acknowledgements: {
    notProductionTraffic: true,
    notDeploy: true,
    notHumanReview: true,
    oneShotOnly: true,
    credentialRefOnly: true,
    rawSecretMustNotBePrinted: true,
    authJsonMustNotBeRead: true,
    externalProviderTraceRequired: true,
    mockSimulatedDryRunMustBeFalse: true,
    evidenceRequired: true,
    rollbackRequired: true,
  },
});

const BLOCKED_STATUSES = new Set([
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

export function buildPhase911Approval(overrides = {}) {
  return {
    ...PHASE911_APPROVAL_TEMPLATE,
    ...overrides,
    modelEligibility: {
      ...PHASE911_APPROVAL_TEMPLATE.modelEligibility,
      ...(overrides.modelEligibility || {}),
    },
    acknowledgements: {
      ...PHASE911_APPROVAL_TEMPLATE.acknowledgements,
      ...(overrides.acknowledgements || {}),
    },
  };
}

export function validatePhase911Approval(packet = {}, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const failures = [];
  if (packet.decision !== PHASE911_APPROVAL_DECISION) failures.push("decision_invalid");
  if (packet.approvalOwner !== "human-user") failures.push("approval_owner_invalid");
  if (!packet.approvalReason) failures.push("approval_reason_required");
  if (packet.providerId !== "nvidia") failures.push("provider_id_must_be_nvidia");
  if (packet.providerFamily !== "nvidia") failures.push("provider_family_must_be_nvidia");
  if (packet.credentialRef !== "credentialRef:nvidia:default") failures.push("credential_ref_invalid");
  if (packet.credentialRefOnly !== true) failures.push("credential_ref_only_required");
  if (packet.allowedModelsSource !== "phase313a_selectable_smoke_passed") failures.push("allowed_models_source_invalid");
  if (packet.fallbackSelectableModelsAllowed !== true) failures.push("fallback_selectable_models_required");
  if (packet.maxRequests !== 1) failures.push("max_requests_must_be_1");
  if (packet.maxRetries !== 0) failures.push("max_retries_must_be_0");
  if (typeof packet.maxEstimatedCostUsd !== "number" || packet.maxEstimatedCostUsd > 0.01) failures.push("max_estimated_cost_invalid");
  if (packet.allowProviderCall !== true) failures.push("allow_provider_call_required");
  for (const key of [
    "allowSecretRead",
    "allowAuthJsonRead",
    "allowDeploy",
    "allowRelease",
    "allowTag",
    "allowArtifactUpload",
    "allowChatDefaultEnable",
    "allowChatGatewayExecuteDefaultEnable",
    "allowChatMutation",
    "allowChatGatewayExecuteMutation",
    "allowCodexConfigMutation",
  ]) {
    if (packet[key] !== false) failures.push(`${key}_must_be_false`);
  }
  for (const [key, expected] of Object.entries(PHASE911_APPROVAL_TEMPLATE.modelEligibility)) {
    if (packet.modelEligibility?.[key] !== expected) failures.push(`modelEligibility.${key}_invalid`);
  }
  for (const [key, expected] of Object.entries(PHASE911_APPROVAL_TEMPLATE.acknowledgements)) {
    if (packet.acknowledgements?.[key] !== expected) failures.push(`acknowledgements.${key}_invalid`);
  }
  if (!packet.expiresAt || Number.isNaN(Date.parse(packet.expiresAt)) || new Date(packet.expiresAt) <= now) {
    failures.push("approval_expired_or_invalid");
  }
  if (packet.oneShotPrompt !== PHASE911_APPROVAL_TEMPLATE.oneShotPrompt) failures.push("one_shot_prompt_invalid");
  if (packet.expectedMarker !== PHASE911_APPROVAL_TEMPLATE.expectedMarker) failures.push("expected_marker_invalid");
  if (hasForbiddenRawFields(packet)) failures.push("raw_secret_or_base_url_field_forbidden");

  return {
    realExternalProviderOneShotApprovalPresent: Object.keys(packet || {}).length > 0,
    authorizationComplete: failures.length === 0,
    failures,
    credentialRefOnly: packet.credentialRefOnly === true,
  };
}

export function selectPhase911Model(input = {}) {
  const approval = input.approval || {};
  const usabilityMatrix = input.usabilityMatrix || {};
  const verificationState = input.verificationState || {};
  const preferred = approval.preferredModelId || null;
  const chatIds = new Set(Array.isArray(usabilityMatrix.chatDropdownModels) ? usabilityMatrix.chatDropdownModels : []);
  const records = Object.values(verificationState.records || {});
  const eligible = records
    .filter((record) => record.providerId === "nvidia")
    .filter((record) => record.verificationStatus === "smoke_passed")
    .filter((record) => chatIds.has(record.modelId))
    .filter((record) => !BLOCKED_STATUSES.has(record.verificationStatus))
    .map((record) => ({
      providerId: record.providerId,
      modelId: record.modelId,
      verificationStatus: record.verificationStatus,
      selectable: true,
      smokePassed: true,
      providerCalled: record.providerCalled === true,
      lastVerifiedAt: record.lastVerifiedAt || null,
      score: scoreModel(record),
    }))
    .sort((left, right) => right.score - left.score || left.modelId.localeCompare(right.modelId));
  const selected = preferred
    ? eligible.find((record) => record.modelId === preferred) || null
    : eligible[0] || null;
  return {
    selectedModel: selected,
    eligibleModels: eligible,
    eligibleModelCount: eligible.length,
    selectionBlockedReason: selected ? null : "no_selectable_smoke_passed_nvidia_model",
  };
}

export function buildBlockedPhase911OneShotResult(input = {}) {
  const approval = input.approval || {};
  const model = input.model || {};
  const blocker = input.blocker || "blocked_by_gate";
  return {
    phase: "Phase911",
    providerId: approval.providerId || "nvidia",
    modelId: model.modelId || null,
    credentialRef: approval.credentialRef || "credentialRef:nvidia:default",
    credentialRefOnly: true,
    providerCallAttempted: false,
    networkAttemptRecorded: false,
    outboundTracePresent: false,
    outboundAttemptAt: null,
    adapterName: "phase911-nvidia-one-shot-authenticity",
    adapterMode: "external_provider",
    providerRequestId: null,
    providerRequestIdUnavailableReason: null,
    responseReceived: false,
    providerResponseReceived: false,
    responseSource: "unknown",
    httpStatusClass: "unknown",
    expectedMarker: approval.expectedMarker || PHASE911_APPROVAL_TEMPLATE.expectedMarker,
    responseMarkerMatched: false,
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

function scoreModel(record = {}) {
  const id = String(record.modelId || "").toLowerCase();
  let score = 0;
  if (id.includes("mini")) score += 40;
  if (id.includes("nano")) score += 30;
  if (id.includes("8b") || id.includes("4b")) score += 20;
  if (id.includes("nemotron")) score += 10;
  if (record.providerCalled === true) score += 5;
  return score;
}

function hasForbiddenRawFields(value) {
  if (!value || typeof value !== "object") return false;
  const forbidden = new Set(["apiKey", "rawSecret", "secret", "baseUrl", "base_url", "endpoint"]);
  return Object.entries(value).some(([key, nested]) => forbidden.has(key) || hasForbiddenRawFields(nested));
}
