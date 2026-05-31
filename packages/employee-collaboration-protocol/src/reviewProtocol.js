import { createEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createReviewRequest({ threadId = "thread.preview.onboarding-friction" } = {}) {
  return createEmployeeMessageEnvelope({
    messageId: "message.preview.product-to-ux.review-request",
    threadId,
    fromEmployeeId: "emp-product-chief",
    toEmployeeIds: ["emp-ux-researcher"],
    messageType: "review_request",
    intent: "request_onboarding_friction_review",
    title: "Review sample dry-run onboarding friction",
    body: "Please review the sample dry-run onboarding friction and return a dry-run UX finding.",
    requiresResponse: true,
  });
}

export function createReviewResult({ threadId = "thread.preview.onboarding-friction" } = {}) {
  return createEmployeeMessageEnvelope({
    messageId: "message.preview.ux-to-product.review-result",
    threadId,
    fromEmployeeId: "emp-ux-researcher",
    toEmployeeIds: ["emp-product-chief"],
    messageType: "review_result",
    intent: "return_onboarding_friction_review",
    title: "UX dry-run review result",
    body: "The sample dry-run entry is understandable; next step copy should clarify the evidence boundary.",
    requiresResponse: false,
  });
}
