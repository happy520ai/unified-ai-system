import { canonMapPath, ensure, fileExists, phase380Safety, readCanonMap, readScenarioLines, writeArtifacts } from "../phase380-common.mjs";

const map = await readCanonMap();
const scenarios = await readScenarioLines();
const requiredEmotionStates = ["calm", "focused", "curious", "happy", "worried", "guard", "blocked", "encouraging", "fallback_sorry"];

ensure(fileExists(canonMapPath), "Missing emotion behavior canon map.");
for (const state of requiredEmotionStates) {
  ensure(map.some((item) => item.emotionState === state), `Missing emotion state mapping: ${state}`);
}
ensure(map.every((item) => item.authorityLevel === "presentation_and_guidance_only"), "Map must keep presentation authority.");
ensure(map.every((item) => Array.isArray(item.canonReference) && item.canonReference.length > 0), "Each map item needs canon references.");
ensure(map.every((item) => scenarios.some((scenario) => scenario.scenarioId === item.scenarioId)), "Each map item needs scenario line binding.");
ensure(map.every((item) => item.forbiddenActions.includes("read_secret") || item.forbiddenActions.includes("deploy")), "Forbidden actions must stay visible.");
ensure(!JSON.stringify(map).includes("canExecuteActions\":true"), "Map must not escalate action authority.");

const result = {
  phase: "Phase380E",
  emotionBehaviorCanonMapCreated: true,
  mappedEmotionStates: requiredEmotionStates,
  mappingCount: map.length,
  forbiddenActionsPreserved: true,
  ...phase380Safety,
  validationPassed: true,
};

await writeArtifacts({
  reportPath: "docs/phase380e-yiyi-emotion-behavior-canon-integration.md",
  resultPath: "apps/ai-gateway-service/evidence/phase380e/yiyi-emotion-behavior-canon-map-result.json",
  result,
  reportLines: [
    "# Phase380E Yiyi Emotion + Behavior Canon Integration",
    "",
    "- Added mapping from scenario lines to emotion state, behavior state, canon references, and forbidden actions.",
    "- Every required emotion state is mapped.",
    "- Authority remains presentation_and_guidance_only.",
    "- Safety boundary overrides any future canon conflict.",
  ],
});

console.log(JSON.stringify(result, null, 2));
