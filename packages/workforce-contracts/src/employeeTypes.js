export const EMPLOYEE_STATUSES = Object.freeze([
  "preview_ready",
  "disabled",
  "manual_review_required",
]);

export const EMPLOYEE_SCHEMA_FIELDS = Object.freeze([
  "employeeId",
  "displayName",
  "positionId",
  "title",
  "domain",
  "pyramidLevel",
  "seniority",
  "capabilities",
  "allowedTaskTypes",
  "riskLevel",
  "brainBinding",
  "maxConcurrency",
  "maxTokens",
  "timeoutMs",
  "requiresApproval",
  "evidencePolicy",
  "status",
]);

export function validateEmployeeShape(employee) {
  const missing = EMPLOYEE_SCHEMA_FIELDS.filter((field) => !(field in (employee || {})));
  return {
    valid: missing.length === 0,
    missing,
  };
}
