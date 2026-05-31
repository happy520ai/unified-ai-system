import {
  approvalDraftPath,
  findBlocker,
  matchesBoundary,
  phaseKeys,
  readJsonIfExists,
  resultPath,
  validationPath,
  writeJson,
} from "./phase1246-1255-common.mjs";

const result = await readJsonIfExists(resultPath, null);
const approvalDraft = await readJsonIfExists(approvalDraftPath, null);

const checks = {
  resultExists: Boolean(result),
  phase1246Completed: result?.phase1246?.completed === true,
  phase1247Completed: result?.phase1247?.completed === true,
  phase1248Completed: result?.phase1248?.completed === true,
  phase1249Completed: result?.phase1249?.completed === true,
  phase1250Completed: result?.phase1250?.completed === true,
  phase1251Completed: result?.phase1251?.completed === true,
  phase1252Completed: result?.phase1252?.completed === true,
  phase1253Completed: result?.phase1253?.completed === true,
  phase1254Completed: result?.phase1254?.completed === true,
  phase1255Completed: result?.phase1255?.completed === true,
  delegatedCodexReviewCompleted: result?.delegatedCodexReviewCompleted === true,
  codexProxyReviewCompleted: result?.codexProxyReviewCompleted === true,
  mechanicalReviewOnly: result?.mechanicalReviewOnly === true,
  ownerReviewPackLoaded: result?.ownerReviewPackLoaded === true,
  manualTrialScriptLoaded: result?.manualTrialScriptLoaded === true,
  riskLedgerLoaded: result?.riskLedgerLoaded === true,
  evidenceRecheckCompleted: result?.evidenceRecheckCompleted === true,
  riskLedgerRechecked: result?.riskLedgerRechecked === true,
  p0RiskDetectedFalse: result?.p0RiskDetected === false,
  limitedEnableReadinessReevaluated: result?.limitedEnableReadinessReevaluated === true,
  approvalDraftGenerated: result?.approvalDraftGenerated === true,
  ownerDecisionChecklistGenerated: result?.ownerDecisionChecklistGenerated === true,
  postReviewActionLedgerGenerated: result?.postReviewActionLedgerGenerated === true,
  ownerManualReviewCompletedFalse: result?.ownerManualReviewCompleted === false,
  realOwnerFeedbackCollectedFalse: result?.realOwnerFeedbackCollected === false,
  codexSelfTestCountedAsOwnerFeedbackFalse: result?.codexSelfTestCountedAsOwnerFeedback === false,
  ownerPersonallyApprovedFalse: result?.ownerPersonallyApproved === false,
  limitedEnableExecutedFalse: result?.limitedEnableExecuted === false,
  limitedEnableAllowedFalse: result?.limitedEnableAllowed === false,
  ownerFinalDecisionRequired: result?.ownerFinalDecisionRequired === true,
  blockerOwnerDecisionMissing: result?.blocker === "owner_final_manual_decision_missing",
  providerCallsMadeFalse: result?.providerCallsMade === false,
  secretReadFalse: result?.secretRead === false,
  authJsonReadFalse: result?.authJsonRead === false,
  rawCredentialRefReadFalse: result?.rawCredentialRefRead === false,
  credentialRefBypassedFalse: result?.credentialRefBypassed === false,
  quotaBypassedFalse: result?.quotaBypassed === false,
  budgetBypassedFalse: result?.budgetBypassed === false,
  selectableGateBypassedFalse: result?.selectableGateBypassed === false,
  chatDefaultChangedFalse: result?.chatDefaultChanged === false,
  chatGatewayExecuteDefaultChangedFalse: result?.chatGatewayExecuteDefaultChanged === false,
  mainChainDefaultEnabledFalse: result?.mainChainDefaultEnabled === false,
  providerRuntimeDefaultEnabledFalse: result?.providerRuntimeDefaultEnabled === false,
  deployExecutedFalse: result?.deployExecuted === false,
  releaseExecutedFalse: result?.releaseExecuted === false,
  tagCreatedFalse: result?.tagCreated === false,
  artifactUploadedFalse: result?.artifactUploaded === false,
  commitCreatedFalse: result?.commitCreated === false,
  pushExecutedFalse: result?.pushExecuted === false,
  workspaceCleanClaimedFalse: result?.workspaceCleanClaimed === false,
  realSemanticValidationClaimedFalse: result?.realSemanticValidationClaimed === false,
  productionReadyClaimedFalse: result?.productionReadyClaimed === false,
  boundaryMatches: matchesBoundary(result),
  phase1246Intake: result?.phase1246?.ownerReviewPackLoaded === true
    && result?.phase1246?.manualTrialScriptLoaded === true
    && result?.phase1246?.riskLedgerLoaded === true
    && result?.phase1246?.limitedEnableTemplateLoaded === true
    && result?.phase1246?.ownerManualReviewCompleted === false
    && result?.phase1246?.realOwnerFeedbackCollected === false,
  phase1247ProxyReview: result?.phase1247?.codexProxyReviewCompleted === true
    && result?.phase1247?.checklistReviewed === true
    && result?.phase1247?.mechanicalReviewOnly === true
    && result?.phase1247?.ownerManualReviewCompleted === false
    && result?.phase1247?.ownerPersonallyApproved === false,
  phase1248Risk: result?.phase1248?.evidenceRecheckCompleted === true
    && result?.phase1248?.riskLedgerRechecked === true
    && result?.phase1248?.p0RiskDetected === false,
  phase1249Ux: result?.phase1249?.candidateStatusVisible === true
    && result?.phase1249?.defaultOffClear === true
    && result?.phase1249?.flagGatedClear === true
    && result?.phase1249?.rollbackReadyClear === true
    && result?.phase1249?.noProviderCallClear === true
    && result?.phase1249?.noProductionReadyClaim === true,
  phase1250Readiness: result?.phase1250?.limitedEnableReadinessReevaluated === true
    && typeof result?.phase1250?.technicalReadinessForOwnerDecision === "boolean"
    && result?.phase1250?.limitedEnableExecuted === false
    && result?.phase1250?.limitedEnableAllowed === false
    && result?.phase1250?.ownerFinalDecisionRequired === true,
  phase1251Draft: result?.phase1251?.approvalDraftGenerated === true
    && result?.phase1251?.ownerPersonallyApproved === false
    && result?.phase1251?.ownerManualReviewCompleted === false,
  phase1252Checklist: result?.phase1252?.ownerDecisionChecklistGenerated === true
    && result?.phase1252?.ownerFinalDecisionRequired === true,
  phase1253Blocker: result?.phase1253?.limitedEnableBlockerClassificationGenerated === true
    && result?.phase1253?.blocker === "owner_final_manual_decision_missing"
    && result?.phase1253?.limitedEnableAllowed === false,
  phase1254Ledger: result?.phase1254?.postReviewActionLedgerGenerated === true
    && Array.isArray(result?.phase1254?.mustFixBeforeLimitedEnable)
    && result?.phase1254?.mustFixBeforeLimitedEnable.length === 0
    && result?.phase1254?.ownerDecisionRequired === true
    && result?.phase1254?.nextPhaseRecommendationGenerated === true,
  phase1255Closure: result?.phase1255?.delegatedCodexReviewCompleted === true
    && result?.phase1255?.ownerManualReviewCompleted === false
    && result?.phase1255?.ownerPersonallyApproved === false
    && result?.phase1255?.limitedEnableExecuted === false
    && result?.phase1255?.blocker === "owner_final_manual_decision_missing",
  approvalDraftExists: Boolean(approvalDraft),
  approvalDraftDefaults: approvalDraft?.phaseRange === "Phase1256-1265"
    && approvalDraft?.decision === "draft_pending_owner_final_decision"
    && approvalDraft?.ownerPersonallyApproved === false
    && approvalDraft?.ownerManualReviewCompleted === false
    && approvalDraft?.allowLimitedEnableBehindFlag === false
    && approvalDraft?.allowProviderCall === false
    && approvalDraft?.allowSecretRead === false
    && approvalDraft?.allowChatDefaultChange === false
    && approvalDraft?.allowChatGatewayExecuteDefaultChange === false
    && approvalDraft?.allowMainChainDefaultEnable === false
    && approvalDraft?.allowProviderRuntimeDefaultEnable === false
    && approvalDraft?.allowDeploy === false
    && approvalDraft?.allowRelease === false
    && approvalDraft?.allowTag === false
    && approvalDraft?.allowArtifactUpload === false
    && approvalDraft?.allowCommitPush === false
    && approvalDraft?.allowProductionReadyClaim === false,
  phaseDocsPresent: phaseKeys.every((key) => Boolean(result?.[key])),
};

const blocker = result?.p0RiskDetected === true ? "p0_risk_detected" : findBlocker(checks);
const validation = {
  phase: "Phase1246-1255-AIO",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker: blocker === null ? "owner_final_manual_decision_missing" : blocker,
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
