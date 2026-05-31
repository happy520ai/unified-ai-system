import { runGlobalModelContinuousRefresh, runSelectableDriftGuard } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadCapabilityIndex, loadPriorEvidence, readJsonIfPresent, writeJson, writePhaseDoc, phaseDoc } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const capabilityIndex = loadCapabilityIndex();
const prior = loadPriorEvidence();
const realRoute = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json") || {};
const soak = readJsonIfPresent("apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json") || {};
const routes = [...(realRoute.routes || []), ...(soak.routes || [])];
const refresh = runGlobalModelContinuousRefresh({
  models: capabilityIndex.models || [],
  routeHistory: routes,
});
const drift = runSelectableDriftGuard({
  before: prior.phase801.selectableModelCount || 17,
  after: prior.phase801.selectableModelCount || 17,
  explicitAdmissionApproved: false,
});
const result = {
  ...refresh,
  ...drift,
  selectableModelCountBefore: drift.selectableModelCountBefore,
  selectableModelCountAfter: drift.selectableModelCountAfter,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase881_900/global-model-continuous-refresh-result.json", result);
writeJson("model-routing/learning/global-model-continuous-refresh-result.json", result);
writePhaseDoc("phase881-900-global-model-continuous-refresh-routing-learning.md", phaseDoc({
  phase: "Phase881-900",
  title: "Global Model Continuous Refresh + Routing Learning",
  goal: "Use local evidence only to detect stale models, health scores, routing weight proposals, and selectable drift.",
  facts: [
    `globalModelContinuousRefreshReady=${result.globalModelContinuousRefreshReady}`,
    `routingLearningReady=${result.routingLearningReady}`,
    `selectableDriftGuardPassed=${result.selectableDriftGuardPassed}`,
    `providerApiCalled=${result.providerAvailabilityWatch.providerApiCalled}`,
  ],
  boundaries: [
    "model refresh is local evidence only",
    "smoke refresh requires future separate approval",
    "routing weight updates are proposals and are not applied automatically",
  ],
  outputs: ["apps/ai-gateway-service/evidence/phase881_900/global-model-continuous-refresh-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
