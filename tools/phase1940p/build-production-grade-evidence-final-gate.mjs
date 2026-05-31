import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const paths = {
  phase1932p: "apps/ai-gateway-service/evidence/phase1932p/guarded-real-provider-stability-test-result.json",
  phase1933p: "apps/ai-gateway-service/evidence/phase1933p/single-provider-stability-boundary-seal-result.json",
  phase1934p: "apps/ai-gateway-service/evidence/phase1934p/three-mode-real-task-closure-result.json",
  phase1935p: "apps/ai-gateway-service/evidence/phase1935p/boss-mode-owner-pilot-intake-result.json",
  phase1936p: "apps/ai-gateway-service/evidence/phase1936p/p0-clear-p1-plan-gate-result.json",
  phase1937p: "apps/ai-gateway-service/evidence/phase1937p/rollback-drill-evidence-result.json",
  phase1938p: "apps/ai-gateway-service/evidence/phase1938p/continuous-safety-regression-gate-result.json",
  phase1939p: "apps/ai-gateway-service/evidence/phase1939p/no-human-explanation-usability-gate-result.json",
};
const evidence = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, readJson(path).data ?? {}]));

const criteria = {
  phase1932pRealProviderTestPassed: evidence.phase1932p.recommended_sealed === true && evidence.phase1932p.realProviderCallExecuted === true && Number(evidence.phase1932p.successfulResponseCount) === 3,
  phase1933pSingleProviderBoundarySealed: evidence.phase1933p.recommended_sealed === true && evidence.phase1933p.singleProviderBoundarySealed === true,
  phase1934pThreeModeClosurePassed: evidence.phase1934p.recommended_sealed === true,
  phase1935pOwnerPilotPassed: evidence.phase1935p.ownerPilotPassed === true,
  phase1936pP0Clear: Number(evidence.phase1936p.p0BlockerCount ?? 1) === 0 && evidence.phase1936p.recommended_sealed === true,
  phase1937pRollbackDrillPassed: evidence.phase1937p.recommended_sealed === true && evidence.phase1937p.rollbackStepsValidated === true,
  phase1938pRegressionsPassed: evidence.phase1938p.recommended_sealed === true && evidence.phase1938p.regressionsPassed === true,
  phase1939pUsabilityPassed: evidence.phase1939p.recommended_sealed === true && evidence.phase1939p.noHumanExplanationUsabilityPassed === true,
};

let blocker = null;
if (!criteria.phase1932pRealProviderTestPassed) blocker = "provider_stability_not_verified";
else if (!criteria.phase1935pOwnerPilotPassed) blocker = "owner_pilot_records_missing";
else if (!criteria.phase1936pP0Clear) blocker = "p0_blockers_remain";
else if (!criteria.phase1939pUsabilityPassed) blocker = "owner_understanding_not_yet_proven";
else if (!Object.values(criteria).every(Boolean)) blocker = "production_grade_evidence_incomplete";

const sealed = blocker === null;
const result = {
  phase: "Phase1940P",
  name: "Production-Grade Evidence Final Gate",
  completed: true,
  recommended_sealed: sealed,
  blocker,
  claimLevel: sealed ? "local_production_candidate" : "blocked_evidence_closure",
  criteria,
  evidencePaths: paths,
  providerId: evidence.phase1932p.providerId ?? "nvidia",
  modelId: evidence.phase1932p.modelId ?? "nvidia/llama-3.3-nemotron-super-49b-v1",
  requestAttemptCount: Number(evidence.phase1932p.requestAttemptCount ?? 0),
  successfulResponseCount: Number(evidence.phase1932p.successfulResponseCount ?? 0),
  failedResponseCount: Number(evidence.phase1932p.failedResponseCount ?? 0),
  p0BlockerCount: Number(evidence.phase1936p.p0BlockerCount ?? 0),
  ownerPilotPassed: evidence.phase1935p.ownerPilotPassed === true,
  rollbackDrillType: evidence.phase1937p.rollbackDrillType ?? "dry-run",
  regressionsPassed: evidence.phase1938p.regressionsPassed === true,
  noHumanExplanationUsabilityPassed: evidence.phase1939p.noHumanExplanationUsabilityPassed === true,
  publicProductionReadyClaimed: false,
  multiProviderProductionStableClaimed: false,
  commercialReadyClaimed: false,
  providerCallsMadeThisPhase: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
};

writeJson("apps/ai-gateway-service/evidence/phase1940p/production-grade-evidence-final-gate-result.json", result);
console.log(JSON.stringify(result, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
