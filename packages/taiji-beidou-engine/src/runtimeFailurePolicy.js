import { runtimeFailureFixtures } from "./autoRuntimeFixtures.js";

export function injectRuntimeFailures(capabilityId = "failure-fixture") {
  return runtimeFailureFixtures.map((fixture) => ({
    capabilityId: `${capabilityId}-${fixture.id}`,
    runtimeKind: "sandbox_local",
    executionStatus: fixture.executionStatus,
    blockedReason: fixture.blockedReason,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
    rollbackRequired: fixture.executionStatus === "failed",
    disabledByKillSwitch: true,
    completed: false,
  }));
}
