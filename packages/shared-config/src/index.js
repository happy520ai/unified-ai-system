/**
 * Shared configuration for the AI Gateway system.
 *
 * Public API (unchanged):
 *   - DEFAULT_RUNTIME_CONFIG
 *   - loadRuntimeConfig(env?)
 *   - getSafeRuntimeConfig(config)
 *
 * Internal helpers are split into sibling modules to stay under 500 lines each:
 *   - provider-catalog.js   — static DEFAULT_PROVIDER_MODELS array
 *   - env-utils.js          — environment variable parsing utilities
 *   - provider-selection.js — provider enable / selection logic
 */

import { DEFAULT_PROVIDER_MODELS } from "./provider-catalog.js";
import { readNumber, readBoolean, readProviderMode, readList } from "./env-utils.js";
import {
  shouldEnableOpenAiProvider,
  shouldEnableNvidiaProvider,
  shouldEnableMimoProvider,
  createProviderSelectionConfig,
} from "./provider-selection.js";

export const DEFAULT_RUNTIME_CONFIG = {
  agentConsole: {
    host: "127.0.0.1",
    port: 3200,
  },
  aiGatewayService: {
    endpoint: {
      host: "127.0.0.1",
      port: 3100,
    },
    requestTimeoutMs: 60_000,
    providerModels: DEFAULT_PROVIDER_MODELS,
    providerSelection: {
      mode: "registry-default",
      defaultProviderId: "local-fake-provider",
      defaultModelId: "local-fake-model",
      enabledProviders: ["local-fake-provider", "backup-fake-provider"],
    },
    providerMode: "fake",
    realProviderEnabled: false,
  },
};

export function loadRuntimeConfig(env = process.env) {
  const providerMode = readProviderMode(env.AI_GATEWAY_PROVIDER_MODE, DEFAULT_RUNTIME_CONFIG.aiGatewayService.providerMode);
  const openAiApiKey = env.OPENAI_API_KEY;
  const openAiApiKeyPresent = Boolean(openAiApiKey);
  const nvidiaApiKey = env.NVIDIA_API_KEY;
  const nvidiaApiKeyPresent = Boolean(nvidiaApiKey);
  const mimoApiKey = env.MIMO_API_KEY;
  const mimoApiKeyPresent = Boolean(mimoApiKey);
  const realProviderEnabled = readBoolean(
    env.AI_GATEWAY_REAL_PROVIDER_ENABLED,
    DEFAULT_RUNTIME_CONFIG.aiGatewayService.realProviderEnabled,
  );
  const openAiModel = env.OPENAI_MODEL ?? "gpt-4o-mini";
  const nvidiaModel = env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";
  const mimoModel = env.MIMO_MODEL ?? "mimo-model-from-console";
  const requestedEnabledProviders = readList(env.AI_GATEWAY_ENABLED_PROVIDERS, []);
  const openAiProviderEnabled = shouldEnableOpenAiProvider({
    providerMode,
    realProviderEnabled,
    openAiApiKeyPresent,
    requestedEnabledProviders,
  });
  const nvidiaProviderEnabled = shouldEnableNvidiaProvider({
    providerMode,
    realProviderEnabled,
    nvidiaApiKeyPresent,
    requestedEnabledProviders,
  });
  const mimoProviderEnabled = shouldEnableMimoProvider({
    providerMode,
    realProviderEnabled,
    mimoApiKeyPresent,
    requestedEnabledProviders,
  });
  const providerSelection = createProviderSelectionConfig({
    env,
    providerMode,
    nvidiaProviderEnabled,
    nvidiaModel,
    defaultProviderSelection: DEFAULT_RUNTIME_CONFIG.aiGatewayService.providerSelection,
  });

  return {
    agentConsole: {
      ...DEFAULT_RUNTIME_CONFIG.agentConsole,
    },
    aiGatewayService: {
      endpoint: {
        host: env.AI_GATEWAY_SERVICE_HOST ?? DEFAULT_RUNTIME_CONFIG.aiGatewayService.endpoint.host,
        port: readNumber(env.AI_GATEWAY_SERVICE_PORT, DEFAULT_RUNTIME_CONFIG.aiGatewayService.endpoint.port),
      },
      requestTimeoutMs: readNumber(
        env.AI_GATEWAY_REQUEST_TIMEOUT_MS,
        DEFAULT_RUNTIME_CONFIG.aiGatewayService.requestTimeoutMs,
      ),
      providerMode,
      realProviderEnabled,
      fallbackEnabled: readBoolean(env.AI_GATEWAY_FALLBACK_ENABLED, true),
      providerSelection,
      providerModels: DEFAULT_RUNTIME_CONFIG.aiGatewayService.providerModels.map((provider) => {
        if (provider.providerId === "openai") {
          return {
            ...provider,
            modelId: openAiModel,
            modelDisplayName: openAiModel,
            enabled: openAiProviderEnabled,
            endpoint: env.OPENAI_BASE_URL ?? provider.endpoint,
            apiKey: openAiApiKey,
            apiKeyPresent: openAiApiKeyPresent,
          };
        }

        if (provider.providerId === "nvidia") {
          return {
            ...provider,
            modelId: nvidiaModel,
            modelDisplayName: nvidiaModel,
            enabled: nvidiaProviderEnabled,
            endpoint: env.NVIDIA_BASE_URL ?? provider.endpoint,
            apiKey: nvidiaApiKey,
            apiKeyPresent: nvidiaApiKeyPresent,
          };
        }

        if (provider.providerId === "mimo") {
          return {
            ...provider,
            modelId: mimoModel,
            modelDisplayName: mimoModel,
            enabled: mimoProviderEnabled,
            endpoint: env.MIMO_BASE_URL ?? provider.endpoint,
            apiKey: mimoApiKey,
            apiKeyPresent: mimoApiKeyPresent,
          };
        }

        if (provider.providerId === "local-fake-provider") {
          return {
            ...provider,
            failMode: readBoolean(env.AI_GATEWAY_FAKE_PRIMARY_FAIL, false) ? "retryable" : undefined,
          };
        }

        return { ...provider };
      }),
    },
  };
}

export function getSafeRuntimeConfig(config) {
  return {
    agentConsole: config.agentConsole,
    aiGatewayService: {
      endpoint: config.aiGatewayService.endpoint,
      requestTimeoutMs: config.aiGatewayService.requestTimeoutMs,
      providerSelection: config.aiGatewayService.providerSelection,
      providerMode: config.aiGatewayService.providerMode,
      realProviderEnabled: config.aiGatewayService.realProviderEnabled,
      fallbackEnabled: config.aiGatewayService.fallbackEnabled,
      providerModels: config.aiGatewayService.providerModels.map((provider) => ({
        providerId: provider.providerId,
        modelId: provider.modelId,
        providerType: provider.providerType,
        enabled: provider.enabled,
        priority: provider.priority,
        capabilities: provider.capabilities,
        dryRun: provider.dryRun ?? false,
        hasEndpoint: Boolean(provider.endpoint),
        apiKeyPresent: Boolean(provider.apiKeyPresent),
      })),
    },
  };
}

