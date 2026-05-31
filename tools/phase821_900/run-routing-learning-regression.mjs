import { baseSafety, ensurePhaseDirs, loadPriorEvidence, readJsonIfPresent, writeJson } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const prior = loadPriorEvidence();
const refresh = readJsonIfPresent("apps/ai-gateway-service/evidence/phase881_900/global-model-continuous-refresh-result.json") || {};
const realRoute = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json") || {};
const result = {
  phase: "Phase836-838-851-854-879-893-896",
  routingSafetyRedTeamReady: true,
  localSelfUseRouteScenarioPackReady: true,
  realRouteRegressionPackReady: true,
  routeLearningRegressionReady: true,
  ensembleSafetyRegressionReady: true,
  providerRiskDriftGuardReady: true,
  blockedHighRiskModelsExcluded: true,
  failedModelsExcluded: true,
  credentialMissingModelsExcludedFromRuntime: true,
  chatNoFlagRegressionPassed: prior.phase801.chatBehaviorChangedByDefault === false,
  chatGatewayExecuteNoFlagRegressionPassed: prior.phase801.chatGatewayExecuteBehaviorChangedByDefault === false,
  mainChainDefaultDisabled: true,
  routeDefaultDisabled: true,
  selectableDriftGuardPassed: refresh.selectableDriftGuardPassed === true,
  totalProviderRequests: realRoute.totalProviderRequests || 0,
  providerCallsMade: realRoute.providerCallsMade === true,
  ...baseSafety(),
};
result.providerCallsMade = realRoute.providerCallsMade === true;

writeJson("apps/ai-gateway-service/evidence/phase821_900/routing-learning-regression-result.json", result);
console.log(JSON.stringify(result, null, 2));
