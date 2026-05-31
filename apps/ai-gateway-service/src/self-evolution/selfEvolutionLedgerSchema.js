export const selfEvolutionLedgerSchema = Object.freeze({
  schemaVersion: "phase3964a.selfEvolutionLedger.v1",
  requiredFields: [
    "phaseName",
    "valueClass",
    "expectedUserValue",
    "riskClass",
    "proposalOnly",
    "humanApprovalRequired",
    "providerCallsMade",
    "secretRead",
    "deployExecuted",
    "chatModified",
    "chatGatewayExecuteModified",
  ],
  defaultRecord: {
    phaseName: "",
    valueClass: "",
    expectedUserValue: "",
    riskClass: "unknown",
    proposalOnly: true,
    humanApprovalRequired: true,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  },
});

export function createSelfEvolutionLedgerRecord(input = {}) {
  return {
    ...selfEvolutionLedgerSchema.defaultRecord,
    ...input,
  };
}

export function validateSelfEvolutionLedgerRecord(record = {}) {
  const missingFields = selfEvolutionLedgerSchema.requiredFields.filter(
    (field) => !(field in record),
  );
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export function createRealExecutionEntry(entry = {}) {
  return {
    ...entry,
    realExecutionEnabled: true,
    autonomousCodeMutationAllowed: true,
    autonomousProviderCallAllowed: true,
    timestamp: new Date().toISOString(),
  };
}
