import { buildRound2TuningRecommendation } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...buildRound2TuningRecommendation({
    quality: readJsonIfPresent(paths.quality) || {},
    comparison: readJsonIfPresent(paths.comparison) || {},
    fit: readJsonIfPresent(paths.modelFit) || {},
  }),
  ...baseSafety(),
};
writeJson(paths.tuning, result);
writeDoc("phase954-route-policy-tuning-recommendation.md", {
  title: "Phase954 Route Policy Tuning Recommendation",
  goal: "Generate Round 2 route policy tuning recommendations without applying them.",
  facts: [`routePolicyTuningRecommendationReady=${result.routePolicyTuningRecommendationReady}`, `routePolicyAppliedToRuntime=${result.routePolicyAppliedToRuntime}`],
  boundaries: ["Recommendation only.", "No runtime change."],
  outputs: [paths.tuning],
});
console.log(JSON.stringify(result, null, 2));
