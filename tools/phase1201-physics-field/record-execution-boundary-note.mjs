import {
  executionBoundaryEvidencePath,
  phase1201Boundary,
  writeJson,
} from "./phase1201-common.mjs";

const boundary = phase1201Boundary();

const note = {
  phase: "Phase1201",
  noteType: "execution-boundary-disclosure",
  completed: true,
  recommended_sealed: false,
  blocker: "operator_side_provider_call_observed_during_health_recheck",
  moduleProviderCallsMade: false,
  phase1201ToolsProviderCallsMade: false,
  phase1201CoreDryRunProviderCallsMade: false,
  operatorManagedDevStartedForHealthRecheck: true,
  operatorSideProviderCallObservedDuringHealthRecheck: true,
  observedProviderName: "nvidia",
  observedProviderRoute: "POST /chat",
  observedSource: "managed-dev logs after dev:phase7b health/doctor recheck",
  providerCallAttributedToPhase1201Module: false,
  providerCallAttributedToPhase1201Smoke: false,
  boundaryDeviationRecorded: true,
  cannotClaimNoProviderCallsForEntireCodexTurn: true,
  serviceStoppedAfterObservation: true,
  finalReportMustDiscloseDeviation: true,
  noSecretValueExposedInThisNote: true,
  noRawApiKeyRecordedInThisNote: true,
  noAuthJsonReadInThisNote: true,
  ...boundary,
  providerCallsMade: false,
};

await writeJson(executionBoundaryEvidencePath, note);
console.log(JSON.stringify({
  phase: note.phase,
  noteType: note.noteType,
  completed: note.completed,
  recommended_sealed: note.recommended_sealed,
  blocker: note.blocker,
  moduleProviderCallsMade: note.moduleProviderCallsMade,
  operatorSideProviderCallObservedDuringHealthRecheck: note.operatorSideProviderCallObservedDuringHealthRecheck,
  serviceStoppedAfterObservation: note.serviceStoppedAfterObservation,
}, null, 2));
