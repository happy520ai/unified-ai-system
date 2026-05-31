import { runContextPreflight } from "./contextPreflight.js";
import { runFreshnessGate } from "./freshnessGate.js";
import { enforceUsageTokenBudget } from "./usageTokenBudgetEnforcer.js";

export function runRealUsageTrialPreflight(options = {}) {
  const context = runContextPreflight(options);
  const freshness = runFreshnessGate(options);
  const tokenBudget = enforceUsageTokenBudget(options);
  const preflightPassed = context.completed && freshness.stale === false && tokenBudget.currentBudgetRespected === true;
  return {
    completed: preflightPassed,
    ...context,
    preflightPassed,
    stale: freshness.stale,
    staleFalseAllowsTrial: freshness.staleFalseAllows,
    tokenBudgetRespected: tokenBudget.currentBudgetRespected,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    providerCallsMade: false,
  };
}
