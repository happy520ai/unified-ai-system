import { buildRouteQualityScoringReport } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, readJsonIfPresent, writeJson } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const realRouteResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json") || {};
const soakResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json") || {};
const routes = [...(realRouteResult.routes || []), ...(soakResult.routes || [])];
const result = {
  ...buildRouteQualityScoringReport(routes),
  ...baseSafety(),
};
result.providerCallsMade = routes.some((route) => route.providerCallsMade === true);

writeJson("apps/ai-gateway-service/evidence/phase821_840/route-quality-scoring-result.json", result);
writeJson("model-routing/quality/route-quality-scoring-result.json", result);
console.log(JSON.stringify(result, null, 2));
