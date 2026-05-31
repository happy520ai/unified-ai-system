import { checkExternalProviderAuthenticityCarryForward } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...checkExternalProviderAuthenticityCarryForward({
    phase916930: readJsonIfPresent(paths.phase916RequiredFinal) || {},
    phase912915: readJsonIfPresent(paths.phase912915Final) || {},
    phase901910: readJsonIfPresent(paths.phase901910Final) || {},
  }),
  ...baseSafety(),
};

writeJson(paths.authenticity, result);
writeDoc("phase932-external-provider-authenticity-carry-forward-check.md", {
  title: "Phase932 External Provider Authenticity Carry-forward Check",
  goal: "Verify Phase916-930 external Provider authenticity can be carried forward for audit only.",
  facts: [
    `authenticityCarryForwardPassed=${result.authenticityCarryForwardPassed}`,
    `responseSource=${result.responseSource}`,
  ],
  boundaries: ["No new Provider request.", "Phase901-910 correction remains preserved."],
  outputs: [paths.authenticity],
});
console.log(JSON.stringify(result, null, 2));
