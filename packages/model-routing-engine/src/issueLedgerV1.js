export function buildIssueLedgerV1(issues = []) {
  return {
    schemaVersion: "issue-ledger.v1",
    generatedByPhase: "Phase1162",
    actualFixesAppliedThisPhase: false,
    issues: issues.map((issue, index) => ({
      issueId: issue.issueId || `ISSUE-${String(index + 1).padStart(3, "0")}`,
      source: issue.source || "manual",
      title: issue.title || "Untitled issue",
      description: issue.description || "",
      affectedArea: issue.affectedArea || "unknown",
      severity: issue.severity || "unknown",
      evidenceRef: issue.evidenceRef || "",
      reproSteps: Array.isArray(issue.reproSteps) ? issue.reproSteps : [],
      suggestedFix: issue.suggestedFix || "",
      activeUnsafeRisk: issue.activeUnsafeRisk === true,
      fixNowAllowed: false,
      requiresApproval: true
    }))
  };
}
