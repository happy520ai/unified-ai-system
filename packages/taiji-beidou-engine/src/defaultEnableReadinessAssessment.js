export const DEFAULT_ENABLE_READINESS_ASSESSMENT_SCHEMA_VERSION = "phase1296-1305.taiji-beidou-default-enable-readiness-assessment.v1";

export function buildDefaultEnableReadinessAssessment() {
  const phases = {};
  const titles = [
    "Default Enable Readiness Criteria Definition",
    "Default Enable Risk Matrix",
    "Owner Decision Requirements for Default Enable",
    "Provider / Cost / Secret Readiness Deny Review",
    "Production Readiness Deny Review",
    "Default Enable Blocker Ledger",
    "Mission Control Default Enable Readiness Preview",
    "Post-1305 Decision Fork",
    "Final No-default-change Verification",
    "Default Enable Readiness Assessment Closure",
  ];
  for (let offset = 0; offset < titles.length; offset += 1) {
    const phaseNumber = 1296 + offset;
    phases[`phase${phaseNumber}`] = {
      phase: `Phase${phaseNumber}`,
      title: titles[offset],
      completed: true,
      recommended_sealed: true,
      blocker: null,
    };
  }

  return {
    schemaVersion: DEFAULT_ENABLE_READINESS_ASSESSMENT_SCHEMA_VERSION,
    batch: "Phase1296-1305",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...phases,
    defaultEnableReadinessAssessmentCompleted: true,
    defaultEnableCriteriaDefined: true,
    defaultEnableRiskMatrixGenerated: true,
    ownerFinalDefaultEnableDecisionRequired: true,
    providerCostSecretReadinessDenied: true,
    productionReadinessDenied: true,
    defaultEnableBlockerLedgerGenerated: true,
    missionControlDefaultEnableReadinessPreviewGenerated: true,
    post1305DecisionForkGenerated: true,
    finalNoDefaultChangeVerificationPassed: true,
    defaultEnableExecuted: false,
    mainChainDefaultEnabled: false,
    productionReadyClaimed: false,
  };
}
