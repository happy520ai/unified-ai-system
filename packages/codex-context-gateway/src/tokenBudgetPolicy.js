export const TOKEN_BUDGET_POLICIES = Object.freeze({
  "8k": Object.freeze({
    budgetName: "8k",
    maxTokens: 8000,
    projectStateTokens: 900,
    evidenceTokens: 1200,
    diffTokens: 900,
    relevantFileTokens: 1800,
    longContextTokens: 1800,
    promptTokens: 1400,
    overflowStrategy: "truncate",
  }),
  "16k": Object.freeze({
    budgetName: "16k",
    maxTokens: 16000,
    projectStateTokens: 1800,
    evidenceTokens: 2400,
    diffTokens: 1800,
    relevantFileTokens: 3600,
    longContextTokens: 3600,
    promptTokens: 2800,
    overflowStrategy: "summarize",
  }),
  "32k": Object.freeze({
    budgetName: "32k",
    maxTokens: 32000,
    projectStateTokens: 3600,
    evidenceTokens: 4800,
    diffTokens: 3600,
    relevantFileTokens: 7200,
    longContextTokens: 7200,
    promptTokens: 5600,
    overflowStrategy: "reference-only",
  }),
});

export function estimateTokens(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(String(text || "").length / 4);
}

export function selectTokenBudgetPolicy(budgetName = "16k") {
  return TOKEN_BUDGET_POLICIES[budgetName] || TOKEN_BUDGET_POLICIES["16k"];
}

export function buildTokenBudgetReport(sections, budgetName = "16k") {
  const policy = selectTokenBudgetPolicy(budgetName);
  const sectionEntries = Object.entries(sections).map(([name, value]) => ({
    name,
    rawEstimatedTokens: estimateTokens(value),
    budgetedTokens: Math.min(estimateTokens(value), allocationForSection(policy, name)),
    allocation: allocationForSection(policy, name),
    overflowAction: estimateTokens(value) > allocationForSection(policy, name) ? policy.overflowStrategy : "none",
  }));
  const estimatedTokens = sectionEntries.reduce((sum, item) => sum + item.budgetedTokens, 0);
  const rawEstimatedTokens = sectionEntries.reduce((sum, item) => sum + item.rawEstimatedTokens, 0);
  const fullContextEstimate = Math.max(rawEstimatedTokens * 5, policy.maxTokens * 3);
  const savedTokens = Math.max(0, fullContextEstimate - estimatedTokens);
  const savedPercent = fullContextEstimate === 0 ? 0 : Math.round((savedTokens / fullContextEstimate) * 100);
  return {
    completed: true,
    policies: Object.values(TOKEN_BUDGET_POLICIES),
    budget: {
      ...policy,
      estimatedTokens,
      rawEstimatedTokens,
      respected: estimatedTokens <= policy.maxTokens,
      sectionEntries,
    },
    tokenSavingEstimate: {
      fullContextEstimate,
      packedContextEstimate: estimatedTokens,
      savedTokens,
      savedPercent,
      method: "estimated-by-character-count-reference-pack",
    },
  };
}

function allocationForSection(policy, name) {
  const map = {
    projectState: policy.projectStateTokens,
    phaseEvidence: policy.evidenceTokens,
    gitDiff: policy.diffTokens,
    relevantFiles: policy.relevantFileTokens,
    longContextSummary: policy.longContextTokens,
    task: Math.min(500, policy.promptTokens),
  };
  return map[name] || Math.max(250, Math.floor(policy.maxTokens / 10));
}
