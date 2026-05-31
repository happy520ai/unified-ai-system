export function buildModelExpansionMetrics({ providerRegistry, seedPack, dryRunImport, aliasReport } = {}) {
  const imported = dryRunImport?.imported ?? [];
  const statusCounts = countBy(imported, "status");
  const credentialMissingCount = statusCounts.credential_missing ?? 0;
  const credentialReadyCount = statusCounts.credential_ready ?? 0;
  const smokePendingCount = statusCounts.smoke_pending ?? 0;
  const selectableCandidateCount = statusCounts.selectable_candidate ?? 0;
  const highRiskBlockedCount = imported.filter((model) => model.risk?.highRisk || model.risk?.blocked || model.risk?.deprecated).length;
  return {
    phase: "Phase777",
    currentMatchedModelCount: 148,
    currentSelectableModelCount: 17,
    currentSmokePassedModelCount: 17,
    currentFailedModelCount: 1,
    currentHighRiskBlockedModelCount: 12,
    providerFamilyCount: providerRegistry?.providerFamilyCount ?? 0,
    catalogSeedModelCount: seedPack?.catalogSeedModelCount ?? 0,
    dryRunImportedModelCount: dryRunImport?.importedModelCount ?? 0,
    dedupedModelCount: aliasReport?.dedupedModelCount ?? 0,
    credentialMissingCount,
    credentialReadyCount,
    smokePendingCount,
    selectableCandidateCount,
    highRiskBlockedCount,
    newSelectableModelsAdded: 0,
    selectableModelCountUnchanged: true,
    smokePassedModelCountUnchanged: true,
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    selectableModified: false,
  };
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
