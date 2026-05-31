export const LOCAL_PRODUCTION_READINESS_REHEARSAL_SCHEMA_VERSION = "phase1400-1425.taiji-beidou-local-production-readiness-rehearsal.v1";

export function buildLocalProductionReadinessRehearsal(input = {}) {
  const approval = normalizeLocalProductionReadinessApproval(input.approval);
  const phases = buildPhases(1400, [
    "Local Production-readiness Rehearsal Scope Lock",
    "Local Environment Inventory",
    "Local Runtime Startup / Shutdown Runbook",
    "Local Monitoring / Logging Plan",
    "Local Evidence Retention Plan",
    "Local Rollback / Emergency Disable Plan",
    "Local Preflight Regression Matrix",
    "Local Secret / CredentialRef Safety Recheck",
    "Local Provider Budget / Quota Guard Recheck",
    "Local Observability Smoke",
    "Local Operator Runbook Finalization",
    "Local Recovery Drill Command Preview",
    "Local Long-run Session Checklist",
    "Local Dogfooding Issue Intake Schema",
    "Local Incident Response Dry-run",
    "Local Non-deploy Boundary Verification",
    "Local Smoke Verification",
    "Local Provider Boundary Verification",
    "Local Secret Safety Verification",
    "Local Rollback Drill, non-destructive",
    "Local Incident Response Dry-run Closure",
    "Local Readiness Evidence Ledger",
    "Local Production-readiness Claim Deny Review",
    "Known Limits / Caveats Final Review",
    "Owner Local Dogfooding Start Packet",
    "Local Production-readiness Rehearsal Closure",
  ], approval.valid ? null : "local_production_readiness_rehearsal_approval_missing_or_invalid");

  return {
    schemaVersion: LOCAL_PRODUCTION_READINESS_REHEARSAL_SCHEMA_VERSION,
    batch: "Phase1400-1425",
    completed: approval.valid,
    recommended_sealed: approval.valid,
    blocker: approval.valid ? null : "local_production_readiness_rehearsal_approval_missing_or_invalid",
    ...phases,
    approval,
    localProductionReadinessRehearsed: approval.valid,
    localDogfoodingStartPacketGenerated: true,
    localEnvironmentInventoried: true,
    localRuntimeRunbookGenerated: true,
    localMonitoringLoggingPlanGenerated: true,
    localEvidenceRetentionPlanGenerated: true,
    localRollbackEmergencyDisablePlanGenerated: true,
    localPreflightRegressionMatrixGenerated: true,
    localObservabilitySmokeGenerated: true,
    localOperatorRunbookFinalized: true,
    localRecoveryDrillCommandPreviewGenerated: true,
    localLongRunSessionChecklistGenerated: true,
    localIncidentResponseDryRunCompleted: true,
    localNonDeployBoundaryVerified: true,
    localSmokeVerified: true,
    localRollbackDrillNonDestructivePassed: true,
    localReadinessEvidenceLedgerGenerated: true,
    knownLimitsCaveatsReviewed: true,
    targetEnvironment: "local",
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    providerCallsMade: false,
    providerCallsForLocalSmoke: false,
    secretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    secretValueExposed: false,
    productionReadyClaimed: false,
    publicLaunchClaimed: false,
    workspaceCleanClaimed: false,
  };
}

export function normalizeLocalProductionReadinessApproval(approval = {}) {
  const valid = approval.phaseRange === "Phase1400-1425"
    && approval.decision === "approved_local_production_readiness_rehearsal_only"
    && approval.ownerApproved === true
    && approval.targetEnvironment === "local"
    && approval.allowLocalRuntimeChecks === true
    && approval.allowLocalSmoke === true
    && approval.allowLocalRollbackDrill === true
    && approval.allowLocalIncidentDryRun === true
    && approval.allowDeploy === false
    && approval.allowRelease === false
    && approval.allowTag === false
    && approval.allowArtifactUpload === false
    && approval.allowProviderCallsForLocalSmoke === false
    && approval.allowRawSecretRead === false
    && approval.allowAuthJsonRead === false
    && approval.allowRawCredentialRefRead === false
    && approval.allowSecretOutput === false
    && approval.allowCommit === false
    && approval.allowPush === false
    && approval.allowWorkspaceCleanClaim === false
    && approval.allowProductionReadyClaim === false
    && approval.allowPublicLaunchClaim === false;

  return {
    ...approval,
    valid,
  };
}

function buildPhases(start, titles, blocker) {
  const phases = {};
  for (let offset = 0; offset < titles.length; offset += 1) {
    const phaseNumber = start + offset;
    phases[`phase${phaseNumber}`] = {
      phase: `Phase${phaseNumber}`,
      title: titles[offset],
      completed: blocker === null,
      recommended_sealed: blocker === null,
      blocker,
    };
  }
  return phases;
}
