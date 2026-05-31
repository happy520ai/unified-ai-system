import { buildSafetyBoundary } from "./repeatedTaskPlanBuilder.js";

export function buildRepeatedUsageEvidence({ report } = {}) {
  return {
    phaseRange: "Phase596A-T",
    title: "Codex Context Gateway Repeated Usage Trial + Token Saving Benchmark",
    completed: report?.completed === true,
    recommended_sealed: report?.completed === true,
    blocker: report?.completed === true ? null : "phase596_benchmark_incomplete",
    executedTaskCount: report?.aggregate?.executedTaskCount || 0,
    averageTokenSavingPercent: report?.aggregate?.averageTokenSavingPercent || 0,
    fullRepoScanFlaggedCount: report?.aggregate?.fullRepoScanFlaggedCount || 0,
    failedTaskCount: report?.aggregate?.failedTaskCount || 0,
    benchmarkStatus: report?.classifier?.trialStatus || "failed_validation",
    safetyBoundary: buildSafetyBoundary(),
  };
}
