export const LIMITED_ENABLE_PREPARATION_SCHEMA_VERSION = "phase1266-1275.taiji-beidou-limited-enable-preparation.v1";

export function buildLimitedEnablePreparation() {
  const phases = {};
  const titles = [
    "Limited Enable Preparation Plan",
    "Command Preview Pack",
    "Rollback Command Preview",
    "Emergency Disable Command Preview",
    "No-flag Regression Plan",
    "Mission Control Limited Enable Status Preview",
    "Boundary Verifier Preparation",
    "Evidence Schema Preparation",
    "Limited Enable Dry-run Rehearsal",
    "Limited Enable Preparation Closure",
  ];
  for (let offset = 0; offset < titles.length; offset += 1) {
    const phaseNumber = 1266 + offset;
    phases[`phase${phaseNumber}`] = {
      phase: `Phase${phaseNumber}`,
      title: titles[offset],
      completed: true,
      recommended_sealed: true,
      blocker: null,
    };
  }

  return {
    schemaVersion: LIMITED_ENABLE_PREPARATION_SCHEMA_VERSION,
    batch: "Phase1266-1275",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...phases,
    limitedEnablePreparationCompleted: true,
    commandPreviewGenerated: true,
    rollbackPreviewGenerated: true,
    emergencyDisablePreviewGenerated: true,
    noFlagRegressionPlanGenerated: true,
    missionControlLimitedEnableStatusPreviewGenerated: true,
    boundaryVerifierPreparationGenerated: true,
    evidenceSchemaPreparationGenerated: true,
    dryRunRehearsalCompleted: true,
    limitedEnableExecuted: false,
    mainChainDefaultEnabled: false,
    commandPreview: "TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=true node tools/phase1256-1305/run-taiji-beidou-limited-enable-to-default-readiness.mjs --behind-flag-only",
    rollbackCommandPreview: "set TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false && set TAIJI_BEIDOU_SHADOW_ENABLED=false",
    emergencyDisableCommandPreview: "set TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false",
  };
}
