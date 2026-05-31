import { buildOwnerFeedbackArtifacts, paths } from "../phase1681_1700/owner-feedback-common.mjs";

const result = buildOwnerFeedbackArtifacts();

console.log(JSON.stringify({
  phase: "Phase1700",
  phaseRange: result.phaseRange,
  routeChoice: result.routeChoice,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  ownerManualFeedbackIntakeReady: result.ownerManualFeedbackIntakeReady,
  ownerSubjectiveFieldsValidated: result.ownerSubjectiveFieldsValidated,
  ownerManualNotePreserved: result.ownerManualNotePreserved,
  realOwnerFeedbackCount: result.realOwnerFeedbackCount,
  p0BugCount: result.p0BugCount,
  p1BugCount: result.p1BugCount,
  p2BugCount: result.p2BugCount,
  p3BugCount: result.p3BugCount,
  p0FixedCount: result.p0FixedCount,
  p1FixedCount: result.p1FixedCount,
  p2DeferredCount: result.p2DeferredCount,
  p3DeferredCount: result.p3DeferredCount,
  postRepairBrowserRecheckPassed: result.postRepairBrowserRecheckPassed,
  regressionRecheckPassed: result.regressionRecheckPassed,
  providerCallsMade: result.providerCallsMade,
  rawSecretRead: result.rawSecretRead,
  authJsonRead: result.authJsonRead,
  chatModified: result.chatModified,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified,
  deployExecuted: result.deployExecuted,
  productionReadyClaimed: result.productionReadyClaimed,
  validationPath: paths.validation,
  sealPath: paths.seal,
}, null, 2));

if (result.blocker) process.exitCode = 1;
