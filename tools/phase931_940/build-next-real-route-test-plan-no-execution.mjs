import { buildNextRealRouteTestPlan } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...buildNextRealRouteTestPlan({ phase916930: readJsonIfPresent(paths.phase916RequiredFinal) || {} }),
  ...baseSafety(),
};

writeJson(paths.nextPlan, result);
writeDoc("phase939-next-real-route-test-plan-no-execution.md", {
  title: "Phase939 Next Real Route Test Plan No Execution",
  goal: "Design the next bounded real route test round without executing it.",
  facts: [
    `recommendedNextPhase=${result.recommendedNextPhase}`,
    `suggestedMaxProviderRequests=${result.suggestedMaxProviderRequests}`,
    `executeNow=${result.executeNow}`,
  ],
  boundaries: ["Approval required.", "No Provider request in this phase."],
  outputs: [paths.nextPlan],
});
console.log(JSON.stringify(result, null, 2));
