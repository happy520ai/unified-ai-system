export interface ServiceEndpointConfig {
  host: string;
  port: number;
}

export interface ProviderModelConfig {
  providerId: string;
  modelId: string;
  providerType: "fake" | "openai" | "nvidia" | "http-llm" | "openai-compatible";
  providerDisplayName?: string;
  modelDisplayName?: string;
  enabled: boolean;
  priority: number;
  capabilities: string[];
  fixedLatencyMs?: number;
  endpoint?: string;
  fixedEndpoint?: boolean;
  maxRetries?: number;
  staticModelsRequireExplicitSelection?: boolean;
  modelSelectionExplicit?: boolean;
  models?: Array<{
    id: string;
    displayName?: string;
    capabilities: string[];
    enabled?: boolean;
    priority?: number;
  }>;
  apiKey?: string;
  apiKeyPresent?: boolean;
  dryRun?: boolean;
}

export type ProviderMode = "fake" | "real" | "auto";
export type ProviderRouteMode = "fixed" | "registry-default";

export interface ProviderSelectionConfig {
  mode: ProviderRouteMode;
  defaultProviderId: string;
  defaultModelId: string;
  enabledProviders: string[];
}

export interface AiGatewayServiceConfig {
  endpoint: ServiceEndpointConfig;
  requestTimeoutMs: number;
  providerMode: ProviderMode;
  realProviderEnabled: boolean;
  fallbackEnabled?: boolean;
  providerSelection: ProviderSelectionConfig;
  providerModels: ProviderModelConfig[];
}

export interface UnifiedRuntimeConfig {
  agentConsole: ServiceEndpointConfig;
  aiGatewayService: AiGatewayServiceConfig;
}

export const DEFAULT_RUNTIME_CONFIG: UnifiedRuntimeConfig = {
  agentConsole: {
    host: "127.0.0.1",
    port: 3200,
  },
  aiGatewayService: {
    endpoint: {
      host: "127.0.0.1",
      port: 3100,
    },
    requestTimeoutMs: 10_000,
    providerModels: [
      {
        providerId: "local-fake-provider",
        modelId: "local-fake-model",
        providerType: "fake",
        providerDisplayName: "Local Fake Provider",
        modelDisplayName: "Local Fake Model",
        enabled: true,
        priority: 1,
        capabilities: ["chat", "reasoning", "summary", "vision"],
      },
      {
        providerId: "backup-fake-provider",
        modelId: "backup-fake-model",
        providerType: "fake",
        providerDisplayName: "Backup Fake Provider",
        modelDisplayName: "Backup Fake Model",
        enabled: true,
        priority: 2,
        capabilities: ["chat", "summary", "vision"],
        fixedLatencyMs: 0,
      },
      {
        providerId: "openai",
        modelId: "gpt-4o-mini",
        providerType: "openai",
        providerDisplayName: "OpenAI",
        modelDisplayName: "GPT-4o Mini",
        enabled: false,
        priority: 50,
        capabilities: ["chat", "reasoning", "summary", "vision"],
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
        capabilities: ["chat", "reasoning", "summary", "vision"],
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
        providerId: "bai",
        modelId: "qwen3.8-flash",
        providerType: "openai-compatible",
        providerDisplayName: "B.AI",
        modelDisplayName: "Qwen 3.8 Flash",
        enabled: false,
        priority: 97,
        capabilities: ["chat", "summary"],
        endpoint: "https://api.b.ai/v1",
        fixedEndpoint: true,
        maxRetries: 1,
        staticModelsRequireExplicitSelection: true,
        models: [
          { id: "deepseek-v4-flash", displayName: "DeepSeek V4 Flash", capabilities: ["chat", "reasoning", "coding", "summary"], enabled: false },
          { id: "deepseek-v4-flash-vision-exp", displayName: "DeepSeek V4 Flash Vision Experimental", capabilities: ["chat", "vision", "reasoning", "summary"], enabled: false },
          { id: "hy3", displayName: "HY3", capabilities: ["chat", "summary"], enabled: false },
          { id: "mimo-v2.5", displayName: "MiMo V2.5", capabilities: ["chat", "reasoning", "coding", "summary"], enabled: false },
          { id: "glm-5.3-flash", displayName: "GLM 5.3 Flash", capabilities: ["chat", "reasoning", "coding", "summary"], enabled: false },
          { id: "qwen3.8-flash", displayName: "Qwen 3.8 Flash", capabilities: ["chat", "reasoning", "coding", "summary"], enabled: false },
        ],
        dryRun: false,
      },
      {
        providerId: "generic-openai-compatible",
        modelId: "custom-chat-model",
        providerType: "openai-compatible",
        providerDisplayName: "Generic OpenAI-Compatible API",
        modelDisplayName: "Custom Chat Model",
        enabled: false,
        priority: 90,
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

export declare function loadRuntimeConfig(env?: Record<string, string | undefined>): UnifiedRuntimeConfig;
export declare function getSafeRuntimeConfig(config: UnifiedRuntimeConfig): unknown;
