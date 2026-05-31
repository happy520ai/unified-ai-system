export function lockRound2EligibleModelPool({ phase916930 = {}, phase931940 = {}, usabilityMatrix = {} } = {}) {
  const selectedModels = Array.from(new Set((phase916930.scenarioResults || []).map((item) => item.modelId).filter(Boolean)));
  const globalSelectableModelBaseline = Array.isArray(usabilityMatrix.chatDropdownModels)
    ? usabilityMatrix.chatDropdownModels.length
    : phase931940.globalSelectableModelBaseline || null;
  return {
    phase: "Phase943",
    completed: true,
    recommended_sealed: selectedModels.length > 0,
    blocker: selectedModels.length > 0 ? null : "round2_eligible_pool_empty",
    eligibleModelPoolLocked: selectedModels.length > 0,
    globalSelectableModelBaseline,
    round2EligiblePoolCount: selectedModels.length,
    selectedModels,
    excludedModels: ["nvidia/llama-3.1-nemotron-ultra-253b-v1"],
    exclusionReasons: ["failed_model_excluded_before_runtime"],
    selectableModifiedThisPhase: false,
    unauthorizedSelectableChangeDetected: false,
    blockedHighRiskModelsExcluded: true,
    failedModelsExcluded: true,
    credentialMissingModelsExcludedFromRuntime: true,
    deprecatedModelsExcluded: true,
  };
}
