import { resolve } from "node:path";
import { phaseDir, readJsonIfExists, writeJson } from "./phase1201-common.mjs";

const resultPath = resolve(phaseDir, "phase1201-1220-final-result.json");
const result = readJsonIfExists(resultPath, null);

const validation = {
  phaseRange: "Phase1201-1220",
  completed: true,
  recommended_sealed: false,
  blocker: null,
  finalResultPresent: Boolean(result),
  ownerFeedbackCollected: result?.ownerFeedbackCollected === true,
  ownerFeedbackAuthentic: result?.ownerFeedbackAuthentic === true,
  noFakeHumanFeedback: result?.noFakeHumanFeedback === true,
  codexSelfTestCountedAsOwnerFeedback: result?.codexSelfTestCountedAsOwnerFeedback === true,
  p0p1BlockerPresent: result?.p0p1BlockerPresent === true,
  p2p3FixCandidatesGenerated: result?.p2p3FixCandidatesGenerated === true,
  actualFixesAppliedThisPhase: result?.actualFixesAppliedThisPhase === true,
  providerCallsMade: result?.providerCallsMade === true,
  secretValueExposed: result?.secretValueExposed === true,
  deployExecuted: result?.deployExecuted === true
};

if (!result) {
  validation.blocker = "phase1201_1220_final_result_missing";
} else if (result.ownerFeedbackCollected !== true) {
  validation.blocker = "owner_real_manual_feedback_missing";
} else if (result.ownerFeedbackAuthentic !== true) {
  validation.blocker = "owner_feedback_authenticity_failed";
} else if (result.p0p1BlockerPresent === true) {
  validation.blocker = "owner_feedback_p0_p1_blocker_present";
} else if (result.noFakeHumanFeedback !== true || result.codexSelfTestCountedAsOwnerFeedback !== false) {
  validation.blocker = "fake_owner_feedback_guard_failed";
} else if (result.providerCallsMade || result.secretValueExposed || result.deployExecuted) {
  validation.blocker = "safety_boundary_failed";
}

validation.recommended_sealed = validation.blocker === null;

writeJson(resolve(phaseDir, "phase1201-1220-validation-result.json"), validation);
console.log(JSON.stringify({
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  ownerFeedbackCollected: validation.ownerFeedbackCollected
}, null, 2));

if (!validation.recommended_sealed) {
  process.exitCode = 1;
}
