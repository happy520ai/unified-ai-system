import { scoreRound2Quality } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readModeResults, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...scoreRound2Quality({ modeResults: readModeResults() }),
  ...baseSafety(),
};
writeJson(paths.quality, result);
writeDoc("phase951-route-quality-score-round2.md", {
  title: "Phase951 Route Quality Score Round 2",
  goal: "Score Round 2 real route evidence without promoting blocked or failed routes.",
  facts: [`averageQualityScore=${result.averageQualityScore}`, `scoreOutOfRangeCount=${result.scoreOutOfRangeCount}`],
  boundaries: ["Scores are evidence output, not runtime tuning."],
  outputs: [paths.quality],
});
console.log(JSON.stringify(result, null, 2));
