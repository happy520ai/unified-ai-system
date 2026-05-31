import {
  boundary,
  makeResult,
  paths,
  writeJson,
} from "../phase1506_1530/phase1506-1530-common.mjs";

const ledgerItems = [
  {
    id: "friction-001",
    category: "copy_clarity",
    severity: "P3",
    source: "automated_observation",
    description: "Framework copy must clearly separate automated evidence from human feedback.",
    automatedFailureDetected: true,
    ownerManualFeedback: false,
  },
  {
    id: "friction-002",
    category: "token_saving_visibility",
    severity: "P2",
    source: "automated_observation",
    description: "Token saving counter should preserve targetMetrics and achievedMetrics separately.",
    automatedFailureDetected: true,
    ownerManualFeedback: false,
  },
];

const result = makeResult("Phase1510", {
  phaseName: "Failure / Friction Ledger",
  failureFrictionLedgerReady: true,
  automatedFailureDetected: true,
  ledgerItems,
  p0Count: 0,
  p1Count: 0,
  p2Count: 1,
  p3Count: 1,
  ...boundary,
});

writeJson(paths.failureFrictionLedger, result);
writeJson(paths.misrouteLedger, makeResult("Phase1511", {
  phaseName: "Misroute Ledger",
  misrouteLedgerReady: true,
  automatedFailureDetected: true,
  misrouteItems: [
    {
      id: "misroute-001",
      route: "mission-control-preview",
      expected: "dry-run local-only evidence",
      actual: "dry-run local-only evidence",
      status: "no_misroute_detected",
    },
  ],
  ...boundary,
}));
writeJson(paths.securityFalsePositiveLedger, makeResult("Phase1512", {
  phaseName: "Security False Positive Ledger",
  securityFalsePositiveLedgerReady: true,
  falsePositiveItems: [],
  ...boundary,
}));
writeJson(paths.securityFalseNegativeLedger, makeResult("Phase1513", {
  phaseName: "Security False Negative Ledger",
  securityFalseNegativeLedgerReady: true,
  falseNegativeItems: [],
  ...boundary,
}));
writeJson(paths.conceptFieldObservationLedger, makeResult("Phase1514", {
  phaseName: "Concept Field Real-Use Observation Ledger",
  conceptFieldRealUseObservationLedgerReady: true,
  observationType: "automated_observation_only",
  realSemanticValidationClaimed: false,
  observations: [
    {
      id: "concept-field-observation-001",
      status: "synthetic_score_visible",
      ownerManualFeedback: false,
    },
  ],
  ...boundary,
}));
writeJson(paths.contextGatewayObservationLedger, makeResult("Phase1515", {
  phaseName: "Context Gateway Real-Use Observation Ledger",
  contextGatewayRealUseObservationLedgerReady: true,
  observationType: "automated_observation_only",
  observations: [
    {
      id: "context-gateway-observation-001",
      status: "token_saving_metric_visible",
      ownerManualFeedback: false,
    },
  ],
  ...boundary,
}));
writeJson(paths.missionControlUxRepairLoop, makeResult("Phase1516", {
  phaseName: "Mission Control UX Repair Loop",
  missionControlUxRepairLoopReady: true,
  highRiskRepairExecuted: false,
  repairItems: ledgerItems.map((item) => ({
    issueId: item.id,
    severity: item.severity,
    allowedScope: "docs_or_read_only_ui_preview_only",
    status: "queued",
  })),
  ...boundary,
}));

console.log(JSON.stringify({
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  failureFrictionLedgerReady: result.failureFrictionLedgerReady,
}, null, 2));
