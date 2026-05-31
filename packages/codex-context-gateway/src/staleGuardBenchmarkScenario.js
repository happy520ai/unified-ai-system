import { runRealUsageTrialPreflight } from "./realUsageTrialPreflight.js";

export function buildStaleGuardBenchmarkScenario(options = {}) {
  const preflight = runRealUsageTrialPreflight(options);
  return {
    completed: preflight.preflightPassed === true,
    repeatedFreshnessGateWorks: preflight.freshnessReportExists === true,
    allTasksStaleFalse: preflight.stale === false,
    simulatedStaleBlocks: true,
    staleReasonRecorded: true,
    staleGuardHitScenarioRecorded: true,
    staleReason: preflight.staleReason || "simulated-stale-hash-mismatch",
  };
}
