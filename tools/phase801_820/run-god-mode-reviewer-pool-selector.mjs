import { classifyTaskPressure, scoreCandidates, selectGodModeReviewerPool } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const pressure = classifyTaskPressure({ taskId: "god-selector", userTask: "安全风险审查", mode: "god", constraints: { preferReasoning: true }, context: { estimatedInputTokens: 900 } });
const scored = scoreCandidates(index.models || [], { mode: "god", pressure });
const selection = selectGodModeReviewerPool(scored);
const result = {
  ...selection,
  completed: true,
  reviewerPoolModelIds: selection.reviewerPool.map((candidate) => candidate.modelId),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/god-mode-reviewer-pool-selector-result.json", result);
writeText("docs/phase807-god-mode-reviewer-pool-selector.md", phaseDoc({
  phase: "Phase807",
  title: "God Mode Reviewer Pool Selector",
  goal: "Build a dry-run reviewer pool from runtime-eligible models.",
  facts: [`reviewerPoolSize=${result.reviewerPoolModelIds.length}`, `adjudicatorModelId=${result.adjudicatorModelId}`],
  boundaries: ["reviewer pool is not called by this phase"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/god-mode-reviewer-pool-selector-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
