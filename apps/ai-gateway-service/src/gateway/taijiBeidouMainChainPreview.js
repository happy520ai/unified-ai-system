export function createTaijiBeidouMainChainPreview(input = {}) {
  const defaultEnabled = input.mode === "default_enabled";
  return {
    previewType: "taiji-beidou-main-chain-readiness",
    mainChainHookEnabled: defaultEnabled,
    mode: input.mode || "preview",
    providerRuntimeAllowed: false,
    credentialRefOnly: true,
    rollbackRequired: true,
    killSwitchRequired: true,
    providerRuntimeDefaultEnabled: false,
    providerCallsMade: false,
    responseReplacementAllowed: defaultEnabled,
    chatBehaviorChangedByDefault: defaultEnabled,
    chatGatewayExecuteBehaviorChangedByDefault: defaultEnabled,
    defaultEnableExecuted: defaultEnabled,
    mainChainDefaultEnabled: defaultEnabled,
    taijiBeidouDefaultEnabled: defaultEnabled,
    productionReadyClaimed: false,
    publicLaunchClaimed: false,
  };
}
