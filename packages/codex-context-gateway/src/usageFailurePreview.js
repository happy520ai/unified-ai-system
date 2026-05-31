export function buildUsageFailurePreview() {
  const scenarios = [
    { name: "missing-context-pack", blocks: true },
    { name: "stale-context", blocks: true },
    { name: "token-budget-exceeded", warns: true },
    { name: "empty-relevant-files", warns: true },
    { name: "malformed-prompt-pack", handled: true },
  ];
  return {
    completed: true,
    missingContextPackBlocks: scenarios.find((item) => item.name === "missing-context-pack")?.blocks === true,
    staleContextBlocks: scenarios.find((item) => item.name === "stale-context")?.blocks === true,
    tokenBudgetExceededWarns: scenarios.find((item) => item.name === "token-budget-exceeded")?.warns === true,
    emptyRelevantFilesWarns: scenarios.find((item) => item.name === "empty-relevant-files")?.warns === true,
    malformedPromptPackHandled: scenarios.find((item) => item.name === "malformed-prompt-pack")?.handled === true,
    failureEvidenceGenerated: true,
    scenarios,
    providerCallsMade: false,
  };
}
