import { PHASE587_FANOUT_LIMITS } from "../../employee-communication-contracts/src/index.js";

export function routeInternalMessage(message, allowedEmployeeIds = []) {
  const requested = [...message.toEmployeeIds, ...message.ccEmployeeIds];
  if (requested.includes("*")) {
    return {
      routed: false,
      blockedReason: "no_all_employee_broadcast",
      activeEmployees: allowedEmployeeIds.slice(0, PHASE587_FANOUT_LIMITS.maxActiveEmployees),
      rejectedEmployees: allowedEmployeeIds.slice(PHASE587_FANOUT_LIMITS.maxActiveEmployees).map((employeeId) => ({
        employeeId,
        reason: "broadcast_blocked_scheduler_review_required",
      })),
      dryRunOnly: true,
    };
  }
  const activeEmployees = requested.filter((employeeId) => allowedEmployeeIds.includes(employeeId)).slice(0, PHASE587_FANOUT_LIMITS.maxActiveEmployees);
  const rejectedEmployees = requested
    .filter((employeeId) => !activeEmployees.includes(employeeId))
    .map((employeeId) => ({ employeeId, reason: "scheduler_approval_required_or_fanout_limit" }));
  return {
    routed: true,
    blockedReason: null,
    activeEmployees,
    rejectedEmployees,
    maxActiveEmployees: PHASE587_FANOUT_LIMITS.maxActiveEmployees,
    maxBrainCalls: 0,
    dryRunOnly: true,
  };
}
