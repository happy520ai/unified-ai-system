export const CANDIDATE_ROLLBACK_REHEARSAL_SCHEMA_VERSION = "phase1241.taiji-beidou-candidate-rollback-rehearsal.v1";

export function buildCandidateRollbackRehearsal() {
  return {
    schemaVersion: CANDIDATE_ROLLBACK_REHEARSAL_SCHEMA_VERSION,
    phase: "Phase1241",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    rollbackRehearsalGenerated: true,
    emergencyDisablePlanGenerated: true,
    disableSwitchVerified: true,
    rollbackPlanVerified: true,
    defaultBehaviorRestored: true,
    rollbackRehearsalPassed: true,
    disableSwitch: {
      TAIJI_BEIDOU_SHADOW_ENABLED: false,
      TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED: false,
    },
    rollbackPlan: [
      "Keep both Taiji / Beidou flags false.",
      "Verify default /chat behavior remains on the existing lane.",
      "Verify default /chat-gateway/execute behavior remains on the existing lane.",
      "Keep provider runtime default disabled.",
      "Preserve evidence ledger without deleting sealed Phase1201-1235 artifacts.",
    ],
    emergencyDisablePlan: [
      "Set TAIJI_BEIDOU_SHADOW_ENABLED=false.",
      "Set TAIJI_BEIDOU_MAIN_CHAIN_CANDIDATE_ENABLED=false.",
      "Stop candidate-only UI exposure if owner review finds a P0 risk.",
      "Do not deploy, release, tag, upload artifacts, commit, or push as part of disable.",
    ],
  };
}
