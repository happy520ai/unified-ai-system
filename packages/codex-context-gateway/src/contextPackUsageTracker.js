import { runRealUsageTrialPreflight } from "./realUsageTrialPreflight.js";
import { loadPromptPack } from "./promptPackLoader.js";
import { buildRelevantFileUsagePolicy } from "./relevantFileUsagePolicy.js";
import { enforceUsageTokenBudget } from "./usageTokenBudgetEnforcer.js";

export function trackContextPackUsage(options = {}) {
  const preflight = options.preflight || runRealUsageTrialPreflight(options);
  const promptPack = options.promptPack || loadPromptPack(options);
  const policy = options.policy || buildRelevantFileUsagePolicy(options);
  const tokenBudget = options.tokenBudget || enforceUsageTokenBudget(options);
  return {
    completed: preflight.preflightPassed && promptPack.promptPackReadable && policy.relevantFilesLoaded && tokenBudget.currentBudgetRespected,
    contextPackUsed: preflight.contextPackMdExists && preflight.contextPackJsonExists,
    promptPackUsed: promptPack.promptPackReadable,
    relevantFilesUsed: policy.relevantFilesLoaded,
    freshnessGateUsed: preflight.staleFalseAllowsTrial === true,
    tokenBudgetChecked: tokenBudget.tokenBudgetEnforcerWorks === true,
    contextHash: options.contextHash || "",
  };
}
