import { evaluateRuntimeBudget } from "./runtimeBudgetGuard.js";
import { evaluateRuntimeKillSwitch } from "./runtimeKillSwitch.js";

export function executeSandboxAutoRuntime(input = {}) {
  const capability = input.capability || {};
  const lease = input.lease || {};
  const dryRunResult = input.dryRunResult || {};
  const startedAt = input.startedAt || new Date().toISOString();
  const durationMs = Number(input.durationMs ?? 5);
  const killSwitch = evaluateRuntimeKillSwitch({
    runtimeKind: "sandbox_local",
    phaseDryRunOverride: true,
  });
  const budget = evaluateRuntimeBudget({
    lease,
    requestCount: 1,
    tokenEstimate: Number(input.tokenEstimate ?? 800),
    runtimeMs: durationMs,
  });

  let executionStatus = "passed";
  let blockedReason = null;
  if (killSwitch.sandboxDryRunAllowed !== true) {
    executionStatus = "blocked";
    blockedReason = killSwitch.blockedReason;
  } else if (budget.allowed !== true) {
    executionStatus = "blocked";
    blockedReason = budget.blockedReason;
  } else if (dryRunResult.status !== "passed") {
    executionStatus = "failed";
    blockedReason = "dry_run_adapter_failed";
  }

  const evidenceRef = `capabilities/_runtime_evidence/${capability.capabilityId}/runtime-evidence.json`;
  return {
    capabilityId: capability.capabilityId,
    runtimeKind: "sandbox_local",
    executionStatus,
    blockedReason,
    startedAt,
    endedAt: input.endedAt || new Date(Date.parse(startedAt) + durationMs).toISOString(),
    durationMs,
    leaseId: lease.leaseId,
    ttlSeconds: lease.ttlSeconds,
    maxRequests: lease.maxRequests,
    maxTokenBudget: lease.maxTokenBudget,
    maxRuntimeMs: lease.maxRuntimeMs,
    spawnDepth: lease.spawnDepth,
    parentGatewayId: lease.parentGatewayId,
    killSwitchRef: lease.killSwitchRef,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
    rollbackAvailable: Boolean(capability.rollbackRef),
    evidenceRef,
    runtimeAutoEnabledForSandboxOnly: true,
    productionRuntimeAutoEnabled: false,
  };
}
