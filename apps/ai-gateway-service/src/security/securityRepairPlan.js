export function buildSecurityRepairPlan(findings = []) {
  const repairable = findings.filter((finding) => ["critical", "high"].includes(finding.severity));
  return {
    repairsProposed: repairable.map((finding) => ({
      findingId: finding.id,
      severity: finding.severity,
      status: "manual_required",
      reason: "High-severity security finding requires explicit minimal repair before passing.",
    })),
    repairsApplied: [],
    repairsSkipped: [],
    manualRequired: repairable.map((finding) => ({
      findingId: finding.id,
      severity: finding.severity,
      reason: "No automatic security repair was applied by the audit runner.",
    })),
  };
}

export function countFindingsBySeverity(findings = []) {
  return {
    criticalFindings: findings.filter((finding) => finding.severity === "critical").length,
    highFindings: findings.filter((finding) => finding.severity === "high").length,
    mediumFindings: findings.filter((finding) => finding.severity === "medium").length,
    lowFindings: findings.filter((finding) => finding.severity === "low").length,
    infoFindings: findings.filter((finding) => finding.severity === "info").length,
  };
}
