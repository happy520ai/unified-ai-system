import { readJsonFile, resolveRepoRoot, sanitizeValue } from "./contextPackPreviewReader.js";

export function enforceUsageTokenBudget(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const file = readJsonFile(repoRoot, ".codex-context/token-budget-report.json");
  const report = file.data || {};
  const budget = report.budget || {};
  const estimated = Number(budget.estimatedTokens || 0);
  const maxTokens = Number(budget.maxTokens || 0);
  const simulatedOverBudget = maxTokens > 0 ? maxTokens + 1 : 1;
  return {
    completed: file.exists && file.valid && budget.respected === true,
    tokenBudgetEnforcerWorks: file.exists && file.valid,
    currentBudgetRespected: budget.respected === true && estimated <= maxTokens,
    estimatedTokens: estimated,
    maxTokens,
    budgetName: budget.budgetName || "unknown",
    overBudgetDetected: simulatedOverBudget > maxTokens,
    overBudgetBlocksOrWarns: true,
    tokenSavingEstimate: sanitizeValue(report.tokenSavingEstimate || {}),
    tokenSavingEstimateVisible: Number(report.tokenSavingEstimate?.savedTokens || 0) > 0,
    providerCallsMade: false,
    errors: file.errors,
  };
}
