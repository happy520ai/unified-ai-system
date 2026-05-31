import { runConceptFieldKernel } from "./conceptFieldKernel.js";
import { cosineSimilarity, createConceptFieldSyntheticSpace, vectorForConcept } from "./conceptFieldSyntheticSpace.js";

export const CONCEPT_FIELD_BENCHMARK_VERSION = "phase1476.concept-field-benchmark.v1";

export function runConceptFieldBenchmark(cases, options = {}) {
  const space = options.space || createConceptFieldSyntheticSpace();
  const benchmarkCases = Array.isArray(cases) ? cases : [];
  return {
    schemaVersion: CONCEPT_FIELD_BENCHMARK_VERSION,
    phase: "Phase1476",
    benchmarkMode: "synthetic_only",
    realSemanticValidationClaimed: false,
    productionReadinessClaimed: false,
    baselines: [
      "directSyntheticNearestNeighbor",
      "simpleKeywordAffinity",
      "randomBaseline",
      "conceptFieldKernelDryRun",
    ],
    results: benchmarkCases.map((benchmarkCase, index) => compareBaselines(benchmarkCase, space, index)),
  };
}

export function directSyntheticNearestNeighbor(input, space = createConceptFieldSyntheticSpace()) {
  const inputConcept = input.inputConcepts?.[0] || "route";
  const inputVector = vectorForConcept(space, inputConcept);
  return space.concepts
    .filter((concept) => concept !== inputConcept)
    .map((concept) => ({
      concept,
      score: roundNumber((cosineSimilarity(inputVector, vectorForConcept(space, concept)) + 1) / 2),
    }))
    .sort((left, right) => right.score - left.score || left.concept.localeCompare(right.concept))
    .slice(0, 3);
}

export function simpleKeywordAffinity(input) {
  const haystack = [
    ...(input.inputConcepts || []),
    ...(input.positiveSources || []).map((source) => source.concept || source),
    JSON.stringify(input.routeContext || {}),
  ].join(" ").toLowerCase();
  const keywords = ["route", "evidence", "security", "capability", "coherence"];
  return keywords.map((keyword) => ({
    concept: keyword,
    score: haystack.includes(keyword) ? 1 : 0,
  })).sort((left, right) => right.score - left.score || left.concept.localeCompare(right.concept));
}

export function randomBaseline(input, seedIndex = 0) {
  const concepts = [...(input.inputConcepts || []), "route", "evidence", "security", "coherence", "capabilityCell"];
  return concepts
    .map((concept, index) => ({
      concept,
      score: roundNumber((((index + 1) * 37 + seedIndex * 17) % 100) / 100),
    }))
    .sort((left, right) => right.score - left.score || left.concept.localeCompare(right.concept))
    .slice(0, 3);
}

function compareBaselines(benchmarkCase, space, index) {
  const kernel = runConceptFieldKernel(benchmarkCase.input, { space });
  return {
    caseId: benchmarkCase.caseId,
    directSyntheticNearestNeighbor: directSyntheticNearestNeighbor(benchmarkCase.input, space),
    simpleKeywordAffinity: simpleKeywordAffinity(benchmarkCase.input),
    randomBaseline: randomBaseline(benchmarkCase.input, index),
    conceptFieldKernelDryRun: {
      routeAffinityScore: kernel.routeAffinityScore,
      evidenceCoherenceScore: kernel.evidenceCoherenceScore,
      surpriseScore: kernel.surpriseScore,
      riskFieldScore: kernel.riskFieldScore,
      topActivatedConcepts: kernel.topActivatedConcepts.slice(0, 3),
    },
  };
}

function roundNumber(value) {
  return Number(Number(value).toFixed(6));
}
