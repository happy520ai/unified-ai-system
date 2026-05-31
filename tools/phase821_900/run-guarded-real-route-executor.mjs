import { runGuardedRealRouteExecutor } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadCapabilityIndex, loadCredentialState, loadRouteAuthorization, writeJson, writePhaseDoc, phaseDoc } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const capabilityIndex = loadCapabilityIndex();
const credentialState = loadCredentialState();
const authorization = loadRouteAuthorization();
const result = {
  ...runGuardedRealRouteExecutor({
    capabilityIndex,
    authorization,
    credentialReady: credentialState.credentialReady,
    credentialRef: credentialState.credentialRef,
  }),
  credentialState,
  ...baseSafety(),
};
result.providerCallsMade = result.routes.some((route) => route.providerCallsMade === true);

writeJson("apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json", result);
writeJson("model-routing/runtime/guarded-real-route-executor-result.json", result);
writePhaseDoc("phase824-840-guarded-real-route-execution.md", phaseDoc({
  phase: "Phase824-840",
  title: "Guarded Real Route Execution",
  goal: "Execute real route only when CredentialRef and budget gates pass; otherwise record an honest gate block.",
  facts: [
    `credentialReady=${credentialState.credentialReady}`,
    `providerCallsMade=${result.providerCallsMade}`,
    `totalProviderRequests=${result.totalProviderRequests}`,
    `blocker=${result.blocker}`,
  ],
  boundaries: [
    "maxTotalProviderRequests=30",
    "maxRetriesPerRequest=0",
    "rawSecretRead=false",
    "selectable candidates remain dry-run only",
  ],
  outputs: ["apps/ai-gateway-service/evidence/phase821_840/guarded-real-route-executor-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
