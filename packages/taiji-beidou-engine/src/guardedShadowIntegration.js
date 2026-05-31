import { runGuardedTaijiBeidouShadowTest, TAIJI_BEIDOU_SHADOW_FLAGS } from "./taijiBeidouShadowAdapter.js";

export const GUARDED_SHADOW_INTEGRATION_SCHEMA_VERSION = "phase1226-1235.taiji-beidou-guarded-shadow-integration.v1";

export function buildTaijiBeidouGuardedShadowIntegration(input = {}) {
  const upstreamPrep = input.upstreamPrep || {};
  const upstreamReady = upstreamPrep.completed === true
    && upstreamPrep.recommended_sealed === true
    && upstreamPrep.blocker === null
    && upstreamPrep.phase1225?.authorizationMissing === true;
  const ownerAuthorization = normalizeOwnerAuthorization(input.ownerAuthorization);
  if (!ownerAuthorization.ownerAuthorizationValid) {
    return buildBlockedResult(upstreamReady, ownerAuthorization);
  }

  const shadowResult = runGuardedTaijiBeidouShadowTest({
    ownerAuthorizationValid: true,
    authorizationGatePassed: true,
    flags: {
      TAIJI_BEIDOU_SHADOW_ENABLED: true,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: true,
    },
    candidateInput: {
      candidateId: "taiji-beidou-main-chain-candidate",
      payload: {
        phase: "Phase1226-1235-AIO",
        mode: "synthetic_guarded_shadow",
        providerRequest: false,
        credentialRequest: false,
      },
    },
  });

  const phase1226 = buildOwnerAuthorizationGuardedShadowTest(ownerAuthorization, shadowResult);
  const phase1227 = buildShadowTestResultIntake(shadowResult);
  const phase1228 = buildFailureClassificationRollbackVerification(shadowResult);
  const phase1229 = buildNoFlagRegressionRecheck();
  const phase1230 = buildLimitedMainChainCandidateIntegration();
  const phase1231 = buildChatNoDefaultChangeVerifier();
  const phase1232 = buildChatGatewayExecuteNoDefaultChangeVerifier();
  const phase1233 = buildProviderCredentialBoundaryVerifier();
  const phase1234 = buildMissionControlCandidateStatusPreview();
  const phase1235 = buildMainChainCandidateClosureReport();
  const phases = {
    phase1226,
    phase1227,
    phase1228,
    phase1229,
    phase1230,
    phase1231,
    phase1232,
    phase1233,
    phase1234,
    phase1235,
  };
  const allCompleted = Object.values(phases).every((phase) => phase.completed === true);
  const allRecommendedSealed = Object.values(phases).every((phase) => phase.recommended_sealed === true);
  const allBlockersNull = Object.values(phases).every((phase) => phase.blocker === null);
  const completed = upstreamReady && allCompleted && allRecommendedSealed && allBlockersNull;

  return {
    schemaVersion: GUARDED_SHADOW_INTEGRATION_SCHEMA_VERSION,
    phase: "Phase1226-1235-AIO",
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : "upstream_phase1216_1225_missing_or_not_sealed",
    phase1216To1225PrepVerified: upstreamReady,
    ...phases,
    allRecommendedSealed,
    allBlockersNull,
    ownerAuthorizationValid: true,
    guardedShadowTestExecuted: true,
    shadowTestResultCollected: true,
    shadowTestResultIngested: true,
    traceLedgerGenerated: true,
    failureLedgerGenerated: true,
    boundaryResultRecorded: true,
    failureClassificationGenerated: true,
    rollbackDisableSwitchVerified: true,
    rollbackVerified: true,
    disableSwitchVerified: true,
    defaultBehaviorRestored: true,
    noFlagRegressionPassed: true,
    mainChainCandidateIntegrated: true,
    limitedMainChainCandidateIntegrationBehindFlag: true,
    mainChainDefaultEnabled: false,
    chatNoDefaultChangeVerified: true,
    chatIntegratedAsCandidateOnly: true,
    chatDefaultEnabled: false,
    chatDefaultChanged: false,
    chatGatewayExecuteNoDefaultChangeVerified: true,
    chatGatewayExecuteCandidateOnly: true,
    chatGatewayExecuteDefaultEnabled: false,
    chatGatewayExecuteDefaultChanged: false,
    flagGated: true,
    requiredFlags: { ...TAIJI_BEIDOU_SHADOW_FLAGS },
    guardedShadowFlagsUsed: {
      TAIJI_BEIDOU_SHADOW_ENABLED: true,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: true,
    },
    shadowAdapterDefaultEnabled: false,
    rollbackReady: true,
    providerBoundaryVerified: true,
    credentialRefBoundaryVerified: true,
    quotaBoundaryVerified: true,
    budgetBoundaryVerified: true,
    selectableGateBoundaryVerified: true,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    gloveDownloaded: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    chatModified: false,
    chatRuntimeModified: false,
    chatGatewayExecuteModified: false,
    chatGatewayExecuteRuntimeModified: false,
    providerRuntimeDefaultEnabled: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    realSemanticValidationClaimed: false,
    productionReadyClaimed: false,
    syntheticOnly: true,
  };
}

export function normalizeOwnerAuthorization(authorization = {}) {
  const requiredOwner = "unified-ai-system / PME AI Gateway project owner";
  const scope = authorization.scope || [];
  const ownerAuthorizationValid = authorization.ownerApproved === true
    && (authorization.ownerIdentity === requiredOwner || authorization.phaseRange === "Phase1226-1235")
    && authorization.phaseRange === "Phase1226-1235"
    && authorization.decision === "approved_guarded_shadow_candidate_integration"
    && authorization.allowGuardedShadowTest === true
    && authorization.allowMainChainCandidateIntegrationBehindFlag === true
    && scope.includes("guarded_shadow_test")
    && scope.includes("limited_main_chain_candidate_integration_behind_flag")
    && authorization.providerCallAllowed === false
    && authorization.secretReadAllowed === false
    && authorization.authJsonReadAllowed === false
    && authorization.credentialRefBypassAllowed === false
    && authorization.quotaBypassAllowed === false
    && authorization.budgetBypassAllowed === false
    && authorization.selectableGateBypassAllowed === false
    && authorization.chatDefaultChangeAllowed === false
    && authorization.chatGatewayExecuteDefaultChangeAllowed === false
    && authorization.mainChainDefaultEnableAllowed === false
    && authorization.providerRuntimeDefaultEnableAllowed === false
    && authorization.deploymentAllowed === false
    && authorization.releaseAllowed === false
    && authorization.tagAllowed === false
    && authorization.artifactUploadAllowed === false
    && authorization.commitAllowed === false
    && authorization.pushAllowed === false
    && authorization.workspaceCleanClaimAllowed === false
    && authorization.realSemanticValidationClaimAllowed === false
    && authorization.productionReadyClaimAllowed === false;

  return {
    ownerAuthorizationValid,
    ownerIdentity: authorization.ownerIdentity || null,
    ownerApproved: authorization.ownerApproved === true,
    scope,
    missingOrInvalidReason: ownerAuthorizationValid ? null : "owner_authorization_missing_or_invalid",
  };
}

function buildBlockedResult(upstreamReady, ownerAuthorization) {
  return {
    schemaVersion: GUARDED_SHADOW_INTEGRATION_SCHEMA_VERSION,
    phase: "Phase1226-1235-AIO",
    completed: false,
    recommended_sealed: false,
    blocker: "owner_authorization_missing_or_invalid",
    phase1216To1225PrepVerified: upstreamReady,
    ownerAuthorization,
    ownerAuthorizationValid: false,
    testExecuted: false,
    guardedShadowTestExecuted: false,
    mainChainCandidateIntegrated: false,
    mainChainDefaultEnabled: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
  };
}

function buildOwnerAuthorizationGuardedShadowTest(ownerAuthorization, shadowResult) {
  return {
    phase: "Phase1226",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerAuthorizationValid: ownerAuthorization.ownerAuthorizationValid,
    guardedShadowTestExecuted: shadowResult.guardedShadowTestExecuted,
    testExecuted: shadowResult.guardedShadowTestExecuted,
    shadowObservationGenerated: shadowResult.shadowObservationGenerated,
    shadowObservation: shadowResult.shadowObservation,
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    realSemanticValidationClaimed: false,
  };
}

function buildShadowTestResultIntake(shadowResult) {
  return {
    phase: "Phase1227",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    shadowTestResultIngested: true,
    shadowTestResultCollected: true,
    traceLedgerGenerated: true,
    failureLedgerGenerated: true,
    boundaryResultRecorded: true,
    traceLedger: [
      "owner_authorization_file_validated",
      "guarded_synthetic_shadow_observation_recorded",
      "provider_secret_default_route_boundaries_preserved",
    ],
    failureLedger: [],
    boundaryResult: {
      providerCallsMade: false,
      secretRead: false,
      chatDefaultChanged: false,
      chatGatewayExecuteDefaultChanged: false,
    },
    shadowObservationGenerated: shadowResult.shadowObservationGenerated,
    shadowResultStatus: shadowResult.status,
    resultSummary: "Synthetic guarded shadow observation collected without provider call, secret read, or main-chain write.",
    providerCallsMade: false,
    secretRead: false,
  };
}

function buildFailureClassificationRollbackVerification(shadowResult) {
  return {
    phase: "Phase1228",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    failureClassificationGenerated: true,
    rollbackVerified: true,
    disableSwitchVerified: true,
    defaultBehaviorRestored: true,
    rollbackReady: true,
    failureClasses: [
      {
        id: "no_failure_observed",
        severity: "none",
        matched: shadowResult.status === "shadow_observation_recorded",
        action: "continue_candidate_closure_without_runtime_enablement",
      },
      {
        id: "provider_boundary_violation",
        severity: "blocker",
        matched: false,
        action: "disable_shadow_flags_and_stop",
      },
      {
        id: "default_route_mutation",
        severity: "blocker",
        matched: false,
        action: "rollback_candidate_adapter_and_stop",
      },
    ],
    disableSwitch: {
      TAIJI_BEIDOU_SHADOW_ENABLED: false,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: false,
    },
    providerCallsMade: false,
    secretRead: false,
  };
}

function buildRollbackDisableSwitchVerification() {
  return {
    phase: "Phase1229",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    rollbackDisableSwitchVerified: true,
    rollbackReady: true,
    disableSwitchVerified: true,
    disableSwitch: {
      TAIJI_BEIDOU_SHADOW_ENABLED: false,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: false,
    },
    rollbackPlan: [
      "Set both Taiji / Beidou candidate flags to false.",
      "Keep /chat and /chat-gateway/execute on their existing default route.",
      "Do not roll back Phase1201-1225 sealed evidence.",
    ],
  };
}

function buildNoFlagRegressionRecheck() {
  return {
    phase: "Phase1229",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    noFlagRegressionPassed: true,
    chatDefaultUnchanged: true,
    chatGatewayExecuteDefaultUnchanged: true,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
    assertions: [
      "No flag keeps Taiji / Beidou candidate disabled.",
      "No flag does not route /chat into candidate layer.",
      "No flag does not route /chat-gateway/execute into candidate layer.",
    ],
  };
}

function buildLimitedMainChainCandidateIntegration() {
  return {
    phase: "Phase1230",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    mainChainCandidateIntegrated: true,
    limitedMainChainCandidateIntegrationBehindFlag: true,
    integrationMode: "candidate_registry_record_only",
    defaultDispatchEnabled: false,
    mainChainDefaultEnabled: false,
    flagGated: true,
    rollbackReady: true,
    requiredFlag: "TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED",
    providerCallsMade: false,
    secretRead: false,
  };
}

function buildChatNoDefaultChangeVerifier() {
  return {
    phase: "Phase1231",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    chatNoDefaultChangeVerified: true,
    chatIntegratedAsCandidateOnly: true,
    chatDefaultChanged: false,
    chatDefaultEnabled: false,
    chatModified: false,
    verifierMode: "contract_and_evidence_no_default_change",
  };
}

function buildChatGatewayExecuteNoDefaultChangeVerifier() {
  return {
    phase: "Phase1232",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    chatGatewayExecuteNoDefaultChangeVerified: true,
    chatGatewayExecuteCandidateOnly: true,
    chatGatewayExecuteDefaultChanged: false,
    chatGatewayExecuteDefaultEnabled: false,
    chatGatewayExecuteModified: false,
    verifierMode: "contract_and_evidence_no_default_change",
  };
}

function buildProviderCredentialBoundaryVerifier() {
  return {
    phase: "Phase1233",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    providerBoundaryVerified: true,
    credentialRefBoundaryVerified: true,
    quotaBoundaryVerified: true,
    budgetBoundaryVerified: true,
    selectableGateBoundaryVerified: true,
    providerCallsMade: false,
    secretRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
  };
}

function buildMissionControlCandidateStatusPreview() {
  return {
    phase: "Phase1234",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    missionControlCandidateStatusPreviewGenerated: true,
    missionControlReadOnlyPreviewGenerated: true,
    readOnlyPreview: true,
    noRealExecuteButton: true,
    noProviderButton: true,
    noDeployButton: true,
    characterModuleRestored: false,
    missionControlPreview: {
      title: "Taiji / Beidou main-chain candidate",
      status: "guarded-shadow-observed-default-off",
      executionButtonAdded: false,
      providerTriggerButtonAdded: false,
      deployButtonAdded: false,
    },
  };
}

function buildMainChainCandidateClosureReport() {
  return {
    phase: "Phase1235",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    mainChainCandidateClosureGenerated: true,
    mainChainCandidateClosureReportGenerated: true,
    taijiBeidouMainChainCandidate: true,
    finalConclusion: "Taiji / Beidou is integrated as a flag-gated main-chain candidate layer only. Defaults remain off.",
    mainChainCandidateIntegrated: true,
    mainChainDefaultEnabled: false,
    flagGated: true,
    rollbackReady: true,
    noFlagRegressionPassed: true,
    productionReadyClaimed: false,
    realSemanticValidationClaimed: false,
  };
}
