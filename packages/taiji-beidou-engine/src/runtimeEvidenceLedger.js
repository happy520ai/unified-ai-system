export function buildRuntimeEvidenceLedger(execution, admissionDecision = {}) {
  return {
    evidenceVersion: "phase671-runtime-evidence-ledger-v1",
    capabilityId: execution.capabilityId,
    runtimeKind: "sandbox_local",
    executionStatus: execution.executionStatus,
    leaseId: execution.leaseId,
    ttlSeconds: execution.ttlSeconds,
    maxRequests: execution.maxRequests,
    maxTokenBudget: execution.maxTokenBudget,
    maxRuntimeMs: execution.maxRuntimeMs,
    rollbackAvailable: execution.rollbackAvailable === true,
    rollbackRef: admissionDecision.rollbackRef || null,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
  };
}
