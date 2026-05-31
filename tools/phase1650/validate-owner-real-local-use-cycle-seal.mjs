import { buildValidationResult, paths, writeJson } from "../phase1621_1650/phase1621-1650-owner-daily-use-common.mjs";

const result = buildValidationResult();
writeJson(paths.validation, result);
writeJson(paths.seal, result.seal);

console.log(JSON.stringify({
  phase: "Phase1650",
  phaseRange: result.phaseRange,
  routeChoice: result.routeChoice,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  ownerDailyUseLedgerActivated: result.ownerDailyUseLedgerActivated,
  dailyStartFlowReady: result.dailyStartFlowReady,
  dailyEndReviewFlowReady: result.dailyEndReviewFlowReady,
  realTaskIntakeSchemaReady: result.realTaskIntakeSchemaReady,
  missionControlUsePathRecorderReady: result.missionControlUsePathRecorderReady,
  contextGatewayTokenSavingRecorderReady: result.contextGatewayTokenSavingRecorderReady,
  conceptFieldObservationRecorderReady: result.conceptFieldObservationRecorderReady,
  evidenceReplayObservationRecorderReady: result.evidenceReplayObservationRecorderReady,
  securityShieldErrorRecorderReady: result.securityShieldErrorRecorderReady,
  ownerManualNotesIntakeReady: result.ownerManualNotesIntakeReady,
  automatedBrowserRecheckPassed: result.automatedBrowserRecheckPassed,
  regressionRecheckPassed: result.regressionRecheckPassed,
  fakeHumanFeedbackDetected: result.fakeHumanFeedbackDetected,
  automatedEvidenceNotClaimedAsHuman: result.automatedEvidenceNotClaimedAsHuman,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
  ownerUseCycleFrameworkReady: result.ownerUseCycleFrameworkReady,
  ownerUseCycleCompleted: result.ownerUseCycleCompleted,
  realDailyLedgerCount: result.realDailyLedgerCount,
  ownerManualNotesCount: result.ownerManualNotesCount,
}, null, 2));

if (result.blocker) process.exitCode = 1;
