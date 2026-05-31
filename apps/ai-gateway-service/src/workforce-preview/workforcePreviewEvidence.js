export function buildWorkforcePreviewEvidence({ schedulerResult, brainBindingPreview, finalRecommendedPlan }) {
  return {
    evidenceId: "phase576f-real-task-workforce-dry-run",
    evidenceTimeline: [
      "real_task_received",
      "task_understanding_created",
      "candidate_employees_selected",
      "fanout_policy_applied",
      "brain_adapter_preview_created",
      "provider_call_skipped",
      "final_recommended_plan_created",
    ],
    taskUnderstanding: schedulerResult.taskUnderstanding,
    selectedPyramidPath: schedulerResult.selectedPyramidPath,
    candidateEmployees: schedulerResult.candidateEmployees.map(toEmployeeEvidence),
    activeEmployees: schedulerResult.activeEmployees.map(toEmployeeEvidence),
    rejectedEmployees: schedulerResult.rejectedEmployees,
    fanoutPolicy: schedulerResult.fanoutPolicy,
    brainBindingPreview,
    noProviderCallBoundary: {
      providerCallsMade: false,
      rawSecretAccessed: false,
      secretValueExposed: false,
      maxBrainCalls: schedulerResult.maxBrainCalls,
    },
    finalRecommendedPlan,
  };
}

function toEmployeeEvidence(employee) {
  return {
    employeeId: employee.employeeId,
    title: employee.title,
    pyramidLevel: employee.pyramidLevel,
    simulatedRoleContribution: `${employee.title} contributes dry-run review only.`,
    evidenceReason: "selected_by_role_router_and_limited_by_fanout_policy",
  };
}
