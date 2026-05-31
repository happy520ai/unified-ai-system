import {
  findBlocker,
  matchesBoundary,
  phaseKeys,
  readJsonIfExists,
  resultPath,
  validationPath,
  writeJson,
} from "./phase1216-1225-common.mjs";

const result = await readJsonIfExists(resultPath, null);

const checks = {
  resultExists: Boolean(result),
  phase1216Completed: result?.phase1216?.completed === true,
  phase1217Completed: result?.phase1217?.completed === true,
  phase1218Completed: result?.phase1218?.completed === true,
  phase1219Completed: result?.phase1219?.completed === true,
  phase1220Completed: result?.phase1220?.completed === true,
  phase1221Completed: result?.phase1221?.completed === true,
  phase1222Completed: result?.phase1222?.completed === true,
  phase1223Completed: result?.phase1223?.completed === true,
  phase1224Completed: result?.phase1224?.completed === true,
  phase1225Completed: result?.phase1225?.completed === true,
  allRecommendedSealed: result?.allRecommendedSealed === true,
  expectedAuthorizationGateAccepted: result?.allBlockersNullOrExpectedAuthorizationBlock === true,
  contractDefined: result?.taijiBeidouMainChainCandidateContractDefined === true,
  mainChainCandidateContractReady: result?.mainChainCandidateContractReady === true,
  shadowAdapterDesigned: result?.shadowAdapterDesigned === true,
  shadowAdapterImplemented: result?.shadowAdapterImplemented === true,
  shadowAdapterReady: result?.shadowAdapterReady === true,
  shadowAdapterDefaultEnabledFalse: result?.shadowAdapterDefaultEnabled === false,
  requiredFlagsDefaultFalse: result?.requiredFlags?.TAIJI_BEIDOU_SHADOW_ENABLED === false
    && result?.requiredFlags?.TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED === false,
  flagGated: result?.flagGated === true,
  rollbackPlanExists: result?.rollbackPlanExists === true,
  disableSwitchExists: result?.disableSwitchExists === true,
  rollbackReady: result?.rollbackReady === true,
  approvalGateGenerated: result?.approvalGateGenerated === true,
  approvalGateReady: result?.approvalGateReady === true,
  testExecutedFalse: result?.testExecuted === false,
  mainChainIntegrationExecutedFalse: result?.mainChainIntegrationExecuted === false,
  providerCallsMadeFalse: result?.providerCallsMade === false,
  secretReadFalse: result?.secretRead === false,
  authJsonReadFalse: result?.authJsonRead === false,
  chatDefaultChangedFalse: result?.chatDefaultChanged === false,
  chatGatewayExecuteDefaultChangedFalse: result?.chatGatewayExecuteDefaultChanged === false,
  deployExecutedFalse: result?.deployExecuted === false,
  boundaryMatches: matchesBoundary(result),
  phaseEvidencePresent: phaseKeys.every((key) => Boolean(result?.phaseEvidenceRefs?.[key])),
  phase1216ContractDefined: result?.phase1216?.taijiBeidouMainChainCandidateContractDefined === true,
  phase1217NoFlagBaseline: result?.phase1217?.noFlagRegressionBaselineGenerated === true && result?.phase1217?.noFlagRegressionBaselinePassed === true,
  phase1218ShadowDesigned: result?.phase1218?.shadowAdapterDesigned === true,
  phase1219ShadowImplementedDefaultOff: result?.phase1219?.shadowAdapterImplemented === true && result?.phase1219?.shadowAdapterDefaultEnabled === false,
  phase1220RollbackVerifier: result?.phase1220?.rollbackVerifierGenerated === true && result?.phase1220?.rollbackPlanExists === true && result?.phase1220?.disableSwitchExists === true,
  phase1221ApprovalReviewDefaults: result?.phase1221?.approvalGateGenerated === true
    && result?.phase1221?.ownerApproved === false
    && result?.phase1221?.mainChainIntegrationAllowed === false
    && result?.phase1221?.providerCallAllowed === false
    && result?.phase1221?.chatModificationAllowed === false
    && result?.phase1221?.chatGatewayExecuteModificationAllowed === false
    && result?.phase1221?.deploymentAllowed === false,
  phase1222ChatGateDesignOnly: result?.phase1222?.chatCandidateGateDesignReady === true && result?.phase1222?.chatDefaultChanged === false,
  phase1223ExecuteGateDesignOnly: result?.phase1223?.chatGatewayExecuteCandidateGateDesignReady === true && result?.phase1223?.chatGatewayExecuteDefaultChanged === false,
  phase1224PreparationOnly: result?.phase1224?.testPlanGenerated === true
    && result?.phase1224?.testCommandPreviewGenerated === true
    && result?.phase1224?.rollbackCommandPreviewGenerated === true
    && result?.phase1224?.testExecuted === false,
  phase1225AuthorizationMissingExpected: result?.phase1225?.authorizationMissing === true
    && result?.phase1225?.testExecuted === false
    && result?.phase1225?.mainChainIntegrationExecuted === false
    && result?.phase1225?.providerCallsMade === false,
};

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1216-1225-AIO",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker: blocker === null ? null : blocker,
  expectedBlocker: result?.phase1225?.authorizationMissing === true ? "expected_authorization_gate" : null,
  checks,
};

await writeJson(validationPath, validation);
console.log(JSON.stringify({
  phase: validation.phase,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  expectedBlocker: validation.expectedBlocker,
}, null, 2));

if (blocker) process.exitCode = 1;
