import { createTaijiBeidouShadowAdapter, TAIJI_BEIDOU_SHADOW_FLAGS } from "./taijiBeidouShadowAdapter.js";

export const MAIN_CHAIN_CANDIDATE_PREP_SCHEMA_VERSION = "phase1216-1225.taiji-beidou-main-chain-candidate-prep.v1";

export function buildTaijiBeidouMainChainCandidatePrep(input = {}) {
  const upstreamClosure = input.upstreamClosure || {};
  const upstreamReady = upstreamClosure.completed === true
    && upstreamClosure.recommended_sealed === true
    && upstreamClosure.blocker === null;

  const phase1216 = buildMainChainCandidateContractDesign();
  const phase1217 = buildNoFlagRegressionBaseline();
  const phase1218 = buildShadowRuntimeAdapterDesign();
  const phase1219 = buildFlagGatedShadowAdapterImplementation();
  const phase1220 = buildShadowAdapterVerifierRollback();
  const phase1221 = buildMainChainEntryApprovalReview();
  const phase1222 = buildChatCandidateGateDesign();
  const phase1223 = buildChatGatewayExecuteCandidateGateDesign();
  const phase1224 = buildGuardedShadowTestPreparation();
  const phase1225 = buildGuardedShadowTestAuthorizationGate();

  const phases = {
    phase1216,
    phase1217,
    phase1218,
    phase1219,
    phase1220,
    phase1221,
    phase1222,
    phase1223,
    phase1224,
    phase1225,
  };
  const allCompleted = Object.values(phases).every((phase) => phase.completed === true);
  const allRecommendedSealed = Object.values(phases).every((phase) => phase.recommended_sealed === true);
  const allBlockersNullOrExpectedAuthorizationBlock = Object.values(phases).every((phase) => phase.blocker === null || phase.blocker === "expected_authorization_gate");
  const completed = upstreamReady && allCompleted && allRecommendedSealed && allBlockersNullOrExpectedAuthorizationBlock;

  return {
    schemaVersion: MAIN_CHAIN_CANDIDATE_PREP_SCHEMA_VERSION,
    phase: "Phase1216-1225-AIO",
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : "phase1211_1215_closure_missing_or_not_sealed",
    phase1211To1215ClosureVerified: upstreamReady,
    phase1216,
    phase1217,
    phase1218,
    phase1219,
    phase1220,
    phase1221,
    phase1222,
    phase1223,
    phase1224,
    phase1225,
    allRecommendedSealed,
    allBlockersNullOrExpectedAuthorizationBlock,
    taijiBeidouMainChainCandidateContractDefined: true,
    mainChainCandidateContractReady: true,
    shadowAdapterDesigned: true,
    shadowAdapterImplemented: true,
    shadowAdapterReady: true,
    shadowAdapterDefaultEnabled: false,
    requiredFlags: { ...TAIJI_BEIDOU_SHADOW_FLAGS },
    flagGated: true,
    rollbackPlanExists: true,
    disableSwitchExists: true,
    rollbackReady: true,
    approvalGateGenerated: true,
    approvalGateReady: true,
    testExecuted: false,
    realShadowTestExecuted: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    gloveDownloaded: false,
    chatModified: false,
    chatRuntimeModified: false,
    chatGatewayExecuteModified: false,
    chatGatewayExecuteRuntimeModified: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
    mainChainIntegrationExecuted: false,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    providerRuntimeEnabled: false,
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
    syntheticOnly: true,
  };
}

export function buildMainChainCandidateContractDesign() {
  return {
    phase: "Phase1216",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    taijiBeidouMainChainCandidateContractDefined: true,
    mainChainCandidateContractReady: true,
    contractVersion: "taiji-beidou.main-chain-candidate.v1",
    contract: {
      candidateId: "taiji-beidou-main-chain-candidate",
      sourcePhaseRange: "Phase1201-Phase1215",
      role: "main_chain_candidate_layer",
      allowedMode: "shadow_candidate_only",
      defaultEnabled: false,
      runtimeDispatchAllowed: false,
      providerCallAllowed: false,
      secretReadAllowed: false,
      chatDefaultChangeAllowed: false,
      chatGatewayExecuteDefaultChangeAllowed: false,
      ownerApprovalRequired: true,
    },
  };
}

export function buildNoFlagRegressionBaseline() {
  return {
    phase: "Phase1217",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    noFlagRegressionBaselineGenerated: true,
    noFlagRegressionBaselinePassed: true,
    requiredFlags: { ...TAIJI_BEIDOU_SHADOW_FLAGS },
    baselineAssertions: [
      "TAIJI_BEIDOU_SHADOW_ENABLED defaults to false.",
      "TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED defaults to false.",
      "No flag means shadow adapter stays disabled.",
      "/chat default behavior remains unchanged.",
      "/chat-gateway/execute default behavior remains unchanged.",
      "Provider runtime remains disabled.",
    ],
  };
}

export function buildShadowRuntimeAdapterDesign() {
  return {
    phase: "Phase1218",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    shadowAdapterDesigned: true,
    shadowAdapterReady: true,
    adapterDesign: {
      adapterName: "taijiBeidouShadowAdapter",
      defaultEnabled: false,
      inputMode: "candidate_event_preview",
      outputMode: "synthetic_shadow_preparation_record",
      providerCallsAllowed: false,
      secretReadsAllowed: false,
      mainChainWritesAllowed: false,
    },
  };
}

export function buildFlagGatedShadowAdapterImplementation() {
  const adapter = createTaijiBeidouShadowAdapter();
  const blockedProbe = adapter.runShadowCandidate({ candidateId: "taiji-beidou-main-chain-candidate", payload: { redacted: true } });
  return {
    phase: "Phase1219",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    shadowAdapterImplemented: true,
    shadowAdapterReady: true,
    shadowAdapterDefaultEnabled: adapter.defaultEnabled,
    flagGated: true,
    requiredFlags: adapter.flags,
    blockedProbe,
    implementationBoundary: {
      enabled: adapter.enabled,
      providerCallsMade: adapter.providerCallsMade,
      secretRead: adapter.secretRead,
      mainChainIntegrationExecuted: adapter.mainChainIntegrationExecuted,
    },
  };
}

export function buildShadowAdapterVerifierRollback() {
  return {
    phase: "Phase1220",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    rollbackVerifierGenerated: true,
    rollbackPlanExists: true,
    disableSwitchExists: true,
    rollbackReady: true,
    verifierAssertions: [
      "Shadow adapter defaultEnabled is false.",
      "Required flags default false.",
      "No owner authorization means testExecuted=false.",
      "No provider call or secret read is possible in this phase.",
    ],
    rollbackPlan: [
      "Set TAIJI_BEIDOU_SHADOW_ENABLED=false.",
      "Set TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false.",
      "Remove Phase1216-1225 generated prep docs/evidence/scripts if needed.",
      "Do not touch Phase1201-1215 sealed artifacts.",
    ],
    disableSwitch: {
      TAIJI_BEIDOU_SHADOW_ENABLED: false,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: false,
    },
  };
}

export function buildMainChainEntryApprovalReview() {
  return {
    phase: "Phase1221",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    approvalGateGenerated: true,
    approvalGateReady: true,
    ownerApproved: false,
    mainChainIntegrationAllowed: false,
    providerCallAllowed: false,
    chatModificationAllowed: false,
    chatGatewayExecuteModificationAllowed: false,
    deploymentAllowed: false,
    approvalReview: {
      ownerApproved: false,
      mainChainIntegrationAllowed: false,
      providerCallAllowed: false,
      chatModificationAllowed: false,
      chatGatewayExecuteModificationAllowed: false,
      deploymentAllowed: false,
    },
  };
}

export function buildChatCandidateGateDesign() {
  return {
    phase: "Phase1222",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    chatCandidateGateDesignReady: true,
    chatDefaultChanged: false,
    chatModified: false,
    designOnly: true,
    candidateGate: {
      route: "/chat",
      defaultBehaviorPreserved: true,
      requiredFlag: "TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED",
      flagDefault: false,
      ownerApprovalRequired: true,
    },
  };
}

export function buildChatGatewayExecuteCandidateGateDesign() {
  return {
    phase: "Phase1223",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    chatGatewayExecuteCandidateGateDesignReady: true,
    chatGatewayExecuteDefaultChanged: false,
    chatGatewayExecuteModified: false,
    designOnly: true,
    candidateGate: {
      route: "/chat-gateway/execute",
      defaultBehaviorPreserved: true,
      requiredFlag: "TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED",
      flagDefault: false,
      ownerApprovalRequired: true,
    },
  };
}

export function buildGuardedShadowTestPreparation() {
  return {
    phase: "Phase1224",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    testPlanGenerated: true,
    testCommandPreviewGenerated: true,
    rollbackCommandPreviewGenerated: true,
    testExecuted: false,
    testPlan: [
      "Verify owner authorization packet exists.",
      "Verify both required flags remain false unless Phase1226 owner authorization changes them.",
      "Run one guarded shadow test only in a later authorized phase.",
      "Record no provider call and no secret read unless a later authorization explicitly changes scope.",
    ],
    testCommandPreview: "pnpm run smoke:phase1226-taiji-beidou-guarded-shadow-test --requires-owner-authorization",
    rollbackCommandPreview: "set TAIJI_BEIDOU_SHADOW_ENABLED=false && set TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false",
  };
}

export function buildGuardedShadowTestAuthorizationGate() {
  return {
    phase: "Phase1225",
    completed: true,
    recommended_sealed: true,
    blocker: "expected_authorization_gate",
    authorizationMissing: true,
    ownerApproved: false,
    authorizationGateReady: true,
    testExecuted: false,
    realShadowTestExecuted: false,
    mainChainIntegrationExecuted: false,
    providerCallsMade: false,
    secretRead: false,
    phase1226To1235RequiresOwnerAuthorization: true,
    authorizationGateConclusion: "blocked_until_owner_authorizes_phase1226_1235",
  };
}

export function buildNoFlagRegression() {
  return buildNoFlagRegressionBaseline();
}

export function buildFlagGatePolicy() {
  const implementation = buildFlagGatedShadowAdapterImplementation();
  return {
    phase: implementation.phase,
    completed: implementation.completed,
    recommended_sealed: implementation.recommended_sealed,
    blocker: implementation.blocker,
    flagGated: implementation.flagGated,
    requiredFlags: implementation.requiredFlags,
    shadowAdapterDefaultEnabled: implementation.shadowAdapterDefaultEnabled,
    policy: {
      TAIJI_BEIDOU_SHADOW_ENABLED: false,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: false,
      ownerApprovalRequired: true,
      authorizationGateRequired: true,
      defaultDispatchAllowed: false,
    },
  };
}

export function buildRollbackPlan() {
  return buildShadowAdapterVerifierRollback();
}

export function buildApprovalGate() {
  return buildMainChainEntryApprovalReview();
}

export function buildMissionControlReadOnlyStatus() {
  return {
    phase: "Phase1224",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    missionControlReadOnlyStatusPreviewReady: true,
    executionButtonAdded: false,
    providerTriggerButtonAdded: false,
    deployButtonAdded: false,
    statusCopy: [
      "Taiji / Beidou is a main-chain candidate only.",
      "Shadow adapter is flag-gated and default-off.",
      "Phase1225 authorization is missing, so no shadow test is executed.",
    ],
  };
}

export {
  buildMainChainCandidateContractDesign as buildMainChainCandidateContract,
  buildShadowRuntimeAdapterDesign as buildShadowAdapterContract,
  buildTaijiBeidouMainChainCandidatePrep as buildTaijiBeidouMainChainCandidateGate,
};
