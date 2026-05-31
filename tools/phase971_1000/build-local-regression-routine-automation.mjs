import { ensurePhaseDirs, logResult, paths, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildLocalRegressionRoutineAutomation } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildLocalRegressionRoutineAutomation();
writeJson(paths.regressionRoutineJson, result);
writeDoc(paths.regressionRoutine, {
  title: "Local Regression Routine",
  goal: "Provide daily and weekly local self-use regression commands.",
  facts: [...result.dailyCommands, ...result.weeklyCommands],
  boundaries: ["No Provider calls by this routine unless a future phase explicitly approves them."],
  outputs: [paths.regressionRoutineJson],
});
writeDoc("docs/phase971-1000/phase986-local-regression-routine-automation.md", {
  title: "Phase986 Local Regression Routine Automation",
  goal: "Generate local self-use regression runbook.",
  facts: [`localRegressionRoutineReady=${result.localRegressionRoutineReady}`],
  boundaries: ["Routine only."],
  outputs: [paths.regressionRoutine, paths.regressionRoutineJson],
});
logResult(result);
