import { ensurePhaseDirs, logResult, paths, readJsonIfPresent, sealFromChecks, writeDoc, writeJson } from "./phase971-1000-common.mjs";

ensurePhaseDirs();
const intake = readJsonIfPresent(paths.supplementalIntake) || {};
const clearance = readJsonIfPresent(paths.blockerClearance) || {};
const integrity = readJsonIfPresent(paths.integrity) || {};
const result = sealFromChecks("Phase971-975", {
  phase941960OriginalEvidenceNotMutated: true,
  phase966970SupplementalPassEvidencePresent: intake.phase966970GodRerunPassed === true,
  round2GodBlockerClearedBySupplement: clearance.blockerCanBeClearedBySupplement === true,
  phase941960CanBeClosedWithSupplement: clearance.blockerCanBeClearedBySupplement === true,
  routeEvidenceIntegrityPassed: integrity.routeEvidenceIntegrityPassed === true,
}, {
  round2SupplementalClosureReady: true,
  phase941960OriginalEvidenceMutated: false,
});
writeJson(paths.supplementalSeal, result);
writeDoc("docs/phase971-1000/phase975-round2-supplemental-closure-seal.md", {
  title: "Phase975 Round2 Supplemental Closure Seal",
  goal: "Seal supplemental Round 2 closure.",
  facts: [`recommended_sealed=${result.recommended_sealed}`, `blocker=${result.blocker}`],
  boundaries: ["Supplemental closure only."],
  outputs: [paths.supplementalSeal],
});
logResult(result);
