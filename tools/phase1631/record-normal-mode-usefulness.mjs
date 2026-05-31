import { buildDailyUseEvidenceRecords, buildValidationResult, paths, writeJson } from "../phase1621_1650/phase1621-1650-owner-daily-use-common.mjs";

const records = buildDailyUseEvidenceRecords();
writeJson(paths.normalModeUsefulnessRecorder, records[paths.normalModeUsefulnessRecorder]);

const result = buildValidationResult();
writeJson(paths.validation, result);
console.log(JSON.stringify({
  phase: "Phase1631",
  completed: result.completed,
  blocker: result.blocker,
  ownerUsefulnessScoreOwnerOnly: records[paths.normalModeUsefulnessRecorder].ownerUsefulnessScoreOwnerOnly,
}, null, 2));

if (result.blocker) process.exitCode = 1;
