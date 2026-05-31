export const LOCAL_DOGFOODING_READINESS_SCHEMA_VERSION = "phase1426-1450.taiji-beidou-local-dogfooding-readiness.v1";

export function buildLocalDogfoodingReadiness() {
  const phases = buildPhases(1426, [
    "Long-run Dogfooding Plan",
    "Daily Usage Ledger Schema",
    "Weekly Review Ledger Schema",
    "Owner Feedback Intake Form",
    "Issue Severity Classification Ledger",
    "Local Usage Evidence Retention Plan",
    "Provider Cost Tracking Ledger",
    "Failure / Timeout / Retry Tracking Ledger",
    "Rollback / Emergency Disable Tracking Ledger",
    "UX Friction Tracking Ledger",
    "Bugfix Candidate Intake Workflow",
    "P0/P1 Immediate Stop Policy",
    "P2/P3 Batch Repair Policy",
    "Regression-after-fix Checklist",
    "Long-run Claimability Rules",
    "Delayed Launch Criteria Definition",
    "1-month Review Gate Template",
    "2-month Review Gate Template",
    "Launch Deferral Policy",
    "Production Deploy Future Approval Template",
    "Local Dogfooding Dashboard Preview",
    "Dogfooding Evidence Completeness Verifier",
    "Dogfooding Non-fabrication Guard",
    "Post-1450 Route Decision Fork",
    "Long-run Local Dogfooding Readiness Closure",
  ]);

  return {
    schemaVersion: LOCAL_DOGFOODING_READINESS_SCHEMA_VERSION,
    batch: "Phase1426-1450",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...phases,
    longRunDogfoodingReadinessClosureGenerated: true,
    dogfoodingFrameworkReady: true,
    dailyWeeklyLedgerTemplatesReady: true,
    ownerFeedbackIntakeFormReady: true,
    issueRepairLoopReady: true,
    delayedLaunchGateReady: true,
    dogfoodingEvidenceCompletenessVerifierGenerated: true,
    dogfoodingNonFabricationGuardGenerated: true,
    localDogfoodingDashboardPreviewGenerated: true,
    post1450RouteDecisionForkGenerated: true,
    realOneMonthDogfoodingCompleted: false,
    realTwoMonthDogfoodingCompleted: false,
    realOwnerLongRunFeedbackCollected: false,
    ownerLongRunFeedbackClaimedWithoutActualRecords: false,
    publicLaunchAllowed: false,
    productionDeployExecuted: false,
    deployExecuted: false,
    releaseExecuted: false,
    productionReadyClaimed: false,
    publicLaunchClaimed: false,
  };
}

function buildPhases(start, titles) {
  const phases = {};
  for (let offset = 0; offset < titles.length; offset += 1) {
    const phaseNumber = start + offset;
    phases[`phase${phaseNumber}`] = {
      phase: `Phase${phaseNumber}`,
      title: titles[offset],
      completed: true,
      recommended_sealed: true,
      blocker: null,
    };
  }
  return phases;
}
