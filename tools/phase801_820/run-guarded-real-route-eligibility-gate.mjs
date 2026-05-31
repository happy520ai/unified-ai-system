import { evaluateGuardedRealRouteEligibility } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const simulator = readJson("apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json");
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const route = simulator.routes?.[0] || {};
const selectedModel = (index.runtimeCandidates || []).find((model) => model.modelId === route.selected?.primaryModelId);
const gate = evaluateGuardedRealRouteEligibility(route, {
  selectedModel,
  approval: {
    providerCallsAllowed: false,
    maxRequests: null,
    credentialRef: null,
    allowSecretRead: false,
  },
});
const result = {
  ...gate,
  completed: true,
  defaultEnabled: false,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/guarded-real-route-eligibility-gate-result.json", result);
writeText("docs/phase817-guarded-real-route-eligibility-gate.md", phaseDoc({
  phase: "Phase817",
  title: "Guarded Real Route Eligibility Gate",
  goal: "Validate real route prerequisites without executing provider calls.",
  facts: [`realRouteEligible=${result.realRouteEligible}`, "realRouteExecutionAllowed=false"],
  boundaries: ["approval required", "credentialRef required", "maxRequests required", "defaultEnabled=false"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/guarded-real-route-eligibility-gate-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
