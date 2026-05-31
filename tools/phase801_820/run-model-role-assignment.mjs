import { buildModelRoleAssignment } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const roleAssignment = buildModelRoleAssignment(index.models || []);
const result = {
  ...roleAssignment,
  completed: true,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/model-role-assignment-result.json", result);
writeText("docs/phase805-model-role-assignment-taxonomy.md", phaseDoc({
  phase: "Phase805",
  title: "Model Role Assignment Taxonomy",
  goal: "Assign routing roles such as default_chat, reasoning, god_reviewer, and tianshu_planner.",
  facts: [`roleCount=${result.roles.length}`, `assignmentCount=${result.assignments.length}`],
  boundaries: ["role assignment does not imply runtime execution"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/model-role-assignment-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
