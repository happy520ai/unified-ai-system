export function classifyUsageTrialResult(input = {}) {
  const failureCases = {
    blocked_by_stale_context: input.stale === true,
    blocked_by_missing_context: input.preflightPassed === false,
    blocked_by_budget: input.tokenBudgetRespected === false,
    blocked_by_scope_violation: input.fullRepoScanFlagged === true,
    failed_validation: input.validationCommandsPassed === false,
  };
  const firstFailure = Object.entries(failureCases).find(([, value]) => value === true)?.[0] || null;
  const status = firstFailure || (input.notes?.length ? "pass_with_notes" : "pass");
  return {
    completed: true,
    resultClassifierWorks: true,
    trialStatusClassified: true,
    failureCasesClassified: Object.keys(failureCases).length === 5,
    blockerPolicyApplied: firstFailure === null || status.startsWith("blocked_by") || status === "failed_validation",
    status,
    failureCases,
    blocker: firstFailure,
  };
}
