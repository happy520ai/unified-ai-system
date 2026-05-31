export const EMPLOYEE_MENTION_REQUIRED_FIELDS = Object.freeze([
  "mentionId",
  "messageId",
  "mentionedEmployeeId",
  "reason",
  "expectedAction",
  "routedBy",
  "routingEvidence",
  "dryRunOnly",
]);

export function createEmployeeMention(overrides = {}) {
  return {
    mentionId: "mention.preview.ai-gateway-engineer.provider-risk",
    messageId: "message.preview.provider-risk.ask",
    mentionedEmployeeId: "emp-ai-gateway-engineer",
    reason: "Provider fallback risk needs gateway boundary review.",
    expectedAction: "review_provider_routing_boundary",
    routedBy: "employee-communication-bus",
    routingEvidence: "evidenceRef.preview.phase587.mention-routing",
    dryRunOnly: true,
    ...overrides,
  };
}

export function validateEmployeeMention(mention) {
  const errors = [];
  if (!mention || typeof mention !== "object") errors.push("mention must be an object");
  for (const field of EMPLOYEE_MENTION_REQUIRED_FIELDS) {
    if (mention?.[field] === undefined) errors.push(`missing field: ${field}`);
  }
  if (mention?.dryRunOnly !== true) errors.push("mention must be dryRunOnly");
  return { valid: errors.length === 0, errors };
}
