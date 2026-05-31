export function buildGatewayAdapterExecutionBlocked(reason = "blocked_pending_specific_authorization") {
  return {
    mode: "blocked",
    providerTestExecutionStatus: reason,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    chatGatewayExecuteCalled: false,
  };
}

