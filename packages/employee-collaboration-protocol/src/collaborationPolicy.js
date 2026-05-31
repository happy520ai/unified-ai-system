import { PHASE587_FANOUT_LIMITS } from "../../employee-communication-contracts/src/index.js";

export function enforceCollaborationPolicy({ selectedEmployees = [], requestedEmployees = [] } = {}) {
  const selected = selectedEmployees.slice(0, PHASE587_FANOUT_LIMITS.maxActiveEmployees);
  const rejected = requestedEmployees
    .filter((employeeId) => !selected.includes(employeeId))
    .map((employeeId) => ({ employeeId, reason: "fanout_policy_limit_or_scheduler_approval_required" }));
  return {
    selectedEmployees: selected,
    rejectedEmployees: rejected,
    noAllEmployeeBroadcast: requestedEmployees.includes("*") ? false : true,
    schedulerApprovalRequiredForNewParticipants: true,
    maxCandidateEmployees: PHASE587_FANOUT_LIMITS.maxCandidateEmployees,
    maxActiveEmployees: PHASE587_FANOUT_LIMITS.maxActiveEmployees,
    maxBrainCalls: 0,
    dryRunOnly: true,
  };
}

export function blockAllEmployeeBroadcast() {
  return {
    allowed: false,
    blockedReason: "no_all_employee_broadcast",
    activeEmployees: ["emp-product-chief", "emp-ux-researcher", "emp-security-chief"],
    rejectedEmployees: [
      { employeeId: "emp-ai-gateway-engineer", reason: "broadcast_blocked_scheduler_review_required" },
      { employeeId: "emp-qa-engineer", reason: "broadcast_blocked_scheduler_review_required" },
    ],
    maxActiveEmployees: PHASE587_FANOUT_LIMITS.maxActiveEmployees,
    maxBrainCalls: 0,
    dryRunOnly: true,
  };
}
