import { runConceptFieldBenchmark } from "./conceptFieldBenchmark.js";
import { createConceptFieldSnapshot } from "./conceptFieldSnapshot.js";

export const CONCEPT_FIELD_FAILURE_AUDIT_VERSION = "phase1484.concept-field-failure-audit.v1";

export function auditConceptFieldFailures(cases = [], options = {}) {
  const benchmark = runConceptFieldBenchmark(cases, options);
  const audits = cases.map((entry) => auditCase(entry, options));
  const driftCandidateCount = audits.filter((entry) => entry.driftDetected).length;
  const hallucinationCandidateCount = audits.filter((entry) => entry.hallucinationRiskDetected).length;

  return {
    schemaVersion: CONCEPT_FIELD_FAILURE_AUDIT_VERSION,
    phase: "Phase1484",
    auditMode: "synthetic_failure_drift_hallucination_scaffold",
    syntheticVectorsOnly: true,
    providerCallsMade: false,
    realSemanticValidationClaimed: false,
    benchmarkAgainstBaseline: true,
    driftCandidateCount,
    hallucinationCandidateCount,
    audits,
    benchmark,
    failureAuditCompleted: true,
    explanation: "This audit only detects synthetic scaffold anomalies; it does not prove real hallucination detection.",
  };
}

function auditCase(entry, options) {
  const snapshot = createConceptFieldSnapshot(entry.input, options);
  const sourceConcepts = new Set([
    ...(entry.input?.inputConcepts || []),
    ...(entry.input?.positiveSources || []).map((source) => source.concept || source),
    ...(entry.input?.negativeSources || []).map((source) => source.concept || source),
    ...(entry.input?.neutralSources || []).map((source) => source.concept || source),
  ]);
  const novelActivated = snapshot.topActivatedConcepts.filter((concept) => !sourceConcepts.has(concept.concept));
  const driftDetected = snapshot.surpriseScore >= 0.38 || snapshot.unstableConcepts.length >= 4;
  const hallucinationRiskDetected = novelActivated.length >= 3 && snapshot.evidenceCoherenceScore < 0.7;

  return {
    caseId: entry.caseId,
    driftDetected,
    hallucinationRiskDetected,
    surpriseScore: snapshot.surpriseScore,
    evidenceCoherenceScore: snapshot.evidenceCoherenceScore,
    novelActivatedConcepts: novelActivated,
    unstableConcepts: snapshot.unstableConcepts,
  };
}
