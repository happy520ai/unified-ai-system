export function createTaijiBeidouAutoRuntimeDryRunPreview(input = {}) {
  const execution = input.execution || {};
  return {
    previewType: "taiji-beidou-auto-runtime-dry-run",
    runtimeKind: "sandbox_local",
    productionReady: false,
    mainChainRuntimeReady: false,
    realProviderRuntimeReady: false,
    capabilityId: execution.capabilityId || "preview",
    executionStatus: execution.executionStatus || "preview_only",
    providerCallsMade: false,
    secretRead: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
  };
}
