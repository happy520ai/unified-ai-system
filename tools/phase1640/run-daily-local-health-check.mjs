import { buildDailyUseEvidenceRecords, buildValidationResult, paths, writeJson } from "../phase1621_1650/phase1621-1650-owner-daily-use-common.mjs";

const records = buildDailyUseEvidenceRecords();
writeJson(paths.dailyHealthCheck, records[paths.dailyHealthCheck]);

const result = buildValidationResult();
writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: "Phase1640",
  completed: result.completed,
  blocker: result.blocker,
  serviceHealth: records[paths.dailyHealthCheck].serviceHealth,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
}, null, 2));

if (result.blocker) process.exitCode = 1;
