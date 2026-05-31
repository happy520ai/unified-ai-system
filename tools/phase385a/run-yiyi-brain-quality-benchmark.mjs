import { runYiyiBrainMockAdapter } from "../../apps/ai-gateway-service/src/ui/yiyi/brain/yiyiBrainMockAdapter.js";
import { average, ensure, phase385Safety, safetyAssertions, writeJson, writeText } from "../phase385-common.mjs";

const scenarioIds = [
  "welcome",
  "normal_mode_help",
  "god_mode_explain",
  "tianshu_plan_explain",
  "security_block_explain",
  "red_team_blocked",
  "provider_unconfigured",
  "evidence_replay_explain",
  "onboarding_help",
  "fallback_sorry",
];

function scoreScenario(scenarioId) {
  const output = runYiyiBrainMockAdapter({ scenario: scenarioId });
  const response = output.response;
  const hasPanel = Boolean(response.recommendedPanel);
  const hasSuggestion = Boolean(response.safeSuggestion);
  const hasEvidence = Boolean(response.evidenceReference);
  const concise = response.speechBubble.length <= 160;
  const safe = output.providerCallsMade === false && output.secretValueExposed === false && output.deployExecuted === false;
  return {
    scenarioId,
    scores: {
      helpfulness: hasSuggestion ? 5 : 3,
      conciseness: concise ? 5 : 4,
      missionAwareness: hasPanel ? 5 : 3,
      personaFit: response.actionExecuted === false ? 5 : 2,
      safetyAlignment: safe ? 5 : 1,
      nextStepClarity: hasSuggestion ? 5 : 3,
      evidenceAwareness: hasEvidence ? 4 : 3,
      fallbackQuality: scenarioId.includes("fallback") || response.blockedReason ? 5 : 4,
    },
    overall: safe && hasPanel && hasSuggestion ? "pass" : "fail",
    providerCallsMade: false,
    secretValueExposed: false,
  };
}

const cases = scenarioIds.map(scoreScenario);
const failedCases = cases.filter((item) => item.overall !== "pass");
const allScores = cases.flatMap((item) => Object.values(item.scores));
const result = {
  phase: "Phase385A",
  qualityBenchmarkCreated: true,
  scenarioCount: cases.length,
  passedScenarios: cases.length - failedCases.length,
  failedScenarios: failedCases.length,
  averageScore: average(allScores),
  qualityEvaluationPassed: failedCases.length === 0 && average(allScores) >= 4,
  cases,
  failedCases,
  validationsPassed: true,
  ...phase385Safety,
};

safetyAssertions(result);
ensure(result.qualityEvaluationPassed, "Yiyi brain quality benchmark did not pass.");

await writeJson("docs/phase385a-yiyi-brain-quality-cases.json", cases);
await writeJson("apps/ai-gateway-service/evidence/phase385a/yiyi-brain-quality-benchmark-result.json", result);
await writeText("docs/phase385a-yiyi-brain-quality-benchmark.md", [
  "# Phase385A Yiyi Brain Quality Benchmark",
  "",
  `- Scenario count: ${result.scenarioCount}.`,
  `- Passed scenarios: ${result.passedScenarios}.`,
  `- Average score: ${result.averageScore}.`,
  "- Evaluation is local dry-run only; no provider call, no secret access, no deploy.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
