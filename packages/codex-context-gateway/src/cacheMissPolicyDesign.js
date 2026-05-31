export function buildCacheMissPolicyDesign() {
  return {
    completed: true,
    cacheMissPolicyDefined: true,
    contextHashReuseDefined: true,
    stablePromptPrefixDefined: true,
    evidenceRefsOnly: true,
    tokenBudgetGateIncluded: true,
    staleGuardIncluded: true,
    repeatedContextPackReuse: true,
    policy: [
      "reuse current context hash when freshness report is stale=false",
      "send stable prompt prefix before task-specific instructions",
      "include evidence refs instead of expanding raw evidence bodies",
      "limit reads to relevant-files.json unless reason is recorded",
      "fail closed when token budget is exceeded",
    ],
  };
}
