import { buildDailyUseEvidenceRecords, buildValidationResult, paths, writeJson } from "../phase1621_1650/phase1621-1650-owner-daily-use-common.mjs";

const records = buildDailyUseEvidenceRecords();
writeJson(paths.week1IssueClassification, records[paths.week1IssueClassification]);
writeJson(paths.week1P0P1RepairQueue, records[paths.week1P0P1RepairQueue]);
writeJson(paths.week1P2P3DeferredLedger, records[paths.week1P2P3DeferredLedger]);

const result = buildValidationResult();
writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: "Phase1642",
  completed: result.completed,
  blocker: result.blocker,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
}, null, 2));

if (result.blocker) process.exitCode = 1;
