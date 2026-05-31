export function buildUsageEvidence(options = {}) {
  const preview = options.preview || {};
  return {
    completed: Boolean(preview.completed),
    contextHash: preview.contextHash || "",
    stale: preview.freshnessGate?.stale === true,
    tokenBudgetRespected: preview.tokenBudgetEnforcement?.currentBudgetRespected === true,
    relevantFileCount: Number(preview.relevantFileScope?.relevantFileCount || 0),
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
  };
}
