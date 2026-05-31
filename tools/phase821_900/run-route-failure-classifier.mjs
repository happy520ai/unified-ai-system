import { buildRouteFailureClassifierReport } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, readJsonIfPresent, writeJson } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const realRouteResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json") || {};
const result = {
  ...buildRouteFailureClassifierReport(realRouteResult.routes || []),
  ...baseSafety(),
};
result.providerCallsMade = (realRouteResult.routes || []).some((route) => route.providerCallsMade === true);

writeJson("apps/ai-gateway-service/evidence/phase821_840/route-failure-classifier-result.json", result);
console.log(JSON.stringify(result, null, 2));
