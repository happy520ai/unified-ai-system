import { createEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createSecurityBoundaryObjection() {
  return createEmployeeMessageEnvelope({
    messageId: "message.preview.security-chief.objection",
    threadId: "thread.preview.provider-boundary",
    fromEmployeeId: "emp-security-chief",
    toEmployeeIds: ["emp-product-chief", "emp-ai-gateway-engineer"],
    messageType: "objection",
    intent: "object_to_provider_boundary_risk",
    title: "Provider boundary objection",
    body: "Security Chief objects to any Provider fallback path without explicit authorization.",
    taskRef: "taskRef.preview.provider-boundary",
    evidenceRef: "evidenceRef.preview.phase587.security-objection",
    requiresResponse: true,
    riskLevel: "high",
  });
}
