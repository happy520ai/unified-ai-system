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
