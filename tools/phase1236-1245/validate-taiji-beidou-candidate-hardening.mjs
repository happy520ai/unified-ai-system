import {
  findBlocker,
  matchesBoundary,
  nextApprovalTemplatePath,
  phaseKeys,
  readJsonIfExists,
  resultPath,
  validationPath,
  writeJson,
} from "./phase1236-1245-common.mjs";

const result = await readJsonIfExists(resultPath, null);
const nextApproval = await readJsonIfExists(nextApprovalTemplatePath, null);

const checks = {
  resultExists: Boolean(result),
  phase1236Completed: result?.phase1236?.completed === true,
  phase1237Completed: result?.phase1237?.completed === true,
  phase1238Completed: result?.phase1238?.completed === true,
  phase1239Completed: result?.phase1239?.completed === true,
  phase1240Completed: result?.phase1240?.completed === true,
  phase1241Completed: result?.phase1241?.completed === true,
  phase1242Completed: result?.phase1242?.completed === true,
  phase1243Completed: result?.phase1243?.completed === true,
  phase1244Completed: result?.phase1244?.completed === true,
  phase1245Completed: result?.phase1245?.completed === true,
  allRecommendedSealed: result?.allRecommendedSealed === true,
  allBlockersNull: result?.allBlockersNull === true,
  candidateBoundaryHardeningGenerated: result?.candidateBoundaryHardeningGenerated === true,
  ownerReviewPacketGenerated: result?.ownerReviewPacketGenerated === true,
  ownerManualTrialScriptGenerated: result?.ownerManualTrialScriptGenerated === true,
  missionControlCandidateStatusUxHardened: result?.missionControlCandidateStatusUxHardened === true,
  extendedNoFlagRegressionGenerated: result?.extendedNoFlagRegressionGenerated === true,
  rollbackRehearsalGenerated: result?.rollbackRehearsalGenerated === true,
  evidenceCompletenessAuditGenerated: result?.evidenceCompletenessAuditGenerated === true,
  limitedEnableReadinessAssessmentGenerated: result?.limitedEnableReadinessAssessmentGenerated === true,
  riskLedgerGenerated: result?.riskLedgerGenerated === true,
  candidateHardeningClosureGenerated: result?.candidateHardeningClosureGenerated === true,
  mainChainCandidateIntegrated: result?.mainChainCandidateIntegrated === true,
  mainChainDefaultEnabledFalse: result?.mainChainDefaultEnabled === false,
  providerRuntimeDefaultEnabledFalse: result?.providerRuntimeDefaultEnabled === false,
  flagGated: result?.flagGated === true,
  rollbackReady: result?.rollbackReady === true,
  noFlagRegressionPassed: result?.noFlagRegressionPassed === true,
  realOwnerFeedbackCollectedFalse: result?.realOwnerFeedbackCollected === false,
  codexSelfTestCountedAsOwnerFeedbackFalse: result?.codexSelfTestCountedAsOwnerFeedback === false,
  limitedEnableExecutedFalse: result?.limitedEnableExecuted === false,
  limitedEnableAllowedFalse: result?.limitedEnableAllowed === false,
  ownerApprovalRequired: result?.ownerApprovalRequired === true,
  providerCallsMadeFalse: result?.providerCallsMade === false,
  secretReadFalse: result?.secretRead === false,
  authJsonReadFalse: result?.authJsonRead === false,
  secretValueExposedFalse: result?.secretValueExposed === false,
  rawCredentialRefReadFalse: result?.rawCredentialRefRead === false,
  credentialRefBypassedFalse: result?.credentialRefBypassed === false,
  quotaBypassedFalse: result?.quotaBypassed === false,
  budgetBypassedFalse: result?.budgetBypassed === false,
  selectableGateBypassedFalse: result?.selectableGateBypassed === false,
  chatDefaultChangedFalse: result?.chatDefaultChanged === false,
  chatModifiedFalse: result?.chatModified === false,
  chatGatewayExecuteDefaultChangedFalse: result?.chatGatewayExecuteDefaultChanged === false,
  chatGatewayExecuteModifiedFalse: result?.chatGatewayExecuteModified === false,
  deployExecutedFalse: result?.deployExecuted === false,
  releaseExecutedFalse: result?.releaseExecuted === false,
  tagCreatedFalse: result?.tagCreated === false,
  artifactUploadedFalse: result?.artifactUploaded === false,
  commitCreatedFalse: result?.commitCreated === false,
  pushExecutedFalse: result?.pushExecuted === false,
  workspaceCleanClaimedFalse: result?.workspaceCleanClaimed === false,
  legacyModifiedFalse: result?.legacyModified === false,
  projectContextModifiedFalse: result?.projectContextModified === false,
  characterModuleRestoredFalse: result?.characterModuleRestored === false,
  realSemanticValidationClaimedFalse: result?.realSemanticValidationClaimed === false,
  productionReadyClaimedFalse: result?.productionReadyClaimed === false,
  boundaryMatches: matchesBoundary(result),
  phase1236Boundary: result?.phase1236?.candidateLayerExists === true
    && result?.phase1236?.mainChainCandidateIntegrated === true
    && result?.phase1236?.mainChainDefaultEnabled === false
    && result?.phase1236?.flagGated === true
    && result?.phase1236?.shadowAdapterDefaultEnabled === false
    && result?.phase1236?.providerRuntimeDefaultEnabled === false
    && result?.phase1236?.unsafeDefaultEnableBlocked === true,
  phase1237OwnerReview: result?.phase1237?.ownerReviewPacketGenerated === true
    && result?.phase1237?.candidateSummaryGenerated === true
    && result?.phase1237?.riskSummaryGenerated === true
    && result?.phase1237?.manualReviewChecklistGenerated === true
    && result?.phase1237?.approvalDecisionTemplateGenerated === true
    && result?.phase1237?.approvalDecisionTemplate?.ownerApprovedForLimitedEnable === false
    && result?.phase1237?.approvalDecisionTemplate?.limitedEnableAllowed === false
    && result?.phase1237?.approvalDecisionTemplate?.providerCallAllowed === false
    && result?.phase1237?.approvalDecisionTemplate?.secretReadAllowed === false
    && result?.phase1237?.approvalDecisionTemplate?.deploymentAllowed === false,
  phase1238ManualTrial: result?.phase1238?.ownerManualTrialScriptGenerated === true
    && result?.phase1238?.manualStepsGenerated === true
    && result?.phase1238?.expectedObservationsGenerated === true
    && result?.phase1238?.feedbackFormGenerated === true
    && result?.phase1238?.realOwnerFeedbackCollected === false
    && result?.phase1238?.codexSelfTestCountedAsOwnerFeedback === false,
  phase1239MissionControl: result?.phase1239?.missionControlCandidateStatusUxHardened === true
    && result?.phase1239?.readOnlyPreview === true
    && result?.phase1239?.noRealExecuteButton === true
    && result?.phase1239?.noProviderButton === true
    && result?.phase1239?.noDeployButton === true
    && result?.phase1239?.characterModuleRestored === false,
  phase1240NoFlag: result?.phase1240?.extendedNoFlagRegressionGenerated === true
    && result?.phase1240?.noFlagRegressionPassed === true
    && result?.phase1240?.chatDefaultUnchanged === true
    && result?.phase1240?.chatGatewayExecuteDefaultUnchanged === true
    && result?.phase1240?.providerRuntimeDefaultEnabled === false
    && result?.phase1240?.mainChainCandidateFlagOff === true
    && result?.phase1240?.shadowAdapterFlagOff === true,
  phase1241Rollback: result?.phase1241?.rollbackRehearsalGenerated === true
    && result?.phase1241?.emergencyDisablePlanGenerated === true
    && result?.phase1241?.disableSwitchVerified === true
    && result?.phase1241?.rollbackPlanVerified === true
    && result?.phase1241?.defaultBehaviorRestored === true,
  phase1242Evidence: result?.phase1242?.evidenceCompletenessAuditGenerated === true
    && result?.phase1242?.phase1201To1235TraceMapGenerated === true
    && result?.phase1242?.missingEvidenceLedgerGenerated === true
    && result?.phase1242?.evidenceRefsValidated === true
    && result?.phase1242?.noFabricatedEvidenceWritten === true,
  phase1243Readiness: result?.phase1243?.limitedEnableReadinessAssessmentGenerated === true
    && result?.phase1243?.limitedEnableExecuted === false
    && result?.phase1243?.ownerApprovalRequired === true
    && result?.phase1243?.providerCallStillDisallowed === true
    && result?.phase1243?.secretReadStillDisallowed === true
    && result?.phase1243?.deploymentStillDisallowed === true
    && result?.phase1243?.limitedEnableAllowed === false,
  phase1244RiskLedger: result?.phase1244?.riskLedgerGenerated === true
    && result?.phase1244?.p0RiskDetected === false
    && result?.phase1244?.safetyBrakeEngaged === false,
  phase1245Closure: result?.phase1245?.candidateHardeningClosureGenerated === true
    && result?.phase1245?.ownerReviewPackReady === true
    && result?.phase1245?.manualTrialPackReady === true
    && result?.phase1245?.extendedNoFlagRegressionPassed === true
    && result?.phase1245?.rollbackRehearsalPassed === true
    && result?.phase1245?.evidenceCompletenessAudited === true
    && result?.phase1245?.riskLedgerGenerated === true
    && result?.phase1245?.nextApprovalGateGenerated === true
    && result?.phase1245?.limitedEnableExecuted === false,
  phaseDocsRefsPresent: phaseKeys.every((key) => typeof result?.[key]?.phase === "string"),
  nextApprovalTemplateExists: Boolean(nextApproval),
  nextApprovalTemplateDefaults: nextApproval?.phaseRange === "Phase1246-1255"
    && nextApproval?.decision === "pending_owner_manual_review"
    && nextApproval?.ownerManualReviewCompleted === false
    && nextApproval?.ownerApprovedLimitedEnable === false
    && nextApproval?.allowLimitedEnableBehindFlag === false
    && nextApproval?.providerCallAllowed === false
    && nextApproval?.secretReadAllowed === false
    && nextApproval?.chatDefaultChangeAllowed === false
    && nextApproval?.chatGatewayExecuteDefaultChangeAllowed === false
    && nextApproval?.mainChainDefaultEnableAllowed === false
    && nextApproval?.deploymentAllowed === false
    && nextApproval?.productionReadyClaimAllowed === false,
};

const p0Detected = result?.phase1244?.p0RiskDetected === true;
const blocker = p0Detected ? "p0_risk_detected" : findBlocker(checks);
const validation = {
  phase: "Phase1236-1245-AIO",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker: blocker === null ? null : blocker,
  checks,
};

await writeJson(validationPath, validation);
console.log(JSON.stringify({
  phase: validation.phase,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
}, null, 2));

if (blocker) process.exitCode = 1;
