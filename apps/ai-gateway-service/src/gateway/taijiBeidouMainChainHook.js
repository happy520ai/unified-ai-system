import { createTaijiBeidouMainChainPreview } from "./taijiBeidouMainChainPreview.js";

export function evaluateTaijiBeidouMainChainHook(input = {}) {
  const flags = input.flags || input.body?.taijiBeidou || {};
  const previewRequested = flags.preview === true || input.body?.taijiBeidouPreview === true;
  const shadowRequested = flags.shadow === true || input.body?.taijiBeidouShadow === true;
  const defaultEnabled = input.defaultEnabled === true || flags.defaultEnabled === true || input.body?.taijiBeidouDefaultEnabled === true;
  const killSwitchActive = input.killSwitchActive === true || flags.killSwitchActive === true;

  if (killSwitchActive) {
    return {
      action: "blocked",
      mode: "preview",
      blockedReason: "taiji_beidou_main_chain_kill_switch_active",
      preview: createTaijiBeidouMainChainPreview({ mode: "preview" }),
      defaultEnabled: false,
      providerCallsMade: false,
    };
  }

  if (defaultEnabled) {
    return {
      action: "default_enabled",
      mode: "default_enabled",
      preview: createTaijiBeidouMainChainPreview({ mode: "default_enabled" }),
      defaultEnabled: true,
      providerCallsMade: false,
      providerRuntimeDefaultEnabled: false,
      responseReplacementAllowed: true,
      chatBehaviorChangedByDefault: true,
      chatGatewayExecuteBehaviorChangedByDefault: true,
      localCandidateLayerResult: {
        status: "taiji_beidou_default_enabled_local_candidate_layer",
        message: "Taiji / Beidou default-enabled local candidate layer handled this request without Provider runtime dispatch.",
        providerCallsMade: false,
        secretRead: false,
        authJsonRead: false,
        rawCredentialRefRead: false,
        productionReadyClaimed: false,
      },
    };
  }

  if (previewRequested) {
    return {
      action: "preview",
      mode: "preview",
      preview: createTaijiBeidouMainChainPreview({ mode: "preview" }),
      defaultEnabled: false,
      providerCallsMade: false,
    };
  }

  if (shadowRequested) {
    return {
      action: "shadow",
      mode: "shadow",
      preview: createTaijiBeidouMainChainPreview({ mode: "shadow" }),
      defaultEnabled: false,
      providerCallsMade: false,
      responseReplacementAllowed: false,
    };
  }

  return {
    action: "passthrough",
    mode: "disabled",
    preview: null,
    defaultEnabled: false,
    providerCallsMade: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
  };
}
