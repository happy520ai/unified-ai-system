import { createEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createCouncilSummary() {
  return createEmployeeMessageEnvelope({
    messageId: "message.preview.council.summary",
    threadId: "thread.preview.onboarding-friction",
    fromEmployeeId: "emp-product-chief",
    toEmployeeIds: ["emp-ux-researcher", "emp-security-chief"],
    ccEmployeeIds: ["emp-ai-gateway-engineer"],
    messageType: "summary",
    intent: "summarize_council_review",
    title: "Council dry-run summary",
    body: "Council summary: keep sample entry, clarify evidence boundary, do not call providers or expose secrets.",
    requiresResponse: false,
    riskLevel: "medium",
  });
}
