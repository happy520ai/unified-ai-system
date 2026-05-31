export const CONCEPT_FIELD_SYNTHETIC_SPACE_VERSION = "phase1476.synthetic-concept-space.v1";

export function createConceptFieldSyntheticSpace() {
  const vectors = {
    tianshu: [0.88, 0.72, 0.42, 0.18, 0.12, 0.24],
    route: [0.84, 0.68, 0.36, 0.12, 0.1, 0.18],
    planner: [0.8, 0.7, 0.38, 0.16, 0.12, 0.2],
    godMode: [0.64, 0.84, 0.7, 0.2, 0.18, 0.22],
    coherence: [0.58, 0.86, 0.78, 0.14, 0.1, 0.2],
    evidence: [0.48, 0.74, 0.86, 0.1, 0.08, 0.2],
    compression: [0.42, 0.62, 0.82, 0.08, 0.08, 0.16],
    capabilityCell: [0.76, 0.58, 0.5, 0.22, 0.14, 0.38],
    synthesis: [0.7, 0.78, 0.68, 0.18, 0.12, 0.24],
    securityShield: [0.28, 0.42, 0.52, 0.92, 0.2, 0.3],
    secretLeak: [0.1, 0.16, 0.2, 0.98, 0.88, 0.76],
    providerBypass: [0.22, 0.22, 0.28, 0.94, 0.82, 0.8],
    deployRisk: [0.24, 0.28, 0.32, 0.9, 0.74, 0.78],
    noise: [0.12, 0.1, 0.08, 0.1, 0.92, 0.2],
    stale: [0.18, 0.18, 0.2, 0.42, 0.82, 0.36],
    ownerLedger: [0.46, 0.58, 0.72, 0.16, 0.12, 0.18],
    dryRun: [0.56, 0.54, 0.62, 0.2, 0.16, 0.32],
    rollback: [0.32, 0.42, 0.46, 0.72, 0.28, 0.42],
  };

  return buildSyntheticConceptSpace(vectors);
}

export function buildSyntheticConceptSpace(vectors) {
  const entries = Object.entries(vectors).map(([concept, vector]) => ({
    concept,
    vector: normalizeVector(vector),
  }));
  const dimensions = entries[0]?.vector.length ?? 0;
  if (dimensions === 0) throw new Error("synthetic_concept_space_empty");
  for (const entry of entries) {
    if (entry.vector.length !== dimensions) throw new Error(`synthetic_dimension_mismatch:${entry.concept}`);
  }
  return {
    schemaVersion: CONCEPT_FIELD_SYNTHETIC_SPACE_VERSION,
    syntheticVectorsOnly: true,
    gloveDownloadExecuted: false,
    externalDatasetLoaded: false,
    providerCallsMade: false,
    dimensions,
    concepts: entries.map((entry) => entry.concept),
    vectors: Object.fromEntries(entries.map((entry) => [entry.concept, entry.vector])),
  };
}

export function vectorForConcept(space, concept) {
  return space.vectors[concept] || deterministicSyntheticVector(concept, space.dimensions);
}

export function deterministicSyntheticVector(concept, dimensions = 6) {
  const seed = hashString(String(concept));
  return Array.from({ length: dimensions }, (_, index) => {
    const value = Math.sin(seed * (index + 1) * 0.017) * 10000;
    return roundNumber(Math.abs(value - Math.floor(value)));
  });
}

export function averageVectors(vectors, dimensions) {
  if (!vectors.length) return zeroVector(dimensions);
  const sum = zeroVector(dimensions);
  for (const vector of vectors) {
    for (let index = 0; index < dimensions; index += 1) sum[index] += vector[index] ?? 0;
  }
  return sum.map((value) => roundNumber(value / vectors.length));
}

export function addVectors(left, right) {
  return left.map((value, index) => value + right[index]);
}

export function subtractVectors(left, right) {
  return left.map((value, index) => value - right[index]);
}

export function scaleVector(vector, scalar) {
  return vector.map((value) => value * scalar);
}

export function cosineSimilarity(left, right) {
  const denominator = norm(left) * norm(right);
  if (denominator === 0) return 0;
  return dot(left, right) / denominator;
}

export function euclideanDistance(left, right) {
  return norm(subtractVectors(left, right));
}

export function roundNumber(value) {
  return Number(Number(value).toFixed(6));
}

function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) throw new Error("vector_must_be_non_empty_array");
  return vector.map((value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("vector_value_must_be_finite");
    return number;
  });
}

function zeroVector(size) {
  return Array.from({ length: size }, () => 0);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector));
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
