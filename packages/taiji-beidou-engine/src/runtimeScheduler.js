import { createRuntimeLease } from "./runtimeLeaseManager.js";

export function scheduleRuntimeExecutions(admittedCapabilities = []) {
  return admittedCapabilities.map((capability, index) => ({
    capabilityId: capability.capabilityId,
    runtimeKind: "sandbox_local",
    scheduled: true,
    scheduleStatus: "ready",
    lease: createRuntimeLease(capability.capabilityId, { sequence: index + 1 }),
  }));
}
