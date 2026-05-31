import { classifyTaskPressure, resolveModeRoutingPolicy, ROUTING_FIXTURES } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const policies = ROUTING_FIXTURES.map((fixture) => {
  const pressure = classifyTaskPressure(fixture);
  return {
    taskId: fixture.taskId,
    ...resolveModeRoutingPolicy(fixture, pressure),
  };
});
const result = {
  phase: "Phase803",
  completed: true,
  modeRoutingPolicyReady: true,
  policies,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/mode-routing-policy-result.json", result);
writeText("docs/phase803-mode-based-routing-policy.md", phaseDoc({
  phase: "Phase803",
  title: "Mode-based Routing Policy",
  goal: "Resolve normal, god, and tianshu mode routing policy from requested mode and task pressure.",
  facts: [`policyCount=${policies.length}`, "auto mode resolves to normal/god/tianshu"],
  boundaries: ["runtimeEnabled=false", "dry-run only"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/mode-routing-policy-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
