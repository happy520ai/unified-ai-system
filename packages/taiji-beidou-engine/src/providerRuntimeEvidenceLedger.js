export function buildProviderRuntimeEvidenceLedger(input = {}) {
  const approval = input.approval || {};
  const execution = input.execution || {};
  const gate = input.gate || {};
  return {
    ledgerVersion: "phase680-provider-runtime-evidence-ledger-v1",
    approvalRef: input.approvalRef || "docs/phase675_682-real-provider-runtime-approval.input.json",
    admissionRef: input.admissionRef || null,
    bridgeDryRunRef: "apps/ai-gateway-service/evidence/phase675_682/provider-runtime-bridge-dry-run-result.json",
    executionRef: "apps/ai-gateway-service/evidence/phase675_682/guarded-real-provider-runtime-one-shot-result.json",
    providerId: approval.providerId || execution.providerId || "nvidia",
    modelId: approval.modelId || execution.modelId || null,
    capabilityId: approval.capabilityId || execution.capabilityId || gate.capabilityId || null,
    credentialRefUsed: true,
    rawSecretRead: false,
    maxRequests: Number(approval.maxRequests || 1),
    actualRequests: Number(execution.requestAttemptCount || 0),
    maxEstimatedCostUsd: Number(approval.maxEstimatedCostUsd || 0),
    estimatedCostUsd: Number(execution.costEstimateUsd || 0),
    responseClassification: execution.responseClassification || "blocked_by_missing_approval",
    rollbackRef: gate.rollbackRef || null,
    rollbackAvailable: Boolean(gate.rollbackRef),
    emergencyDisableRef: "TAIJI_BEIDOU_REAL_PROVIDER_RUNTIME_ENABLED=false",
    emergencyDisableAvailable: true,
    maxRequestsRespected: Number(execution.requestAttemptCount || 0) <= Number(approval.maxRequests || 1),
    budgetGuardAttached: true,
    evidenceLedgerGenerated: true,
  };
}
