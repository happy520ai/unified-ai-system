import {
  approvalPath,
  batchRanges,
  findBlocker,
  matchesBoundary,
  readJsonIfExists,
  resultPath,
  validationPath,
  writeJson,
} from "./phase1256-1305-common.mjs";

const result = await readJsonIfExists(resultPath, null);
const approval = await readJsonIfExists(approvalPath, null);

const checks = {
  resultExists: Boolean(result),
  approvalExists: Boolean(approval),
  approvalPhaseRange: approval?.phaseRange === "Phase1256-1305",
  approvalDecision: approval?.decision === "approved_limited_enable_behind_flag_and_default_readiness_assessment_only",
  approvalOwnerApproved: approval?.ownerApproved === true,
  approvalAllowsRequiredScope: approval?.allowApprovalFinalization === true
    && approval?.allowLimitedEnablePreparation === true
    && approval?.allowGuardedLimitedEnableBehindFlag === true
    && approval?.allowLimitedEnableResultClosure === true
    && approval?.allowDefaultEnableReadinessAssessment === true,
  approvalBlocksForbiddenScope: approval?.allowDefaultEnableExecution === false
    && approval?.allowProviderCall === false
    && approval?.allowSecretRead === false
    && approval?.allowAuthJsonRead === false
    && approval?.allowRawCredentialRefRead === false
    && approval?.allowCredentialRefBypass === false
    && approval?.allowQuotaBypass === false
    && approval?.allowBudgetBypass === false
    && approval?.allowSelectableGateBypass === false
    && approval?.allowChatDefaultChange === false
    && approval?.allowChatGatewayExecuteDefaultChange === false
    && approval?.allowMainChainDefaultEnable === false
    && approval?.allowProviderRuntimeDefaultEnable === false
    && approval?.allowDeploy === false
    && approval?.allowRelease === false
    && approval?.allowTag === false
    && approval?.allowArtifactUpload === false
    && approval?.allowCommit === false
    && approval?.allowPush === false
    && approval?.allowWorkspaceCleanClaim === false
    && approval?.allowProductionReadyClaim === false
    && approval?.allowRealSemanticValidationClaim === false,
  allRecommendedSealed: result?.allRecommendedSealed === true,
  allBlockersNull: result?.allBlockersNull === true,
  approvalFinalizationCompleted: result?.approvalFinalizationCompleted === true,
  limitedEnablePreparationCompleted: result?.limitedEnablePreparationCompleted === true,
  guardedLimitedEnableBehindFlagExecuted: result?.guardedLimitedEnableBehindFlagExecuted === true,
  limitedEnableResultClosureCompleted: result?.limitedEnableResultClosureCompleted === true,
  defaultEnableReadinessAssessmentCompleted: result?.defaultEnableReadinessAssessmentCompleted === true,
  defaultEnableExecutedFalse: result?.defaultEnableExecuted === false,
  mainChainDefaultEnabledFalse: result?.mainChainDefaultEnabled === false,
  providerRuntimeDefaultEnabledFalse: result?.providerRuntimeDefaultEnabled === false,
  chatDefaultChangedFalse: result?.chatDefaultChanged === false,
  chatGatewayExecuteDefaultChangedFalse: result?.chatGatewayExecuteDefaultChanged === false,
  providerCallsMadeFalse: result?.providerCallsMade === false,
  secretReadFalse: result?.secretRead === false,
  authJsonReadFalse: result?.authJsonRead === false,
  rawCredentialRefReadFalse: result?.rawCredentialRefRead === false,
  secretValueExposedFalse: result?.secretValueExposed === false,
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
  realSemanticValidationClaimedFalse: result?.realSemanticValidationClaimed === false,
  productionReadyClaimedFalse: result?.productionReadyClaimed === false,
  boundaryMatches: matchesBoundary(result),
};

for (const [, start, end] of batchRanges) {
  for (let phaseNumber = start; phaseNumber <= end; phaseNumber += 1) {
    checks[`phase${phaseNumber}Completed`] = result?.[`phase${phaseNumber}`]?.completed === true;
    checks[`phase${phaseNumber}RecommendedSealed`] = result?.[`phase${phaseNumber}`]?.recommended_sealed === true;
    checks[`phase${phaseNumber}BlockerNull`] = result?.[`phase${phaseNumber}`]?.blocker === null;
  }
}

const batchChecks = {
  phase1256To1265: result?.phase1256To1265?.completed === true
    && result?.phase1256To1265?.recommended_sealed === true
    && result?.phase1256To1265?.blocker === null
    && result?.phase1256To1265?.approvalFinalizationCompleted === true,
  phase1266To1275: result?.phase1266To1275?.completed === true
    && result?.phase1266To1275?.recommended_sealed === true
    && result?.phase1266To1275?.blocker === null
    && result?.phase1266To1275?.limitedEnablePreparationCompleted === true
    && result?.phase1266To1275?.limitedEnableExecuted === false,
  phase1276To1285: result?.phase1276To1285?.completed === true
    && result?.phase1276To1285?.recommended_sealed === true
    && result?.phase1276To1285?.blocker === null
    && result?.phase1276To1285?.guardedLimitedEnableBehindFlagExecuted === true
    && result?.phase1276To1285?.mainChainDefaultEnabled === false
    && result?.phase1276To1285?.providerCallsMade === false,
  phase1286To1295: result?.phase1286To1295?.completed === true
    && result?.phase1286To1295?.recommended_sealed === true
    && result?.phase1286To1295?.blocker === null
    && result?.phase1286To1295?.limitedEnableResultClosureCompleted === true
    && result?.phase1286To1295?.noFlagRegressionPassed === true
    && result?.phase1286To1295?.productionReadyClaimed === false,
  phase1296To1305: result?.phase1296To1305?.completed === true
    && result?.phase1296To1305?.recommended_sealed === true
    && result?.phase1296To1305?.blocker === null
    && result?.phase1296To1305?.defaultEnableReadinessAssessmentCompleted === true
    && result?.phase1296To1305?.defaultEnableExecuted === false
    && result?.phase1296To1305?.mainChainDefaultEnabled === false,
};

Object.assign(checks, batchChecks);

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1256-1305-AIO",
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
