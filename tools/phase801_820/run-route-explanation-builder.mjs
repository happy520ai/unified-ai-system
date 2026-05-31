import { buildRouteExplanation, classifyTaskPressure } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const taskPressure = classifyTaskPressure({ taskId: "route-explanation", userTask: "解释路由推荐", mode: "normal", context: { estimatedInputTokens: 300 } });
const explanation = buildRouteExplanation({
  routeId: "route-explanation",
  mode: "normal",
  taskPressure,
  selected: { primaryModelId: "nvidia/llama-3.1-nemotron-nano-8b-v1" },
});
const result = {
  phase: "Phase815",
  completed: true,
  routeExplanationBuilderReady: true,
  routeExplanation: explanation,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/route-explanation-builder-result.json", result);
writeText("docs/phase815-route-explanation-builder.md", phaseDoc({
  phase: "Phase815",
  title: "Route Explanation Builder",
  goal: "Build user-visible route explanations with pressure, mode, selected model, and dry-run boundary.",
  facts: [explanation],
  boundaries: ["route explanation is not execution evidence"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/route-explanation-builder-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
