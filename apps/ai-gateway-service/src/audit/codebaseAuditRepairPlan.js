const PHASE279A_APPLIED_REPAIRS = [
  {
    issue: "secret-safety-fixture-prefix-false-positive",
    severity: "medium",
    status: "applied",
    file: "apps/ai-gateway-service/src/audit/codebaseAuditSecretScanner.js",
    repair: "Added context-aware allowance for known verifier fixtures, provider prefix rules, and process.env references without recording plaintext values.",
    whyMinimal: "The repair only narrows deterministic false positives in the audit scanner and does not change provider, routing, HTTP, cache, RAG, or knowledge-import behavior.",
    verification: "node --check, audit:full-codebase, verify:phase279a-full-codebase-audit, and verify:phase107a-secret-safety.",
  },
  {
    issue: "workspace-dirty-status-buffer-overflow",
    severity: "medium",
    status: "applied",
    file: "apps/ai-gateway-service/src/audit/codebaseAuditBoundaryCheck.js",
    repair: "Raised the git status maxBuffer so a large dirty workspace is detected instead of being treated as clean.",
    whyMinimal: "The repair only changes local audit command buffering and does not clean, revert, or mutate workspace files.",
    verification: "node --check, git status --short, audit:full-codebase, and verify:phase279a-full-codebase-audit.",
  },
];

export function buildRepairPlan(issues = []) {
  const repairable = issues.filter((issue) => ["critical", "high"].includes(issue.severity));
  return {
    repairsProposed: [
      ...PHASE279A_APPLIED_REPAIRS.map((repair) => ({
        issueId: repair.issue,
        severity: repair.severity,
        status: "applied",
        reason: repair.repair,
      })),
      ...repairable.map((issue) => ({
        issueId: issue.id,
        severity: issue.severity,
        status: "manual_required",
        reason: "High-severity codebase audit issue requires explicit minimal repair before passing.",
      })),
    ],
    repairsApplied: PHASE279A_APPLIED_REPAIRS,
    repairsSkipped: [],
    blockedRepairs: [],
    manualRequired: repairable.map((issue) => ({
      issueId: issue.id,
      severity: issue.severity,
      reason: "No automatic repair was applied by the audit runner.",
    })),
  };
}

export function countIssuesBySeverity(issues = []) {
  return {
    criticalIssues: issues.filter((issue) => issue.severity === "critical").length,
    highIssues: issues.filter((issue) => issue.severity === "high").length,
    mediumIssues: issues.filter((issue) => issue.severity === "medium").length,
    lowIssues: issues.filter((issue) => issue.severity === "low").length,
    infoFindings: issues.filter((issue) => issue.severity === "info").length,
  };
}
