export function requiresEmployeeApproval(employee) {
  return employee.riskLevel === "high" || employee.brainBinding?.mode !== "dry_run";
}

