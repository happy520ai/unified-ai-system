import { buildStaticValidationResult, paths, writeJson } from "./owner-p1-ui-repair-common.mjs";

const result = await buildStaticValidationResult();
await writeJson(paths.validation, result);

console.log(JSON.stringify({
  phase: "Phase1701-1720",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  ownerP1UiRepairCompleted: result.ownerP1UiRepairCompleted,
  ownerPerceivedClarityTargetAddressed: result.ownerPerceivedClarityTargetAddressed,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
  checks: result.checks,
}, null, 2));

if (result.blocker) process.exitCode = 1;
