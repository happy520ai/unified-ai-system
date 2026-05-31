import { clarifyEligiblePoolScope } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...clarifyEligiblePoolScope({
    phase916930: readJsonIfPresent(paths.phase916RequiredFinal) || {},
    usabilityMatrix: readJsonIfPresent(paths.usabilityMatrix) || {},
  }),
  ...baseSafety(),
};

writeJson(paths.scope, result);
writeDoc("phase933-eligible-pool-scope-clarification.md", {
  title: "Phase933 Eligible Pool Scope Clarification",
  goal: "Clarify that Phase916-930 selectable count 2 is the strict NVIDIA eligible test pool, not global selectable shrinkage.",
  facts: [
    `globalSelectableModelBaseline=${result.globalSelectableModelBaseline}`,
    `phase916930EligibleTestPoolCount=${result.phase916930EligibleTestPoolCount}`,
    `unauthorizedSelectableShrinkage=${result.unauthorizedSelectableShrinkage}`,
  ],
  boundaries: ["No selectable mutation.", "No global model library status changes."],
  outputs: [paths.scope],
});
console.log(JSON.stringify(result, null, 2));
