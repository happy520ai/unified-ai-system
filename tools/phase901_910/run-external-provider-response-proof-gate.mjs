import { evaluateExternalProviderResponseProof } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadRouteEvidence, phaseDoc, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const result = {
  ...evaluateExternalProviderResponseProof(loadRouteEvidence()),
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase901_910/external-provider-response-proof-gate-result.json", result);
writePhaseDoc("phase905-external-provider-response-proof-gate.md", phaseDoc({
  phase: "Phase905",
  title: "External Provider Response Proof Gate",
  goal: "Confirm or conservatively downgrade Provider API authenticity evidence.",
  facts: [
    `externalProviderApiCallConfirmed=${result.externalProviderApiCallConfirmed}`,
    `authenticityClassification=${result.authenticityClassification}`,
  ],
  boundaries: ["no new external Provider request", "unknown/unconfirmed never promoted"],
  outputs: ["apps/ai-gateway-service/evidence/phase901_910/external-provider-response-proof-gate-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
