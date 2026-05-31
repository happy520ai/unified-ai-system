import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { buildPhase941960BlockerClearanceSupplement } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();
const result = buildPhase941960BlockerClearanceSupplement({ intake: readJsonIfPresent(paths.supplementalIntake) || {} });
writeJson(paths.blockerClearance, result);
writeDoc("docs/phase971-1000/phase972-phase941960-blocker-clearance-supplement.md", {
  title: "Phase972 Phase941-960 Blocker Clearance Supplement",
  goal: "Clear the Round 2 God blocker by supplemental evidence while preserving original failure.",
  facts: [result.safeWording, `blockerCanBeClearedBySupplement=${result.blockerCanBeClearedBySupplement}`],
  boundaries: ["No original evidence rewrite.", "No runtime policy application."],
  outputs: [paths.blockerClearance],
});
logResult(result);
