import { compareOwnerFeedbackBeforeAfter } from "../phase1721_1740/owner-second-retest-common.mjs";

const result = await compareOwnerFeedbackBeforeAfter();
console.log(JSON.stringify({
  phase: "Phase1736",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  beforeAfterComparisonGenerated: result.beforeAfterComparisonGenerated,
  oldClarity: result.oldClarity,
  oldTrust: result.oldTrust,
  newClarity: result.newClarity,
  newTrust: result.newTrust,
  ownerUseCycleCompleted: result.ownerUseCycleCompleted,
}, null, 2));

if (result.blocker) process.exitCode = 1;
