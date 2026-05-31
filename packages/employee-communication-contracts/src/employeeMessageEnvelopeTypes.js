import { EMPLOYEE_INTERNAL_MESSAGE_TYPES } from "./messageTypeEnums.js";

export const EMPLOYEE_MESSAGE_ENVELOPE_REQUIRED_FIELDS = Object.freeze([
  "messageId",
  "threadId",
  "fromEmployeeId",
  "toEmployeeIds",
  "ccEmployeeIds",
  "messageType",
  "intent",
  "title",
  "body",
  "taskRef",
  "evidenceRef",
  "requiresResponse",
  "responseDeadlineMs",
  "riskLevel",
  "dryRunOnly",
  "createdAt",
]);

export function createEmployeeMessageEnvelope(overrides = {}) {
  return {
    messageId: "message.preview.product-to-ux.ask",
    threadId: "thread.preview.onboarding-friction",
    fromEmployeeId: "emp-product-chief",
    toEmployeeIds: ["emp-ux-researcher"],
    ccEmployeeIds: [],
    messageType: "ask",
    intent: "request_review",
    title: "Review sample dry-run onboarding friction",
    body: "Product Chief asks UX Researcher to review sample dry-run onboarding friction.",
    taskRef: "taskRef.preview.onboarding-friction",
    evidenceRef: "evidenceRef.preview.phase587.product-to-ux",
    requiresResponse: true,
    responseDeadlineMs: 3600000,
    riskLevel: "medium",
    dryRunOnly: true,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

export function validateEmployeeMessageEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== "object") errors.push("message envelope must be an object");
  for (const field of EMPLOYEE_MESSAGE_ENVELOPE_REQUIRED_FIELDS) {
    if (envelope?.[field] === undefined) errors.push(`missing field: ${field}`);
  }
  if (!EMPLOYEE_INTERNAL_MESSAGE_TYPES.includes(envelope?.messageType)) errors.push("unsupported messageType");
  if (!Array.isArray(envelope?.toEmployeeIds) || envelope.toEmployeeIds.length < 1) errors.push("toEmployeeIds must not be empty");
  if (envelope?.dryRunOnly !== true) errors.push("message envelope must be dryRunOnly");
  return { valid: errors.length === 0, errors };
}
