import { buildDailyUseEvidenceRecords, buildValidationResult, paths, writeJson } from "../phase1621_1650/phase1621-1650-owner-daily-use-common.mjs";

const records = buildDailyUseEvidenceRecords();
writeJson(paths.conceptFieldObservationRecorder, records[paths.conceptFieldObservationRecorder]);

const result = buildValidationResult();
writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: "Phase1627",
  completed: result.completed,
  blocker: result.blocker,
  conceptFieldObservationRecorderReady: result.conceptFieldObservationRecorderReady,
}, null, 2));

if (result.blocker) process.exitCode = 1;
