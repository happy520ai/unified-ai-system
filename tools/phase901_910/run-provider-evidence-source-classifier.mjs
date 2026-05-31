import { classifyProviderEvidenceSources } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadRouteEvidence, phaseDoc, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const routeEvidence = loadRouteEvidence();
const result = {
  ...classifyProviderEvidenceSources(routeEvidence),
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase901_910/provider-evidence-source-classifier-result.json", result);
writePhaseDoc("phase902-provider-evidence-source-classifier.md", phaseDoc({
  phase: "Phase902",
  title: "Provider Evidence Source Classifier",
  goal: "Classify Phase821-900 route evidence sources without reading secrets.",
  facts: [`routeExecutionEvidenceCount=${result.routeExecutionEvidenceCount}`, `providerCallClaimCount=${result.providerCallClaimCount}`],
  boundaries: ["allowed evidence files only", "no auth.json read"],
  outputs: ["apps/ai-gateway-service/evidence/phase901_910/provider-evidence-source-classifier-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
