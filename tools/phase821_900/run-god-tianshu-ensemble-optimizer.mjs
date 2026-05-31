import { runGodTianshuEnsembleOptimizer } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadCapabilityIndex, loadCredentialState, writeJson, writePhaseDoc, phaseDoc } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const capabilityIndex = loadCapabilityIndex();
const credentialState = loadCredentialState();
const result = {
  ...runGodTianshuEnsembleOptimizer({
    capabilityIndex,
    credentialReady: credentialState.credentialReady,
  }),
  credentialState,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase861_880/god-tianshu-ensemble-optimization-final-result.json", result);
writeJson("model-routing/evidence/god-tianshu-ensemble-optimization-result.json", result);
writePhaseDoc("phase861-880-god-tianshu-ensemble-optimization.md", phaseDoc({
  phase: "Phase861-880",
  title: "God / Tianshu Advanced Model Ensemble Optimization",
  goal: "Build dry-run ensemble policies and guarded real-test gates for God and Tianshu modes.",
  facts: [
    `fixtureCount=${result.fixtureCount}`,
    `godTianshuEnsembleOptimized=${result.godTianshuEnsembleOptimized}`,
    `guardedEnsembleRealTestExecuted=${result.guardedEnsembleRealTestExecuted}`,
    `credentialReady=${credentialState.credentialReady}`,
  ],
  boundaries: [
    "reviewer pool uses runtime eligible models only",
    "guarded real ensemble test remains blocked without CredentialRef",
    "humanReviewed=false",
  ],
  outputs: ["apps/ai-gateway-service/evidence/phase861_880/god-tianshu-ensemble-optimization-final-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
