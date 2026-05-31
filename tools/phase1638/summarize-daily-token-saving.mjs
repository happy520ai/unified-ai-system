import { buildDailyUseEvidenceRecords, buildValidationResult, paths, writeJson } from "../phase1621_1650/phase1621-1650-owner-daily-use-common.mjs";

const records = buildDailyUseEvidenceRecords();
writeJson(paths.tokenSavingSummary, records[paths.tokenSavingSummary]);

const result = buildValidationResult();
writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: "Phase1638",
  completed: result.completed,
  blocker: result.blocker,
  tokenSavingComputed: records[paths.tokenSavingSummary].tokenSavingComputed,
  measuredFromOwnerTasks: records[paths.tokenSavingSummary].measuredFromOwnerTasks,
}, null, 2));

if (result.blocker) process.exitCode = 1;
