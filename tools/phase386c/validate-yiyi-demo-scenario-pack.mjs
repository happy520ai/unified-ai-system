import {
  assertPhase386SafetyFlags,
  ensure,
  makeResult,
  phase386Contract,
  phase386Safety,
  phase386Scenarios,
  writeJson,
  writeText,
} from "../phase386-common.mjs";

ensure(phase386Scenarios.length === 10, "Scenario pack must include 10 scenarios.");

const scenarioIds = new Set(phase386Scenarios.map((scenario) => scenario.scenarioId));
for (const step of phase386Contract.showcaseSteps) {
  ensure(scenarioIds.has(step), `Scenario missing for showcase step: ${step}`);
}

for (const scenario of phase386Scenarios) {
  ensure(typeof scenario.title === "string" && scenario.title.length > 0, `Missing title: ${scenario.scenarioId}`);
  ensure(typeof scenario.yiyiLine === "string" && scenario.yiyiLine.length > 12, `Missing Yiyi line: ${scenario.scenarioId}`);
  ensure(typeof scenario.emotionState === "string", `Missing emotion state: ${scenario.scenarioId}`);
  ensure(typeof scenario.behaviorState === "string", `Missing behavior state: ${scenario.scenarioId}`);
  ensure(typeof scenario.highlightPanel === "string", `Missing highlight panel: ${scenario.scenarioId}`);
  ensure(Array.isArray(scenario.safetyBadges) && scenario.safetyBadges.length >= 2, `Missing safety badges: ${scenario.scenarioId}`);
  ensure(scenario.providerCallsMade === false, `providerCallsMade must be false: ${scenario.scenarioId}`);
  ensure(scenario.secretValueExposed === false, `secretValueExposed must be false: ${scenario.scenarioId}`);
  ensure(scenario.deployExecuted === false, `deployExecuted must be false: ${scenario.scenarioId}`);
}

const result = makeResult({
  phase: "Phase386C",
  demoScenarioPackCreated: true,
  scenarioCount: phase386Scenarios.length,
  scenarioIds: [...scenarioIds],
  ...phase386Safety,
});
assertPhase386SafetyFlags(result);

await writeJson("docs/phase386c-yiyi-demo-scenarios.json", {
  phase: "Phase386C",
  scenarios: phase386Scenarios,
});
await writeText(
  "docs/phase386c-yiyi-demo-scenario-pack.md",
  [
    "# Phase386C Yiyi Demo Scenario Pack",
    "",
    "The scenario pack maps the Guided Showcase into ten demo scenes. Each scene contains a Yiyi line, emotion state, behavior state, highlight panel, visible safety badges, and explicit no-provider/no-secret/no-deploy flags.",
    "",
    ...phase386Scenarios.map((scenario, index) => `${index + 1}. ${scenario.title}: ${scenario.yiyiLine}`),
    "",
    "All scenarios remain local dry-run preview scenes.",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase386c/yiyi-demo-scenario-pack-result.json", result);

console.log(JSON.stringify(result, null, 2));
