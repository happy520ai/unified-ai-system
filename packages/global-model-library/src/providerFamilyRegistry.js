export const REQUIRED_PROVIDER_FAMILIES = Object.freeze([
  "nvidia",
  "openai",
  "anthropic",
  "google-gemini",
  "xai",
  "deepseek",
  "qwen",
  "moonshot-kimi",
  "zhipu-glm",
  "baidu-qianfan",
  "tencent-hunyuan",
  "minimax",
  "mistral",
  "cohere",
  "ai21",
  "groq",
  "together",
  "fireworks",
  "deepinfra",
  "replicate",
  "huggingface-inference",
  "cerebras",
  "sambanova",
  "perplexity",
  "openrouter",
  "litellm-compatible",
  "ollama-local",
  "lm-studio-local",
  "vllm-private",
  "siliconflow",
  "modelscope",
  "volcano-ark",
  "baichuan",
  "yi-01ai",
  "mimo",
]);

const FAMILY_LABELS = Object.freeze({
  nvidia: "NVIDIA NIM",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  "google-gemini": "Google Gemini",
  xai: "xAI",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  "moonshot-kimi": "Moonshot Kimi",
  "zhipu-glm": "Zhipu GLM",
  "baidu-qianfan": "Baidu Qianfan",
  "tencent-hunyuan": "Tencent Hunyuan",
  minimax: "MiniMax",
  mistral: "Mistral",
  cohere: "Cohere",
  ai21: "AI21",
  groq: "Groq",
  together: "Together AI",
  fireworks: "Fireworks AI",
  deepinfra: "DeepInfra",
  replicate: "Replicate",
  "huggingface-inference": "Hugging Face Inference",
  cerebras: "Cerebras",
  sambanova: "SambaNova",
  perplexity: "Perplexity",
  openrouter: "OpenRouter",
  "litellm-compatible": "LiteLLM Compatible",
  "ollama-local": "Ollama Local",
  "lm-studio-local": "LM Studio Local",
  "vllm-private": "vLLM Private",
  siliconflow: "SiliconFlow",
  modelscope: "ModelScope",
  "volcano-ark": "Volcano Ark",
  baichuan: "Baichuan",
  "yi-01ai": "01.AI Yi",
  mimo: "MiMo",
});

const AGGREGATOR_FAMILIES = new Set(["openrouter", "litellm-compatible", "siliconflow", "modelscope", "volcano-ark"]);
const LOCAL_FAMILIES = new Set(["ollama-local", "lm-studio-local", "vllm-private"]);

export function buildProviderFamilyRegistry() {
  const providerFamilies = REQUIRED_PROVIDER_FAMILIES.map((providerFamily) => {
    const localRuntime = LOCAL_FAMILIES.has(providerFamily);
    const aggregator = AGGREGATOR_FAMILIES.has(providerFamily);
    return {
      providerFamily,
      displayName: FAMILY_LABELS[providerFamily] ?? providerFamily,
      providerKind: localRuntime ? "local_runtime" : aggregator ? "aggregator" : "direct_provider",
      status: "catalog_family_seeded",
      userOwnedCredentialRefRequired: !localRuntime,
      rawSecretAllowed: false,
      discoveryMode: aggregator ? "aggregator_catalog_contract" : localRuntime ? "local_runtime_manifest_contract" : "provider_discovery_contract",
      runtimeEnabled: false,
      providerCallsMade: false,
      secretRead: false,
    };
  });

  return {
    phaseRange: "Phase761-780",
    registryName: "global-provider-family-registry",
    providerFamilyCount: providerFamilies.length,
    providerFamilies,
    safety: buildProviderFamilySafety(),
  };
}

export function buildProviderFamilySafety() {
  return {
    providerCallsMade: false,
    discoveryApiCalled: false,
    secretRead: false,
    authJsonRead: false,
    rawSecretAllowed: false,
    runtimeEnabled: false,
    selectableModified: false,
    defaultChatModified: false,
    chatGatewayExecuteModified: false,
  };
}
