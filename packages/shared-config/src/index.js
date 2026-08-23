import { DEFAULT_RUNTIME_CONFIG } from "./defaultRuntimeConfig.js";
import { DEFAULT_PROVIDER_MODELS } from "./provider-catalog.js";

export { DEFAULT_RUNTIME_CONFIG };

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
      }).concat(readExtraProviderModels(env)),
      chatContextCompaction: {
        thresholdMessages: readNumber(env.AI_GATEWAY_CHAT_COMPACTION_THRESHOLD_MESSAGES, DEFAULT_RUNTIME_CONFIG.aiGatewayService.chatContextCompaction.thresholdMessages),
        maxContextTokens: readNumber(env.AI_GATEWAY_CHAT_COMPACTION_MAX_TOKENS, DEFAULT_RUNTIME_CONFIG.aiGatewayService.chatContextCompaction.maxContextTokens),
        keepRecentTurns: readNumber(env.AI_GATEWAY_CHAT_COMPACTION_KEEP_RECENT_TURNS, DEFAULT_RUNTIME_CONFIG.aiGatewayService.chatContextCompaction.keepRecentTurns),
      },
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
      chatContextCompaction: config.aiGatewayService.chatContextCompaction,
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

function readNumber(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readList(value, fallback) {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Env-gated extension point: AI_GATEWAY_EXTRA_PROVIDERS=agnes,google,bloom
// appends matching provider-catalog entries to the registry list. Without the
// env the default providerModels set is returned unchanged, so default
// behavior and existing deployments stay identical.
function readExtraProviderModels(env) {
  const wanted = readList(env.AI_GATEWAY_EXTRA_PROVIDERS, []).map((item) => item.toLowerCase());
  if (wanted.length === 0) {
    return [];
  }
  return DEFAULT_PROVIDER_MODELS.filter((entry) => wanted.includes(String(entry.providerId).toLowerCase()));
}

function readRouteMode(value, fallback) {
  if (value === "fixed" || value === "registry-default") {
    return value;
  }

  return fallback;
}

function readProviderMode(value, fallback) {
  if (value === "fake" || value === "real" || value === "auto") {
    return value;
  }

  return fallback;
}

function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

function shouldEnableOpenAiProvider({ providerMode, realProviderEnabled, openAiApiKeyPresent, requestedEnabledProviders }) {
  if (!realProviderEnabled) {
    return false;
  }

  if (providerMode === "real" || providerMode === "auto") {
    return openAiApiKeyPresent && requestedEnabledProviders.includes("openai");
  }

  return false;
}

function shouldEnableNvidiaProvider({ providerMode, realProviderEnabled, nvidiaApiKeyPresent, requestedEnabledProviders }) {
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

function shouldEnableMimoProvider({ providerMode, realProviderEnabled, mimoApiKeyPresent, requestedEnabledProviders }) {
  if (!realProviderEnabled || !mimoApiKeyPresent) {
    return false;
  }

  if (providerMode === "real" || providerMode === "auto") {
    return requestedEnabledProviders.includes("mimo");
  }

  return false;
}

function createProviderSelectionConfig({ env, providerMode, nvidiaProviderEnabled, nvidiaModel }) {
  const fakeDefaults = DEFAULT_RUNTIME_CONFIG.aiGatewayService.providerSelection;
  const nvidiaSelection = {
    mode: "fixed",
    defaultProviderId: "nvidia",
    defaultModelId: nvidiaModel,
    enabledProviders: ["nvidia"],
  };
  const defaultSelection =
    providerMode === "real" || (providerMode === "auto" && nvidiaProviderEnabled) ? nvidiaSelection : fakeDefaults;
  const enabledProvidersFallback = defaultSelection.enabledProviders;

  return {
    mode: readRouteMode(env.AI_GATEWAY_ROUTE_MODE, defaultSelection.mode),
    defaultProviderId: env.AI_GATEWAY_DEFAULT_PROVIDER ?? defaultSelection.defaultProviderId,
    defaultModelId: env.AI_GATEWAY_DEFAULT_MODEL ?? defaultSelection.defaultModelId,
    enabledProviders: readList(env.AI_GATEWAY_ENABLED_PROVIDERS, enabledProvidersFallback),
  };
}
