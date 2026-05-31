import { buildOwnerFeedbackArtifacts } from "../phase1681_1700/owner-feedback-common.mjs";

const result = buildOwnerFeedbackArtifacts();

console.log(JSON.stringify({
  phase: "Phase1682",
  ownerSubjectiveFieldsValidated: result.ownerSubjectiveFieldsValidated,
  ownerPerceivedUsefulness: result.ownerPerceivedUsefulness,
  ownerPerceivedSpeed: result.ownerPerceivedSpeed,
  ownerPerceivedClarity: result.ownerPerceivedClarity,
  ownerTrustLevel: result.ownerTrustLevel,
  keepUsingTomorrow: result.keepUsingTomorrow,
  missingFields: result.missingFields,
  blocker: result.ownerSubjectiveFieldsValidated ? null : "owner_manual_feedback_missing",
}, null, 2));

if (!result.ownerSubjectiveFieldsValidated) process.exitCode = 1;
