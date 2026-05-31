import { runYiyiBrainMockAdapter, yiyiBrainMockScenarios } from "../../apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainMockAdapter.js";
import { ensure, phase381Safety, readJson, writeJson, writeText } from "../phase381-common.mjs";

const scenarioIds = await readJson("docs/phase381e-yiyi-brain-mock-scenarios.json");
const scenarioResults = scenarioIds.map((scenario) => {
  const output = runYiyiBrainMockAdapter({ scenario });
  return {
    scenario,
    emotionState: output.response.emotionState,
    behaviorState: output.response.behaviorState,
    speechBubblePresent: Boolean(output.response.speechBubble),
    recommendedPanel: output.response.recommendedPanel,
    safeSuggestionPresent: Boolean(output.response.safeSuggestion),
    providerCallsMade: output.providerCallsMade,
    secretValueExposed: output.secretValueExposed,
    deployExecuted: output.deployExecuted,
    actionExecuted: output.actionExecuted,
  };
});

ensure(Object.keys(yiyiBrainMockScenarios).length >= 10, "Mock adapter must support at least 10 scenarios.");
ensure(scenarioResults.every((item) => item.speechBubblePresent && item.safeSuggestionPresent), "Every scenario needs speech and safe suggestion.");
ensure(scenarioResults.every((item) => item.providerCallsMade === false), "Mock adapter must not call providers.");
ensure(scenarioResults.every((item) => item.actionExecuted === false), "Mock adapter must not execute actions.");

const result = {
  phase: "Phase381E",
  mockAdapterCreated: true,
  mockScenariosCreated: true,
  scenarioCount: scenarioResults.length,
  scenarioResults,
  validationPassed: true,
  ...phase381Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase381e/yiyi-brain-mock-adapter-result.json", result);
await writeText("docs/phase381e-yiyi-brain-mock-adapter.md", [
  "# Phase381E Yiyi Brain Mock Adapter",
  "",
  "- Simulates Yiyi Brain responses with local rules only.",
  "- Covers welcome, normal, God Mode, Tianshu, security block, red-team blocked, provider unconfigured, evidence replay, fallback, and onboarding.",
  "- Does not use model-backed generation and does not call providers.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
