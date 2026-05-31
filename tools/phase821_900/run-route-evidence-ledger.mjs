import { buildRouteEvidenceLedger } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, readJsonIfPresent, writeJson } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const realRouteResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json") || {};
const soakResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json") || {};
const ensembleResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase861_880/god-tianshu-ensemble-optimization-final-result.json") || {};
const result = {
  ...buildRouteEvidenceLedger({
    realRoutes: realRouteResult.routes || [],
    surrogateRoutes: soakResult.routes || [],
    ensembleRoutes: ensembleResult.routes || [],
  }),
  ...baseSafety(),
};
result.providerCallsMade = result.entries.some((entry) => entry.requestAttemptCount > 0);

writeJson("apps/ai-gateway-service/evidence/phase821_840/route-evidence-ledger-result.json", result);
writeJson("model-routing/evidence/route-evidence-ledger.json", result);
console.log(JSON.stringify(result, null, 2));
