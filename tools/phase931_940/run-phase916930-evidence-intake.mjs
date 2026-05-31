import { intakePhase916930RouteQualityEvidence } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...intakePhase916930RouteQualityEvidence({
    requiredFinal: readJsonIfPresent(paths.phase916RequiredFinal),
    canonicalFinal: readJsonIfPresent(paths.phase916CanonicalFinal),
  }),
  ...baseSafety(),
};

writeJson(paths.intake, result);
writeDoc("phase931-phase916930-evidence-intake.md", {
  title: "Phase931 Phase916-930 Evidence Intake",
  goal: "Read the bounded real route quality test evidence without executing any new Provider call.",
  facts: [
    `realRouteEvidenceCount=${result.realRouteEvidenceCount}`,
    `totalProviderRequests=${result.totalProviderRequests}`,
    `responseSource=${result.responseSource}`,
  ],
  boundaries: ["No Provider call.", "No selectable mutation."],
  outputs: [paths.intake],
});
console.log(JSON.stringify(result, null, 2));
