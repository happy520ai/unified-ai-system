import { createConceptFieldSnapshot } from "./conceptFieldSnapshot.js";

export const CONCEPT_FIELD_SLEEP_CONSOLIDATION_VERSION = "phase1483.concept-field-sleep-consolidation.v1";

export function planConceptFieldSleepConsolidation(input = {}, options = {}) {
  const snapshot = options.snapshot || createConceptFieldSnapshot(input, options);
  const sleepConsolidationCandidates = snapshot.sleepConsolidationCandidates.map((entry) => ({
    ...entry,
    action: "candidate_for_future_synthetic_memory_compaction",
  }));
  const pruneCandidates = snapshot.pruneCandidates.map((entry) => ({
    ...entry,
    action: "candidate_for_future_prune_review",
  }));

  return {
    schemaVersion: CONCEPT_FIELD_SLEEP_CONSOLIDATION_VERSION,
    phase: "Phase1483",
    sleepConsolidationDryRun: true,
    syntheticVectorsOnly: true,
    providerCallsMade: false,
    realSemanticValidationClaimed: false,
    sleepConsolidationCandidates,
    pruneCandidates,
    unstableConcepts: snapshot.unstableConcepts,
    consolidationDecision:
      sleepConsolidationCandidates.length > 0 || pruneCandidates.length > 0
        ? "candidate_review_available"
        : "no_candidate_selected",
    explanation: "Candidates are dry-run maintenance hints only and are not applied automatically.",
  };
}
