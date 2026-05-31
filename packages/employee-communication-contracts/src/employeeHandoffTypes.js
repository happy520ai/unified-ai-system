export const EMPLOYEE_HANDOFF_REQUIRED_FIELDS = Object.freeze([
  "handoffId",
  "fromEmployeeId",
  "toEmployeeId",
  "taskRef",
  "reason",
  "handoffPayload",
  "accepted",
  "rejectedReason",
  "evidenceRef",
  "dryRunOnly",
]);

export function createEmployeeHandoff(overrides = {}) {
  return {
    handoffId: "handoff.preview.ux-to-engineer",
    fromEmployeeId: "emp-ux-researcher",
    toEmployeeId: "emp-ai-gateway-engineer",
    taskRef: "taskRef.preview.onboarding-friction",
    reason: "UX finding needs implementation boundary review.",
    handoffPayload: {
      summary: "Sample dry-run onboarding friction needs gateway-safe UI adjustment.",
      requiredAction: "review_boundary_safe_fix_plan",
    },
    accepted: true,
    rejectedReason: null,
    evidenceRef: "evidenceRef.preview.phase587.handoff",
    dryRunOnly: true,
    ...overrides,
  };
}

export function validateEmployeeHandoff(handoff) {
  const errors = [];
  if (!handoff || typeof handoff !== "object") errors.push("handoff must be an object");
  for (const field of EMPLOYEE_HANDOFF_REQUIRED_FIELDS) {
    if (handoff?.[field] === undefined) errors.push(`missing field: ${field}`);
  }
  if (handoff?.fromEmployeeId === handoff?.toEmployeeId) errors.push("handoff requires distinct employees");
  if (handoff?.dryRunOnly !== true) errors.push("handoff must be dryRunOnly");
  return { valid: errors.length === 0, errors };
}
