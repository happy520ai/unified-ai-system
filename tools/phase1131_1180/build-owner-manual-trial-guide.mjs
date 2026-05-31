import { runStep } from "./phase1131-1180-common.mjs";

const result = await runStep("build-owner-manual-trial-guide");
console.log(JSON.stringify(result, null, 2));
const expectedOwnerFeedbackBlocker = result.blocker === "owner_real_manual_feedback_missing" || result.partialCompletionAccepted === true;
if (result.recommended_sealed === false && !expectedOwnerFeedbackBlocker) {
  process.exitCode = 1;
}
