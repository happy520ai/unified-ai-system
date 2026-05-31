import { compareRound2Modes } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readModeResults, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...compareRound2Modes({ modeResults: readModeResults() }),
  ...baseSafety(),
};
writeJson(paths.comparison, result);
writeDoc("phase952-mode-comparison-round2.md", {
  title: "Phase952 Mode Comparison Round 2",
  goal: "Compare Round 2 modes across quality, cost, latency, reliability, and instruction following.",
  facts: [`modeComparisonReady=${result.modeComparisonReady}`, `sampleSizeStillLimited=${result.sampleSizeStillLimited}`],
  boundaries: ["Small sample; recommendation remains preliminary."],
  outputs: [paths.comparison],
});
console.log(JSON.stringify(result, null, 2));
