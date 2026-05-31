import { buildNetworkAttemptEvidenceSchema } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const result = {
  ...buildNetworkAttemptEvidenceSchema(),
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase901_910/network-attempt-evidence-schema-result.json", result);
writePhaseDoc("phase903-network-attempt-evidence-schema.md", phaseDoc({
  phase: "Phase903",
  title: "Network Attempt Evidence Schema",
  goal: "Define the future minimum schema for a confirmed external Provider API attempt.",
  facts: [`requiredFieldCount=${result.requiredFields.length}`],
  boundaries: ["schema only", "no Provider call"],
  outputs: ["apps/ai-gateway-service/evidence/phase901_910/network-attempt-evidence-schema-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
