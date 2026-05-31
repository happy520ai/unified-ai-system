export function buildWorkforceEvidence({ taskUnderstanding, selectedPyramidPath, candidateEmployees, activeEmployees, rejectedEmployees, policy }) {
  return {
    evidenceId: "phase576c-workforce-dry-run-preview",
    evidenceTimeline: [
      "task_understanding_created",
      "roles_routed",
      "fanout_policy_applied",
      "active_employees_selected",
      "brain_calls_skipped_by_policy",
      "dry_run_contributions_recorded",
    ],
    taskUnderstanding,
    selectedPyramidPath,
    candidateEmployees: candidateEmployees.map(toEvidenceEmployee),
    activeEmployees: activeEmployees.map(toEvidenceEmployee),
    rejectedEmployees,
    fanoutPolicy: policy,
    providerCallsMade: false,
    secretValueExposed: false,
  };
}

function toEvidenceEmployee(employee) {
  return {
    employeeId: employee.employeeId,
    title: employee.title,
    pyramidLevel: employee.pyramidLevel,
    reason: "matched_task_role_and_within_fanout_budget",
  };
}
