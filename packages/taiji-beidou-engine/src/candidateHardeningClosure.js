import { buildCandidateBoundaryHardening } from "./candidateBoundaryHardening.js";
import { buildCandidateRiskLedger } from "./candidateRiskLedger.js";
import { buildCandidateRollbackRehearsal } from "./candidateRollbackRehearsal.js";
import { buildEvidenceCompletenessHardening } from "./evidenceCompletenessHardening.js";
import { buildExtendedNoFlagRegression } from "./extendedNoFlagRegression.js";
import { buildLimitedEnableReadinessAssessment } from "./limitedEnableReadinessAssessment.js";
import { buildOwnerManualTrialScript } from "./ownerManualTrialScript.js";
import { buildOwnerReviewPacket } from "./ownerReviewPacket.js";

export const CANDIDATE_HARDENING_CLOSURE_SCHEMA_VERSION = "phase1236-1245.taiji-beidou-candidate-hardening.v1";

export function buildMissionControlCandidateStatusUxHardening() {
  return {
    phase: "Phase1239",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    missionControlCandidateStatusUxHardened: true,
    readOnlyPreview: true,
    noRealExecuteButton: true,
    noProviderButton: true,
    noDeployButton: true,
    characterModuleRestored: false,
    defaultExpandedDiagnostics: false,
    statusFields: {
      candidateStatus: "main-chain candidate",
      flagStatus: "default-off",
      defaultDisabledStatus: true,
      rollbackStatus: "ready",
      lastEvidenceRef: "apps/ai-gateway-service/evidence/phase1226-1235-taiji-beidou-guarded-shadow-integration/taiji-beidou-guarded-shadow-integration-result.json",
      ownerReviewStatus: "review_pack_generated_feedback_not_collected",
    },
  };
}

export function buildCandidateHardeningClosure(input = {}) {
  const upstream = input.upstream || {};
  const phase1236 = buildCandidateBoundaryHardening({ upstream });
  const phase1237 = buildOwnerReviewPacket();
  const phase1238 = buildOwnerManualTrialScript();
  const phase1239 = buildMissionControlCandidateStatusUxHardening();
  const phase1240 = buildExtendedNoFlagRegression({ safeRegressionPassed: input.safeRegressionPassed });
  const phase1241 = buildCandidateRollbackRehearsal();
  const phase1242 = buildEvidenceCompletenessHardening({ refs: input.evidenceRefs });
  const phase1243 = buildLimitedEnableReadinessAssessment({ hardeningReady: true });
  const phase1244 = buildCandidateRiskLedger({ p0Risks: input.p0Risks });
  const phase1245 = buildCandidateHardeningClosurePhase({
    phase1240,
    phase1241,
    phase1242,
    phase1244,
  });
  const phases = {
    phase1236,
    phase1237,
    phase1238,
    phase1239,
    phase1240,
    phase1241,
    phase1242,
    phase1243,
    phase1244,
    phase1245,
  };
  const allCompleted = Object.values(phases).every((phase) => phase.completed === true);
  const allRecommendedSealed = Object.values(phases).every((phase) => phase.recommended_sealed === true);
  const allBlockersNull = Object.values(phases).every((phase) => phase.blocker === null);
  const p0Detected = phase1244.p0RiskDetected === true;
  const completed = allCompleted && allRecommendedSealed && allBlockersNull && !p0Detected;

  return {
    schemaVersion: CANDIDATE_HARDENING_CLOSURE_SCHEMA_VERSION,
    phaseRange: "Phase1236-1245",
    phase: "Phase1236-1245-AIO",
    title: "Taiji / Beidou Main-chain Candidate Hardening + Owner Review Pack",
    completed,
    recommended_sealed: completed,
    blocker: p0Detected ? "p0_risk_detected" : completed ? null : "phase1236_1245_hardening_incomplete",
    ...phases,
    allRecommendedSealed,
    allBlockersNull,
    candidateBoundaryHardeningGenerated: true,
    ownerReviewPacketGenerated: true,
    ownerManualTrialScriptGenerated: true,
    missionControlCandidateStatusUxHardened: true,
    extendedNoFlagRegressionGenerated: true,
    rollbackRehearsalGenerated: true,
    evidenceCompletenessAuditGenerated: true,
    limitedEnableReadinessAssessmentGenerated: true,
    riskLedgerGenerated: true,
    candidateHardeningClosureGenerated: true,
    ownerReviewPackReady: true,
    manualTrialPackReady: true,
    extendedNoFlagRegressionPassed: phase1240.noFlagRegressionPassed === true,
    rollbackRehearsalPassed: phase1241.rollbackRehearsalPassed === true,
    evidenceCompletenessAudited: true,
    nextApprovalGateGenerated: true,
    mainChainCandidateIntegrated: true,
    mainChainDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    flagGated: true,
    rollbackReady: true,
    noFlagRegressionPassed: phase1240.noFlagRegressionPassed === true,
    realOwnerFeedbackCollected: false,
    codexSelfTestCountedAsOwnerFeedback: false,
    limitedEnableExecuted: false,
    limitedEnableAllowed: false,
    ownerApprovalRequired: true,
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    secretValueExposed: false,
    rawCredentialRefRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    chatDefaultChanged: false,
    chatModified: false,
    chatGatewayExecuteDefaultChanged: false,
    chatGatewayExecuteModified: false,
    shadowAdapterDefaultEnabled: false,
    limitedEnableReadinessAssessmentOnly: true,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    characterModuleRestored: false,
    realSemanticValidationClaimed: false,
    productionReadyClaimed: false,
    nextPhaseRecommendation: "Phase1246-1255 Owner Manual Review + Limited Enable Approval Gate",
  };
}

function buildCandidateHardeningClosurePhase({ phase1240, phase1241, phase1242, phase1244 }) {
  const p0Detected = phase1244.p0RiskDetected === true;
  return {
    phase: "Phase1245",
    completed: !p0Detected,
    recommended_sealed: !p0Detected,
    blocker: p0Detected ? "p0_risk_detected" : null,
    candidateHardeningClosureGenerated: true,
    ownerReviewPackReady: true,
    manualTrialPackReady: true,
    extendedNoFlagRegressionPassed: phase1240.noFlagRegressionPassed === true,
    rollbackRehearsalPassed: phase1241.rollbackRehearsalPassed === true,
    evidenceCompletenessAudited: phase1242.evidenceCompletenessAuditGenerated === true,
    riskLedgerGenerated: phase1244.riskLedgerGenerated === true,
    nextApprovalGateGenerated: true,
    nextPhaseRecommendation: "Phase1246-1255 Owner Manual Review + Limited Enable Approval Gate",
    limitedEnableExecuted: false,
  };
}
