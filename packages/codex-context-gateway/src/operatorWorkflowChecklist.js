export function buildOperatorWorkflowChecklist() {
  const items = [
    "Refresh context pack before a new Codex task.",
    "Confirm context-freshness-report.json has stale=false.",
    "Confirm token-budget-report.json has respected=true.",
    "Review relevant-files.json and keep reads scoped by default.",
    "Review codex-prompt-pack.md before starting.",
    "Run Codex task only in preview/dry-run workflow for this phase.",
    "Run validation commands after the task.",
    "Review docs and evidence before sealing.",
    "Do not claim workspace clean.",
  ];
  return {
    completed: true,
    operatorChecklistExists: true,
    items,
    staleCheckIncluded: items.some((item) => item.includes("stale=false")),
    budgetCheckIncluded: items.some((item) => item.includes("respected=true")),
    relevantFilesCheckIncluded: items.some((item) => item.includes("relevant-files.json")),
    validationIncluded: items.some((item) => item.includes("validation")),
    workspaceCleanClaimForbidden: items.some((item) => item.includes("Do not claim workspace clean")),
    providerCallsMade: false,
  };
}
