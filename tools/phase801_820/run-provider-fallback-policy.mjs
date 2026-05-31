import { buildProviderFallbackPolicy, classifyTaskPressure, scoreCandidates } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const pressure = classifyTaskPressure({ taskId: "fallback-policy", userTask: "Provider fallback route", mode: "auto", constraints: { preferReasoning: true }, context: { estimatedInputTokens: 800 } });
const scored = scoreCandidates(index.models || [], { mode: "tianshu", pressure });
const selected = scored.find((candidate) => candidate.runtimeEligible);
const fallback = buildProviderFallbackPolicy(scored, selected?.modelId);
const result = {
  ...fallback,
  completed: true,
  selectedModelId: selected?.modelId ?? null,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/provider-fallback-policy-result.json", result);
writeText("docs/phase813-provider-fallback-policy.md", phaseDoc({
  phase: "Phase813",
  title: "Provider Fallback Policy",
  goal: "Build a fallback chain from selectable smoke-passed runtime candidates.",
  facts: [`fallbackCount=${result.fallbackChain.length}`, `selectedModelId=${result.selectedModelId}`],
  boundaries: ["fallback chain is recommendation only"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/provider-fallback-policy-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
