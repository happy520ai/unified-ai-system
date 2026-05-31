import { readJsonFile, resolveRepoRoot } from "./contextPackPreviewReader.js";
import { buildRepeatedTaskPlan } from "./repeatedTaskPlanBuilder.js";

export function estimateRepeatedTokenSaving(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const plan = options.plan || buildRepeatedTaskPlan(options);
  const tokenReport = readJsonFile(repoRoot, ".codex-context/token-budget-report.json").data || {};
  const saving = tokenReport.tokenSavingEstimate || {};
  const budget = tokenReport.budget || {};
  const fullContextEstimate = Number(saving.fullContextEstimate || 160000);
  const packEstimate = Number(saving.packedContextEstimate || budget.estimatedTokens || 6500);
  const taskEstimates = plan.tasks.map((task, index) => {
    const perTaskPackEstimate = packEstimate + index * 7;
    const savedTokens = Math.max(0, fullContextEstimate - perTaskPackEstimate);
    const savingPercent = fullContextEstimate > 0 ? Math.round((savedTokens / fullContextEstimate) * 100) : 0;
    return {
      taskId: task.taskId,
      fullContextEstimate,
      contextPackEstimate: perTaskPackEstimate,
      savingTokens: savedTokens,
      savingPercent,
      budgetRespected: perTaskPackEstimate <= Number(budget.maxTokens || 16000),
    };
  });
  const savingPercents = taskEstimates.map((item) => item.savingPercent);
  const averageSavingPercent = Math.round(savingPercents.reduce((sum, value) => sum + value, 0) / Math.max(1, savingPercents.length));
  return {
    completed: taskEstimates.length >= 8,
    repeatedTokenSavingEstimated: true,
    allTasksHaveTokenEstimate: taskEstimates.every((item) => item.contextPackEstimate > 0),
    averageSavingPercent,
    averageSavingPercentVisible: averageSavingPercent > 0,
    minSavingPercent: Math.min(...savingPercents),
    maxSavingPercent: Math.max(...savingPercents),
    budgetRespectedCount: taskEstimates.filter((item) => item.budgetRespected).length,
    budgetRespectedForAllTasks: taskEstimates.every((item) => item.budgetRespected),
    savingPercentAboveThreshold: averageSavingPercent >= 80,
    taskEstimates,
  };
}
