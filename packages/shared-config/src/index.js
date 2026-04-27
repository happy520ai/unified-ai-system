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
    providerModels: [
      {
        providerId: "local-fake-provider",
        modelId: "local-fake-model",
        providerType: "fake",
        providerDisplayName: "Local Fake Provider",
        modelDisplayName: "Local Fake Model",
        enabled: true,
        priority: 1,
        capabilities: ["chat", "reasoning", "summary"],
      },
      {
        providerId: "backup-fake-provider",
        modelId: "backup-fake-model",
        providerType: "fake",
        providerDisplayName: "Backup Fake Provider",
        modelDisplayName: "Backup Fake Model",
        enabled: true,
        priority: 2,
        capabilities: ["chat", "summary"],
        fixedLatencyMs: 20,
      },
      {
        providerId: "openai",
        modelId: "gpt-4o-mini",
        providerType: "openai",
        providerDisplayName: "OpenAI",
        modelDisplayName: "GPT-4o Mini",
        enabled: false,
        priority: 50,
        capabilities: ["chat", "reasoning", "summary"],
        endpoint: "https://api.openai.com/v1",
        dryRun: false,
      },
      {
        providerId: "nvidia",
        modelId: "meta/llama-3.1-8b-instruct",
        providerType: "nvidia",
        providerDisplayName: "NVIDIA",
        modelDisplayName: "Meta Llama 3.1 8B Instruct",
        enabled: false,
        priority: 60,
        capabilities: ["chat", "summary"],
        endpoint: "https://integrate.api.nvidia.com/v1",
        dryRun: false,
      },
      {
        providerId: "openrouter",
        modelId: "openai/gpt-4o-mini",
        providerType: "openai-compatible",
        providerDisplayName: "OpenRouter",
        modelDisplayName: "OpenAI GPT-4o Mini",
        enabled: false,
        priority: 70,
        capabilities: ["chat", "reasoning", "summary"],
        endpoint: "https://openrouter.ai/api/v1",
        dryRun: false,
      },
      {
        providerId: "deepseek",
        modelId: "deepseek-chat",
        providerType: "openai-compatible",
        providerDisplayName: "DeepSeek",
        modelDisplayName: "DeepSeek Chat",
        enabled: false,
        priority: 71,
        capabilities: ["chat", "reasoning", "summary"],
        endpoint: "https://api.deepseek.com/v1",
        dryRun: false,
      },
      {
        providerId: "groq",
        modelId: "llama-3.1-8b-instant",
        providerType: "openai-compatible",
        providerDisplayName: "Groq",
        modelDisplayName: "Llama 3.1 8B Instant",
        enabled: false,
        priority: 72,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.groq.com/openai/v1",
        dryRun: false,
      },
      {
        providerId: "together",
        modelId: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        providerType: "openai-compatible",
        providerDisplayName: "Together AI",
        modelDisplayName: "Meta Llama 3.1 8B Instruct Turbo",
        enabled: false,
        priority: 73,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.together.xyz/v1",
        dryRun: false,
      },
      {
        providerId: "mistral",
        modelId: "mistral-small-latest",
        providerType: "openai-compatible",
        providerDisplayName: "Mistral",
        modelDisplayName: "Mistral Small Latest",
        enabled: false,
        priority: 74,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.mistral.ai/v1",
        dryRun: false,
      },
      {
        providerId: "xai",
        modelId: "grok-3-mini",
        providerType: "openai-compatible",
        providerDisplayName: "xAI",
        modelDisplayName: "Grok 3 Mini",
        enabled: false,
        priority: 75,
        capabilities: ["chat", "reasoning", "summary"],
        endpoint: "https://api.x.ai/v1",
        dryRun: false,
      },
      {
        providerId: "perplexity",
        modelId: "sonar",
        providerType: "openai-compatible",
        providerDisplayName: "Perplexity",
        modelDisplayName: "Sonar",
        enabled: false,
        priority: 76,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.perplexity.ai",
        dryRun: false,
      },
      {
        providerId: "fireworks",
        modelId: "accounts/fireworks/models/llama-v3p1-8b-instruct",
        providerType: "openai-compatible",
        providerDisplayName: "Fireworks AI",
        modelDisplayName: "Llama v3.1 8B Instruct",
        enabled: false,
        priority: 77,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.fireworks.ai/inference/v1",
        dryRun: false,
      },
      {
        providerId: "cerebras",
        modelId: "llama3.1-8b",
        providerType: "openai-compatible",
        providerDisplayName: "Cerebras",
        modelDisplayName: "Llama 3.1 8B",
        enabled: false,
        priority: 78,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.cerebras.ai/v1",
        dryRun: false,
      },
      {
        providerId: "moonshot",
        modelId: "moonshot-v1-8k",
        providerType: "openai-compatible",
        providerDisplayName: "Moonshot AI",
        modelDisplayName: "Moonshot v1 8K",
        enabled: false,
        priority: 79,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.moonshot.ai/v1",
        dryRun: false,
      },
      {
        providerId: "siliconflow",
        modelId: "Qwen/Qwen2.5-7B-Instruct",
        providerType: "openai-compatible",
        providerDisplayName: "SiliconFlow",
        modelDisplayName: "Qwen 2.5 7B Instruct",
        enabled: false,
        priority: 80,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.siliconflow.cn/v1",
        dryRun: false,
      },
      {
        providerId: "dashscope",
        modelId: "qwen-plus",
        providerType: "openai-compatible",
        providerDisplayName: "DashScope",
        modelDisplayName: "Qwen Plus",
        enabled: false,
        priority: 81,
        capabilities: ["chat", "summary"],
        endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        dryRun: false,
      },
      {
        providerId: "tencent-hunyuan",
        modelId: "hunyuan-lite",
        providerType: "openai-compatible",
        providerDisplayName: "Tencent Hunyuan",
        modelDisplayName: "Hunyuan Lite",
        enabled: false,
        priority: 82,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.hunyuan.cloud.tencent.com/v1",
        dryRun: false,
      },
      {
        providerId: "qianfan",
        modelId: "ernie-speed-128k",
        providerType: "openai-compatible",
        providerDisplayName: "Baidu Qianfan",
        modelDisplayName: "ERNIE Speed 128K",
        enabled: false,
        priority: 83,
        capabilities: ["chat", "summary"],
        endpoint: "https://qianfan.baidubce.com/v2",
        dryRun: false,
      },
      {
        providerId: "zhipu",
        modelId: "glm-4-flash",
        providerType: "openai-compatible",
        providerDisplayName: "Zhipu AI",
        modelDisplayName: "GLM 4 Flash",
        enabled: false,
        priority: 84,
        capabilities: ["chat", "reasoning", "summary"],
        endpoint: "https://open.bigmodel.cn/api/paas/v4",
        dryRun: false,
      },
      {
        providerId: "xunfei-spark",
        modelId: "lite",
        providerType: "openai-compatible",
        providerDisplayName: "iFlytek Spark",
        modelDisplayName: "Spark Lite",
        enabled: false,
        priority: 85,
        capabilities: ["chat", "summary"],
        endpoint: "https://spark-api-open.xf-yun.com/v1",
        dryRun: false,
      },
      {
        providerId: "modelscope",
        modelId: "Qwen/Qwen2.5-7B-Instruct",
        providerType: "openai-compatible",
        providerDisplayName: "ModelScope",
        modelDisplayName: "Qwen 2.5 7B Instruct",
        enabled: false,
        priority: 86,
        capabilities: ["chat", "summary"],
        endpoint: "https://api-inference.modelscope.cn/v1",
        dryRun: false,
      },
      {
        providerId: "cohere",
        modelId: "command-a-03-2025",
        providerType: "openai-compatible",
        providerDisplayName: "Cohere",
        modelDisplayName: "Command A",
        enabled: false,
        priority: 87,
        capabilities: ["chat", "tool-use", "summary"],
        endpoint: "https://api.cohere.ai/compatibility/v1",
        dryRun: false,
      },
      {
        providerId: "volcengine-doubao",
        modelId: "doubao-seed-1-6",
        providerType: "openai-compatible",
        providerDisplayName: "Volcengine Doubao / Ark",
        modelDisplayName: "Doubao Seed",
        enabled: false,
        priority: 88,
        capabilities: ["chat", "vision", "coding", "summary"],
        endpoint: "https://ark.cn-beijing.volces.com/api/v3",
        dryRun: false,
      },
      {
        providerId: "minimax",
        modelId: "MiniMax-Text-01",
        providerType: "openai-compatible",
        providerDisplayName: "MiniMax",
        modelDisplayName: "MiniMax Text",
        enabled: false,
        priority: 89,
        capabilities: ["chat", "vision", "tool-use", "summary"],
        endpoint: "https://api.minimax.io/v1",
        dryRun: false,
      },
      {
        providerId: "stepfun",
        modelId: "step-2-mini",
        providerType: "openai-compatible",
        providerDisplayName: "StepFun",
        modelDisplayName: "Step 2 Mini",
        enabled: false,
        priority: 90,
        capabilities: ["chat", "vision", "coding", "summary"],
        endpoint: "https://api.stepfun.com/v1",
        dryRun: false,
      },
      {
        providerId: "novita",
        modelId: "meta-llama/llama-3.1-8b-instruct",
        providerType: "openai-compatible",
        providerDisplayName: "Novita AI",
        modelDisplayName: "Llama 3.1 8B",
        enabled: false,
        priority: 91,
        capabilities: ["chat", "vision", "image", "coding", "summary"],
        endpoint: "https://api.novita.ai/openai/v1",
        dryRun: false,
      },
      {
        providerId: "baichuan",
        modelId: "Baichuan4",
        providerType: "openai-compatible",
        providerDisplayName: "Baichuan AI",
        modelDisplayName: "Baichuan 4",
        enabled: false,
        priority: 92,
        capabilities: ["chat", "coding", "summary"],
        endpoint: "https://api.baichuan-ai.com/v1",
        dryRun: false,
      },
      {
        providerId: "yi",
        modelId: "yi-large",
        providerType: "openai-compatible",
        providerDisplayName: "01.AI / Yi",
        modelDisplayName: "Yi Large",
        enabled: false,
        priority: 93,
        capabilities: ["chat", "vision", "coding", "summary"],
        endpoint: "https://api.lingyiwanwu.com/v1",
        dryRun: false,
      },
      {
        providerId: "infini-ai",
        modelId: "qwen2.5-72b-instruct",
        providerType: "openai-compatible",
        providerDisplayName: "Infini AI",
        modelDisplayName: "Qwen 2.5 72B Instruct",
        enabled: false,
        priority: 94,
        capabilities: ["chat", "embedding", "rerank", "summary"],
        endpoint: "https://cloud.infini-ai.com/maas/v1",
        dryRun: false,
      },
      {
        providerId: "huggingface",
        modelId: "meta-llama/Llama-3.1-8B-Instruct",
        providerType: "openai-compatible",
        providerDisplayName: "Hugging Face Router",
        modelDisplayName: "Llama 3.1 8B Instruct",
        enabled: false,
        priority: 95,
        capabilities: ["chat", "vision", "coding", "image", "summary"],
        endpoint: "https://router.huggingface.co/v1",
        dryRun: false,
      },
      {
        providerId: "generic-openai-compatible",
        modelId: "custom-chat-model",
        providerType: "openai-compatible",
        providerDisplayName: "Generic OpenAI-Compatible API",
        modelDisplayName: "Custom Chat Model",
        enabled: false,
        priority: 99,
        capabilities: ["chat", "summary"],
        endpoint: "",
        dryRun: false,
      },
    ],
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
  const realProviderEnabled = readBoolean(
    env.AI_GATEWAY_REAL_PROVIDER_ENABLED,
    DEFAULT_RUNTIME_CONFIG.aiGatewayService.realProviderEnabled,
  );
  const openAiModel = env.OPENAI_MODEL ?? "gpt-4o-mini";
  const nvidiaModel = env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct";
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
      fallbackEnabled: readBoolean(env.AI_GATEWAY_FALLBACK_ENABLED, false),
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
