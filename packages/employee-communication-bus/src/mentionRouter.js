import { createEmployeeMention, validateEmployeeMention } from "../../employee-communication-contracts/src/index.js";

export function routeMention(input = {}) {
  const mention = createEmployeeMention(input);
  const validation = validateEmployeeMention(mention);
  return {
    routed: validation.valid,
    mention,
    validation,
    schedulerApprovalRequiredForNewParticipants: true,
    dryRunOnly: true,
  };
}
