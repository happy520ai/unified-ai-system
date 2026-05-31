export function buildFixCandidateBatch(issues = []) {
  return {
    schemaVersion: "fix-candidate-batch.v1",
    actualFixesAppliedThisPhase: false,
    candidates: issues.map((issue) => ({
      issueId: issue.issueId,
      severity: issue.severity || "unknown",
      title: issue.title || "",
      proposedScope: issue.severity === "P0" || issue.severity === "P1" ? "plan-only-requires-approval" : "low-risk-dry-run-candidate",
      fixNowAllowed: false,
      requiresApproval: true,
      rollbackPlan: [
        "Revert only the files changed by the approved fix.",
        "Run the fix regression matrix.",
        "Do not use git reset --hard or git clean."
      ],
      regressionCommands: [
        "pnpm verify:phase107a-secret-safety",
        "pnpm verify:phase321a-workbench-product-recovery",
        "pnpm smoke:phase308a-desktop-workbench-ui"
      ]
    }))
  };
}
