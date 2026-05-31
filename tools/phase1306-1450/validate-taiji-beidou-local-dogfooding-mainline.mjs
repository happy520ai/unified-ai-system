import {
  batchRanges,
  callableApprovalPath,
  defaultEnableApprovalPath,
  findBlocker,
  futureProductionApprovalPath,
  localRehearsalApprovalPath,
  multiProviderApprovalPath,
  readJsonIfExists,
  resultPath,
  safetyBoundary,
  validationPath,
  writeJson,
} from "./phase1306-1450-common.mjs";

const result = await readJsonIfExists(resultPath, null);
const defaultApproval = await readJsonIfExists(defaultEnableApprovalPath, null);
const callableApproval = await readJsonIfExists(callableApprovalPath, null);
const multiProviderApproval = await readJsonIfExists(multiProviderApprovalPath, null);
const localApproval = await readJsonIfExists(localRehearsalApprovalPath, null);
const futureApproval = await readJsonIfExists(futureProductionApprovalPath, null);

const checks = {
  resultExists: Boolean(result),
  completedTrue: result?.completed === true,
  recommendedSealedTrue: result?.recommended_sealed === true,
  blockerNull: result?.blocker === null,
  upstreamPhase1256To1305Verified: result?.upstreamPhase1256To1305Verified === true,
  allRecommendedSealed: result?.allRecommendedSealed === true,
  allBlockersNull: result?.allBlockersNull === true,
  defaultApprovalValid: defaultApproval?.phaseRange === "Phase1306-1325"
    && defaultApproval?.decision === "approved_guarded_default_enable_execution"
    && defaultApproval?.ownerApproved === true
    && defaultApproval?.ownerPersonallyApprovedDefaultEnable === true
    && defaultApproval?.allowDefaultEnableExecution === true
    && defaultApproval?.allowMainChainDefaultEnable === true
    && defaultApproval?.allowProviderCall === false
    && defaultApproval?.allowSecretRead === false
    && defaultApproval?.allowProviderRuntimeDefaultEnable === false
    && defaultApproval?.allowDeploy === false
    && defaultApproval?.allowCommit === false
    && defaultApproval?.allowPush === false,
  callableApprovalValid: callableApproval?.phaseRange === "Phase1326-1365"
    && callableApproval?.decision === "approved_controlled_callable_readable_claimable_validation"
    && callableApproval?.ownerApproved === true
    && callableApproval?.allowBoundedProviderCall === true
    && callableApproval?.allowRawSecretRead === false
    && callableApproval?.allowAuthJsonRead === false
    && callableApproval?.allowRawCredentialRefRead === false
    && callableApproval?.allowProductionReadyClaim === false,
  multiProviderApprovalValid: multiProviderApproval?.phaseRange === "Phase1375-1399"
    && multiProviderApproval?.decision === "approved_bounded_multi_provider_stability_evaluation"
    && multiProviderApproval?.ownerApproved === true
    && multiProviderApproval?.allowRealProviderCalls === true
    && multiProviderApproval?.allowRawSecretRead === false
    && multiProviderApproval?.allowAuthJsonRead === false
    && multiProviderApproval?.allowRawCredentialRefRead === false
    && multiProviderApproval?.allowDeploy === false,
  localApprovalValid: localApproval?.phaseRange === "Phase1400-1425"
    && localApproval?.decision === "approved_local_production_readiness_rehearsal_only"
    && localApproval?.targetEnvironment === "local"
    && localApproval?.allowDeploy === false
    && localApproval?.allowProviderCallsForLocalSmoke === false,
  futureApprovalDefaultDenied: futureApproval?.allowProductionDeploy === false
    && futureApproval?.allowPublicLaunch === false
    && futureApproval?.realOneMonthDogfoodingCompleted === false
    && futureApproval?.realTwoMonthDogfoodingCompleted === false,
  defaultEnableExecuted: result?.defaultEnableExecuted === true,
  mainChainDefaultEnabled: result?.mainChainDefaultEnabled === true,
  taijiBeidouDefaultEnabled: result?.taijiBeidouDefaultEnabled === true,
  callableTrue: result?.callable === true,
  readableTrue: result?.readable === true,
  claimableTrue: result?.claimable === true,
  callableScopeBounded: result?.callableScope === "bounded",
  readableScopeCredentialRefRuntimeOnly: result?.readableScope === "credentialRef_runtime_only",
  claimableScopeEvidenceBackedOnly: result?.claimableScope === "evidence_backed_only",
  multiProviderStabilityEvaluated: result?.multiProviderStabilityEvaluated === true,
  costEnvelopeEvaluated: result?.costEnvelopeEvaluated === true,
  failureRecoveryEvaluated: result?.failureRecoveryEvaluated === true,
  localProductionReadinessRehearsed: result?.localProductionReadinessRehearsed === true,
  localDogfoodingStartPacketGenerated: result?.localDogfoodingStartPacketGenerated === true,
  dogfoodingFrameworkReady: result?.dogfoodingFrameworkReady === true,
  dailyWeeklyLedgerTemplatesReady: result?.dailyWeeklyLedgerTemplatesReady === true,
  issueRepairLoopReady: result?.issueRepairLoopReady === true,
  delayedLaunchGateReady: result?.delayedLaunchGateReady === true,
  providerCallsMadeHonest: result?.realProviderCallsMade === false
    && result?.providerScopeMissingForRealCall === true
    && result?.multiProviderEvaluationBlocker === "provider_scope_missing_for_real_multi_provider_test",
  providerCallsMadeWithinApprovalFalseWithoutScope: result?.providerCallsMadeWithinApproval === false,
  providerCallsExceededApprovalFalse: result?.providerCallsExceededApproval === false,
  estimatedCostExceededApprovalFalse: result?.estimatedCostExceededApproval === false,
  unapprovedProviderCalledFalse: result?.unapprovedProviderCalled === false,
  unapprovedModelCalledFalse: result?.unapprovedModelCalled === false,
  requestAttemptCountZeroWithoutScope: result?.requestAttemptCount === 0,
  estimatedCostZeroWithoutScope: result?.estimatedCostUsd === 0,
  costWithinBudget: result?.costWithinBudget === true,
  chatDefaultChangedByApprovedDefaultEnable: result?.chatDefaultChanged === true,
  chatGatewayExecuteDefaultChangedByApprovedDefaultEnable: result?.chatGatewayExecuteDefaultChanged === true,
  providerRuntimeDefaultEnabledFalse: result?.providerRuntimeDefaultEnabled === false,
  secretValueExposedFalse: result?.secretValueExposed === false,
  rawSecretReadByCodexFalse: result?.rawSecretReadByCodex === false,
  authJsonReadFalse: result?.authJsonRead === false,
  rawCredentialRefReadFalse: result?.rawCredentialRefRead === false,
  credentialRefBypassedFalse: result?.credentialRefBypassed === false,
  quotaBypassedFalse: result?.quotaBypassed === false,
  budgetBypassedFalse: result?.budgetBypassed === false,
  selectableGateBypassedFalse: result?.selectableGateBypassed === false,
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
  productionReadyClaimedFalse: result?.productionReadyClaimed === false,
  publicLaunchClaimedFalse: result?.publicLaunchClaimed === false,
  realSemanticValidationClaimedWithoutEvidenceFalse: result?.realSemanticValidationClaimedWithoutEvidence === false,
  ownerLongRunFeedbackClaimedWithoutActualRecordsFalse: result?.ownerLongRunFeedbackClaimedWithoutActualRecords === false,
  realOneMonthDogfoodingCompletedFalse: result?.realOneMonthDogfoodingCompleted === false,
  realTwoMonthDogfoodingCompletedFalse: result?.realTwoMonthDogfoodingCompleted === false,
  realOwnerLongRunFeedbackCollectedFalse: result?.realOwnerLongRunFeedbackCollected === false,
  publicLaunchAllowedFalse: result?.publicLaunchAllowed === false,
  productionDeployExecutedFalse: result?.productionDeployExecuted === false,
};

for (const [key, start, end, aggregateKey] of batchRanges) {
  checks[`${aggregateKey}.completed`] = result?.[aggregateKey]?.completed === true;
  checks[`${aggregateKey}.recommended_sealed`] = result?.[aggregateKey]?.recommended_sealed === true;
  checks[`${aggregateKey}.blocker`] = result?.[aggregateKey]?.blocker === null;
  checks[`${key}.completed`] = result?.[key]?.completed === true;
  checks[`${key}.recommended_sealed`] = result?.[key]?.recommended_sealed === true;
  checks[`${key}.blocker`] = result?.[key]?.blocker === null;
  for (let phaseNumber = start; phaseNumber <= end; phaseNumber += 1) {
    checks[`phase${phaseNumber}Completed`] = result?.[`phase${phaseNumber}`]?.completed === true;
    checks[`phase${phaseNumber}RecommendedSealed`] = result?.[`phase${phaseNumber}`]?.recommended_sealed === true;
    checks[`phase${phaseNumber}BlockerNull`] = result?.[`phase${phaseNumber}`]?.blocker === null;
  }
}

for (const [key, expected] of Object.entries(safetyBoundary())) {
  checks[`boundary.${key}`] = result?.[key] === expected;
}

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1306-1450-AIO",
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
