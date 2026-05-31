import { buildRouteRollbackDisablePlan } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, readJsonIfPresent, writeJson } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const failureReport = readJsonIfPresent("apps/ai-gateway-service/evidence/phase821_840/route-failure-classifier-result.json") || {};
const failures = (failureReport.classifications || []).filter((item) => item.responseClassification !== "pass");
const result = {
  ...buildRouteRollbackDisablePlan({ failures }),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase821_840/route-rollback-disable-result.json", result);
console.log(JSON.stringify(result, null, 2));
