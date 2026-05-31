import { buildOwnerFeedbackArtifacts } from "../phase1681_1700/owner-feedback-common.mjs";

const result = buildOwnerFeedbackArtifacts();

console.log(JSON.stringify({
  phase: "Phase1683",
  ownerManualNotePreserved: result.ownerManualNotePreserved,
  ownerManualNoteSummary: result.ownerManualNoteSummary,
  p0BugCount: result.p0BugCount,
  p1BugCount: result.p1BugCount,
  p2BugCount: result.p2BugCount,
  p3BugCount: result.p3BugCount,
}, null, 2));
