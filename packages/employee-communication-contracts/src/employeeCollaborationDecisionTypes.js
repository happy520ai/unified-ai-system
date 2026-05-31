import { EMPLOYEE_COLLABORATION_MODES, PHASE587_FANOUT_LIMITS } from "./messageTypeEnums.js";

export const EMPLOYEE_COLLABORATION_DECISION_REQUIRED_FIELDS = Object.freeze([
  "decisionId",
  "taskRef",
  "selectedEmployees",
  "rejectedEmployees",
  "threadId",
  "fanoutPolicy",
  "collaborationMode",
  "maxActiveEmployees",
  "maxBrainCalls",
  "evidence",
  "dryRunOnly",
]);

export function createEmployeeCollaborationDecision(overrides = {}) {
  return {
    decisionId: "decision.preview.council-summary",
    taskRef: "taskRef.preview.onboarding-friction",
    selectedEmployees: ["emp-product-chief", "emp-ux-researcher", "emp-security-chief"],
    rejectedEmployees: [{ employeeId: "emp-qa-engineer", reason: "fanout_policy_limit" }],
    threadId: "thread.preview.onboarding-friction",
    fanoutPolicy: { ...PHASE587_FANOUT_LIMITS },
    collaborationMode: "council_review",
    maxActiveEmployees: PHASE587_FANOUT_LIMITS.maxActiveEmployees,
    maxBrainCalls: 0,
    evidence: {
      evidenceId: "evidence.phase587.collaboration-decision",
      timeline: ["scheduler_selected_active_employees", "bus_created_thread", "council_summary_created"],
    },
    dryRunOnly: true,
    ...overrides,
  };
}

export function validateEmployeeCollaborationDecision(decision) {
  const errors = [];
  if (!decision || typeof decision !== "object") errors.push("collaboration decision must be an object");
  for (const field of EMPLOYEE_COLLABORATION_DECISION_REQUIRED_FIELDS) {
    if (decision?.[field] === undefined) errors.push(`missing field: ${field}`);
  }
  if (!EMPLOYEE_COLLABORATION_MODES.includes(decision?.collaborationMode)) errors.push("unsupported collaborationMode");
  if (!Array.isArray(decision?.selectedEmployees) || decision.selectedEmployees.length > PHASE587_FANOUT_LIMITS.maxActiveEmployees) errors.push("selectedEmployees exceeds maxActiveEmployees");
  if (decision?.maxActiveEmployees > PHASE587_FANOUT_LIMITS.maxActiveEmployees) errors.push("maxActiveEmployees exceeded");
  if (decision?.maxBrainCalls !== 0) errors.push("maxBrainCalls must be 0");
  if (decision?.dryRunOnly !== true) errors.push("decision must be dryRunOnly");
  return { valid: errors.length === 0, errors };
}
