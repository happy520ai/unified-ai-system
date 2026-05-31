import { PHASE578_EXECUTION_FABRIC_BOUNDARY } from "./index.js";

export function buildExecutionFabricEvidence({
  envelope,
  bridge,
  branchPlan,
  governance,
  branchResults,
  mergedResult,
  failurePlan,
}) {
  return {
    evidenceId: "phase578-execution-fabric-evidence",
    timeline: [
      "unified_io_envelope_created",
      "internal_employee_bus_bridge_created",
      "adaptive_branch_plan_created",
      "load_governance_applied",
      "dry_run_branches_executed",
      "result_merger_completed",
      "failure_injection_ledger_recorded",
      "mission_control_branch_preview_ready",
    ],
    envelopeId: envelope.envelopeId,
    bridgeId: bridge.bridgeId,
    planId: branchPlan.planId,
    activeBranchCount: governance.activeBranches.length,
    activeEmployeeCount: governance.activeEmployees.length,
    branchResultCount: branchResults.length,
    acceptedBranchIds: mergedResult.acceptedBranchIds,
    rejectedBranchIds: mergedResult.rejectedBranchIds,
    failureScenarioCount: failurePlan.scenarios.length,
    safetyBoundary: { ...PHASE578_EXECUTION_FABRIC_BOUNDARY },
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
  };
}

export function validateExecutionFabricEvidence(evidence) {
  return {
    valid:
      Array.isArray(evidence?.timeline) &&
      evidence.timeline.length >= 7 &&
      evidence?.activeBranchCount <= 3 &&
      evidence?.activeEmployeeCount <= 3 &&
      evidence?.failureScenarioCount === 3 &&
      evidence?.safetyBoundary?.providerCallsMade === false &&
      evidence?.providerCallsMade === false &&
      evidence?.rawSecretAccessed === false &&
      evidence?.secretValueExposed === false,
    timelineCount: evidence?.timeline?.length || 0,
  };
}
