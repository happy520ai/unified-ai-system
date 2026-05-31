import {
  approvalPath,
  findBlocker,
  matchesBoundary,
  phaseKeys,
  readJsonIfExists,
  resultPath,
  validationPath,
  writeJson,
} from "./phase1226-1235-common.mjs";

const result = await readJsonIfExists(resultPath, null);
const approval = await readJsonIfExists(approvalPath, null);

const checks = {
  approvalExists: Boolean(approval),
  approvalPhaseRange: approval?.phaseRange === "Phase1226-1235",
  approvalDecision: approval?.decision === "approved_guarded_shadow_candidate_integration",
  approvalOwnerApproved: approval?.ownerApproved === true,
  approvalGuardedShadowAllowed: approval?.allowGuardedShadowTest === true,
  approvalCandidateIntegrationAllowed: approval?.allowMainChainCandidateIntegrationBehindFlag === true,
  approvalProviderCallBlocked: approval?.providerCallAllowed === false,
  approvalSecretReadBlocked: approval?.secretReadAllowed === false,
  approvalAuthJsonReadBlocked: approval?.authJsonReadAllowed === false,
  approvalCredentialRefBypassBlocked: approval?.credentialRefBypassAllowed === false,
  approvalQuotaBypassBlocked: approval?.quotaBypassAllowed === false,
  approvalBudgetBypassBlocked: approval?.budgetBypassAllowed === false,
  approvalSelectableGateBypassBlocked: approval?.selectableGateBypassAllowed === false,
  approvalChatDefaultChangeBlocked: approval?.chatDefaultChangeAllowed === false,
  approvalChatGatewayExecuteDefaultChangeBlocked: approval?.chatGatewayExecuteDefaultChangeAllowed === false,
  approvalMainChainDefaultEnableBlocked: approval?.mainChainDefaultEnableAllowed === false,
  approvalProviderRuntimeDefaultEnableBlocked: approval?.providerRuntimeDefaultEnableAllowed === false,
  approvalDeploymentBlocked: approval?.deploymentAllowed === false,
  approvalCommitPushBlocked: approval?.commitPushAllowed === false,
  approvalReleaseBlocked: approval?.releaseAllowed === false,
  approvalTagBlocked: approval?.tagAllowed === false,
  approvalArtifactUploadBlocked: approval?.artifactUploadAllowed === false,
  approvalCommitBlocked: approval?.commitAllowed === false,
  approvalPushBlocked: approval?.pushAllowed === false,
  approvalWorkspaceCleanClaimBlocked: approval?.workspaceCleanClaimAllowed === false,
  approvalRealSemanticValidationClaimBlocked: approval?.realSemanticValidationClaimAllowed === false,
  approvalProductionReadyClaimBlocked: approval?.productionReadyClaimAllowed === false,
  resultExists: Boolean(result),
  phase1226Completed: result?.phase1226?.completed === true,
  phase1227Completed: result?.phase1227?.completed === true,
  phase1228Completed: result?.phase1228?.completed === true,
  phase1229Completed: result?.phase1229?.completed === true,
  phase1230Completed: result?.phase1230?.completed === true,
  phase1231Completed: result?.phase1231?.completed === true,
  phase1232Completed: result?.phase1232?.completed === true,
  phase1233Completed: result?.phase1233?.completed === true,
  phase1234Completed: result?.phase1234?.completed === true,
  phase1235Completed: result?.phase1235?.completed === true,
  allRecommendedSealed: result?.allRecommendedSealed === true,
  allBlockersNull: result?.allBlockersNull === true,
  ownerAuthorizationValid: result?.ownerAuthorizationValid === true,
  guardedShadowTestExecuted: result?.guardedShadowTestExecuted === true,
  shadowTestResultIngested: result?.shadowTestResultIngested === true,
  traceLedgerGenerated: result?.traceLedgerGenerated === true,
  failureLedgerGenerated: result?.failureLedgerGenerated === true,
  boundaryResultRecorded: result?.boundaryResultRecorded === true,
  shadowTestResultCollected: result?.shadowTestResultCollected === true,
  failureClassificationGenerated: result?.failureClassificationGenerated === true,
  rollbackVerified: result?.rollbackVerified === true,
  disableSwitchVerified: result?.disableSwitchVerified === true,
  defaultBehaviorRestored: result?.defaultBehaviorRestored === true,
  noFlagRegressionPassed: result?.noFlagRegressionPassed === true,
  mainChainCandidateIntegrated: result?.mainChainCandidateIntegrated === true,
  limitedMainChainCandidateIntegrationBehindFlag: result?.limitedMainChainCandidateIntegrationBehindFlag === true,
  mainChainDefaultEnabledFalse: result?.mainChainDefaultEnabled === false,
  chatNoDefaultChangeVerified: result?.chatNoDefaultChangeVerified === true,
  chatIntegratedAsCandidateOnly: result?.chatIntegratedAsCandidateOnly === true,
  chatDefaultEnabledFalse: result?.chatDefaultEnabled === false,
  chatDefaultChangedFalse: result?.chatDefaultChanged === false,
  chatGatewayExecuteNoDefaultChangeVerified: result?.chatGatewayExecuteNoDefaultChangeVerified === true,
  chatGatewayExecuteCandidateOnly: result?.chatGatewayExecuteCandidateOnly === true,
  chatGatewayExecuteDefaultEnabledFalse: result?.chatGatewayExecuteDefaultEnabled === false,
  chatGatewayExecuteDefaultChangedFalse: result?.chatGatewayExecuteDefaultChanged === false,
  flagGated: result?.flagGated === true,
  shadowAdapterDefaultEnabledFalse: result?.shadowAdapterDefaultEnabled === false,
  rollbackReady: result?.rollbackReady === true,
  providerBoundaryVerified: result?.providerBoundaryVerified === true,
  credentialRefBoundaryVerified: result?.credentialRefBoundaryVerified === true,
  quotaBoundaryVerified: result?.quotaBoundaryVerified === true,
  budgetBoundaryVerified: result?.budgetBoundaryVerified === true,
  selectableGateBoundaryVerified: result?.selectableGateBoundaryVerified === true,
  providerCallsMadeFalse: result?.providerCallsMade === false,
  secretReadFalse: result?.secretRead === false,
  authJsonReadFalse: result?.authJsonRead === false,
  credentialRefBypassedFalse: result?.credentialRefBypassed === false,
  quotaBypassedFalse: result?.quotaBypassed === false,
  budgetBypassedFalse: result?.budgetBypassed === false,
  selectableGateBypassedFalse: result?.selectableGateBypassed === false,
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
  phaseEvidencePresent: phaseKeys.every((key) => Boolean(result?.phaseEvidenceRefs?.[key])),
  phase1226AuthorizationAndShadow: result?.phase1226?.ownerAuthorizationValid === true
    && result?.phase1226?.guardedShadowTestExecuted === true
    && result?.phase1226?.providerCallsMade === false
    && result?.phase1226?.secretRead === false,
  phase1227Intake: result?.phase1227?.shadowTestResultIngested === true
    && result?.phase1227?.traceLedgerGenerated === true
    && result?.phase1227?.failureLedgerGenerated === true
    && result?.phase1227?.boundaryResultRecorded === true,
  phase1228FailureRollback: result?.phase1228?.failureClassificationGenerated === true
    && result?.phase1228?.rollbackVerified === true
    && result?.phase1228?.disableSwitchVerified === true
    && result?.phase1228?.defaultBehaviorRestored === true,
  phase1229NoFlagPassed: result?.phase1229?.noFlagRegressionPassed === true
    && result?.phase1229?.chatDefaultUnchanged === true
    && result?.phase1229?.chatGatewayExecuteDefaultUnchanged === true
    && result?.phase1229?.providerRuntimeDefaultEnabled === false,
  phase1230IntegrationBehindFlag: result?.phase1230?.mainChainCandidateIntegrated === true
    && result?.phase1230?.limitedMainChainCandidateIntegrationBehindFlag === true
    && result?.phase1230?.mainChainDefaultEnabled === false
    && result?.phase1230?.flagGated === true
    && result?.phase1230?.rollbackReady === true,
  phase1231ChatDefault: result?.phase1231?.chatIntegratedAsCandidateOnly === true
    && result?.phase1231?.chatDefaultChanged === false
    && result?.phase1231?.chatDefaultEnabled === false,
  phase1232ExecuteDefault: result?.phase1232?.chatGatewayExecuteCandidateOnly === true
    && result?.phase1232?.chatGatewayExecuteDefaultChanged === false
    && result?.phase1232?.chatGatewayExecuteDefaultEnabled === false,
  phase1233Boundary: result?.phase1233?.providerCallsMade === false
    && result?.phase1233?.credentialRefBypassed === false
    && result?.phase1233?.secretRead === false
    && result?.phase1233?.quotaBypassed === false
    && result?.phase1233?.budgetBypassed === false
    && result?.phase1233?.selectableGateBypassed === false,
  phase1234MissionControl: result?.phase1234?.missionControlCandidateStatusPreviewGenerated === true
    && result?.phase1234?.readOnlyPreview === true
    && result?.phase1234?.noRealExecuteButton === true
    && result?.phase1234?.noProviderButton === true
    && result?.phase1234?.noDeployButton === true
    && result?.phase1234?.characterModuleRestored === false,
  phase1235Closure: result?.phase1235?.mainChainCandidateClosureGenerated === true
    && result?.phase1235?.taijiBeidouMainChainCandidate === true
    && result?.phase1235?.mainChainCandidateIntegrated === true
    && result?.phase1235?.mainChainDefaultEnabled === false
    && result?.phase1235?.flagGated === true
    && result?.phase1235?.rollbackReady === true
    && result?.phase1235?.noFlagRegressionPassed === true
    && result?.phase1235?.productionReadyClaimed === false,
};

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1226-1235-AIO",
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
