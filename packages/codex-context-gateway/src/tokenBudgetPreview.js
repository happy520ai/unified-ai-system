import { readJsonFile, resolveRepoRoot, sanitizeValue, safeArray } from "./contextPackPreviewReader.js";

export function readTokenBudgetPreview(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const reportFile = readJsonFile(repoRoot, ".codex-context/token-budget-report.json");
  const report = reportFile.data || {};
  const policies = safeArray(report.policies);
  const budget = report.budget || {};
  const preview = {
    completed: reportFile.exists && reportFile.valid,
    tokenBudgetReportReadable: reportFile.exists && reportFile.valid,
    tokenBudgetVisible: policies.length >= 3,
    policies: sanitizeValue(policies.map((item) => ({
      budgetName: item.budgetName,
      maxTokens: item.maxTokens,
      overflowStrategy: item.overflowStrategy,
    }))),
    policy8kVisible: policies.some((item) => item.budgetName === "8k"),
    policy16kVisible: policies.some((item) => item.budgetName === "16k"),
    policy32kVisible: policies.some((item) => item.budgetName === "32k"),
    currentEstimate: Number(budget.estimatedTokens || 0),
    currentEstimateVisible: Number(budget.estimatedTokens || 0) > 0,
    maxTokens: Number(budget.maxTokens || 0),
    budgetName: budget.budgetName || "unknown",
    budgetRespected: budget.respected === true,
    budgetRespectedVisible: typeof budget.respected === "boolean",
    tokenSavingEstimate: sanitizeValue(report.tokenSavingEstimate || {}),
    tokenSavingEstimateVisible: Number(report.tokenSavingEstimate?.savedTokens || 0) > 0,
    providerCallsMade: false,
    errors: reportFile.errors,
  };
  return preview;
}
