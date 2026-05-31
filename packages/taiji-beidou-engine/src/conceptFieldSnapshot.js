import { normalizeConceptFieldKernelInput } from "./conceptFieldKernelContract.js";
import { runConceptFieldKernel } from "./conceptFieldKernel.js";

export const CONCEPT_FIELD_SNAPSHOT_VERSION = "phase1477.concept-field-snapshot.v1";

export function createConceptFieldSnapshot(input = {}, options = {}) {
  const normalized = normalizeConceptFieldKernelInput(input);
  const kernelResult = options.kernelResult || runConceptFieldKernel(normalized, options);
  const tokenReplayEstimate = estimateTokenReplay(normalized);
  const fieldSnapshotTokenEstimate = estimateFieldSnapshotTokens(kernelResult);
  const tokenReductionRatio = roundNumber(1 - fieldSnapshotTokenEstimate / Math.max(1, tokenReplayEstimate));

  return {
    schemaVersion: CONCEPT_FIELD_SNAPSHOT_VERSION,
    phase: "Phase1477",
    snapshotMode: "synthetic_field_snapshot",
    fieldSnapshotGenerated: true,
    syntheticVectorsOnly: true,
    gloveDownloadExecuted: false,
    externalDatasetLoaded: false,
    externalNetworkUsed: false,
    providerCallsMade: false,
    realSemanticValidationClaimed: false,
    sourceKernelVersion: kernelResult.schemaVersion,
    tokenReplayEstimate,
    fieldSnapshotTokenEstimate,
    tokenReductionRatio,
    benchmarkAgainstBaseline: true,
    routeAffinityScore: kernelResult.routeAffinityScore,
    evidenceCoherenceScore: kernelResult.evidenceCoherenceScore,
    surpriseScore: kernelResult.surpriseScore,
    riskFieldScore: kernelResult.riskFieldScore,
    topActivatedConcepts: kernelResult.topActivatedConcepts,
    topSuppressedConcepts: kernelResult.topSuppressedConcepts,
    unstableConcepts: kernelResult.unstableConcepts,
    sleepConsolidationCandidates: kernelResult.sleepConsolidationCandidates,
    pruneCandidates: kernelResult.pruneCandidates,
    compactReadout: buildCompactReadout(normalized, kernelResult),
  };
}

export function estimateTokenReplay(input = {}) {
  const normalized = normalizeConceptFieldKernelInput(input);
  const serialized = JSON.stringify({
    inputConcepts: normalized.inputConcepts,
    positiveSources: normalized.positiveSources,
    negativeSources: normalized.negativeSources,
    neutralSources: normalized.neutralSources,
    routeContext: normalized.routeContext,
    evidenceRefs: normalized.evidenceRefs,
    riskSignals: normalized.riskSignals,
  });
  return Math.max(48, Math.ceil(serialized.length / 3.7) + normalized.evidenceRefs.length * 16);
}

export function estimateFieldSnapshotTokens(kernelResult = {}) {
  const activated = kernelResult.topActivatedConcepts?.length ?? 0;
  const suppressed = kernelResult.topSuppressedConcepts?.length ?? 0;
  const unstable = kernelResult.unstableConcepts?.length ?? 0;
  return 24 + activated * 6 + suppressed * 5 + unstable * 4;
}

function buildCompactReadout(normalized, kernelResult) {
  return {
    inputConcepts: normalized.inputConcepts,
    positiveConcepts: normalized.positiveSources.map((source) => source.concept),
    negativeConcepts: normalized.negativeSources.map((source) => source.concept),
    activatedConceptIds: kernelResult.topActivatedConcepts.map((entry) => entry.concept),
    suppressedConceptIds: kernelResult.topSuppressedConcepts.map((entry) => entry.concept),
    unstableConceptIds: kernelResult.unstableConcepts.map((entry) => entry.concept),
    explanation:
      "Synthetic field snapshot for dry-run benchmark only; it is not a real semantic memory or intelligence proof.",
  };
}

function roundNumber(value) {
  return Number(Number(value).toFixed(6));
}
