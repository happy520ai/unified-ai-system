export const LIMITED_ENABLE_READINESS_ASSESSMENT_SCHEMA_VERSION = "phase1243.taiji-beidou-limited-enable-readiness-assessment.v1";

export function buildLimitedEnableReadinessAssessment(input = {}) {
  const hardeningReady = input.hardeningReady !== false;

  return {
    schemaVersion: LIMITED_ENABLE_READINESS_ASSESSMENT_SCHEMA_VERSION,
    phase: "Phase1243",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    limitedEnableReadinessAssessmentGenerated: true,
    limitedEnableExecuted: false,
    ownerApprovalRequired: true,
    providerCallStillDisallowed: true,
    secretReadStillDisallowed: true,
    deploymentStillDisallowed: true,
    readyForOwnerDecision: hardeningReady,
    limitedEnableAllowed: false,
    readinessFactors: [
      {
        id: "candidate_default_off",
        passed: true,
      },
      {
        id: "rollback_ready",
        passed: true,
      },
      {
        id: "owner_review_required",
        passed: true,
      },
      {
        id: "limited_enable_not_executed",
        passed: true,
      },
    ],
  };
}
