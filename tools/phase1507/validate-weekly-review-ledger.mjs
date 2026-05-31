import { boundary, makeResult, paths, readJson, writeJson } from "../phase1506_1530/phase1506-1530-common.mjs";

const weeklyTemplate = readJson(paths.weeklyReviewTemplate, null);
const checks = {
  weeklyTemplateExists: Boolean(weeklyTemplate),
  recordType: weeklyTemplate?.recordType === "weekly_review_template",
  ownerReviewedFalse: weeklyTemplate?.ownerReviewed === false,
  dogfoodingCompletedFalse: weeklyTemplate?.dogfoodingCompleted === false,
  realHumanFeedbackCollectedFalse: weeklyTemplate?.realHumanFeedbackCollected === false,
};
const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
const result = makeResult("Phase1507", {
  phaseName: "Weekly Review Schema v1",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  weeklyReviewSchemaReady: blocker === null,
  checks,
  ...boundary,
});

writeJson(paths.weeklyReviewValidation, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  weeklyReviewSchemaReady: result.weeklyReviewSchemaReady,
}, null, 2));

if (blocker) process.exitCode = 1;
