import { buildRegressionResult } from "../phase1701_1720/owner-p1-ui-repair-common.mjs";

const result = await buildRegressionResult();
console.log(JSON.stringify({
  phase: "Phase1718",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  regressionRecheckPassed: result.regressionRecheckPassed,
  ownerP1UiRepairCompleted: result.ownerP1UiRepairCompleted,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
}, null, 2));

if (result.blocker) process.exitCode = 1;
