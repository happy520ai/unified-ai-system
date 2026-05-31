import { canonicalizeModelId } from "./globalModelCatalogSchema.js";

export function resolveModelAliases(models = []) {
  const byCanonical = new Map();
  const aliases = [];
  for (const model of models) {
    const canonicalModelId = canonicalizeModelId(model.canonicalModelId ?? model.modelId);
    const existing = byCanonical.get(canonicalModelId);
    if (existing) {
      aliases.push({
        canonicalModelId,
        keptModelId: existing.modelId,
        aliasModelId: model.modelId,
        reason: "canonical_id_match",
      });
      continue;
    }
    byCanonical.set(canonicalModelId, { ...model, canonicalModelId });
  }
  return {
    phase: "Phase774",
    inputModelCount: models.length,
    dedupedModelCount: byCanonical.size,
    aliasCount: aliases.length,
    aliases,
    models: Array.from(byCanonical.values()),
    providerCallsMade: false,
    secretRead: false,
    selectableModified: false,
  };
}
