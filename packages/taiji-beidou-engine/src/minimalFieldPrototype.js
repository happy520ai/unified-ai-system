export const MINIMAL_FIELD_SCHEMA_VERSION = "phase1201.minimal-field.v1";

export function createSyntheticConceptSpace() {
  const vectors = {
    man: [1, 0, 0],
    woman: [0, 1, 0],
    king: [1, 0, 1],
    queen: [0, 1, 1],
    prince: [1, 0, 0.72],
    princess: [0, 1, 0.72],
    monarch: [0.5, 0.5, 0.94],
    ruler: [0.5, 0.48, 0.86],
    boy: [0.92, 0.05, 0.02],
    girl: [0.05, 0.92, 0.02],
    throne: [0.5, 0.5, 1.25],
    city: [0.2, 0.2, -0.6],
  };

  return buildConceptSpace(vectors, { dataset: "phase1201-synthetic-analogy" });
}

export function buildConceptSpace(vectors, options = {}) {
  const entries = Object.entries(vectors).map(([word, vector]) => ({
    word,
    vector: normalizeVector(vector),
  }));
  if (entries.length === 0) {
    throw new Error("concept_space_empty");
  }
  const dimensions = entries[0].vector.length;
  if (dimensions === 0) {
    throw new Error("concept_space_dimension_empty");
  }
  for (const entry of entries) {
    if (entry.vector.length !== dimensions) {
      throw new Error(`concept_space_dimension_mismatch:${entry.word}`);
    }
  }

  return {
    schemaVersion: MINIMAL_FIELD_SCHEMA_VERSION,
    dataset: options.dataset || "custom-local",
    source: options.source || "local-synthetic",
    dimensions,
    size: entries.length,
    words: entries.map((entry) => entry.word),
    vectors: Object.fromEntries(entries.map((entry) => [entry.word, entry.vector])),
    graph: buildKNearestGraph(entries, options.neighborCount ?? 3),
  };
}

export function buildPhysicalSources(conceptSpace, analogy = defaultAnalogy()) {
  const terms = [
    { word: analogy.positive[0], charge: 1, role: "positive-source" },
    { word: analogy.negative[0], charge: -1, role: "negative-source" },
    { word: analogy.positive[1], charge: 1, role: "positive-source" },
  ];

  const sources = terms.map((term) => {
    const vector = conceptSpace.vectors[term.word];
    if (!vector) {
      throw new Error(`source_word_missing:${term.word}`);
    }
    return { ...term, vector };
  });

  const targetVector = addVectors(
    subtractVectors(sources[0].vector, sources[1].vector),
    sources[2].vector,
  );

  return {
    expression: `${analogy.positive[0]} - ${analogy.negative[0]} + ${analogy.positive[1]}`,
    expected: analogy.expected,
    sources,
    targetVector,
  };
}

export function totalEnergy(stateVector, fieldSources, options = {}) {
  const attractionStrength = options.attractionStrength ?? 1;
  const anchorStrength = options.anchorStrength ?? 0;
  const anchorVector = options.anchorVector || zeroVector(stateVector.length);
  const targetDelta = subtractVectors(stateVector, fieldSources.targetVector);
  const anchorDelta = subtractVectors(stateVector, anchorVector);
  return (
    0.5 * attractionStrength * dot(targetDelta, targetDelta)
    + 0.5 * anchorStrength * dot(anchorDelta, anchorDelta)
  );
}

export function energyGradient(stateVector, fieldSources, options = {}) {
  const attractionStrength = options.attractionStrength ?? 1;
  const anchorStrength = options.anchorStrength ?? 0;
  const anchorVector = options.anchorVector || zeroVector(stateVector.length);
  const targetGradient = scaleVector(subtractVectors(stateVector, fieldSources.targetVector), attractionStrength);
  const anchorGradient = scaleVector(subtractVectors(stateVector, anchorVector), anchorStrength);
  return addVectors(targetGradient, anchorGradient);
}

export function runGradientDescent(fieldSources, options = {}) {
  const learningRate = options.learningRate ?? 0.2;
  const maxSteps = options.maxSteps ?? 36;
  const tolerance = options.tolerance ?? 1e-7;
  const initialState = normalizeVector(options.initialState || zeroVector(fieldSources.targetVector.length));
  const trajectory = [];
  let state = initialState;

  for (let step = 0; step <= maxSteps; step += 1) {
    const energy = totalEnergy(state, fieldSources, options);
    const gradient = energyGradient(state, fieldSources, options);
    const gradientNorm = norm(gradient);
    trajectory.push({
      step,
      energy: roundNumber(energy),
      gradientNorm: roundNumber(gradientNorm),
      state: state.map(roundNumber),
    });
    if (gradientNorm <= tolerance) break;
    state = subtractVectors(state, scaleVector(gradient, learningRate));
  }

  return {
    converged: trajectory.at(-1).gradientNorm <= tolerance,
    steps: trajectory.at(-1).step,
    finalEnergy: trajectory.at(-1).energy,
    finalState: state.map(roundNumber),
    trajectory,
  };
}

export function readSteadyStateCandidates(conceptSpace, stateVector, options = {}) {
  const exclude = new Set(options.excludeWords || []);
  return conceptSpace.words
    .filter((word) => !exclude.has(word))
    .map((word) => ({
      word,
      distance: roundNumber(euclideanDistance(stateVector, conceptSpace.vectors[word])),
      similarity: roundNumber(cosineSimilarity(stateVector, conceptSpace.vectors[word])),
    }))
    .sort((left, right) => left.distance - right.distance || right.similarity - left.similarity || left.word.localeCompare(right.word))
    .slice(0, options.limit ?? 5);
}

export function runMinimalFieldPrototype(options = {}) {
  const conceptSpace = options.conceptSpace || createSyntheticConceptSpace();
  const sample = defaultAnalogy();
  const fieldSources = buildPhysicalSources(conceptSpace, sample);
  const descent = runGradientDescent(fieldSources, {
    initialState: conceptSpace.vectors.king,
    learningRate: options.learningRate ?? 0.25,
    maxSteps: options.maxSteps ?? 48,
    tolerance: options.tolerance ?? 0.00001,
  });
  const steadyStateCandidates = readSteadyStateCandidates(conceptSpace, descent.finalState, {
    excludeWords: fieldSources.sources.map((source) => source.word),
    limit: options.limit ?? 5,
  });

  return {
    schemaVersion: MINIMAL_FIELD_SCHEMA_VERSION,
    phase: "Phase1201",
    verificationMode: "synthetic-dry-run",
    conceptSpace,
    sample: {
      expression: fieldSources.expression,
      expected: sample.expected,
    },
    fieldSources,
    energyFunctional: {
      name: "quadratic-target-potential",
      formula: "E(x)=0.5*||x-(king-man+woman)||^2",
      gradient: "grad E(x)=x-(king-man+woman)",
    },
    descent,
    steadyStateCandidates,
    topCandidate: steadyStateCandidates[0] || null,
    completionVerified: steadyStateCandidates[0]?.word === sample.expected,
    verificationReason: steadyStateCandidates[0]?.word === sample.expected
      ? "synthetic_concept_space_converged_to_expected_analogy_candidate"
      : "synthetic_concept_space_did_not_rank_expected_candidate_first",
  };
}

export function defaultAnalogy() {
  return {
    positive: ["king", "woman"],
    negative: ["man"],
    expected: "queen",
  };
}

export function isGloveDownloadAllowed(env = process.env) {
  return env.ALLOW_TAIJI_GLOVE_DOWNLOAD === "true";
}

function buildKNearestGraph(entries, neighborCount) {
  const graph = {};
  for (const entry of entries) {
    graph[entry.word] = entries
      .filter((candidate) => candidate.word !== entry.word)
      .map((candidate) => ({
        word: candidate.word,
        distance: roundNumber(euclideanDistance(entry.vector, candidate.vector)),
      }))
      .sort((left, right) => left.distance - right.distance || left.word.localeCompare(right.word))
      .slice(0, neighborCount);
  }
  return graph;
}

function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("vector_must_be_non_empty_array");
  }
  return vector.map((value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error("vector_value_must_be_finite_number");
    }
    return number;
  });
}

function zeroVector(size) {
  return Array.from({ length: size }, () => 0);
}

function addVectors(left, right) {
  return left.map((value, index) => value + right[index]);
}

function subtractVectors(left, right) {
  return left.map((value, index) => value - right[index]);
}

function scaleVector(vector, scalar) {
  return vector.map((value) => value * scalar);
}

function dot(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function norm(vector) {
  return Math.sqrt(dot(vector, vector));
}

function euclideanDistance(left, right) {
  return norm(subtractVectors(left, right));
}

function cosineSimilarity(left, right) {
  const denominator = norm(left) * norm(right);
  if (denominator === 0) return 0;
  return dot(left, right) / denominator;
}

function roundNumber(value) {
  return Number(value.toFixed(8));
}
