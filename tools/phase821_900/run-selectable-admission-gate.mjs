import { evaluateSelectableAdmissionGate } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadPriorEvidence, readJsonIfPresent, writeJson, writePhaseDoc, phaseDoc } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const prior = loadPriorEvidence();
const approval = readJsonIfPresent("model-routing/approvals/phase821_840-selectable-admission.input.json");
const result = {
  ...evaluateSelectableAdmissionGate({
    approval,
    selectableModelCountBefore: prior.phase801.selectableModelCount || 17,
  }),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase821_840/selectable-admission-contract-result.json", result);
writeJson("model-routing/evidence/selectable-admission-gate-result.json", result);
writePhaseDoc("phase821-selectable-admission-approval-contract.md", phaseDoc({
  phase: "Phase821-823",
  title: "Selectable Admission Approval Contract",
  goal: "Define a manual admission contract while keeping selectable unchanged in this phase.",
  facts: [
    `selectableAdmissionApprovalPresent=${result.selectableAdmissionApprovalPresent}`,
    `newSelectableModelsAdded=${result.newSelectableModelsAdded}`,
    `selectableModelCountBefore=${result.selectableModelCountBefore}`,
    `selectableModelCountAfter=${result.selectableModelCountAfter}`,
  ],
  boundaries: result.blockedStatuses.map((status) => `${status} cannot enter guarded runtime`),
  outputs: ["apps/ai-gateway-service/evidence/phase821_840/selectable-admission-contract-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
