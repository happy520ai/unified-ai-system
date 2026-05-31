import { runSelectableCandidateGate } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const smokeClassification = readJson("provider-expansion/smoke/smoke-classification-result.json");
const gate = runSelectableCandidateGate({ smokeClassification });
const result = {
  ...gate,
  completed: true,
  selectableCandidateGateReady: true,
  ...baseSafety(),
};
writeJson("provider-expansion/candidates/selectable-candidate-gate-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/selectable-candidate-gate-result.json", result);
writeText("docs/phase781-800/phase790-selectable-candidate-gate.md", phaseDoc({
  phase: "Phase790",
  title: "Selectable Candidate Gate",
  goal: "只允许 smoke pass 结果进入 selectable_candidate，不自动进入 selectable。",
  facts: [`selectableCandidateModelCount=${result.selectableCandidateModelCount}`, "newSelectableModelsAdded=0"],
  boundaries: ["Phase821+ required for selectable admission", "selectableModelCountUnchanged=true"],
  outputs: ["provider-expansion/candidates/selectable-candidate-gate-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
