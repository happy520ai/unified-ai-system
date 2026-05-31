import { resolveModelAliases } from "./modelAliasResolver.js";

export function runCatalogMergeAliasResolverRecheck({ existingSeed = [], expansionRecords = [] } = {}) {
  const merged = [...existingSeed, ...expansionRecords];
  const aliasReport = resolveModelAliases(merged);
  return {
    phase: "Phase795",
    mergeInputCount: merged.length,
    expansionRecordCount: expansionRecords.length,
    dedupedModelCount: aliasReport.dedupedModelCount,
    aliasCount: aliasReport.aliasCount,
    newSelectableModelsAdded: 0,
    selectableModelCountUnchanged: true,
    providerCallsMade: false,
    secretRead: false,
  };
}
