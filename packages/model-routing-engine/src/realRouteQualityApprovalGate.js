export const PHASE916_930_APPROVAL_DECISION = "approved_execute_phase916_930_bounded_real_route_quality_test";

export const PHASE916_930_APPROVAL_LIMITS = Object.freeze({
  providerId: "nvidia",
  providerAllowlist: Object.freeze(["nvidia"]),
  credentialRef: "credentialRef:nvidia:default",
  maxTotalProviderRequests: 20,
  maxRequestsPerMode: 6,
  maxRequestsPerModel: 3,
  maxEstimatedCostUsdTotal: 1,
  maxRetriesPerRequest: 0,
});

export function buildRealRouteQualityApprovalTemplate(overrides = {}) {
  return {
    decision: PHASE916_930_APPROVAL_DECISION,
    approvalOwner: "human-user",
    approvalReason: "Authorize bounded NVIDIA-only real route quality testing after Phase912-915 confirmed external Provider authenticity.",
    providerAllowlist: ["nvidia"],
    credentialRef: "credentialRef:nvidia:default",
    credentialRefOnly: true,
    allowedModes: ["normal", "god", "tianshu"],
    modelEligibility: {
      requireSelectable: true,
      requireSmokePassed: true,
      blockFailed: true,
      blockHighRisk: true,
      blockDeprecated: true,
      blockCredentialMissing: true,
    },
    maxTotalProviderRequests: 20,
    maxRequestsPerMode: 6,
    maxRequestsPerModel: 3,
    maxRetriesPerRequest: 0,
    maxEstimatedCostUsdTotal: 1,
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
    acknowledgements: {
      notProductionTraffic: true,
      notDeploy: true,
      notRelease: true,
      notHumanReview: true,
      codexSurrogateTestingOnly: true,
      credentialRefOnly: true,
      rawSecretMustNotBePrinted: true,
      authJsonMustNotBeRead: true,
      externalProviderTraceRequired: true,
      maxRequestsMustBeRespected: true,
      maxRetriesMustBeZero: true,
      budgetMustBeRespected: true,
      failedBlockedHighRiskModelsExcluded: true,
      selectableMustNotChange: true,
      evidenceRequired: true,
      rollbackRequired: true,
    },
    ...overrides,
  };
}

export function evaluateRealRouteQualityApprovalGate({
  approval = null,
  phase912915 = {},
} = {}) {
  const failures = [];
  if (phase912915.externalProviderApiCallConfirmed !== true) failures.push("phase912_915_external_authenticity_required");
  if (phase912915.readyForRealRouteQualityTest !== true) failures.push("phase915_quality_readiness_required");
  if (!approval) failures.push("phase916_930_approval_missing");
  if (approval) {
    if (approval.decision !== PHASE916_930_APPROVAL_DECISION) failures.push("approval_decision_invalid");
    if (!Array.isArray(approval.providerAllowlist) || approval.providerAllowlist.length !== 1 || approval.providerAllowlist[0] !== "nvidia") {
      failures.push("provider_allowlist_must_be_nvidia_only");
    }
    if (approval.credentialRef !== "credentialRef:nvidia:default") failures.push("credential_ref_invalid");
    if (approval.credentialRefOnly !== true) failures.push("credential_ref_only_required");
    if (!Array.isArray(approval.allowedModes) || !["normal", "god", "tianshu"].every((mode) => approval.allowedModes.includes(mode))) {
      failures.push("allowed_modes_incomplete");
    }
    if (approval.maxTotalProviderRequests > 20) failures.push("max_total_provider_requests_exceeded");
    if (approval.maxRequestsPerMode > 6) failures.push("max_requests_per_mode_exceeded");
    if (approval.maxRequestsPerModel > 3) failures.push("max_requests_per_model_exceeded");
    if (approval.maxEstimatedCostUsdTotal > 1) failures.push("max_estimated_cost_exceeded");
    if (approval.maxRetriesPerRequest !== 0) failures.push("max_retries_per_request_must_be_zero");
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
      if (approval[key] !== false) failures.push(`${key}_must_be_false`);
    }
    if (approval.allowProviderCall !== true) failures.push("allow_provider_call_required");
    const eligibility = approval.modelEligibility || {};
    for (const [key, value] of Object.entries({
      requireSelectable: true,
      requireSmokePassed: true,
      blockFailed: true,
      blockHighRisk: true,
      blockDeprecated: true,
      blockCredentialMissing: true,
    })) {
      if (eligibility[key] !== value) failures.push(`model_eligibility_${key}_invalid`);
    }
    const acknowledgements = approval.acknowledgements || {};
    for (const key of [
      "notProductionTraffic",
      "notDeploy",
      "notRelease",
      "notHumanReview",
      "codexSurrogateTestingOnly",
      "credentialRefOnly",
      "rawSecretMustNotBePrinted",
      "authJsonMustNotBeRead",
      "externalProviderTraceRequired",
      "maxRequestsMustBeRespected",
      "maxRetriesMustBeZero",
      "budgetMustBeRespected",
      "failedBlockedHighRiskModelsExcluded",
      "selectableMustNotChange",
      "evidenceRequired",
      "rollbackRequired",
    ]) {
      if (acknowledgements[key] !== true) failures.push(`acknowledgement_${key}_required`);
    }
  }
  return {
    phase: "Phase916",
    approvalPresent: Boolean(approval),
    authorizationComplete: failures.length === 0,
    providerId: "nvidia",
    providerAllowlist: Array.isArray(approval?.providerAllowlist) ? approval.providerAllowlist : ["nvidia"],
    credentialRef: "credentialRef:nvidia:default",
    credentialRefOnly: true,
    maxTotalProviderRequests: approval?.maxTotalProviderRequests || 20,
    maxRequestsPerMode: approval?.maxRequestsPerMode || 6,
    maxRequestsPerModel: approval?.maxRequestsPerModel || 3,
    maxEstimatedCostUsdTotal: approval?.maxEstimatedCostUsdTotal || 1,
    maxRetriesPerRequest: approval?.maxRetriesPerRequest ?? 0,
    failures,
    blocker: failures.length ? failures[0] : null,
  };
}
