import { createEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createApprovalRequestPreview() {
  return createEmployeeMessageEnvelope({
    messageId: "message.preview.approval-request",
    threadId: "thread.preview.approval",
    fromEmployeeId: "emp-system-governor",
    toEmployeeIds: ["emp-product-chief"],
    messageType: "approval_request",
    intent: "request_scheduler_approval_for_new_participant",
    title: "Scheduler approval required",
    body: "Adding new employee participants requires Workforce Scheduler approval.",
    requiresResponse: true,
    riskLevel: "medium",
  });
}
