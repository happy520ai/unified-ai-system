export function buildUsageTrialEvidence({ report } = {}) {
  return {
    completed: report?.completed === true,
    phaseRange: "Phase595A-T",
    contextPackUsed: report?.usageTracker?.contextPackUsed === true,
    relevantFilesUsed: report?.usageTracker?.relevantFilesUsed === true,
    promptPackUsed: report?.usageTracker?.promptPackUsed === true,
    staleGateUsed: report?.usageTracker?.freshnessGateUsed === true,
    tokenBudgetRespected: report?.tokenSaving?.budgetRespected === true,
    trialNoteGenerated: report?.trialNote?.trialNoteGenerated === true,
    validationCommandsPassed: report?.validationExecution?.allValidationCommandsPassed === true,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
  };
}
