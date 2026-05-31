import { createEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createDryRunReply({ threadId, fromEmployeeId, toEmployeeId, body } = {}) {
  return createEmployeeMessageEnvelope({
    messageId: `message.preview.${fromEmployeeId || "employee"}.reply`,
    threadId: threadId || "thread.preview.onboarding-friction",
    fromEmployeeId: fromEmployeeId || "emp-ux-researcher",
    toEmployeeIds: [toEmployeeId || "emp-product-chief"],
    messageType: "reply",
    intent: "reply_to_internal_request",
    title: "Dry-run employee reply",
    body: body || "Dry-run reply created; no Provider call was made.",
    requiresResponse: false,
  });
}
