export const TAIJI_BEIDOU_SHADOW_FLAGS = {
  TAIJI_BEIDOU_SHADOW_ENABLED: false,
  TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: false,
};

export function createTaijiBeidouShadowAdapter(options = {}) {
  const flags = {
    ...TAIJI_BEIDOU_SHADOW_FLAGS,
    ...(options.flags || {}),
  };
  const ownerApproved = options.ownerApproved === true;
  const authorizationGatePassed = options.authorizationGatePassed === true;
  const allowGuardedShadowObservation = options.allowGuardedShadowObservation === true;
  const enabled = flags.TAIJI_BEIDOU_SHADOW_ENABLED === true
    && flags.TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED === true
    && ownerApproved
    && authorizationGatePassed;

  return {
    name: "taijiBeidouShadowAdapter",
    defaultEnabled: false,
    enabled,
    flags,
    ownerApproved,
    authorizationGatePassed,
    allowGuardedShadowObservation,
    providerCallsMade: false,
    secretRead: false,
    mainChainIntegrationExecuted: false,
    runShadowCandidate(input = {}) {
      if (!enabled) {
        return {
          status: "blocked",
          reason: "shadow_adapter_disabled_or_authorization_missing",
          inputPreview: sanitizeInputPreview(input),
          shadowObservationGenerated: false,
          testExecuted: false,
          providerCallsMade: false,
          secretRead: false,
          mainChainIntegrationExecuted: false,
        };
      }

      return {
        status: allowGuardedShadowObservation ? "shadow_observation_recorded" : "prepared_only",
        reason: allowGuardedShadowObservation
          ? "guarded_synthetic_shadow_observation_without_provider_or_main_chain_write"
          : "guarded_shadow_observation_not_authorized",
        inputPreview: sanitizeInputPreview(input),
        shadowObservationGenerated: allowGuardedShadowObservation,
        testExecuted: allowGuardedShadowObservation,
        providerCallsMade: false,
        secretRead: false,
        mainChainIntegrationExecuted: false,
      };
    },
  };
}

export function runGuardedTaijiBeidouShadowTest(options = {}) {
  const adapter = createTaijiBeidouShadowAdapter({
    flags: {
      TAIJI_BEIDOU_SHADOW_ENABLED: true,
      ...options.flags,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: options.flags?.TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED === true,
    },
    ownerApproved: options.ownerAuthorizationValid === true,
    authorizationGatePassed: options.authorizationGatePassed === true,
    allowGuardedShadowObservation: true,
  });
  const candidateInput = options.candidateInput || {
    candidateId: "taiji-beidou-main-chain-candidate",
    payload: {
      mode: "synthetic_guarded_shadow",
      source: "phase1226-1235",
    },
  };
  const adapterResult = adapter.runShadowCandidate(candidateInput);
  const guardedExecutionAllowed = options.ownerAuthorizationValid === true
    && options.authorizationGatePassed === true
    && options.flags?.TAIJI_BEIDOU_SHADOW_ENABLED === true
    && options.flags?.TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED === true;

  return {
    status: guardedExecutionAllowed ? "shadow_observation_recorded" : "blocked",
    adapterResult,
    guardedShadowTestExecuted: guardedExecutionAllowed,
    shadowObservationGenerated: guardedExecutionAllowed,
    shadowObservation: guardedExecutionAllowed ? {
      candidateId: candidateInput.candidateId || "taiji-beidou-main-chain-candidate",
      observationMode: "synthetic_guarded_shadow",
      mainChainWriteAttempted: false,
      providerCallAttempted: false,
      credentialReadAttempted: false,
      defaultRouteMutationAttempted: false,
      result: "candidate_contract_observed_without_runtime_dispatch",
    } : null,
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    mainChainIntegrationExecuted: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    realSemanticValidationClaimed: false,
  };
}

function sanitizeInputPreview(input) {
  return {
    candidateId: input.candidateId || "taiji-beidou-dry-run-main-chain-candidate",
    hasPayload: Boolean(input.payload),
    payloadRedacted: Boolean(input.payload),
  };
}
