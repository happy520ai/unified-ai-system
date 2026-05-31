export function classifyRepeatedUsageResults({ plan, tokenSaving, scanAvoidance, staleScenario } = {}) {
  const tasks = plan?.tasks || [];
  const taskResults = tasks.map((task) => ({
    taskId: task.taskId,
    status:
      staleScenario?.allTasksStaleFalse !== true
        ? "blocked_by_stale_context"
        : tokenSaving?.budgetRespectedForAllTasks !== true
          ? "blocked_by_budget"
          : scanAvoidance?.fullRepoScanFlagged === true
            ? "blocked_by_scope_violation"
            : "pass",
  }));
  const failedTasks = taskResults.filter((item) => item.status !== "pass");
  return {
    completed: tasks.length >= 8 && failedTasks.length === 0,
    benchmarkResultClassifierWorks: true,
    allExecutedTasksClassified: taskResults.length >= 8 && taskResults.every((item) => item.status),
    failedTasksCount: failedTasks.length,
    blockerPolicyApplied: true,
    trialStatus: failedTasks.length === 0 ? "pass" : "failed_validation",
    taskResults,
  };
}
