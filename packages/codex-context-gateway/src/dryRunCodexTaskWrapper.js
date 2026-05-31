import { runContextPreflight } from "./contextPreflight.js";
import { runFreshnessGate } from "./freshnessGate.js";
import { buildRelevantFileScopeGate } from "./relevantFileScopeGate.js";
import { loadPromptPack } from "./promptPackLoader.js";
import { planValidationCommands } from "./validationCommandPlanner.js";

export function buildDryRunCodexTaskWrapper(options = {}) {
  const preflight = options.preflight || runContextPreflight(options);
  const freshness = options.freshnessGate || runFreshnessGate(options);
  const relevantScope = options.relevantFileScope || buildRelevantFileScopeGate(options);
  const promptPack = options.promptPack || loadPromptPack(options);
  const validationPlan = options.validationPlan || planValidationCommands({ ...options, promptPack });
  const ready =
    preflight.completed &&
    freshness.staleFalseAllows &&
    relevantScope.scopeGateWorks &&
    promptPack.promptPackReadable &&
    validationPlan.validationCommandPlannerWorks;
  return {
    completed: ready,
    dryRunTaskWrapperWorks: ready,
    preflightExecuted: preflight.completed === true,
    freshnessGateExecuted: freshness.freshnessGateWorks === true,
    relevantFileScopeApplied: relevantScope.scopeGateWorks === true,
    promptPackLoaded: promptPack.promptPackReadable === true,
    validationPlanGenerated: validationPlan.validationCommandPlannerWorks === true,
    taskPlan: {
      mode: "dry-run-preview",
      readContextPackFirst: true,
      stopWhenStale: true,
      defaultReadScope: relevantScope.allowedPaths,
      validationCommands: validationPlan.commands,
    },
    realCodexConnectionMade: false,
    providerCallsMade: false,
  };
}
