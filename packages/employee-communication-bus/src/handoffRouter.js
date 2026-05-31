import { createEmployeeHandoff, validateEmployeeHandoff } from "../../employee-communication-contracts/src/index.js";

export function routeHandoff(input = {}) {
  const handoff = createEmployeeHandoff(input);
  const validation = validateEmployeeHandoff(handoff);
  return {
    routed: validation.valid,
    handoff,
    validation,
    accepted: handoff.accepted,
    dryRunOnly: true,
  };
}
