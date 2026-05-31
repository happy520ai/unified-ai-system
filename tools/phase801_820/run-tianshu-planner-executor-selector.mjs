import { classifyTaskPressure, scoreCandidates, selectTianshuPlannerExecutor } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const pressure = classifyTaskPressure({ taskId: "tianshu-selector", userTask: "复杂规划任务", mode: "tianshu", constraints: { preferReasoning: true }, context: { estimatedInputTokens: 2400 } });
const scored = scoreCandidates(index.models || [], { mode: "tianshu", pressure });
const selection = selectTianshuPlannerExecutor(scored);
const result = {
  ...selection,
  completed: true,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/tianshu-planner-executor-selector-result.json", result);
writeText("docs/phase808-tianshu-planner-executor-selector.md", phaseDoc({
  phase: "Phase808",
  title: "Tianshu Planner / Executor Selector",
  goal: "Select dry-run planner and executor recommendations for complex tasks.",
  facts: [`plannerModelId=${result.plannerModelId}`, `executorCount=${result.executorModelIds.length}`],
  boundaries: ["planner/executor recommendations are not runtime calls"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/tianshu-planner-executor-selector-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
