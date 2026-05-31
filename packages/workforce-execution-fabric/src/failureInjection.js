export function createFailureInjectionPlan() {
  return {
    planId: "phase578-failure-injection-plan",
    scenarios: [
      {
        scenarioId: "branch-timeout",
        branchId: "branch-engineering-path",
        type: "timeout",
        expectedCompletionVerified: false,
      },
      {
        scenarioId: "employee-unavailable",
        branchId: "branch-product-path",
        type: "employee_unavailable",
        expectedCompletionVerified: false,
      },
      {
        scenarioId: "merge-conflict",
        branchId: "branch-safety-path",
        type: "merge_conflict",
        expectedCompletionVerified: false,
      },
    ],
    providerCallsMade: false,
  };
}

export function selectFailureScenario(plan, scenarioId) {
  return plan.scenarios.filter((scenario) => scenario.scenarioId === scenarioId);
}

export function validateFailureInjectionPlan(plan) {
  return {
    valid:
      Array.isArray(plan?.scenarios) &&
      plan.scenarios.length === 3 &&
      plan.scenarios.every((scenario) => scenario.expectedCompletionVerified === false) &&
      plan?.providerCallsMade === false,
    scenarioCount: plan?.scenarios?.length || 0,
  };
}
