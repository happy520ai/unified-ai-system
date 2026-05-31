export function createTaijiBeidouRealProviderRuntimePreview(input = {}) {
  return {
    previewType: "taiji-beidou-real-provider-runtime-v0",
    guardedRealProviderRuntimeV0Available: true,
    productionReady: false,
    mainChainRuntimeReady: false,
    providerRuntimeDefaultEnabled: false,
    providerIdAllowedList: ["nvidia"],
    approvalFilePresent: input.approvalFilePresent === true,
    authorizationComplete: input.authorizationComplete === true,
    realProviderCallExecuted: input.realProviderCallExecuted === true,
    providerId: input.providerId || "nvidia",
    credentialRefOnly: true,
    rawSecretRead: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
  };
}
