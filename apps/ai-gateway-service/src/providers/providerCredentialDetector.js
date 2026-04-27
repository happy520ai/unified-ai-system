const MODEL_DISCOVERY_TIMEOUT_MS = 6_000;
const MAX_DISCOVERED_MODELS = 120;
const CAPABILITY_ORDER = [
  "chat",
  "vision",
  "reasoning",
  "coding",
  "tool-use",
  "structured-output",
  "image-generation",
  "audio-input",
  "speech-output",
  "video-generation",
  "embedding",
  "rerank",
  "moderation",
  "summary",
];

const CHAT_EXCLUSIVE_BLOCKERS = new Set([
  "audio-input",
  "speech-output",
  "image-generation",
  "video-generation",
  "embedding",
  "rerank",
  "moderation",
]);

const PROVIDER_CATALOG = [
  {
    family: "local-fake",
    providerId: "local-fake-provider",
    displayName: "Local Fake Provider",
    prefixes: [{ value: "fake-", unique: true, confidence: "test-only" }],
    testOnly: true,
    availableForChat: true,
    defaultModels: [
      { modelId: "local-fake-model", modelDisplayName: "Local Fake Model", capabilities: ["chat", "summary"] },
      { modelId: "phase76o-alt-model", modelDisplayName: "Phase 76O Alt Model", capabilities: ["chat", "summary"] },
    ],
    reason: "Detected a local fake test key. This is only for local verification.",
  },
  {
    family: "nvidia",
    providerId: "nvidia",
    displayName: "NVIDIA",
    prefixes: [{ value: "nvapi-", unique: true, confidence: "high" }],
    availableForChat: true,
    endpoint: "https://integrate.api.nvidia.com/v1",
    modelListPath: "/models",
    modelListValidatesCredential: false,
    defaultModels: [
      { modelId: "meta/llama-3.1-8b-instruct", modelDisplayName: "Meta Llama 3.1 8B Instruct", capabilities: ["chat", "summary"] },
      { modelId: "meta/llama-3.3-70b-instruct", modelDisplayName: "Meta Llama 3.3 70B Instruct", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "qwen/qwen2.5-coder-32b-instruct", modelDisplayName: "Qwen 2.5 Coder 32B Instruct", capabilities: ["chat", "coding", "summary"] },
    ],
    reason: "Detected an NVIDIA API key prefix. The system can discover NVIDIA models and add chat-capable ones to the current runtime.",
  },
  {
    family: "openrouter",
    providerId: "openrouter",
    displayName: "OpenRouter",
    prefixes: [{ value: "sk-or-v1-", unique: true, confidence: "high" }],
    availableForChat: true,
    endpoint: "https://openrouter.ai/api/v1",
    modelListPath: "/models?output_modalities=all",
    defaultModels: [
      { modelId: "openai/gpt-4o-mini", modelDisplayName: "OpenAI GPT-4o Mini", capabilities: ["chat", "vision", "summary"] },
      { modelId: "anthropic/claude-sonnet-4.5", modelDisplayName: "Claude Sonnet 4.5", capabilities: ["chat", "vision", "coding", "reasoning", "summary"] },
      { modelId: "google/gemini-2.5-pro", modelDisplayName: "Gemini 2.5 Pro", capabilities: ["chat", "vision", "coding", "reasoning", "summary"] },
    ],
    reason: "Detected an OpenRouter key prefix. The system can discover OpenRouter models, read their modality metadata, and let you choose a chat-executable model.",
  },
  {
    family: "groq",
    providerId: "groq",
    displayName: "Groq",
    prefixes: [{ value: "gsk_", unique: true, confidence: "high" }],
    availableForChat: true,
    endpoint: "https://api.groq.com/openai/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "llama-3.1-8b-instant", modelDisplayName: "Llama 3.1 8B Instant", capabilities: ["chat", "summary"] },
      { modelId: "llama-3.3-70b-versatile", modelDisplayName: "Llama 3.3 70B Versatile", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "whisper-large-v3", modelDisplayName: "Whisper Large v3", capabilities: ["audio-input"] },
    ],
    reason: "Detected a Groq key prefix. The system can discover Groq OpenAI-compatible chat models.",
  },
  {
    family: "xai",
    providerId: "xai",
    displayName: "xAI",
    prefixes: [{ value: "xai-", unique: true, confidence: "high" }],
    availableForChat: true,
    endpoint: "https://api.x.ai/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "grok-3-mini", modelDisplayName: "Grok 3 Mini", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "grok-beta", modelDisplayName: "Grok Beta", capabilities: ["chat", "summary"] },
      { modelId: "grok-2-vision-1212", modelDisplayName: "Grok 2 Vision", capabilities: ["chat", "vision", "summary"] },
    ],
    reason: "Detected an xAI key prefix. The system can discover xAI OpenAI-compatible chat models.",
  },
  {
    family: "cerebras",
    providerId: "cerebras",
    displayName: "Cerebras",
    prefixes: [{ value: "csk-", unique: true, confidence: "high" }],
    availableForChat: true,
    endpoint: "https://api.cerebras.ai/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "llama3.1-8b", modelDisplayName: "Llama 3.1 8B", capabilities: ["chat", "summary"] },
      { modelId: "llama-3.3-70b", modelDisplayName: "Llama 3.3 70B", capabilities: ["chat", "reasoning", "summary"] },
    ],
    reason: "Detected a Cerebras key prefix. The system can discover Cerebras OpenAI-compatible chat models.",
  },
  {
    family: "perplexity",
    providerId: "perplexity",
    displayName: "Perplexity",
    prefixes: [{ value: "pplx-", unique: true, confidence: "medium" }],
    availableForChat: true,
    endpoint: "https://api.perplexity.ai",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "sonar", modelDisplayName: "Sonar", capabilities: ["chat", "summary"] },
      { modelId: "sonar-pro", modelDisplayName: "Sonar Pro", capabilities: ["chat", "reasoning", "summary"] },
    ],
    reason: "Detected a Perplexity-style key prefix. The system can try Perplexity's OpenAI-compatible chat path.",
  },
  {
    family: "openai",
    providerId: "openai",
    displayName: "OpenAI",
    prefixes: [
      { value: "sk-proj-", unique: true, confidence: "high" },
      { value: "sk-", unique: false, confidence: "ambiguous" },
    ],
    availableForChat: true,
    endpoint: "https://api.openai.com/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "gpt-4o-mini", modelDisplayName: "GPT-4o Mini", capabilities: ["chat", "vision", "tool-use", "structured-output", "summary"] },
      { modelId: "gpt-4o", modelDisplayName: "GPT-4o", capabilities: ["chat", "vision", "reasoning", "tool-use", "structured-output", "summary"] },
      { modelId: "o4-mini", modelDisplayName: "o4 Mini", capabilities: ["chat", "reasoning", "coding", "tool-use", "structured-output", "summary"] },
      { modelId: "gpt-image-1", modelDisplayName: "GPT Image 1", capabilities: ["image-generation"] },
      { modelId: "text-embedding-3-large", modelDisplayName: "Text Embedding 3 Large", capabilities: ["embedding"] },
      { modelId: "whisper-1", modelDisplayName: "Whisper 1", capabilities: ["audio-input"] },
      { modelId: "tts-1", modelDisplayName: "TTS 1", capabilities: ["speech-output"] },
    ],
    reason: "Detected an OpenAI-style key. Generic sk- keys are ambiguous, so the system avoids probing multiple vendors automatically.",
  },
  {
    family: "deepseek",
    providerId: "deepseek",
    displayName: "DeepSeek",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    availableForChat: true,
    endpoint: "https://api.deepseek.com/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "deepseek-chat", modelDisplayName: "DeepSeek Chat", capabilities: ["chat", "coding", "summary"] },
      { modelId: "deepseek-reasoner", modelDisplayName: "DeepSeek Reasoner", capabilities: ["chat", "reasoning", "coding", "summary"] },
    ],
    reason: "Generic sk- keys may belong to DeepSeek; choose this provider to probe only DeepSeek.",
  },
  {
    family: "together",
    providerId: "together",
    displayName: "Together AI",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    availableForChat: true,
    endpoint: "https://api.together.xyz/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", modelDisplayName: "Llama 3.1 8B Instruct Turbo", capabilities: ["chat", "summary"] },
      { modelId: "meta-llama/Llama-3.3-70B-Instruct-Turbo", modelDisplayName: "Llama 3.3 70B Instruct Turbo", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "Qwen/Qwen2.5-Coder-32B-Instruct", modelDisplayName: "Qwen 2.5 Coder 32B Instruct", capabilities: ["chat", "coding", "summary"] },
    ],
    reason: "Generic sk- keys may belong to Together AI; choose this provider to probe only Together.",
  },
  {
    family: "mistral",
    providerId: "mistral",
    displayName: "Mistral",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    availableForChat: true,
    endpoint: "https://api.mistral.ai/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "mistral-small-latest", modelDisplayName: "Mistral Small Latest", capabilities: ["chat", "tool-use", "summary"] },
      { modelId: "mistral-large-latest", modelDisplayName: "Mistral Large Latest", capabilities: ["chat", "reasoning", "coding", "tool-use", "summary"] },
      { modelId: "pixtral-large-latest", modelDisplayName: "Pixtral Large Latest", capabilities: ["chat", "vision", "summary"] },
    ],
    reason: "Generic sk- keys may belong to Mistral; choose this provider to probe only Mistral.",
  },
  {
    family: "moonshot",
    providerId: "moonshot",
    displayName: "Moonshot AI",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    availableForChat: true,
    endpoint: "https://api.moonshot.ai/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "moonshot-v1-8k", modelDisplayName: "Moonshot v1 8K", capabilities: ["chat", "summary"] },
      { modelId: "moonshot-v1-32k", modelDisplayName: "Moonshot v1 32K", capabilities: ["chat", "summary"] },
      { modelId: "kimi-k2-instruct", modelDisplayName: "Kimi K2 Instruct", capabilities: ["chat", "coding", "reasoning", "summary"] },
    ],
    reason: "Generic sk- keys may belong to Moonshot AI; choose this provider to probe only Moonshot.",
  },
  {
    family: "siliconflow",
    providerId: "siliconflow",
    displayName: "SiliconFlow",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    availableForChat: true,
    endpoint: "https://api.siliconflow.cn/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "Qwen/Qwen2.5-7B-Instruct", modelDisplayName: "Qwen 2.5 7B Instruct", capabilities: ["chat", "summary"] },
      { modelId: "deepseek-ai/DeepSeek-V3", modelDisplayName: "DeepSeek V3", capabilities: ["chat", "coding", "summary"] },
      { modelId: "BAAI/bge-m3", modelDisplayName: "BGE M3", capabilities: ["embedding"] },
      { modelId: "BAAI/bge-reranker-v2-m3", modelDisplayName: "BGE Reranker v2 M3", capabilities: ["rerank"] },
    ],
    reason: "Generic sk- keys may belong to SiliconFlow; choose this provider to probe only SiliconFlow.",
  },
  {
    family: "dashscope",
    providerId: "dashscope",
    displayName: "DashScope",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["dashscope", "dashscope.aliyuncs.com", "阿里百炼", "百炼", "通义", "qwen"],
    credentialPatterns: [
      { pattern: /^sk-[a-f0-9]{32}$/i, unique: true, confidence: "dashscope-key-shape" },
    ],
    availableForChat: true,
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "qwen-plus", modelDisplayName: "Qwen Plus", capabilities: ["chat", "summary"] },
      { modelId: "qwen-max", modelDisplayName: "Qwen Max", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "qwen-vl-plus", modelDisplayName: "Qwen VL Plus", capabilities: ["chat", "vision", "summary"] },
      { modelId: "text-embedding-v3", modelDisplayName: "Text Embedding v3", capabilities: ["embedding"] },
      { modelId: "wanx2.1-t2i-plus", modelDisplayName: "Wanx Image", capabilities: ["image-generation"] },
    ],
    reason: "Generic sk- keys may belong to DashScope; choose this provider to probe only DashScope.",
  },
  {
    family: "tencent-hunyuan",
    providerId: "tencent-hunyuan",
    displayName: "Tencent Hunyuan",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["tencent", "hunyuan", "混元", "腾讯", "api.hunyuan.cloud.tencent.com"],
    availableForChat: true,
    endpoint: "https://api.hunyuan.cloud.tencent.com/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "hunyuan-lite", modelDisplayName: "Hunyuan Lite", capabilities: ["chat", "summary"] },
      { modelId: "hunyuan-turbo", modelDisplayName: "Hunyuan Turbo", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "hunyuan-t1-latest", modelDisplayName: "Hunyuan T1 Latest", capabilities: ["chat", "reasoning", "summary"] },
    ],
    reason: "Generic sk- keys may belong to Tencent Hunyuan; choose this provider to probe only Tencent Hunyuan.",
  },
  {
    family: "qianfan",
    providerId: "qianfan",
    displayName: "Baidu Qianfan",
    prefixes: [
      { value: "bce-v3/", unique: true, confidence: "high" },
      { value: "AK-", unique: true, confidence: "medium" },
    ],
    credentialPatterns: [
      { pattern: /bce-v3\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]{16,}/i, unique: true, confidence: "high" },
    ],
    hints: ["qianfan", "baidu", "千帆", "百度", "qianfan.baidubce.com"],
    availableForChat: true,
    endpoint: "https://qianfan.baidubce.com/v2",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "ernie-4.5-turbo-128k", modelDisplayName: "ERNIE 4.5 Turbo 128K", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "ernie-4.0-turbo-8k", modelDisplayName: "ERNIE 4.0 Turbo 8K", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "ernie-speed-128k", modelDisplayName: "ERNIE Speed 128K", capabilities: ["chat", "summary"] },
    ],
    reason: "Detected a Baidu Qianfan credential or platform hint. The OpenAI-compatible Qianfan endpoint can be added to the chat lane after provider confirmation.",
  },
  {
    family: "zhipu",
    providerId: "zhipu",
    displayName: "Zhipu AI",
    credentialPatterns: [
      { pattern: /[0-9a-f]{32}\.[A-Za-z0-9_-]{8,}/i, unique: true, confidence: "high" },
    ],
    hints: ["zhipu", "bigmodel", "智谱", "glm", "open.bigmodel.cn"],
    availableForChat: true,
    endpoint: "https://open.bigmodel.cn/api/paas/v4",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "glm-4.5", modelDisplayName: "GLM 4.5", capabilities: ["chat", "reasoning", "coding", "summary"] },
      { modelId: "glm-4.5-air", modelDisplayName: "GLM 4.5 Air", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "glm-4-flash", modelDisplayName: "GLM 4 Flash", capabilities: ["chat", "summary"] },
    ],
    reason: "Detected a Zhipu AI key shape. The system can add GLM chat models through the OpenAI-compatible runtime adapter.",
  },
  {
    family: "xunfei-spark",
    providerId: "xunfei-spark",
    displayName: "iFlytek Spark",
    credentialPatterns: [
      { pattern: /[A-Za-z0-9_-]{12,}:[A-Za-z0-9_-]{12,}/, unique: true, confidence: "medium" },
    ],
    hints: ["xf-yun", "spark-api-open", "科大讯飞", "讯飞", "星火", "spark lite"],
    availableForChat: true,
    endpoint: "https://spark-api-open.xf-yun.com/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "lite", modelDisplayName: "Spark Lite", capabilities: ["chat", "summary"] },
      { modelId: "generalv3", modelDisplayName: "Spark General v3", capabilities: ["chat", "summary"] },
      { modelId: "generalv3.5", modelDisplayName: "Spark General v3.5", capabilities: ["chat", "reasoning", "summary"] },
    ],
    reason: "Detected an iFlytek Spark credential shape or platform hint. Spark OpenAI-compatible chat can be probed only after this provider is chosen.",
  },
  {
    family: "modelscope",
    providerId: "modelscope",
    displayName: "ModelScope",
    prefixes: [{ value: "ms-", unique: true, confidence: "high" }],
    hints: ["modelscope", "魔搭", "魔搭社区", "api-inference.modelscope.cn"],
    availableForChat: true,
    endpoint: "https://api-inference.modelscope.cn/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "Qwen/Qwen2.5-7B-Instruct", modelDisplayName: "Qwen 2.5 7B Instruct", capabilities: ["chat", "summary"] },
      { modelId: "Qwen/Qwen2.5-72B-Instruct", modelDisplayName: "Qwen 2.5 72B Instruct", capabilities: ["chat", "reasoning", "summary"] },
      { modelId: "deepseek-ai/DeepSeek-V3", modelDisplayName: "DeepSeek V3", capabilities: ["chat", "coding", "summary"] },
    ],
    reason: "Detected a ModelScope token prefix. The system can add ModelScope OpenAI-compatible chat models.",
  },
  {
    family: "cohere",
    providerId: "cohere",
    displayName: "Cohere",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["cohere", "command", "api.cohere.ai"],
    availableForChat: true,
    endpoint: "https://api.cohere.ai/compatibility/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "command-a-03-2025", modelDisplayName: "Command A", capabilities: ["chat", "tool-use", "summary"] },
      { modelId: "command-r-plus", modelDisplayName: "Command R Plus", capabilities: ["chat", "tool-use", "summary"] },
    ],
    reason: "Cohere exposes an OpenAI-compatible model list path. Choose Cohere to probe only Cohere instead of guessing from a generic sk- key.",
  },
  {
    family: "volcengine-doubao",
    providerId: "volcengine-doubao",
    displayName: "Volcengine Doubao / Ark",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["volcengine", "doubao", "ark.cn-beijing.volces.com", "bytedance"],
    availableForChat: true,
    endpoint: "https://ark.cn-beijing.volces.com/api/v3",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "doubao-seed-1-6", modelDisplayName: "Doubao Seed", capabilities: ["chat", "vision", "summary"] },
      { modelId: "doubao-1-5-pro-32k", modelDisplayName: "Doubao 1.5 Pro", capabilities: ["chat", "reasoning", "summary"] },
    ],
    reason: "Volcengine Ark uses an OpenAI-compatible path. Choose this provider to probe Doubao models explicitly.",
  },
  {
    family: "minimax",
    providerId: "minimax",
    displayName: "MiniMax",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["minimax", "MiniMax-Text", "api.minimax.io"],
    availableForChat: true,
    endpoint: "https://api.minimax.io/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "MiniMax-Text-01", modelDisplayName: "MiniMax Text", capabilities: ["chat", "summary"] },
      { modelId: "abab6.5s-chat", modelDisplayName: "ABAB Chat", capabilities: ["chat", "summary"] },
    ],
    reason: "MiniMax is exposed through an OpenAI-compatible path. Choose this provider to probe MiniMax models explicitly.",
  },
  {
    family: "stepfun",
    providerId: "stepfun",
    displayName: "StepFun",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["stepfun", "step-", "api.stepfun.com"],
    availableForChat: true,
    endpoint: "https://api.stepfun.com/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "step-2-mini", modelDisplayName: "Step 2 Mini", capabilities: ["chat", "summary"] },
      { modelId: "step-1v-32k", modelDisplayName: "Step 1V", capabilities: ["chat", "vision", "summary"] },
    ],
    reason: "StepFun is exposed through an OpenAI-compatible path. Choose this provider to probe StepFun models explicitly.",
  },
  {
    family: "novita",
    providerId: "novita",
    displayName: "Novita AI",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["novita", "api.novita.ai"],
    availableForChat: true,
    endpoint: "https://api.novita.ai/openai/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "meta-llama/llama-3.1-8b-instruct", modelDisplayName: "Llama 3.1 8B", capabilities: ["chat", "summary"] },
      { modelId: "qwen/qwen-2.5-72b-instruct", modelDisplayName: "Qwen 2.5 72B", capabilities: ["chat", "reasoning", "summary"] },
    ],
    reason: "Novita AI is exposed through an OpenAI-compatible path. Choose this provider to probe Novita models explicitly.",
  },
  {
    family: "baichuan",
    providerId: "baichuan",
    displayName: "Baichuan AI",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["baichuan", "api.baichuan-ai.com"],
    availableForChat: true,
    endpoint: "https://api.baichuan-ai.com/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "Baichuan4", modelDisplayName: "Baichuan 4", capabilities: ["chat", "summary"] },
      { modelId: "Baichuan3-Turbo", modelDisplayName: "Baichuan 3 Turbo", capabilities: ["chat", "summary"] },
    ],
    reason: "Baichuan AI is exposed through an OpenAI-compatible path. Choose this provider to probe Baichuan models explicitly.",
  },
  {
    family: "yi",
    providerId: "yi",
    displayName: "01.AI / Yi",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["01.ai", "lingyiwanwu", "yi-large", "api.lingyiwanwu.com"],
    availableForChat: true,
    endpoint: "https://api.lingyiwanwu.com/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "yi-large", modelDisplayName: "Yi Large", capabilities: ["chat", "summary"] },
      { modelId: "yi-vision", modelDisplayName: "Yi Vision", capabilities: ["chat", "vision", "summary"] },
    ],
    reason: "01.AI / Yi is exposed through an OpenAI-compatible path. Choose this provider to probe Yi models explicitly.",
  },
  {
    family: "infini-ai",
    providerId: "infini-ai",
    displayName: "Infini AI",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["infini", "cloud.infini-ai.com"],
    availableForChat: true,
    endpoint: "https://cloud.infini-ai.com/maas/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "qwen2.5-72b-instruct", modelDisplayName: "Qwen 2.5 72B Instruct", capabilities: ["chat", "summary"] },
      { modelId: "bge-m3", modelDisplayName: "BGE M3", capabilities: ["embedding"] },
    ],
    reason: "Infini AI is exposed through an OpenAI-compatible path. Choose this provider to probe Infini AI models explicitly.",
  },
  {
    family: "cloudflare-workers-ai",
    providerId: "cloudflare-workers-ai",
    displayName: "Cloudflare Workers AI",
    prefixes: [{ value: "cfat_", unique: true, confidence: "high" }],
    hints: ["cloudflare", "workers ai", "api.cloudflare.com/client/v4/accounts"],
    availableForChat: false,
    defaultModels: [
      { modelId: "@cf/meta/llama-3.1-8b-instruct", modelDisplayName: "Llama 3.1 8B Instruct", capabilities: ["chat", "summary"] },
      { modelId: "@cf/qwen/qwen1.5-14b-chat-awq", modelDisplayName: "Qwen Chat", capabilities: ["chat", "summary"] },
      { modelId: "@cf/baai/bge-base-en-v1.5", modelDisplayName: "BGE Base Embedding", capabilities: ["embedding"] },
    ],
    reason: "Detected a Cloudflare API token. Cloudflare Workers AI also needs an account-specific endpoint, so it is recognized but not one-click chat-enabled yet.",
  },
  {
    family: "huggingface",
    providerId: "huggingface",
    displayName: "Hugging Face Router",
    prefixes: [{ value: "hf_", unique: true, confidence: "high" }],
    hints: ["huggingface", "bloom", "hf_", "router.huggingface.co"],
    availableForChat: true,
    endpoint: "https://router.huggingface.co/v1",
    modelListPath: "/models",
    defaultModels: [
      { modelId: "openai/gpt-oss-20b", modelDisplayName: "GPT OSS 20B", capabilities: ["chat", "summary"] },
      { modelId: "Qwen/Qwen2.5-7B-Instruct", modelDisplayName: "Qwen 2.5 7B Instruct", capabilities: ["chat", "summary"] },
      { modelId: "bigscience/bloom", modelDisplayName: "BLOOM", capabilities: ["chat", "summary"] },
    ],
    reason: "Detected a Hugging Face token. The system can probe the Hugging Face Router OpenAI-compatible model list.",
  },
  {
    family: "coze",
    providerId: "coze",
    displayName: "Coze",
    prefixes: [{ value: "pat_", unique: true, confidence: "high" }],
    hints: ["coze", "扣子"],
    availableForChat: false,
    defaultModels: [
      { modelId: "coze-bot-api", modelDisplayName: "Coze Bot API", capabilities: ["chat", "tool-use"] },
      { modelId: "coze-workflow-api", modelDisplayName: "Coze Workflow API", capabilities: ["tool-use"] },
    ],
    reason: "Detected a Coze token. Coze is an agent/workflow platform, not a current OpenAI-compatible chat provider in this runtime.",
  },
  {
    family: "generic-openai-compatible",
    providerId: "generic-openai-compatible",
    displayName: "Generic OpenAI-Compatible API",
    prefixes: [{ value: "sk-", unique: false, confidence: "ambiguous" }],
    hints: ["公益api", "free api", "openai兼容", "openai-compatible", "oneapi", "newapi"],
    availableForChat: true,
    endpointRequired: true,
    defaultModels: [
      { modelId: "custom-chat-model", modelDisplayName: "Custom Chat Model", capabilities: ["chat", "summary"] },
    ],
    reason: "Detected a generic OpenAI-compatible key and base URL. The system can add it as a custom chat provider after a real /chat probe.",
  },
  {
    family: "gemini",
    providerId: "gemini",
    displayName: "Gemini",
    prefixes: [{ value: "AIza", unique: true, confidence: "high" }],
    availableForChat: false,
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    modelListPath: "/models",
    modelListAuth: "gemini-query-key",
    defaultModels: [
      { modelId: "gemini-embedding-001", modelDisplayName: "Gemini Embedding 001", capabilities: ["embedding"] },
      { modelId: "gemini-2.5-flash", modelDisplayName: "Gemini 2.5 Flash", capabilities: ["chat", "vision", "coding", "reasoning", "summary"] },
      { modelId: "gemini-2.5-pro", modelDisplayName: "Gemini 2.5 Pro", capabilities: ["chat", "vision", "coding", "reasoning", "summary"] },
      { modelId: "imagen-4.0-generate-001", modelDisplayName: "Imagen 4", capabilities: ["image-generation"] },
      { modelId: "veo-3.0-generate-001", modelDisplayName: "Veo 3", capabilities: ["video-generation"] },
    ],
    reason: "Detected a Gemini key. Gemini is currently wired for embedding/vector infrastructure, not the chat provider lane.",
  },
  {
    family: "anthropic",
    providerId: "anthropic",
    displayName: "Anthropic",
    prefixes: [{ value: "sk-ant-", unique: true, confidence: "high" }],
    availableForChat: false,
    endpoint: "https://api.anthropic.com/v1",
    modelListPath: "/models",
    modelListAuth: "anthropic-api-key",
    defaultModels: [
      { modelId: "claude-sonnet-4.5", modelDisplayName: "Claude Sonnet 4.5", capabilities: ["chat", "vision", "coding", "reasoning", "tool-use", "summary"] },
      { modelId: "claude-3-5-sonnet-latest", modelDisplayName: "Claude 3.5 Sonnet Latest", capabilities: ["chat", "vision", "coding", "reasoning", "tool-use", "summary"] },
    ],
    reason: "Detected an Anthropic key. The current chat lane only supports existing OpenAI-compatible adapters, so native Anthropic is recognized but not one-click chat-enabled yet.",
  },
];

export async function detectRuntimeCredentialProviders(application, body = {}) {
  const apiKey = String(body?.apiKey ?? "").trim();
  if (!apiKey) {
    const error = new Error("apiKey is required.");
    error.code = "provider_runtime_credential_detect_api_key_required";
    error.category = "validation";
    throw error;
  }

  const preferredProviderId = String(body?.preferredProviderId ?? "").trim();
  const allowModelListProbe = body?.allowModelListProbe === true || body?.probePolicy === "bounded-model-list";
  const matches = matchProviderFamilies(apiKey, preferredProviderId);
  const detected = [];
  let networkProbePerformed = false;

  for (const match of matches) {
    const extractedApiKey = extractRuntimeCredentialSecret(match.family.providerId, apiKey);
    const candidate = await createDetectionCandidate(application, match.family, {
      apiKey: extractedApiKey,
      rawCredential: apiKey,
      matchedPrefix: match.prefix,
      preferredProviderId,
      allowModelListProbe,
      rawCredentialWasParsed: extractedApiKey !== apiKey,
    });
    if (candidate) {
      detected.push(candidate);
      networkProbePerformed = networkProbePerformed || candidate.modelDiscovery?.networkProbePerformed === true;
    }
  }

  const available = detected
    .flatMap((candidate) => candidate.models.map((model) => ({ candidate, model })))
    .filter(({ candidate, model }) => candidate.availableForChat && candidate.supportedByRuntime && model.execution?.chat === true);
  const recommended = pickRecommendedCandidate(available);
  const capabilitySummary = createCapabilitySummary(detected);

  return {
    success: true,
    apiKeyPresent: true,
    secretStorage: "not-stored",
    mode: networkProbePerformed ? "provider-model-discovery" : "safe-catalog-detection",
    detected,
    recommended,
    capabilitySummary,
    warnings: createDetectionWarnings({ apiKey, detected, recommended, capabilitySummary, allowModelListProbe }),
    safety: {
      apiKeyStored: false,
      apiKeyLogged: false,
      providerProbePerformed: networkProbePerformed,
      networkProbePerformed,
      ambiguousKeySprayPrevented: detected.some((candidate) => candidate.requiresProviderChoice),
      modelListProbeEnabled: allowModelListProbe,
      probePolicy: allowModelListProbe ? "explicit-bounded-model-list" : "safe-prefix-catalog",
      fakeProviderExcludedFromRealKeyFallback: true,
      defaultChatMainLaneChanged: false,
    },
  };
}

export function extractRuntimeCredentialSecret(providerId, rawCredential) {
  const raw = String(rawCredential ?? "").trim();
  if (!raw) return raw;

  const family = PROVIDER_CATALOG.find((item) => item.providerId === providerId);
  if (!family) return raw;

  for (const pattern of family.credentialPatterns ?? []) {
    const match = raw.match(pattern.pattern);
    if (match?.[1]) return match[1];
    if (match?.[0]) return match[0];
  }

  for (const prefix of family.prefixes ?? []) {
    const match = findTokenByPrefix(raw, prefix.value);
    if (match) return match;
  }

  if (
    providerId === "tencent-hunyuan" ||
    providerId === "siliconflow" ||
    providerId === "dashscope" ||
    providerId === "openai" ||
    providerId === "generic-openai-compatible" ||
    providerId === "cohere" ||
    providerId === "volcengine-doubao" ||
    providerId === "minimax" ||
    providerId === "stepfun" ||
    providerId === "novita" ||
    providerId === "baichuan" ||
    providerId === "yi" ||
    providerId === "infini-ai"
  ) {
    const skToken = findTokenByPrefix(raw, "sk-");
    if (skToken) return skToken;
  }

  return raw;
}

export function extractRuntimeCredentialEndpoint(providerId, rawCredential) {
  const raw = String(rawCredential ?? "").trim();
  if (!raw) return "";

  const family = PROVIDER_CATALOG.find((item) => item.providerId === providerId);
  if (family?.endpoint && !family.endpointRequired) {
    return "";
  }

  if (providerId === "generic-openai-compatible") {
    return extractOpenAiCompatibleBaseUrl(raw);
  }

  return "";
}

function matchProviderFamilies(apiKey, preferredProviderId) {
  if (preferredProviderId) {
    const family = PROVIDER_CATALOG.find((item) => item.providerId === preferredProviderId);
    return family ? [{ family, prefix: { value: "manual-provider-choice", unique: true, confidence: "manual" } }] : [];
  }

  const matches = [];
  for (const family of PROVIDER_CATALOG) {
    const match = findFamilyCredentialMatch(family, apiKey);
    if (match) {
      matches.push({ family, prefix: match });
    }
  }

  const uniqueMatches = matches.filter((match) => match.prefix.unique);
  if (uniqueMatches.length) {
    const providerSpecificMatches = uniqueMatches.filter((match) => match.family.providerId !== "generic-openai-compatible");
    return providerSpecificMatches.length ? providerSpecificMatches : uniqueMatches;
  }

  if (matches.length) {
    return matches.filter((match) => !match.family.testOnly);
  }

  return [];
}

function findFamilyCredentialMatch(family, rawCredential) {
  const text = String(rawCredential ?? "").trim();
  const lower = text.toLowerCase();

  for (const prefix of family.prefixes ?? []) {
    if (prefix.unique && hasTokenWithPrefix(text, prefix.value)) {
      return prefix;
    }
  }

  if (family.providerId === "generic-openai-compatible" && extractOpenAiCompatibleBaseUrl(text) && hasTokenWithPrefix(text, "sk-")) {
    return {
      value: "base-url-and-sk",
      unique: true,
      confidence: "base-url",
    };
  }

  for (const pattern of family.credentialPatterns ?? []) {
    pattern.pattern.lastIndex = 0;
    if (pattern.pattern.test(text)) {
      return {
        value: pattern.name ?? "credential-pattern",
        unique: pattern.unique !== false,
        confidence: pattern.confidence ?? "medium",
      };
    }
  }

  for (const hint of family.hints ?? []) {
    if (lower.includes(String(hint).toLowerCase())) {
      return {
        value: "platform-hint",
        unique: true,
        confidence: "platform-hint",
      };
    }
  }

  for (const prefix of family.prefixes ?? []) {
    if (!prefix.unique && hasTokenWithPrefix(text, prefix.value)) {
      return prefix;
    }
  }

  return null;
}

function hasTokenWithPrefix(rawCredential, prefix) {
  return Boolean(findTokenByPrefix(rawCredential, prefix));
}

function findTokenByPrefix(rawCredential, prefix) {
  const text = String(rawCredential ?? "");
  const escapedPrefix = escapeRegExp(prefix);
  const pattern = new RegExp(`(^|[^A-Za-z0-9_\\-./])(${escapedPrefix}[A-Za-z0-9_\\-./]{4,})`, "i");
  const match = text.match(pattern);
  return match?.[2] ?? null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function createDetectionCandidate(application, family, context) {
  const runtimeEndpoint = resolveRuntimeDetectionEndpoint(family, context);
  const descriptor = findProviderDescriptor(application, family.providerId);
  const modelConfigs = findProviderModelConfigs(application, family.providerId);
  const supportedByRuntime = Boolean(descriptor || modelConfigs.length > 0);
  const discovery = await discoverModels(family, { ...context, endpoint: runtimeEndpoint });
  const models = createModelCandidates({ family, descriptor, modelConfigs, discovery, supportedByRuntime });
  const authFailed = discovery.status === "auth-failed";
  const chatExecutableModelCount = models.filter((model) => model.execution?.chat === true).length;
  const endpointReady = !family.endpointRequired || Boolean(runtimeEndpoint);
  const availableForChat = family.availableForChat && supportedByRuntime && endpointReady && chatExecutableModelCount > 0 && !authFailed;
  const credentialValidated = discovery.credentialValidated === true;
  const endpointMissing = family.endpointRequired && !runtimeEndpoint;
  const requiresProviderChoice = !credentialValidated && !authFailed && !endpointMissing && !context.matchedPrefix?.unique && context.preferredProviderId !== family.providerId;

  return {
    providerId: family.providerId,
    providerDisplayName: descriptor?.displayName ?? modelConfigs[0]?.providerDisplayName ?? family.displayName,
    keyFamily: family.family,
    confidence: createCandidateConfidence({ discovery, matchedPrefix: context.matchedPrefix }),
    matchMethod: createCandidateMatchMethod(discovery),
    status: createCandidateStatus({ availableForChat, supportedByRuntime, authFailed, requiresProviderChoice, chatExecutableModelCount }),
    supportedByRuntime,
    endpointRequired: Boolean(family.endpointRequired),
    endpointConfigured: Boolean(runtimeEndpoint || family.endpoint),
    suggestedEndpoint: runtimeEndpoint || undefined,
    runtimeEnabled: Boolean(application.providerRegistry?.enabledProviders?.has(family.providerId)),
    availableForChat,
    chatExecutableModelCount,
    requiresProviderChoice,
    credentialInputParsed: Boolean(context.rawCredentialWasParsed),
    reason: availableForChat ? family.reason : createUnavailableReason(family, supportedByRuntime, discovery, chatExecutableModelCount),
    modelDiscovery: discovery,
    capabilitySummary: summarizeModels(models),
    models,
  };
}

function resolveRuntimeDetectionEndpoint(family, context) {
  if (family.endpointRequired) {
    return extractRuntimeCredentialEndpoint(family.providerId, context.rawCredential ?? context.apiKey);
  }

  return family.endpoint;
}

async function discoverModels(family, { apiKey, matchedPrefix, preferredProviderId, endpoint, allowModelListProbe }) {
  const discoveryEndpoint = endpoint || family.endpoint;
  const canProbe = Boolean(discoveryEndpoint && family.modelListPath && (
    matchedPrefix?.unique ||
    preferredProviderId === family.providerId ||
    (allowModelListProbe && !family.testOnly)
  ));

  if (!family.availableForChat && !canProbe) {
    return {
      status: "recognized-capability-catalog",
      networkProbePerformed: false,
      source: "provider-catalog",
      models: rankDiscoveredModels(family, family.defaultModels ?? []),
    };
  }

  if (!canProbe) {
    return {
      status: family.endpointRequired && !discoveryEndpoint ? "endpoint-required" : matchedPrefix?.confidence === "unknown" ? "manual-provider-choice" : "not-run-ambiguous-key",
      networkProbePerformed: false,
      source: "provider-catalog",
      models: rankDiscoveredModels(family, family.defaultModels ?? []),
    };
  }

  try {
    const request = createModelListRequest(family, discoveryEndpoint, apiKey);
    const response = await fetchJsonWithTimeout(request.url, request.options);

    if (!response.ok) {
      const authFailed = response.statusCode === 401 || response.statusCode === 403;
      return {
        status: authFailed ? "auth-failed" : "not-ready-catalog-fallback",
        networkProbePerformed: true,
        httpStatus: response.statusCode,
        source: "provider-models-api",
        models: authFailed ? [] : rankDiscoveredModels(family, family.defaultModels ?? []),
        warning: `Model list request returned HTTP ${response.statusCode}.`,
      };
    }

    const liveModels = rankDiscoveredModels(
      family,
      dedupeModels([
        ...withModelSource(family.defaultModels ?? [], "provider-catalog-default"),
        ...normalizeDiscoveredModels(response.body),
      ]),
    ).slice(0, MAX_DISCOVERED_MODELS);
    const credentialValidated = family.modelListValidatesCredential !== false;

    return {
      status: liveModels.length ? "ready" : "ready-empty-model-list",
      networkProbePerformed: true,
      httpStatus: response.statusCode,
      source: "provider-models-api",
      credentialValidated,
      credentialValidation: credentialValidated ? "model-list-authenticated" : "model-list-does-not-prove-key-valid",
      models: liveModels,
    };
  } catch (error) {
    return {
      status: "probe-failed",
      networkProbePerformed: true,
      source: "provider-models-api",
      models: rankDiscoveredModels(family, family.defaultModels ?? []),
      warning: error instanceof Error ? error.message : "Model discovery failed.",
    };
  }
}

function createModelListRequest(family, discoveryEndpoint, apiKey) {
  const url = `${trimSlash(discoveryEndpoint)}${family.modelListPath}`;
  const headers = {
    accept: "application/json",
  };

  if (family.modelListAuth === "gemini-query-key") {
    return {
      url: appendQueryParam(url, "key", apiKey),
      options: { headers },
    };
  }

  if (family.modelListAuth === "anthropic-api-key") {
    return {
      url,
      options: {
        headers: {
          ...headers,
          "anthropic-version": "2023-06-01",
          "x-api-key": apiKey,
        },
      },
    };
  }

  return {
    url,
    options: {
      headers: {
        ...headers,
        authorization: `Bearer ${apiKey}`,
      },
    },
  };
}

function appendQueryParam(rawUrl, key, value) {
  const url = new URL(rawUrl);
  url.searchParams.set(key, value);
  return url.toString();
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      statusCode: response.status,
      body: text ? safeJsonParse(text) : {},
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDiscoveredModels(body) {
  const rawModels = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.models)
      ? body.models
      : Array.isArray(body)
        ? body
        : [];

  return dedupeModels(rawModels.map((model) => {
    const id = typeof model === "string" ? model : model?.id ?? model?.name ?? model?.model;
    if (!id) return null;
    const supportedParameters = normalizeStringList(model?.supported_parameters ?? model?.supportedParameters);
    const modalities = extractRawModalities(model);
    return {
      modelId: String(id),
      modelDisplayName: String(model?.displayName ?? model?.display_name ?? model?.name ?? id),
      capabilities: normalizeCapabilityList(model?.capabilities ?? model?.capability),
      modalities,
      supportedParameters,
      source: "provider-models-api",
      metadata: {
        ownedBy: model?.owned_by,
        created: model?.created,
        contextLength: model?.context_length ?? model?.contextLength,
        pricing: model?.pricing,
        architecture: model?.architecture
          ? {
              modality: model.architecture.modality,
              tokenizer: model.architecture.tokenizer,
            }
          : undefined,
      },
    };
  }).filter(Boolean));
}

function withModelSource(models, source) {
  return (Array.isArray(models) ? models : []).map((model) => ({
    ...model,
    source,
  }));
}

function rankDiscoveredModels(family, models) {
  return [...models].sort((left, right) => {
    const diff = scoreDiscoveredModel(family, right) - scoreDiscoveredModel(family, left);
    if (diff !== 0) return diff;
    return String(left.modelId).localeCompare(String(right.modelId));
  });
}

function scoreDiscoveredModel(family, model) {
  const profile = createModelProfile(family, model);
  const id = String(model.modelId ?? "").toLowerCase();
  const defaultModelIds = (family.defaultModels ?? []).map((item) => String(item.modelId ?? "").toLowerCase());
  const defaults = new Set(defaultModelIds);
  const defaultIndex = defaultModelIds.indexOf(id);
  let score = 0;

  if (defaults.has(id)) score += 1_000 + Math.max(0, 400 - defaultIndex * 80);
  if (profile.capabilities.includes("chat")) score += 500;
  if (profile.capabilities.includes("vision")) score += 130;
  if (profile.capabilities.includes("reasoning")) score += 120;
  if (profile.capabilities.includes("coding")) score += 110;
  if (profile.capabilities.includes("tool-use")) score += 70;
  if (profile.capabilities.includes("structured-output")) score += 60;
  if (id.includes("instruct")) score += 180;
  if (id.includes("chat")) score += 160;
  if (id.includes("llama")) score += 130;
  if (id.includes("qwen")) score += 120;
  if (id.includes("deepseek")) score += 110;
  if (id.includes("mistral")) score += 100;
  if (id.includes("kimi")) score += 90;
  if (id.includes("gpt")) score += 85;
  if (id.includes("reason")) score += 70;
  if (id.includes("turbo")) score += 45;
  if (id.includes("mini") || id.includes("small") || id.includes("8b")) score += 20;
  if (!profile.capabilities.includes("chat")) score -= 600;
  return score;
}

function createModelCandidates({ family, descriptor, modelConfigs, discovery, supportedByRuntime }) {
  const discovered = (discovery.models ?? []).map((model) => createModelCandidate({
    family,
    model,
    source: model.source ?? discovery.source ?? "provider-catalog",
    supportedByRuntime,
  }));

  if (discovered.length) {
    return dedupeModels(discovered);
  }

  const fromDescriptor = (descriptor?.models ?? []).map((model) => createModelCandidate({
    family,
    model: {
      modelId: model.id,
      modelDisplayName: model.displayName ?? model.id,
      capabilities: model.capabilities,
      metadata: model.metadata,
    },
    source: "runtime-descriptor",
    supportedByRuntime,
  }));

  if (fromDescriptor.length) {
    return dedupeModels(fromDescriptor);
  }

  const fromConfig = modelConfigs
    .map((model) => createModelCandidate({
      family,
      model: {
        modelId: model.modelId,
        modelDisplayName: model.modelDisplayName ?? model.modelId,
        capabilities: model.capabilities,
        metadata: model.metadata,
      },
      source: "runtime-config",
      supportedByRuntime,
    }))
    .filter((model) => model.modelId);

  return dedupeModels(fromConfig);
}

function createModelCandidate({ family, model, source, supportedByRuntime }) {
  const profile = createModelProfile(family, model);
  const execution = createExecutionProfile({ family, profile, supportedByRuntime });
  return {
    providerId: family.providerId,
    modelId: profile.modelId,
    modelDisplayName: profile.modelDisplayName,
    capabilities: profile.capabilities,
    modalities: profile.modalities,
    supportedParameters: profile.supportedParameters,
    execution,
    source,
    metadata: {
      ...(model.metadata ?? {}),
      capabilitySource: profile.capabilitySource,
      executionReason: execution.chatReason,
    },
  };
}

function createModelProfile(family, model) {
  const modelId = String(model?.modelId ?? model?.id ?? "").trim();
  const modelDisplayName = String(model?.modelDisplayName ?? model?.displayName ?? modelId);
  const supportedParameters = normalizeStringList(model?.supportedParameters ?? model?.supported_parameters);
  const rawModalities = normalizeModalities(model?.modalities);
  const capabilities = inferCapabilities({
    family,
    modelId,
    modelDisplayName,
    explicitCapabilities: model?.capabilities,
    modalities: rawModalities,
    supportedParameters,
  });
  const modalities = rawModalities.input.length || rawModalities.output.length
    ? rawModalities
    : inferModalitiesFromCapabilities(capabilities);

  return {
    modelId,
    modelDisplayName,
    capabilities,
    modalities,
    supportedParameters,
    capabilitySource: normalizeCapabilityList(model?.capabilities).length ? "provider-or-catalog" : "name-and-modality-inference",
  };
}

function inferCapabilities({ family, modelId, modelDisplayName, explicitCapabilities, modalities, supportedParameters }) {
  const id = `${modelId} ${modelDisplayName}`.toLowerCase();
  const input = new Set(modalities.input.map((item) => item.toLowerCase()));
  const output = new Set(modalities.output.map((item) => item.toLowerCase()));
  const capabilities = new Set(normalizeCapabilityList(explicitCapabilities));

  if (input.has("image") || id.includes("vision") || id.includes("-vl") || id.includes("vl-") || id.includes("pixtral") || id.includes("llava") || id.includes("fuyu")) {
    capabilities.add("vision");
  }
  if (id.includes("coder") || id.includes("coding") || id.includes("codex") || id.includes("code-") || id.includes("devstral") || id.includes("starcoder")) {
    capabilities.add("coding");
  }
  if (id.includes("reason") || /^o[134]/.test(id) || id.includes("r1") || id.includes("thinking")) {
    capabilities.add("reasoning");
  }
  if (id.includes("embedding") || id.includes("embed") || id.includes("bge") || output.has("embedding")) {
    capabilities.add("embedding");
  }
  if (id.includes("rerank") || id.includes("reranker")) {
    capabilities.add("rerank");
  }
  if (id.includes("moderation") || id.includes("safety") || id.includes("guard") || id.includes("detector")) {
    capabilities.add("moderation");
  }
  if (id.includes("whisper") || id.includes("transcribe") || id.includes("asr") || input.has("audio")) {
    capabilities.add("audio-input");
  }
  if (id.includes("tts") || id.includes("speech") || output.has("audio")) {
    capabilities.add("speech-output");
  }
  if (id.includes("dall-e") || id.includes("gpt-image") || id.includes("imagen") || id.includes("flux") || id.includes("stable-diffusion") || id.includes("sdxl") || output.has("image")) {
    capabilities.add("image-generation");
  }
  if (id.includes("sora") || id.includes("veo") || id.includes("wan") || id.includes("video") || output.has("video")) {
    capabilities.add("video-generation");
  }

  const params = supportedParameters.map((item) => item.toLowerCase());
  if (params.some((item) => item.includes("tool") || item.includes("function"))) {
    capabilities.add("tool-use");
  }
  if (params.some((item) => item.includes("response_format") || item.includes("json_schema"))) {
    capabilities.add("structured-output");
  }

  const exclusiveNonChat = Array.from(capabilities).some((capability) => CHAT_EXCLUSIVE_BLOCKERS.has(capability)) &&
    !capabilities.has("vision") &&
    !capabilities.has("coding") &&
    !capabilities.has("reasoning");
  const looksTextChat = !exclusiveNonChat &&
    !id.includes("embedding") &&
    !id.includes("embed") &&
    !id.includes("rerank") &&
    !id.includes("whisper") &&
    !id.includes("transcribe") &&
    !id.includes("tts") &&
    !id.includes("speech") &&
    !id.includes("dall-e") &&
    !id.includes("imagen") &&
    !id.includes("video") &&
    !id.includes("sora") &&
    !id.includes("veo") &&
    !output.has("image") &&
    !output.has("video") &&
    !output.has("audio") &&
    !output.has("embedding");

  if (looksTextChat || output.has("text")) {
    capabilities.add("chat");
    capabilities.add("summary");
  }

  if (family.family === "local-fake") {
    capabilities.add("chat");
    capabilities.add("summary");
  }

  return sortCapabilities(Array.from(capabilities));
}

function createExecutionProfile({ family, profile, supportedByRuntime }) {
  const hasChat = profile.capabilities.includes("chat");
  const providerChatWired = family.availableForChat === true;
  const executable = providerChatWired && supportedByRuntime && hasChat;
  const blockedReason = !hasChat
    ? "model-is-not-a-chat-model"
    : !providerChatWired
      ? "provider-recognized-but-chat-adapter-not-wired"
      : !supportedByRuntime
        ? "provider-not-registered-in-current-runtime"
        : "chat-executable";

  return {
    chat: executable,
    chatReason: blockedReason,
    currentRuntime: executable ? "current-chat-lane" : "recognized-only",
    executableCapabilities: executable ? ["chat"] : [],
    recognizedOnlyCapabilities: profile.capabilities.filter((capability) => !executable || capability !== "chat"),
  };
}

function inferModalitiesFromCapabilities(capabilities) {
  const caps = new Set(capabilities);
  const input = new Set(["text"]);
  const output = new Set();

  if (caps.has("vision")) input.add("image");
  if (caps.has("audio-input")) input.add("audio");
  if (caps.has("chat") || caps.has("summary") || caps.has("rerank") || caps.has("audio-input")) output.add("text");
  if (caps.has("image-generation")) output.add("image");
  if (caps.has("speech-output")) output.add("audio");
  if (caps.has("video-generation")) output.add("video");
  if (caps.has("embedding")) output.add("embedding");

  return {
    input: Array.from(input),
    output: output.size ? Array.from(output) : ["text"],
  };
}

function extractRawModalities(model) {
  const architecture = model?.architecture && typeof model.architecture === "object" ? model.architecture : {};
  const modalities = model?.modalities && typeof model.modalities === "object" ? model.modalities : {};
  return normalizeModalities({
    input: model?.input_modalities ?? model?.inputModalities ?? architecture.input_modalities ?? architecture.inputModalities ?? modalities.input,
    output: model?.output_modalities ?? model?.outputModalities ?? architecture.output_modalities ?? architecture.outputModalities ?? modalities.output,
  });
}

function normalizeModalities(value) {
  if (!value) return { input: [], output: [] };
  if (Array.isArray(value)) {
    return { input: normalizeStringList(value), output: [] };
  }
  return {
    input: normalizeStringList(value.input ?? value.inputs ?? value.input_modalities ?? value.inputModalities),
    output: normalizeStringList(value.output ?? value.outputs ?? value.output_modalities ?? value.outputModalities),
  };
}

function normalizeCapabilityList(value) {
  const aliases = {
    audio: "audio-input",
    speech: "speech-output",
    image: "image-generation",
    video: "video-generation",
    "image_generation": "image-generation",
    "video_generation": "video-generation",
    "audio_input": "audio-input",
    "speech_output": "speech-output",
    "tool": "tool-use",
    "tool_use": "tool-use",
    "structured_output": "structured-output",
  };
  return sortCapabilities(normalizeStringList(value).map((item) => aliases[item] ?? item));
}

function normalizeStringList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  return Array.from(new Set(source.map((item) => String(item ?? "").trim().toLowerCase()).filter(Boolean)));
}

function sortCapabilities(capabilities) {
  const unique = Array.from(new Set((Array.isArray(capabilities) ? capabilities : []).filter(Boolean)));
  return unique.sort((left, right) => {
    const leftIndex = CAPABILITY_ORDER.indexOf(left);
    const rightIndex = CAPABILITY_ORDER.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }
    return left.localeCompare(right);
  });
}

function summarizeModels(models) {
  const byCapability = {};
  let chatExecutable = 0;
  for (const model of Array.isArray(models) ? models : []) {
    if (model.execution?.chat === true) chatExecutable += 1;
    for (const capability of model.capabilities ?? []) {
      byCapability[capability] = (byCapability[capability] ?? 0) + 1;
    }
  }
  return {
    totalModels: Array.isArray(models) ? models.length : 0,
    chatExecutableModels: chatExecutable,
    byCapability,
  };
}

function createCapabilitySummary(detected) {
  const providerSummaries = (Array.isArray(detected) ? detected : []).map((provider) => ({
    providerId: provider.providerId,
    providerDisplayName: provider.providerDisplayName,
    status: provider.status,
    availableForChat: provider.availableForChat,
    ...provider.capabilitySummary,
  }));
  const allModels = (Array.isArray(detected) ? detected : []).flatMap((provider) => provider.models ?? []);
  return {
    totalProviders: providerSummaries.length,
    totalModels: allModels.length,
    providerSummaries,
    ...summarizeModels(allModels),
  };
}

function dedupeModels(models) {
  const seen = new Set();
  return models.filter((model) => {
    if (!model?.modelId) return false;
    const key = `${model.providerId ?? ""}::${model.modelId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickRecommendedCandidate(available) {
  const verified = available.find(({ candidate }) => candidate.modelDiscovery?.credentialValidated === true);
  const stable = verified ?? available.find(({ candidate }) => !candidate.requiresProviderChoice);
  return stable ? createRecommendedCandidate(stable) : null;
}

function createRecommendedCandidate({ candidate, model }) {
  return {
    providerId: candidate.providerId,
    providerDisplayName: candidate.providerDisplayName,
    modelId: model.modelId,
    modelDisplayName: model.modelDisplayName,
    value: `${candidate.providerId}::${model.modelId}`,
    label: `${candidate.providerDisplayName} / ${model.modelDisplayName}`,
    confidence: candidate.confidence,
    modelDiscoveryStatus: candidate.modelDiscovery?.status,
    credentialValidated: candidate.modelDiscovery?.credentialValidated === true,
    capabilities: model.capabilities ?? [],
    modalities: model.modalities ?? {},
    execution: model.execution ?? {},
  };
}

function createCandidateConfidence({ discovery, matchedPrefix }) {
  if (discovery.status === "ready") {
    return discovery.credentialValidated ? "verified" : "catalog-live-needs-chat-probe";
  }

  return matchedPrefix?.confidence ?? "unknown";
}

function createCandidateMatchMethod(discovery) {
  if (discovery.status === "ready") {
    return discovery.credentialValidated ? "provider-models-api-authenticated" : "provider-models-api-catalog";
  }

  return "api-key-prefix-or-manual-choice";
}

function createCandidateStatus({ availableForChat, supportedByRuntime, authFailed, requiresProviderChoice, chatExecutableModelCount }) {
  if (authFailed) return "credential-rejected-by-provider";
  if (availableForChat && requiresProviderChoice) return "candidate-provider-choice-required";
  if (availableForChat) return "candidate";
  if (supportedByRuntime && chatExecutableModelCount === 0) return "recognized-no-chat-executable-model";
  if (supportedByRuntime) return "recognized-not-chat-available";
  return "recognized-not-supported";
}

function createUnavailableReason(family, supportedByRuntime, discovery, chatExecutableModelCount) {
  if (family.endpointRequired && discovery.status === "endpoint-required") {
    return `${family.displayName} is recognized, but a base URL ending in /v1 or /v2 is required before it can be added.`;
  }

  if (!supportedByRuntime) {
    return `${family.displayName} is recognized, but this runtime does not expose a matching provider adapter.`;
  }

  if (discovery.status === "auth-failed") {
    return `${family.displayName} rejected this API key while listing models. Check whether the key belongs to this provider.`;
  }

  if (chatExecutableModelCount === 0) {
    return `${family.displayName} is recognized and may expose non-chat capabilities, but no model is executable through the current chat lane.`;
  }

  return family.reason;
}

function createDetectionWarnings({ apiKey, detected, recommended, capabilitySummary, allowModelListProbe = false }) {
  if (!detected.length) {
    return [
      "unknown-key-family",
      "The key prefix is not recognized. To avoid sending a secret to the wrong provider, the system did not auto-select a model.",
    ];
  }

  if (detected.some((candidate) => candidate.requiresProviderChoice)) {
    return [
      "ambiguous-key-provider-choice-required",
      allowModelListProbe
        ? "This key family can belong to multiple providers. The explicit model-list probe did not produce exactly one verified chat provider, so the system still requires provider choice."
        : "This key family can belong to multiple providers. The system listed safe candidates but did not send the key to every provider automatically.",
    ];
  }

  if (!recommended && capabilitySummary?.totalModels > 0) {
    return [
      "recognized-capabilities-not-chat-executable",
      "The key family was recognized and model capabilities were classified, but no model can be safely added to the current chat lane.",
    ];
  }

  if (!recommended) {
    return [
      "recognized-but-not-chat-available",
      "The key was recognized, but no supported chat model is available for one-click add in the current runtime.",
    ];
  }

  if (detected.some((candidate) => candidate.modelDiscovery?.status === "ready" && candidate.modelDiscovery?.credentialValidated === false)) {
    return [
      "model-list-does-not-prove-key-valid",
      "The provider model list is reachable, but this does not prove the API key can run chat. The one-click add step must still run a real /chat probe.",
    ];
  }

  if (apiKey.startsWith("sk-") && recommended.confidence !== "verified") {
    return ["generic-sk-key-needs-provider-confirmation"];
  }

  return [];
}

function findProviderDescriptor(application, providerId) {
  const descriptors = typeof application.providerRegistry?.listAllDescriptors === "function"
    ? application.providerRegistry.listAllDescriptors()
    : application.gatewayService?.getProviderDescriptors?.() ?? [];
  return descriptors.find((provider) => provider.id === providerId) ?? null;
}

function findProviderModelConfigs(application, providerId) {
  const models = application.config?.aiGatewayService?.providerModels ?? [];
  return models.filter((provider) => provider.providerId === providerId);
}

function trimSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function extractOpenAiCompatibleBaseUrl(rawCredential) {
  const text = String(rawCredential ?? "");
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return "";

  let url = match[0].trim().replace(/[),.;，。]+$/, "");
  url = url.replace(/\/chat\/completions\/?$/i, "");
  url = url.replace(/\/models\/?$/i, "");
  url = url.replace(/\/+$/, "");

  if (!/\/v\d+$/i.test(url)) {
    url = `${url}/v1`;
  }

  return url;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}
