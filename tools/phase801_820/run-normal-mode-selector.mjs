import { classifyTaskPressure, scoreCandidates, selectNormalModeModel } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const pressure = classifyTaskPressure({ taskId: "normal-selector", userTask: "普通中文问答", mode: "normal", constraints: { preferLowLatency: true }, context: { estimatedInputTokens: 120 } });
const scored = scoreCandidates(index.models || [], { mode: "normal", pressure });
const selection = selectNormalModeModel(scored);
const result = {
  ...selection,
  completed: true,
  selectedModelId: selection.selected?.modelId ?? null,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/normal-mode-selector-result.json", result);
writeText("docs/phase806-normal-mode-selector.md", phaseDoc({
  phase: "Phase806",
  title: "Normal Mode Selector",
  goal: "Select one runtime-eligible smoke-passed selectable model for normal mode dry-run routing.",
  facts: [`selectedModelId=${result.selectedModelId}`],
  boundaries: ["selection is recommendation only", "providerCallsMade=false"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/normal-mode-selector-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
