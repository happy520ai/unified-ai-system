import { buildOwnerFeedbackArtifacts, paths } from "../phase1681_1700/owner-feedback-common.mjs";

const result = buildOwnerFeedbackArtifacts();

console.log(JSON.stringify({
  phase: "Phase1681",
  ownerManualFeedbackIntakeReady: result.ownerManualFeedbackIntakeReady,
  ownerManualFeedbackCount: result.ownerManualFeedbackCount,
  ownerManualNotePreserved: result.ownerManualNotePreserved,
  sourceJsonValid: result.sourceJsonValid,
  missingFields: result.missingFields,
  normalizedOwnerFeedbackPath: paths.normalizedOwnerFeedback,
}, null, 2));
