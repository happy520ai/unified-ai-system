import { createEmployeeHandoff, createEmployeeMessageEnvelope } from "../../employee-communication-contracts/src/index.js";

export function createHandoffFromUxToEngineer() {
  const handoff = createEmployeeHandoff();
  const message = createEmployeeMessageEnvelope({
    messageId: "message.preview.ux-to-engineer.handoff",
    threadId: "thread.preview.onboarding-friction",
    fromEmployeeId: handoff.fromEmployeeId,
    toEmployeeIds: [handoff.toEmployeeId],
    messageType: "handoff",
    intent: "handoff_boundary_safe_fix_plan",
    title: "Handoff UX finding to AI Gateway Engineer",
    body: handoff.reason,
    requiresResponse: true,
  });
  return { handoff, message, dryRunOnly: true };
}
