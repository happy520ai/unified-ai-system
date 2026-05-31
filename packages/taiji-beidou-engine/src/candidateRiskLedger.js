export const CANDIDATE_RISK_LEDGER_SCHEMA_VERSION = "phase1244.taiji-beidou-candidate-risk-ledger.v1";

export function buildCandidateRiskLedger(input = {}) {
  const p0Risks = Array.isArray(input.p0Risks) ? input.p0Risks : [];
  const safetyBrakeEngaged = p0Risks.length > 0;

  return {
    schemaVersion: CANDIDATE_RISK_LEDGER_SCHEMA_VERSION,
    phase: "Phase1244",
    completed: !safetyBrakeEngaged,
    recommended_sealed: !safetyBrakeEngaged,
    blocker: safetyBrakeEngaged ? "p0_risk_detected" : null,
    riskLedgerGenerated: true,
    p0RiskDetected: safetyBrakeEngaged,
    safetyBrakeEngaged,
    riskClassificationPolicy: {
      P0: "unsafe execution / default behavior changed / secret/provider/deploy risk",
      P1: "route boundary / rollback / no-flag regression weakness",
      P2: "UX / evidence / status visibility issue",
      P3: "docs / copy / naming issue",
    },
    riskLedger: [
      ...p0Risks.map((risk) => ({
        id: risk.id,
        severity: "P0",
        description: risk.description,
        action: "stop_and_block_seal",
      })),
      {
        id: "owner_manual_review_pending",
        severity: "P2",
        description: "Owner review pack is generated, but real owner feedback is not collected in this phase.",
        action: "defer_to_phase1246_1255",
      },
      {
        id: "limited_enable_requires_future_gate",
        severity: "P1",
        description: "Limited enable remains blocked until a future owner approval gate.",
        action: "keep_limitedEnableAllowed_false",
      },
    ],
  };
}
