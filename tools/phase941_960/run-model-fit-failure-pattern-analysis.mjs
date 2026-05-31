import { analyzeModelFitFailurePatterns } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readModeResults, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...analyzeModelFitFailurePatterns({ modeResults: readModeResults() }),
  ...baseSafety(),
};
writeJson(paths.modelFit, result);
writeDoc("phase953-model-fit-failure-pattern-analysis.md", {
  title: "Phase953 Model Fit Failure Pattern Analysis",
  goal: "Analyze model fit and failure patterns without disabling or modifying models.",
  facts: [`modelFitAnalysisReady=${result.modelFitAnalysisReady}`, `failurePatternSummary=${result.failurePatternSummary}`],
  boundaries: ["No model is disabled.", "No selectable state is changed."],
  outputs: [paths.modelFit],
});
console.log(JSON.stringify(result, null, 2));
