import { buildModelCapabilityIndex } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadRoutingEvidenceInputs, phaseDoc, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const inputs = loadRoutingEvidenceInputs();
const index = buildModelCapabilityIndex(inputs);
const result = {
  ...index,
  completed: true,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json", result);
writeText("docs/phase804-model-capability-index-builder.md", phaseDoc({
  phase: "Phase804",
  title: "Model Capability Index Builder",
  goal: "Build a routing-safe capability index from local model library evidence only.",
  facts: [
    `selectableModelCount=${result.selectableModelCount}`,
    `smokePassedModelCount=${result.smokePassedModelCount}`,
    `runtimeCandidateCount=${result.runtimeCandidates.length}`,
  ],
  boundaries: ["credential_missing/cataloged models are excluded from runtime candidates"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json"],
}));

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  selectableModelCount: result.selectableModelCount,
  smokePassedModelCount: result.smokePassedModelCount,
  runtimeCandidateCount: result.runtimeCandidates.length,
  providerCallsMade: false,
}, null, 2));
