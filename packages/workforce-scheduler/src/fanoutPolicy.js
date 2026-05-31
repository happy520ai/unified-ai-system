import { DEFAULT_DRY_RUN_SCHEDULER_POLICY } from "../../workforce-contracts/src/index.js";

export const dryRunFanoutPolicy = Object.freeze({
  ...DEFAULT_DRY_RUN_SCHEDULER_POLICY,
  policyId: "phase576c-dry-run-fanout",
});

export function applyFanoutPolicy(candidates, policy = dryRunFanoutPolicy) {
  const candidateEmployees = candidates.slice(0, policy.maxCandidateEmployees);
  const activeEmployees = candidateEmployees.slice(0, policy.maxActiveEmployees);
  const rejectedEmployees = candidates.slice(policy.maxActiveEmployees).map((employee) => ({
    employeeId: employee.employeeId,
    title: employee.title,
    reason: "fanout_policy_limit_or_lower_task_match",
  }));
  return { candidateEmployees, activeEmployees, rejectedEmployees };
}
