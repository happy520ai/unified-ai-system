import { createEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createFinalRecommendation() {
  return createEmployeeMessageEnvelope({
    messageId: "message.preview.council.final-recommendation",
    threadId: "thread.preview.onboarding-friction",
    fromEmployeeId: "emp-product-chief",
    toEmployeeIds: ["emp-ux-researcher", "emp-security-chief", "emp-ai-gateway-engineer"],
    messageType: "final_recommendation",
    intent: "final_internal_recommendation",
    title: "Final dry-run recommendation",
    body: "Proceed with an internal-only communication bus. External IM adapters should wait for Phase588.",
    requiresResponse: false,
    riskLevel: "medium",
  });
}
