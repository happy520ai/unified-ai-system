import { lockRound2EligibleModelPool } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...lockRound2EligibleModelPool({
    phase916930: readJsonIfPresent(paths.phase916930Final) || {},
    phase931940: readJsonIfPresent(paths.phase931940Final) || {},
    usabilityMatrix: readJsonIfPresent(paths.usabilityMatrix) || {},
  }),
  ...baseSafety(),
};

writeJson(paths.eligiblePool, result);
writeDoc("phase943-eligible-model-pool-lock.md", {
  title: "Phase943 Eligible Model Pool Lock",
  goal: "Lock the Round 2 eligible NVIDIA test pool without modifying selectable state.",
  facts: [
    `globalSelectableModelBaseline=${result.globalSelectableModelBaseline}`,
    `round2EligiblePoolCount=${result.round2EligiblePoolCount}`,
    `selectableModifiedThisPhase=${result.selectableModifiedThisPhase}`,
  ],
  boundaries: ["No selectable mutation.", "Failed/high-risk/credential-missing models remain excluded."],
  outputs: [paths.eligiblePool],
});
console.log(JSON.stringify(result, null, 2));
