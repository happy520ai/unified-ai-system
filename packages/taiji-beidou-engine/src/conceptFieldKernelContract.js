export const CONCEPT_FIELD_KERNEL_SCHEMA_VERSION = "phase1476.concept-field-kernel-contract.v1";

export function createConceptFieldKernelContract() {
  return {
    schemaVersion: CONCEPT_FIELD_KERNEL_SCHEMA_VERSION,
    kernelId: "taiji-beidou.concept-field.synthetic-dry-run",
    status: "experimental_sub_kernel_only",
    input: {
      inputConcepts: "string[]",
      positiveSources: "ConceptFieldSource[]",
      negativeSources: "ConceptFieldSource[]",
      neutralSources: "ConceptFieldSource[]",
      routeContext: "object",
      evidenceRefs: "string[]",
      riskSignals: "string[]",
    },
    output: {
      routeAffinityScore: "number",
      evidenceCoherenceScore: "number",
      surpriseScore: "number",
      riskFieldScore: "number",
      topActivatedConcepts: "ConceptScore[]",
      topSuppressedConcepts: "ConceptScore[]",
      unstableConcepts: "ConceptScore[]",
      sleepConsolidationCandidates: "ConceptScore[]",
      pruneCandidates: "ConceptScore[]",
    },
    boundaries: {
      syntheticVectorsOnly: true,
      gloveDownloadExecuted: false,
      externalDatasetLoaded: false,
      providerCallsMade: false,
      realSemanticValidationClaimed: false,
      productionReadinessClaimed: false,
      agiClaimAllowed: false,
      trillionModelSurpassClaimAllowed: false,
    },
  };
}

export function normalizeConceptFieldKernelInput(input = {}) {
  return {
    inputConcepts: normalizeStringArray(input.inputConcepts),
    positiveSources: normalizeSources(input.positiveSources, "positive"),
    negativeSources: normalizeSources(input.negativeSources, "negative"),
    neutralSources: normalizeSources(input.neutralSources, "neutral"),
    routeContext: input.routeContext && typeof input.routeContext === "object" ? { ...input.routeContext } : {},
    evidenceRefs: normalizeStringArray(input.evidenceRefs),
    riskSignals: normalizeStringArray(input.riskSignals),
    seed: String(input.seed ?? "phase1476-default-seed"),
    maxIterations: clampInteger(input.maxIterations ?? 4, 1, 12),
  };
}

export function validateConceptFieldKernelInput(input = {}) {
  const normalized = normalizeConceptFieldKernelInput(input);
  const errors = [];
  if (normalized.inputConcepts.length === 0) errors.push("inputConcepts_required");
  if (normalized.positiveSources.length === 0) errors.push("positiveSources_required");
  if (normalized.maxIterations < 1 || normalized.maxIterations > 12) errors.push("maxIterations_out_of_bounds");
  return {
    valid: errors.length === 0,
    errors,
    normalized,
  };
}

function normalizeSources(sources, defaultPolarity) {
  return (Array.isArray(sources) ? sources : [])
    .map((source) => {
      if (typeof source === "string") {
        return { concept: source, weight: 1, polarity: defaultPolarity };
      }
      return {
        concept: String(source?.concept ?? source?.id ?? "").trim(),
        weight: Number.isFinite(Number(source?.weight)) ? Number(source.weight) : 1,
        polarity: source?.polarity || defaultPolarity,
        evidenceRef: source?.evidenceRef || null,
      };
    })
    .filter((source) => source.concept);
}

function normalizeStringArray(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function clampInteger(value, min, max) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
