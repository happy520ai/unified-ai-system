import { randomUUID } from "node:crypto";
import { cleanSecretValue, isLikelyMaskedSecret, maskSecret } from "../security/secretSafety.js";

export const MODEL_IMPORT_SOURCE = "provider_models_api";
export const MODEL_IMPORT_TIMEOUT_MS = 4_000;

const PROVIDER_PROBES = {
  nvidia: {
    providerId: "nvidia",
    displayName: "NVIDIA",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
  },
  openai: {
    providerId: "openai",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
  },
  openrouter: {
    providerId: "openrouter",
    displayName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelsPath: "/models?output_modalities=all",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  dashscope: {
    providerId: "dashscope",
    displayName: "DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  deepseek: {
    providerId: "deepseek",
    displayName: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "coding", "summary"],
    providerGroup: "openai-compatible",
  },
  groq: {
    providerId: "groq",
    displayName: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  together: {
    providerId: "together",
    displayName: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  mistral: {
    providerId: "mistral",
    displayName: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  xai: {
    providerId: "xai",
    displayName: "xAI",
    baseUrl: "https://api.x.ai/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "reasoning", "summary"],
    providerGroup: "openai-compatible",
  },
  perplexity: {
    providerId: "perplexity",
    displayName: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  fireworks: {
    providerId: "fireworks",
    displayName: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  cerebras: {
    providerId: "cerebras",
    displayName: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  moonshot: {
    providerId: "moonshot",
    displayName: "Moonshot AI",
    baseUrl: "https://api.moonshot.ai/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "coding", "summary"],
    providerGroup: "openai-compatible",
  },
  siliconflow: {
    providerId: "siliconflow",
    displayName: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  "tencent-hunyuan": {
    providerId: "tencent-hunyuan",
    displayName: "Tencent Hunyuan",
    baseUrl: "https://api.hunyuan.cloud.tencent.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  qianfan: {
    providerId: "qianfan",
    displayName: "Baidu Qianfan",
    baseUrl: "https://qianfan.baidubce.com/v2",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  zhipu: {
    providerId: "zhipu",
    displayName: "Zhipu AI",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "reasoning", "coding", "summary"],
    providerGroup: "openai-compatible",
  },
  "xunfei-spark": {
    providerId: "xunfei-spark",
    displayName: "iFlytek Spark",
    baseUrl: "https://spark-api-open.xf-yun.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  modelscope: {
    providerId: "modelscope",
    displayName: "ModelScope",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    providerGroup: "openai-compatible",
  },
  cohere: {
    providerId: "cohere",
    displayName: "Cohere",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "tool-use", "summary"],
    providerGroup: "openai-compatible",
  },
  "volcengine-doubao": {
    providerId: "volcengine-doubao",
    displayName: "Volcengine Doubao / Ark",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "vision", "coding", "reasoning"],
    providerGroup: "openai-compatible",
  },
  minimax: {
    providerId: "minimax",
    displayName: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "vision", "tool-use"],
    providerGroup: "openai-compatible",
  },
  stepfun: {
    providerId: "stepfun",
    displayName: "StepFun",
    baseUrl: "https://api.stepfun.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "vision", "coding"],
    providerGroup: "openai-compatible",
  },
  novita: {
    providerId: "novita",
    displayName: "Novita AI",
    baseUrl: "https://api.novita.ai/openai/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "vision", "image", "coding"],
    providerGroup: "openai-compatible",
  },
  baichuan: {
    providerId: "baichuan",
    displayName: "Baichuan AI",
    baseUrl: "https://api.baichuan-ai.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "coding"],
    providerGroup: "openai-compatible",
  },
  yi: {
    providerId: "yi",
    displayName: "01.AI / Yi",
    baseUrl: "https://api.lingyiwanwu.com/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "vision", "coding"],
    providerGroup: "openai-compatible",
  },
  "infini-ai": {
    providerId: "infini-ai",
    displayName: "Infini AI",
    baseUrl: "https://cloud.infini-ai.com/maas/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "embedding", "rerank"],
    providerGroup: "openai-compatible",
  },
  huggingface: {
    providerId: "huggingface",
    displayName: "Hugging Face Router",
    baseUrl: "https://router.huggingface.co/v1",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "vision", "coding", "image"],
    providerGroup: "openai-compatible",
  },
  anthropic: {
    providerId: "anthropic",
    displayName: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1",
    modelsPath: "/models",
    auth: "anthropic-api-key",
    defaultCapabilities: ["native-chat", "vision", "coding", "reasoning", "tool-use"],
    providerGroup: "native",
  },
  "openai-compatible": {
    providerId: "openai-compatible",
    displayName: "OpenAI-Compatible",
    modelsPath: "/models",
    auth: "bearer",
    defaultCapabilities: ["chat", "summary"],
    requiresBaseUrl: true,
    providerGroup: "openai-compatible",
  },
  gemini: {
    providerId: "gemini",
    displayName: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelsPath: "/models",
    auth: "query-key",
    defaultCapabilities: ["chat", "summary"],
  },
};

export function createApiKeyRef() {
  return `model-import-${randomUUID()}`;
}

export function cleanApiKey(value) {
  return cleanSecretValue(value);
}

export function maskApiKey(apiKey) {
  return maskSecret(apiKey);
}

export function isLikelyMaskedApiKey(value) {
  return isLikelyMaskedSecret(value);
}

export function resolveProviderCandidates({ apiKey, providerHint = "auto", baseUrl } = {}) {
  const clean = cleanApiKey(apiKey);
  const hint = String(providerHint ?? "auto").trim().toLowerCase();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!clean) {
    return [];
  }

  if (hint && hint !== "auto") {
    return createHintCandidates(hint, normalizedBaseUrl);
  }

  if (normalizedBaseUrl) {
    return [createCandidate("openai-compatible", { baseUrl: normalizedBaseUrl })];
  }

  if (clean.startsWith("nvapi-")) {
    return [createCandidate("nvidia")];
  }

  if (clean.startsWith("sk-or-v1-")) {
    return [createCandidate("openrouter")];
  }

  if (clean.startsWith("gsk_")) {
    return [createCandidate("groq")];
  }

  if (clean.startsWith("xai-")) {
    return [createCandidate("xai")];
  }

  if (clean.startsWith("csk-")) {
    return [createCandidate("cerebras")];
  }

  if (clean.startsWith("pplx-")) {
    return [createCandidate("perplexity")];
  }

  if (clean.startsWith("fw_")) {
    return [createCandidate("fireworks")];
  }

  if (clean.startsWith("ms-")) {
    return [createCandidate("modelscope")];
  }

  if (clean.startsWith("bce-v3/")) {
    return [createCandidate("qianfan")];
  }

  if (clean.startsWith("sk-ant-")) {
    return [createCandidate("anthropic")];
  }

  if (clean.startsWith("hf_")) {
    return [createCandidate("huggingface")];
  }

  if (clean.startsWith("AIza")) {
    return [createCandidate("gemini")];
  }

  if (clean.startsWith("sk-")) {
    const candidates = createOpenAiStyleCandidates();
    candidates.push(createCandidate("openai-compatible", { baseUrl: normalizedBaseUrl }));
    return candidates;
  }

  return [];
}

function createOpenAiStyleCandidates() {
  return [
    createCandidate("openai"),
    createCandidate("dashscope"),
    createCandidate("deepseek"),
    createCandidate("together"),
    createCandidate("mistral"),
    createCandidate("moonshot"),
    createCandidate("siliconflow"),
    createCandidate("tencent-hunyuan"),
    createCandidate("zhipu"),
    createCandidate("xunfei-spark"),
    createCandidate("qianfan"),
    createCandidate("modelscope"),
    createCandidate("cohere"),
    createCandidate("volcengine-doubao"),
    createCandidate("minimax"),
    createCandidate("stepfun"),
    createCandidate("novita"),
    createCandidate("baichuan"),
    createCandidate("yi"),
    createCandidate("infini-ai"),
  ];
}

export async function probeProviderModels({ candidate, apiKey, fetchImpl = globalThis.fetch, timeoutMs = MODEL_IMPORT_TIMEOUT_MS } = {}) {
  const config = PROVIDER_PROBES[candidate?.providerId];
  const clean = cleanApiKey(apiKey);
  const baseUrl = normalizeBaseUrl(candidate?.baseUrl ?? config?.baseUrl);

  if (!config) {
    return createProbeResult({
      ok: false,
      providerId: candidate?.providerId ?? "unknown",
      status: "probe_failed",
      reason: "provider_probe_not_registered",
    });
  }

  if (config.requiresBaseUrl && !baseUrl) {
    return createProbeResult({
      ok: false,
      providerId: config.providerId,
      status: "needs_user_selection",
      reason: "base_url_required_for_openai_compatible_probe",
      skipped: true,
    });
  }

  if (!clean) {
    return createProbeResult({
      ok: false,
      providerId: config.providerId,
      status: "invalid_api_key",
      reason: "api_key_required",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(createModelListUrl({ config, baseUrl, apiKey: clean }), {
      method: "GET",
      headers: createModelListHeaders({ config, apiKey: clean }),
      signal: controller.signal,
    });
    const rawText = await response.text();
    const body = safeJsonParse(rawText);

    if (response.status === 401 || response.status === 403) {
      return createProbeResult({
        ok: false,
        providerId: config.providerId,
        status: "invalid_api_key",
        httpStatus: response.status,
        reason: "provider_rejected_api_key",
      });
    }

    if (!response.ok) {
      return createProbeResult({
        ok: false,
        providerId: config.providerId,
        status: "probe_failed",
        httpStatus: response.status,
        reason: "provider_models_api_failed",
      });
    }

    const models = normalizeProviderModels({
      providerId: config.providerId,
      defaultCapabilities: config.defaultCapabilities,
      body,
    });

    return createProbeResult({
      ok: true,
      providerId: config.providerId,
      status: models.length ? "models_discovered" : "provider_detected_but_no_models",
      httpStatus: response.status,
      models,
    });
  } catch (error) {
    return createProbeResult({
      ok: false,
      providerId: config.providerId,
      status: error?.name === "AbortError" ? "probe_timeout" : "probe_failed",
      reason: error?.name === "AbortError" ? "provider_models_api_timeout" : "provider_models_api_unreachable",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeProviderModels({ providerId, defaultCapabilities = ["chat"], body } = {}) {
  const rawModels = readRawModels(body);
  return rawModels
    .map((model) => normalizeProviderModel({ providerId, defaultCapabilities, model }))
    .filter(Boolean);
}

export function getProviderProbeConfig(providerId) {
  return PROVIDER_PROBES[providerId] ?? null;
}

export function listModelImportProviders() {
  return Object.values(PROVIDER_PROBES).map((config) => ({
    providerId: config.providerId,
    displayName: config.displayName,
    providerGroup: config.providerGroup ?? config.providerId,
    baseUrl: config.requiresBaseUrl ? null : config.baseUrl,
    requiresBaseUrl: Boolean(config.requiresBaseUrl),
    modelsPath: config.modelsPath,
    auth: config.auth,
    defaultCapabilities: [...(config.defaultCapabilities ?? [])],
  }));
}

function createHintCandidates(hint, baseUrl) {
  if (PROVIDER_PROBES[hint]) {
    return [createCandidate(hint, { baseUrl })];
  }

  if (hint === "openai_compatible" || hint === "compatible" || hint === "generic-openai-compatible") {
    return [createCandidate("openai-compatible", { baseUrl })];
  }

  return [];
}

function createCandidate(providerId, options = {}) {
  const config = PROVIDER_PROBES[providerId] ?? {};
  const baseUrl = normalizeBaseUrl(options.baseUrl || config.baseUrl);
  return {
    providerId,
    providerDisplayName: config.displayName ?? providerId,
    providerGroup: config.providerGroup ?? providerId,
    baseUrl,
    requiresBaseUrl: Boolean(config.requiresBaseUrl && !baseUrl),
  };
}

function createModelListUrl({ config, baseUrl, apiKey }) {
  const path = config.modelsPath ?? "/models";
  const url = `${baseUrl}${path}`;
  if (config.auth !== "query-key") {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

function createModelListHeaders({ config, apiKey }) {
  if (config.auth === "query-key") {
    return {
      "accept": "application/json",
    };
  }
  if (config.auth === "anthropic-api-key") {
    return {
      "accept": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    };
  }
  return {
    "accept": "application/json",
    "authorization": `Bearer ${apiKey}`,
  };
}

function readRawModels(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.models)) return body.models;
  return [];
}

function normalizeProviderModel({ providerId, defaultCapabilities, model }) {
  const rawId = String(model?.id ?? model?.modelId ?? model?.name ?? "").trim();
  const modelId = providerId === "gemini" ? rawId.replace(/^models\//, "") : rawId;
  if (!modelId) return null;

  const displayName = String(model?.displayName ?? model?.display_name ?? model?.modelDisplayName ?? modelId);
  const capabilities = normalizeCapabilities(model?.capabilities ?? createCapabilitiesFromModelMetadata(providerId, model, defaultCapabilities));
  const modalities = createModalitiesFromModelMetadata(model, capabilities);

  return {
    providerId,
    modelId,
    displayName,
    capabilities,
    source: MODEL_IMPORT_SOURCE,
    status: "discovered",
    metadata: {
      ownedBy: model?.owned_by ?? model?.owner ?? model?.publisher,
      rawName: model?.name,
      supportedGenerationMethods: model?.supportedGenerationMethods,
      modalities,
      providerReturnedModel: true,
    },
  };
}

function createCapabilitiesFromModelMetadata(providerId, model, defaultCapabilities) {
  if (providerId === "gemini" && Array.isArray(model?.supportedGenerationMethods)) {
    const methods = model.supportedGenerationMethods.map((item) => String(item).toLowerCase());
    const capabilities = [];
    if (methods.some((item) => item.includes("generatecontent"))) capabilities.push("chat", "summary");
    if (methods.some((item) => item.includes("embedcontent"))) capabilities.push("embedding");
    return capabilities.length ? capabilities : defaultCapabilities;
  }

  const inferred = new Set();
  const modalities = [
    ...readStringList(model?.input_modalities),
    ...readStringList(model?.output_modalities),
    ...readStringList(model?.modalities),
    ...readStringList(model?.architecture?.input_modalities),
    ...readStringList(model?.architecture?.output_modalities),
  ].map((item) => item.toLowerCase());
  const haystack = [
    model?.id,
    model?.modelId,
    model?.name,
    model?.displayName,
    model?.display_name,
    model?.description,
    model?.owned_by,
    ...modalities,
  ].map((item) => String(item ?? "").toLowerCase()).join(" ");

  if (modalities.includes("text")) inferred.add("chat");
  if (modalities.some((item) => item.includes("image"))) inferred.add("vision");
  if (modalities.some((item) => item.includes("audio"))) inferred.add("audio");
  if (modalities.some((item) => item.includes("video"))) inferred.add("video");
  if (/\b(embed|embedding|text-embedding|bge-|gte-|e5-)\b/.test(haystack)) inferred.add("embedding");
  if (/\b(rerank|reranker)\b/.test(haystack)) inferred.add("rerank");
  if (/\b(whisper|transcribe|speech|tts|audio)\b/.test(haystack)) inferred.add("audio");
  if (/\b(vision|vl|image-input|gpt-4o|qwen-vl|glm-4v|pixtral|llava)\b/.test(haystack)) inferred.add("vision");
  if (/\b(image|dall-e|imagen|sdxl|stable-diffusion|flux|midjourney|text-to-image)\b/.test(haystack)) inferred.add("image");
  if (/\b(video|sora|wan-|text-to-video|veo)\b/.test(haystack)) inferred.add("video");
  if (/\b(code|coder|coding|codestral|devstral)\b/.test(haystack)) inferred.add("coding");
  if (/\b(reason|reasoning|r1|o1|o3|o4|thinking)\b/.test(haystack)) inferred.add("reasoning");

  if (inferred.size) {
    if (inferred.has("vision") || inferred.has("coding") || inferred.has("reasoning")) {
      inferred.add("chat");
    }
    return Array.from(inferred);
  }

  return defaultCapabilities;
}

function normalizeCapabilities(value) {
  const list = Array.isArray(value) ? value : [];
  const normalized = Array.from(new Set(list.map((item) => String(item ?? "").trim()).filter(Boolean)));
  return normalized.length ? normalized : ["chat"];
}

function createModalitiesFromModelMetadata(model, capabilities) {
  const inputs = new Set(readStringList(model?.input_modalities));
  const outputs = new Set(readStringList(model?.output_modalities));
  for (const item of readStringList(model?.architecture?.input_modalities)) inputs.add(item);
  for (const item of readStringList(model?.architecture?.output_modalities)) outputs.add(item);

  const capabilitySet = new Set((capabilities ?? []).map((item) => String(item).toLowerCase()));
  if (capabilitySet.has("chat") || capabilitySet.has("completion") || capabilitySet.has("reasoning")) {
    inputs.add("text");
    outputs.add("text");
  }
  if (capabilitySet.has("vision")) inputs.add("image");
  if (capabilitySet.has("image")) outputs.add("image");
  if (capabilitySet.has("audio")) {
    inputs.add("audio");
    outputs.add("audio");
  }
  if (capabilitySet.has("video")) outputs.add("video");
  if (capabilitySet.has("embedding")) {
    inputs.add("text");
    outputs.add("embedding");
  }
  return {
    input: Array.from(inputs).filter(Boolean),
    output: Array.from(outputs).filter(Boolean),
  };
}

function readStringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function createProbeResult(result) {
  return {
    ok: Boolean(result.ok),
    providerId: result.providerId,
    status: result.status,
    httpStatus: result.httpStatus,
    reason: result.reason,
    skipped: Boolean(result.skipped),
    models: result.models ?? [],
  };
}

function normalizeBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}
