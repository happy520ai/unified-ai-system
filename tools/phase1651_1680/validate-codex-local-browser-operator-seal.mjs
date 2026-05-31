import { buildValidationResult, paths, writeJson } from "./browser-operator-common.mjs";

const result = await buildValidationResult();
await writeJson(paths.validation, result);
await writeJson(paths.seal, result.seal);

console.log(JSON.stringify({
  phase: "Phase1680",
  phaseRange: result.phaseRange,
  routeChoice: result.routeChoice,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  codexBrowserOperatorImplemented: result.codexBrowserOperatorImplemented,
  localServiceDetected: result.localServiceDetected,
  browserLaunched: result.browserLaunched,
  missionControlOpened: result.missionControlOpened,
  normalModeWalked: result.normalModeWalked,
  godModeWalked: result.godModeWalked,
  tianshuModeWalked: result.tianshuModeWalked,
  securityShieldWalked: result.securityShieldWalked,
  evidenceReplayWalked: result.evidenceReplayWalked,
  providerGateWalkedOrSkippedWithReason: result.providerGateWalkedOrSkippedWithReason,
  localOnlySampleTaskDryRunExecuted: result.localOnlySampleTaskDryRunExecuted,
  screenshotsGenerated: result.screenshotsGenerated,
  domSnapshotsGenerated: result.domSnapshotsGenerated,
  operationTraceLedgerGenerated: result.operationTraceLedgerGenerated,
  dailyUseRecordDraftGenerated: result.dailyUseRecordDraftGenerated,
  ownerSubjectiveFieldsLeftBlank: result.ownerSubjectiveFieldsLeftBlank,
  ownerManualFeedbackClaimed: result.ownerManualFeedbackClaimed,
  ownerUseCycleCompleted: result.ownerUseCycleCompleted,
  providerCallsMade: result.providerCallsMade,
  unresolvedP0Count: result.unresolvedP0Count,
  unresolvedP1Count: result.unresolvedP1Count,
}, null, 2));

if (result.blocker) process.exitCode = 1;
