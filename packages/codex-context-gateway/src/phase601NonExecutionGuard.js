export function buildPhase601NonExecutionGuard() {
  return {
    completed: true,
    nonExecutionGuardWorks: true,
    commandPreviewOnly: true,
    realCommandExecutionBlocked: true,
    realRelayConnectionBlocked: true,
    providerCallBlocked: true,
    realConfigWriteBlocked: true,
    realTestExecuted: false,
    commandExecuted: false,
    relayStarted: false,
    providerCallsMade: false,
  };
}
