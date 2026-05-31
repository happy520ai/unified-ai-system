import { buildDailyUseEvidenceRecords, buildValidationResult, paths, writeJson } from "../phase1621_1650/phase1621-1650-owner-daily-use-common.mjs";

const records = buildDailyUseEvidenceRecords();
writeJson(paths.failureFrictionLedger, records[paths.failureFrictionLedger]);

const result = buildValidationResult();
writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: "Phase1635",
  completed: result.completed,
  blocker: result.blocker,
  failureFrictionLedgerReady: records[paths.failureFrictionLedger].failureFrictionLedgerReady,
}, null, 2));

if (result.blocker) process.exitCode = 1;
