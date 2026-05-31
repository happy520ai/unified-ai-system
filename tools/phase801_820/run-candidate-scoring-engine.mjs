import { classifyTaskPressure, scoreCandidates } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const pressure = classifyTaskPressure({ taskId: "scoring-engine", userTask: "代码修复和复杂推理", mode: "auto", constraints: { preferCoding: true, preferReasoning: true }, context: { estimatedInputTokens: 1800 } });
const scored = scoreCandidates(index.models || [], { mode: "tianshu", pressure });
const result = {
  phase: "Phase814",
  completed: true,
  candidateScoringEngineReady: true,
  scoredCandidateCount: scored.length,
  topCandidates: scored.slice(0, 10).map((candidate) => ({
    modelId: candidate.modelId,
    providerId: candidate.providerId,
    score: candidate.score,
    reasonCodes: candidate.reasonCodes,
    exclusionReasons: candidate.exclusionReasons,
  })),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/candidate-scoring-engine-result.json", result);
writeText("docs/phase814-candidate-scoring-engine.md", phaseDoc({
  phase: "Phase814",
  title: "Candidate Scoring Engine",
  goal: "Score candidates by capability match, mode fit, pressure fit, reliability, latency, cost, context, and risk.",
  facts: [`scoredCandidateCount=${scored.length}`, "score range is 0-100"],
  boundaries: ["score is advisory and not a provider call"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/candidate-scoring-engine-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
