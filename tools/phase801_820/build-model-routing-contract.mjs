import { buildModelRoutingContract } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const contract = buildModelRoutingContract();
const result = {
  phase: "Phase801",
  completed: true,
  modelRoutingEngineReady: true,
  contract,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/model-routing-contract-result.json", result);
writeText("docs/phase801-model-routing-contract.md", phaseDoc({
  phase: "Phase801",
  title: "Model Routing Contract",
  goal: "Define the dry-run route input/output contract for task pressure and mode-based model routing.",
  facts: ["defaultRuntimeEnabled=false", "dryRunOnly=true", "selectableAdmissionEnabled=false"],
  boundaries: ["providerCallsMade=false", "secretRead=false", "default chat behavior unchanged"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/model-routing-contract-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
