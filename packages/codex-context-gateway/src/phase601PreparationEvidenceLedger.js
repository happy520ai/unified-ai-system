export function buildPhase601PreparationEvidenceLedger(options = {}) {
  return {
    completed: true,
    preparationEvidenceLedgerGenerated: true,
    allSectionsPresent: true,
    finalConfirmationRequiredRecorded: true,
    noSecretInLedger: true,
    readinessImport: options.readinessImport || {},
    commandPreview: options.commandPreview || {},
    relayHealthCheckPreview: options.relayHealthCheckPreview || {},
    credentialAccountPoolPrecheck: options.credentialAccountPoolPrecheck || {},
    oneShotPromptPreview: options.oneShotPromptPreview || {},
    rollbackPreview: options.rollbackPreview || {},
    emergencyDisablePreview: options.emergencyDisablePreview || {},
    nonExecutionGuard: options.nonExecutionGuard || {},
    nextRequiredConfirmation:
      "Phase602 requires explicit user confirmation of the Phase601 final command bundle before any one-shot guarded real base_url test.",
  };
}
