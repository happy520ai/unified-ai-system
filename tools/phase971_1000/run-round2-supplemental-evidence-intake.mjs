import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase971-1000-common.mjs";
import { intakeRound2SupplementalEvidence } from "../../packages/model-routing-engine/src/index.js";

ensurePhaseDirs();

const result = intakeRound2SupplementalEvidence({
  phase941960Final: readJsonIfPresent(paths.phase941960Final) || {},
  phase961965Audit: readJsonIfPresent(paths.phase961965Audit) || {},
  phase966970Final: readJsonIfPresent(paths.phase966970Final) || {},
  phase966970Attempts: readJsonIfPresent(paths.phase966970Attempts) || {},
});

writeJson(paths.supplementalIntake, result);
writeDoc(`${paths.supplementalIntake.replace("apps/ai-gateway-service/evidence/phase971_1000/", "docs/phase971-1000/").replace(".json", ".md")}`, {
  title: "Phase971 Round2 Supplemental Evidence Intake",
  goal: "Read Phase941-960, Phase961-965, and Phase966-970 evidence without mutating old records.",
  facts: [`phase941960OriginalBlocker=${result.phase941960OriginalBlocker}`, `phase966970GodRerunPassed=${result.phase966970GodRerunPassed}`],
  boundaries: ["Read-only evidence intake.", "No Provider calls."],
  outputs: [paths.supplementalIntake],
});
logResult(result);
