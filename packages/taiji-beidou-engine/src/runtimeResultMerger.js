export function mergeRuntimeResults(executions = [], failures = []) {
  const all = [...executions, ...failures];
  const counts = {
    accepted: executions.filter((item) => item.executionStatus === "passed").length,
    rejected: all.filter((item) => item.executionStatus === "rejected").length,
    blocked: all.filter((item) => item.executionStatus === "blocked").length,
    failed: all.filter((item) => item.executionStatus === "failed").length,
    timeout: all.filter((item) => item.blockedReason === "runtime_timeout").length,
    budget_exceeded: all.filter((item) => /budget_exceeded/.test(item.blockedReason || "")).length,
    rollback_required: all.filter((item) => item.rollbackRequired === true).length,
  };

  return {
    phase: "Phase671",
    runtimeResultMergerAvailable: true,
    statuses: counts,
    failedRuntimeNotMarkedPassed: all.every((item) => item.executionStatus !== "failed" || item.executionStatus !== "passed"),
    blockedRuntimeNotMarkedCompleted: all.every((item) => item.executionStatus !== "blocked" || item.completed !== true),
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
  };
}
