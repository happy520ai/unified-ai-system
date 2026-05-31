export function importWikidataJsonPreview(input = {}) {
  const source = input.source ?? {};
  const parsed = typeof input.json === "string" ? JSON.parse(input.json) : input.json;
  const entity = parsed?.entities ? Object.values(parsed.entities)[0] : parsed;
  const claims = entity?.claims ?? {};
  const label = entity?.labels?.en?.value ?? entity?.labels?.zh?.value ?? "Unknown entity";
  const description = entity?.descriptions?.en?.value ?? entity?.descriptions?.zh?.value ?? "";
  const claimCount = Object.values(claims).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);

  return {
    adapter: "wikidata-json-preview",
    adapterMode: "fixture-json-entity-preview",
    entitiesParsed: entity?.id ? 1 : 0,
    entityRecord: {
      sourceId: source.sourceId ?? "wikidata-json-preview",
      sourceFamily: "wikidata-json",
      entityId: entity?.id ?? "unknown",
      label,
      description,
      claimCount,
      licenseNote: source.licenseNote ?? "structured public data; source-specific license and attribution required",
      freshnessPolicy: source.freshnessPolicy ?? "periodic_snapshot",
      snapshotDate: "2026-05-01",
    },
    paidApiCallCount: 0,
    externalApiCalled: false,
    embeddingApiCalled: false,
    llmCleaningCalled: false,
    fullDumpImported: false,
  };
}
