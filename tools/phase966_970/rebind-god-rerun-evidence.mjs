import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase966-970-common.mjs";
import { buildGodRerunEvidenceRebind } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();

const originalGodResult = readJsonIfPresent(paths.phase941960God) || {};
const rerunResult = readJsonIfPresent(paths.rerun) || {};
const result = {
  ...buildGodRerunEvidenceRebind({ originalGodResult, rerunResult }),
  ...baseSafety(),
};

writeJson(paths.rebind, result);
writeDoc("phase969-god-rerun-evidence-rebind-blocker-review.md", {
  title: "Phase969 God Rerun Evidence Rebind Blocker Review",
  goal: "Bind supplemental rerun evidence without mutating Phase941-960 original failed evidence.",
  facts: [
    `rebindPerformed=${result.rebindPerformed}`,
    `originalPhase941960GodResult=${result.originalPhase941960GodResult}`,
    `phase941960BlockerCanBeClearedBySupplement=${result.phase941960BlockerCanBeClearedBySupplement}`,
  ],
  boundaries: ["Original Phase941-960 evidence remains unchanged.", "No runtime policy application."],
  outputs: [paths.rebind],
});

console.log(JSON.stringify(result, null, 2));
