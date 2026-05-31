import { normalizeConceptFieldKernelInput, validateConceptFieldKernelInput } from "./conceptFieldKernelContract.js";
import {
  addVectors,
  averageVectors,
  cosineSimilarity,
  createConceptFieldSyntheticSpace,
  euclideanDistance,
  roundNumber,
  scaleVector,
  subtractVectors,
  vectorForConcept,
} from "./conceptFieldSyntheticSpace.js";

export const CONCEPT_FIELD_KERNEL_VERSION = "phase1476.concept-field-kernel.v1";

export function runConceptFieldKernel(input = {}, options = {}) {
  const validation = validateConceptFieldKernelInput(input);
  if (!validation.valid) {
    throw new Error(`concept_field_kernel_input_invalid:${validation.errors.join(",")}`);
  }
  const normalized = normalizeConceptFieldKernelInput(input);
  const space = options.space || createConceptFieldSyntheticSpace();
  const dimensions = space.dimensions;
  const positiveVector = sourceVector(space, normalized.positiveSources, dimensions);
  const negativeVector = sourceVector(space, normalized.negativeSources, dimensions);
  const neutralVector = sourceVector(space, normalized.neutralSources, dimensions);
  const inputVector = averageVectors(normalized.inputConcepts.map((concept) => vectorForConcept(space, concept)), dimensions);
  const targetVector = addVectors(addVectors(inputVector, positiveVector), scaleVector(negativeVector, -0.72));
  const anchorVector = neutralVector;
  const iterations = boundedIteration(targetVector, anchorVector, normalized.maxIterations);
  const finalState = iterations.at(-1).state;
  const scores = scoreConcepts(space, finalState, normalized);
  const riskSimilarity = Math.max(0, cosineSimilarity(finalState, negativeVector));
  const routeAffinityScore = clamp01(0.58 * positiveSimilarity(finalState, positiveVector) + 0.42 * contextBoost(normalized.routeContext));
  const evidenceCoherenceScore = clamp01(0.64 * evidenceBoost(normalized.evidenceRefs) + 0.36 * positiveSimilarity(finalState, vectorForConcept(space, "evidence")));
  const surpriseScore = clamp01(euclideanDistance(inputVector, finalState) / Math.sqrt(dimensions));
  const riskFieldScore = clamp01(0.72 * riskSimilarity + 0.28 * riskSignalBoost(normalized.riskSignals));

  return {
    schemaVersion: CONCEPT_FIELD_KERNEL_VERSION,
    phase: "Phase1476",
    kernelMode: "synthetic_concept_field_dry_run",
    conceptFieldKernelImplemented: true,
    syntheticDryRunOnly: true,
    syntheticVectorsOnly: true,
    gloveDownloadExecuted: false,
    externalDatasetLoaded: false,
    providerCallsMade: false,
    deterministicSeed: normalized.seed,
    boundedIteration: {
      maxIterations: normalized.maxIterations,
      actualIterations: iterations.length,
      iterations,
    },
    scores: {
      routeAffinityScore,
      evidenceCoherenceScore,
      surpriseScore,
      riskFieldScore,
    },
    routeAffinityScore,
    evidenceCoherenceScore,
    surpriseScore,
    riskFieldScore,
    topActivatedConcepts: scores.activated,
    topSuppressedConcepts: scores.suppressed,
    unstableConcepts: scores.unstable,
    sleepConsolidationCandidates: scores.sleepConsolidationCandidates,
    pruneCandidates: scores.pruneCandidates,
    readout: {
      inputConcepts: normalized.inputConcepts,
      positiveSourceCount: normalized.positiveSources.length,
      negativeSourceCount: normalized.negativeSources.length,
      neutralSourceCount: normalized.neutralSources.length,
      evidenceRefCount: normalized.evidenceRefs.length,
      riskSignalCount: normalized.riskSignals.length,
      explanation:
        "Synthetic vector field readout only. Scores are deterministic scaffold signals, not real semantic validation.",
    },
  };
}

function sourceVector(space, sources, dimensions) {
  const weighted = sources.map((source) => scaleVector(vectorForConcept(space, source.concept), source.weight));
  return averageVectors(weighted, dimensions);
}

function boundedIteration(targetVector, anchorVector, maxIterations) {
  const iterations = [];
  let state = anchorVector;
  for (let stepIndex = 0; stepIndex < maxIterations; stepIndex += 1) {
    const delta = subtractVectors(targetVector, state);
    const energy = 0.5 * delta.reduce((sum, value) => sum + value * value, 0);
    state = addVectors(state, scaleVector(delta, 0.42));
    iterations.push({
      step: stepIndex + 1,
      energyLikeScore: roundNumber(energy),
      state: state.map(roundNumber),
    });
  }
  return iterations;
}

function scoreConcepts(space, finalState, normalized) {
  const inputSet = new Set(normalized.inputConcepts);
  const positiveSet = new Set(normalized.positiveSources.map((source) => source.concept));
  const negativeSet = new Set(normalized.negativeSources.map((source) => source.concept));
  const scored = space.concepts
    .map((concept) => ({
      concept,
      score: roundNumber(clamp01((cosineSimilarity(finalState, vectorForConcept(space, concept)) + 1) / 2)),
      distance: roundNumber(euclideanDistance(finalState, vectorForConcept(space, concept))),
      sourceRole: negativeSet.has(concept)
        ? "negative"
        : positiveSet.has(concept)
          ? "positive"
          : inputSet.has(concept)
            ? "input"
            : "candidate",
    }))
    .sort((left, right) => right.score - left.score || left.distance - right.distance || left.concept.localeCompare(right.concept));
  const activated = scored.slice(0, 5);
  const suppressed = scored
    .filter((entry) => negativeSet.has(entry.concept) || entry.score < 0.58)
    .sort((left, right) => left.score - right.score || left.concept.localeCompare(right.concept))
    .slice(0, 5);
  const unstable = scored.filter((entry) => entry.score >= 0.52 && entry.score <= 0.68).slice(0, 5);
  return {
    activated,
    suppressed,
    unstable,
    sleepConsolidationCandidates: activated.filter((entry) => entry.sourceRole === "candidate").slice(0, 3),
    pruneCandidates: suppressed.filter((entry) => entry.sourceRole !== "positive").slice(0, 3),
  };
}

function positiveSimilarity(left, right) {
  return clamp01((cosineSimilarity(left, right) + 1) / 2);
}

function contextBoost(routeContext) {
  const text = JSON.stringify(routeContext ?? {}).toLowerCase();
  if (!text) return 0.5;
  let boost = 0.45;
  if (/tianshu|route|planner/.test(text)) boost += 0.22;
  if (/evidence|coherence|compression/.test(text)) boost += 0.16;
  if (/security|risk|shield/.test(text)) boost -= 0.08;
  return clamp01(boost);
}

function evidenceBoost(evidenceRefs) {
  return clamp01(Math.min(1, evidenceRefs.length / 4));
}

function riskSignalBoost(riskSignals) {
  return clamp01(Math.min(1, riskSignals.length / 4));
}

function clamp01(value) {
  return roundNumber(Math.min(1, Math.max(0, Number(value) || 0)));
}
