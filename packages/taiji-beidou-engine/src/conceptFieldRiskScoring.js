import { createConceptFieldSnapshot } from "./conceptFieldSnapshot.js";

export const CONCEPT_FIELD_RISK_SCORING_VERSION = "phase1480.concept-field-risk-scoring.v1";

const highRiskConcepts = Object.freeze(["secretLeak", "providerBypass", "deployRisk", "stale"]);

export function scoreConceptFieldRisk(input = {}, options = {}) {
  const snapshot = options.snapshot || createConceptFieldSnapshot(input, options);
  const highRiskActivation = Math.max(
    0,
    ...snapshot.topActivatedConcepts
      .filter((entry) => highRiskConcepts.includes(entry.concept))
      .map((entry) => Number(entry.score || 0)),
  );
  const suppressedRiskCoverage = snapshot.topSuppressedConcepts.filter((entry) => highRiskConcepts.includes(entry.concept)).length;
  const riskFieldScore = clamp01(snapshot.riskFieldScore * 0.7 + highRiskActivation * 0.25 - suppressedRiskCoverage * 0.04);

  return {
    schemaVersion: CONCEPT_FIELD_RISK_SCORING_VERSION,
    phase: "Phase1480",
    riskFieldScore,
    riskFieldScoreGenerated: Number.isFinite(riskFieldScore),
    riskDecision: riskFieldScore >= 0.72 ? "risk_field_high_review_required" : "risk_field_scaffold_ok",
    syntheticVectorsOnly: true,
    providerCallsMade: false,
    secretValueExposed: false,
    rawCredentialRefRead: false,
    realSemanticValidationClaimed: false,
    highRiskConcepts,
    highRiskActivation,
    suppressedRiskCoverage,
    topActivatedConcepts: snapshot.topActivatedConcepts,
    topSuppressedConcepts: snapshot.topSuppressedConcepts,
    explanation: "Risk field score is a dry-run shield signal and never authorizes risky actions.",
  };
}

function clamp01(value) {
  return Number(Math.min(1, Math.max(0, Number(value) || 0)).toFixed(6));
}
