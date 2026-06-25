/**
 * Provider enable/selection logic for shared-config.
 * Extracted from shared-config/src/index.js to keep the main module under 500 lines.
 */

import { readList, readRouteMode } from "./env-utils.js";

export function shouldEnableOpenAiProvider({ providerMode, realProviderEnabled, openAiApiKeyPresent, requestedEnabledProviders }) {
  if (!realProviderEnabled) {
    return false;
  }

  if (providerMode === "real" || providerMode === "auto") {
    return openAiApiKeyPresent && requestedEnabledProviders.includes("openai");
  }

  return false;
}

export function shouldEnableNvidiaProvider({ providerMode, realProviderEnabled, nvidiaApiKeyPresent, requestedEnabledProviders }) {
  if (!realProviderEnabled) {
    return false;
  }

  if (providerMode === "real") {
    return requestedEnabledProviders.length === 0 || requestedEnabledProviders.includes("nvidia");
  }

  if (providerMode === "auto") {
    return nvidiaApiKeyPresent && (requestedEnabledProviders.length === 0 || requestedEnabledProviders.includes("nvidia"));
  }

  return false;
}

export function shouldEnableMimoProvider({ providerMode, realProviderEnabled, mimoApiKeyPresent, requestedEnabledProviders }) {
  if (!realProviderEnabled || !mimoApiKeyPresent) {
    return false;
  }

  if (providerMode === "real" || providerMode === "auto") {
    return requestedEnabledProviders.includes("mimo");
  }

  return false;
}

export function createProviderSelectionConfig({ env, providerMode, nvidiaProviderEnabled, nvidiaModel, defaultProviderSelection }) {
  const nvidiaSelection = {
    mode: "fixed",
    defaultProviderId: "nvidia",
    defaultModelId: nvidiaModel,
    enabledProviders: ["nvidia", "openrouter", "cerebras", "zhipu", "xunfei-spark", "xiaomi", "siliconflow", "qianfan", "tencent-hunyuan", "dashscope", "modelscope", "publicwelfare", "openai", "google", "groq", "cloudflare", "agnes", "bloom", "deepseek", "moonshot", "volcengine-doubao", "minimax", "stepfun", "baichuan", "yi"],
  };
  const defaultSelection =
    providerMode === "real" || (providerMode === "auto" && nvidiaProviderEnabled) ? nvidiaSelection : defaultProviderSelection;
  const enabledProvidersFallback = defaultSelection.enabledProviders;

  return {
    mode: readRouteMode(env.AI_GATEWAY_ROUTE_MODE, defaultSelection.mode),
    defaultProviderId: env.AI_GATEWAY_DEFAULT_PROVIDER ?? defaultSelection.defaultProviderId,
    defaultModelId: env.AI_GATEWAY_DEFAULT_MODEL ?? defaultSelection.defaultModelId,
    enabledProviders: readList(env.AI_GATEWAY_ENABLED_PROVIDERS, enabledProvidersFallback),
  };
}
