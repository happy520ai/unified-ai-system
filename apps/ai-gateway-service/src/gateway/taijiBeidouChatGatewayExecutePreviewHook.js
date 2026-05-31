import { evaluateTaijiBeidouMainChainHook } from "./taijiBeidouMainChainHook.js";

export function evaluateTaijiBeidouChatGatewayExecutePreviewHook(input = {}) {
  const mainChain = evaluateTaijiBeidouMainChainHook(input);
  const base = {
    hookType: "taiji-beidou-chat-gateway-execute-preview-hook",
    route: input.route || "/chat-gateway/execute",
    chatGatewayExecuteIntegrated: true,
    chatGatewayExecuteDefaultEnabled: mainChain.defaultEnabled === true,
    mainChainDefaultEnabled: mainChain.defaultEnabled === true,
    taijiBeidouDefaultEnabled: mainChain.defaultEnabled === true,
    providerRuntimeDefaultEnabled: false,
    credentialRefOnly: true,
    rawSecretRead: false,
    secretValueExposed: false,
    providerCallsMade: false,
    responseReplacementAllowed: false,
    rollbackReady: true,
    killSwitchReady: true,
  };

  if (mainChain.action === "preview" || mainChain.action === "blocked") {
    return {
      action: "respond",
      responseStatus: mainChain.action === "blocked" ? 423 : 200,
      result: {
        ...base,
        previewGenerated: mainChain.action === "preview",
        blocked: mainChain.action === "blocked",
        blockedReason: mainChain.blockedReason || null,
        mainChainPreview: mainChain.preview,
      },
    };
  }

  if (mainChain.action === "default_enabled") {
    return {
      action: "respond",
      responseStatus: 200,
      result: {
        ...base,
        previewGenerated: false,
        blocked: false,
        defaultEnableExecuted: true,
        mainChainPreview: mainChain.preview,
        localCandidateLayerResult: mainChain.localCandidateLayerResult,
      },
    };
  }

  return {
    action: mainChain.action,
    result: {
      ...base,
      previewGenerated: false,
      blocked: false,
      mainChainPreview: mainChain.preview,
    },
  };
}
