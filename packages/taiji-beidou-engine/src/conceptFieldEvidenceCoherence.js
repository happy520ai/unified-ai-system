import { createConceptFieldSnapshot } from "./conceptFieldSnapshot.js";

export const CONCEPT_FIELD_EVIDENCE_COHERENCE_VERSION = "phase1481.concept-field-evidence-coherence.v1";

export function scoreConceptFieldEvidenceCoherence(input = {}, options = {}) {
  const snapshot = options.snapshot || createConceptFieldSnapshot(input, options);
  const evidenceRefCount = Array.isArray(input.evidenceRefs) ? input.evidenceRefs.length : 0;
  const evidenceConceptScore = conceptScore(snapshot.topActivatedConcepts, ["evidence", "coherence", "compression", "ownerLedger"]);
  const unstablePenalty = Math.min(0.24, (snapshot.unstableConcepts?.length ?? 0) * 0.04);
  const evidenceCoherenceScore = clamp01(
    snapshot.evidenceCoherenceScore * 0.56 + evidenceConceptScore * 0.32 + Math.min(0.12, evidenceRefCount * 0.03) - unstablePenalty,
  );

  return {
    schemaVersion: CONCEPT_FIELD_EVIDENCE_COHERENCE_VERSION,
    phase: "Phase1481",
    evidenceCoherenceScore,
    evidenceCoherenceScoreGenerated: Number.isFinite(evidenceCoherenceScore),
    evidenceRefCount,
    coherenceDecision: evidenceCoherenceScore >= 0.62 ? "coherence_scaffold_ok" : "coherence_review_required",
    syntheticVectorsOnly: true,
    providerCallsMade: false,
    realSemanticValidationClaimed: false,
    topActivatedConcepts: snapshot.topActivatedConcepts,
    unstableConcepts: snapshot.unstableConcepts,
    explanation: "Evidence coherence is a synthetic consistency scaffold; it does not validate factual truth.",
  };
}

function conceptScore(entries = [], concepts = []) {
  const conceptSet = new Set(concepts);
  const matched = entries.filter((entry) => conceptSet.has(entry.concept));
  if (!matched.length) return 0;
  return matched.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / matched.length;
}

function clamp01(value) {
  return Number(Math.min(1, Math.max(0, Number(value) || 0)).toFixed(6));
}
