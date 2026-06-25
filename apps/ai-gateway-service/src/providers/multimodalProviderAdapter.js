import { sleep } from "../entrypoints/entrypointUtils.js"
// src/providers/multimodalProviderAdapter.js
// Multimodal provider adapter for image generation, embeddings, TTS, and STT.
// Normalizes responses across OpenAI, DashScope, Gemini, NVIDIA, and compatible providers.

import { DEFAULT_TIMEOUTS, PROVIDER_DEFAULTS } from "./multimodalConstants.js";
import {
  normalizeImageResponse,
  normalizeDashscopeImageResult,
  normalizeDashscopeDirectResult,
  normalizeGeminiImageResult,
  normalizeOpenaiEmbeddingResult,
  normalizeSttResult,
} from "./multimodalNormalize.js";
import {
  resolveProvider,
  clampInt,
  estimateTokenCount,
  formatToContentType,
  buildMultipartFormData,
  createAdapterError,
} from "./multimodalUtils.js";
import { callJson, callBinary, callMultipart } from "./multimodalHttpHelpers.js";

export function createMultimodalProviderAdapter({ runtimeCredentialStore, env = process.env, fetchImpl = globalThis.fetch } = {}) {
  return new MultimodalProviderAdapter({ runtimeCredentialStore, env, fetchImpl });
}

class MultimodalProviderAdapter {
  #runtimeCredentialStore;
  #env;
  #fetch;

  constructor({ runtimeCredentialStore, env, fetchImpl }) {
    this.#runtimeCredentialStore = runtimeCredentialStore;
    this.#env = env;
    this.#fetch = fetchImpl;
  }

  // --- Image generation ---

  async generateImage({ provider, model, prompt, n = 1, size = "1024x1024", responseFormat = "url", quality, style } = {}) {
    const resolvedProvider = resolveProvider(provider, model);
    const apiKey = this.#resolveApiKey(resolvedProvider);
    if (!apiKey) {
      throw createAdapterError("multimodal_api_key_missing", `API key is not configured for provider: ${resolvedProvider}`, false);
    }

    switch (resolvedProvider) {
      case "openai":
        return this.#openaiImageGeneration({ apiKey, model, prompt, n, size, responseFormat, quality, style });
      case "dashscope":
        return this.#dashscopeImageGeneration({ apiKey, model, prompt, n, size, responseFormat });
      case "gemini":
        return this.#geminiImageGeneration({ apiKey, model, prompt, n, responseFormat });
      case "siliconflow":
        return this.#openaiCompatibleImageGeneration({ apiKey, model, prompt, n, size, responseFormat, baseUrl: PROVIDER_DEFAULTS.siliconflow.baseUrl, endpoint: PROVIDER_DEFAULTS.siliconflow.imageEndpoint, provider: "siliconflow" });
      case "zhipu":
        return this.#openaiCompatibleImageGeneration({ apiKey, model, prompt, n, size, responseFormat, baseUrl: PROVIDER_DEFAULTS.zhipu.baseUrl, endpoint: PROVIDER_DEFAULTS.zhipu.imageEndpoint, provider: "zhipu" });
      default:
        return this.#openaiCompatibleImageGeneration({ apiKey, model, prompt, n, size, responseFormat, baseUrl: this.#resolveBaseUrl(resolvedProvider), endpoint: "/images/generations", provider: resolvedProvider });
    }
  }

  // --- Embeddings ---

  async generateEmbedding({ provider, model, input, dimensions, encodingFormat = "float" } = {}) {
    const resolvedProvider = resolveProvider(provider, model);
    const apiKey = this.#resolveApiKey(resolvedProvider);
    if (!apiKey) {
      throw createAdapterError("multimodal_api_key_missing", `API key is not configured for provider: ${resolvedProvider}`, false);
    }

    const inputArray = Array.isArray(input) ? input : [String(input ?? "")];
    if (inputArray.length === 0 || inputArray.every((item) => !String(item).trim())) {
      throw createAdapterError("multimodal_validation_error", "Embedding input must be a non-empty string or array of strings.", false);
    }

    switch (resolvedProvider) {
      case "openai":
        return this.#openaiEmbedding({ apiKey, model, input: inputArray, dimensions, encodingFormat });
      case "dashscope":
        return this.#openaiEmbedding({ apiKey, model, input: inputArray, dimensions, encodingFormat, baseUrl: PROVIDER_DEFAULTS.dashscope.baseUrl, endpoint: PROVIDER_DEFAULTS.dashscope.embeddingEndpoint, provider: "dashscope" });
      case "gemini":
        return this.#geminiEmbedding({ apiKey, model, input: inputArray });
      case "nvidia":
        return this.#nvidiaEmbedding({ apiKey, model, input: inputArray });
      case "siliconflow":
        return this.#openaiEmbedding({ apiKey, model, input: inputArray, dimensions, encodingFormat, baseUrl: PROVIDER_DEFAULTS.siliconflow.baseUrl, endpoint: PROVIDER_DEFAULTS.siliconflow.embeddingEndpoint, provider: "siliconflow" });
      case "zhipu":
        return this.#openaiEmbedding({ apiKey, model, input: inputArray, dimensions, encodingFormat, baseUrl: PROVIDER_DEFAULTS.zhipu.baseUrl, endpoint: PROVIDER_DEFAULTS.zhipu.embeddingEndpoint, provider: "zhipu" });
      default:
        return this.#openaiEmbedding({ apiKey, model, input: inputArray, dimensions, encodingFormat, baseUrl: this.#resolveBaseUrl(resolvedProvider), endpoint: "/embeddings", provider: resolvedProvider });
    }
  }

  // --- TTS (text-to-speech) ---

  async synthesizeSpeech({ provider, model, input, voice = "alloy", responseFormat = "mp3", speed = 1.0 } = {}) {
    const resolvedProvider = resolveProvider(provider, model);
    const apiKey = this.#resolveApiKey(resolvedProvider);
    if (!apiKey) {
      throw createAdapterError("multimodal_api_key_missing", `API key is not configured for provider: ${resolvedProvider}`, false);
    }

    const text = String(input ?? "").trim();
    if (!text) {
      throw createAdapterError("multimodal_validation_error", "TTS input text must not be empty.", false);
    }

    // Clamp speed to the valid range [0.25, 4.0]
    const clampedSpeed = Math.max(0.25, Math.min(4.0, Number(speed) || 1.0));

    switch (resolvedProvider) {
      case "openai":
        return this.#openaiTts({ apiKey, model, input: text, voice, responseFormat, speed: clampedSpeed });
      case "dashscope":
        return this.#openaiTts({ apiKey, model, input: text, voice, responseFormat, speed: clampedSpeed, baseUrl: PROVIDER_DEFAULTS.dashscope.baseUrl, endpoint: PROVIDER_DEFAULTS.dashscope.ttsEndpoint, provider: "dashscope" });
      case "siliconflow":
        return this.#openaiTts({ apiKey, model, input: text, voice, responseFormat, speed: clampedSpeed, baseUrl: PROVIDER_DEFAULTS.siliconflow.baseUrl, endpoint: PROVIDER_DEFAULTS.siliconflow.ttsEndpoint, provider: "siliconflow" });
      default:
        return this.#openaiTts({ apiKey, model, input: text, voice, responseFormat, speed: clampedSpeed, baseUrl: this.#resolveBaseUrl(resolvedProvider), endpoint: "/audio/speech", provider: resolvedProvider });
    }
  }

  // --- STT (speech-to-text) ---

  async transcribeAudio({ provider, model, audioBuffer, filename = "audio.wav", language, responseFormat = "json" } = {}) {
    const resolvedProvider = resolveProvider(provider, model);
    const apiKey = this.#resolveApiKey(resolvedProvider);
    if (!apiKey) {
      throw createAdapterError("multimodal_api_key_missing", `API key is not configured for provider: ${resolvedProvider}`, false);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw createAdapterError("multimodal_validation_error", "Audio data must not be empty.", false);
    }

    switch (resolvedProvider) {
      case "openai":
        return this.#openaiStt({ apiKey, model, audioBuffer, filename, language, responseFormat });
      case "dashscope":
        return this.#openaiStt({ apiKey, model, audioBuffer, filename, language, responseFormat, baseUrl: PROVIDER_DEFAULTS.dashscope.baseUrl, endpoint: PROVIDER_DEFAULTS.dashscope.sttEndpoint, provider: "dashscope" });
      case "siliconflow":
        return this.#openaiStt({ apiKey, model, audioBuffer, filename, language, responseFormat, baseUrl: PROVIDER_DEFAULTS.siliconflow.baseUrl, endpoint: PROVIDER_DEFAULTS.siliconflow.sttEndpoint, provider: "siliconflow" });
      default:
        return this.#openaiStt({ apiKey, model, audioBuffer, filename, language, responseFormat, baseUrl: this.#resolveBaseUrl(resolvedProvider), endpoint: "/audio/transcriptions", provider: resolvedProvider });
    }
  }

  // --- Private: OpenAI image generation ---

  async #openaiImageGeneration({ apiKey, model, prompt, n, size, responseFormat, quality, style }) {
    const baseUrl = PROVIDER_DEFAULTS.openai.baseUrl;
    const endpoint = PROVIDER_DEFAULTS.openai.imageEndpoint;
    const payload = {
      model: model || "dall-e-3",
      prompt: String(prompt ?? ""),
      n: clampInt(n, 1, 10),
      size: size || "1024x1024",
      response_format: responseFormat || "url",
    };
    if (quality) payload.quality = quality;
    if (style) payload.style = style;

    const data = await this.#callJson({
      url: `${baseUrl}${endpoint}`,
      apiKey,
      payload,
      timeoutMs: DEFAULT_TIMEOUTS.imageMs,
      provider: "openai",
    });

    return normalizeImageResponse(data, { model: payload.model, provider: "openai" });
  }

  async #openaiCompatibleImageGeneration({ apiKey, model, prompt, n, size, responseFormat, baseUrl, endpoint, provider }) {
    const payload = {
      model: model || "default-image-model",
      prompt: String(prompt ?? ""),
      n: clampInt(n, 1, 10),
      size: size || "1024x1024",
      response_format: responseFormat || "url",
    };

    const data = await this.#callJson({
      url: `${baseUrl}${endpoint}`,
      apiKey,
      payload,
      timeoutMs: DEFAULT_TIMEOUTS.imageMs,
      provider,
    });

    return normalizeImageResponse(data, { model: payload.model, provider });
  }

  // --- Private: DashScope image generation (task-based) ---

  async #dashscopeImageGeneration({ apiKey, model, prompt, n, size, responseFormat }) {
    const taskUrl = `${PROVIDER_DEFAULTS.dashscope.imageBaseUrl}/image-synthesis`;
    const taskPayload = {
      model: model || "wanx2.1-t2i-plus",
      input: { prompt: String(prompt ?? "") },
      parameters: {
        n: clampInt(n, 1, 4),
        size: size || "1024*1024",
      },
    };

    // Step 1: submit task
    const taskResponse = await this.#callJson({
      url: taskUrl,
      apiKey,
      payload: taskPayload,
      timeoutMs: DEFAULT_TIMEOUTS.imageMs,
      provider: "dashscope",
      extraHeaders: { "X-DashScope-Async": "enable" },
    });

    const taskId = taskResponse?.output?.task_id;
    if (!taskId) {
      // Some DashScope compatible-mode endpoints may return results directly
      if (taskResponse?.output?.results) {
        return normalizeDashscopeDirectResult(taskResponse, { model: taskPayload.model });
      }
      throw createAdapterError("dashscope_task_id_missing", "DashScope did not return a task_id for image generation.", true);
    }

    // Step 2: poll task result with exponential backoff (start at 1s, double up to 8s max)
    const pollUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
    const maxPolls = 60;
    const totalDeadlineMs = 300_000; // 5-minute hard ceiling for the entire task
    const taskStartedAt = Date.now();
    let pollIntervalMs = 1_000;
    const maxPollIntervalMs = 8_000;

    for (let attempt = 0; attempt < maxPolls; attempt++) {
      await sleep(pollIntervalMs);
      // Hard deadline check: abort if total wall-clock exceeds budget
      if (Date.now() - taskStartedAt > totalDeadlineMs) {
        throw createAdapterError("dashscope_image_task_timeout", "DashScope image task exceeded total deadline (5min).", false);
      }
      const pollResponse = await this.#callJson({
        url: pollUrl,
        apiKey,
        method: "GET",
        timeoutMs: 15_000,
        provider: "dashscope",
      });

      const status = pollResponse?.output?.task_status;
      if (status === "SUCCEEDED") {
        return normalizeDashscopeImageResult(pollResponse, { model: taskPayload.model });
      }
      if (status === "FAILED" || status === "CANCELED") {
        throw createAdapterError(
          "dashscope_image_task_failed",
          `DashScope image task ${status.toLowerCase()}: ${pollResponse?.output?.message ?? "unknown error"}`,
          false,
        );
      }
      // PENDING or RUNNING: increase backoff for next poll (exponential, capped at maxPollIntervalMs)
      pollIntervalMs = Math.min(pollIntervalMs * 2, maxPollIntervalMs);
    }

    throw createAdapterError("dashscope_image_task_timeout", "DashScope image generation task did not complete within the expected time.", true);
  }

  // --- Private: Gemini image generation ---

  async #geminiImageGeneration({ apiKey, model, prompt, n, responseFormat }) {
    const modelName = model || "imagen-4.0-generate-001";
    const url = `${PROVIDER_DEFAULTS.gemini.baseUrl}/models/${modelName}:predict`;
    const payload = {
      instances: [{ prompt: String(prompt ?? "") }],
      parameters: {
        sampleCount: clampInt(n, 1, 4),
      },
    };

    const data = await this.#callJson({
      url,
      apiKey: null, // key passed via x-goog-api-key header, not Bearer
      payload,
      timeoutMs: DEFAULT_TIMEOUTS.imageMs,
      provider: "gemini",
      extraHeaders: { "x-goog-api-key": apiKey },
    });

    return normalizeGeminiImageResult(data, { model: modelName, responseFormat });
  }

  // --- Private: OpenAI-compatible embedding ---

  async #openaiEmbedding({ apiKey, model, input, dimensions, encodingFormat, baseUrl, endpoint, provider }) {
    const resolvedBaseUrl = baseUrl || PROVIDER_DEFAULTS.openai.baseUrl;
    const resolvedEndpoint = endpoint || PROVIDER_DEFAULTS.openai.embeddingEndpoint;
    const resolvedProvider = provider || "openai";
    const payload = {
      model: model || "text-embedding-3-small",
      input,
      encoding_format: encodingFormat || "float",
    };
    if (dimensions) payload.dimensions = dimensions;

    const data = await this.#callJson({
      url: `${resolvedBaseUrl}${resolvedEndpoint}`,
      apiKey,
      payload,
      timeoutMs: DEFAULT_TIMEOUTS.embeddingMs,
      provider: resolvedProvider,
    });

    return normalizeOpenaiEmbeddingResult(data, { model: payload.model, provider: resolvedProvider });
  }

  // --- Private: Gemini embedding (parallel with concurrency cap) ---

  async #geminiEmbedding({ apiKey, model, input }) {
    const modelName = model || "text-embedding-004";
    const url = `${PROVIDER_DEFAULTS.gemini.baseUrl}/models/${modelName}:embedContent`;

    // Process embeddings in parallel with a concurrency cap of 5
    const concurrencyCap = 5;
    const allEmbeddings = new Array(input.length);

    const runBatch = async (startIdx, batchSize) => {
      const batch = input.slice(startIdx, startIdx + batchSize);
      const results = await Promise.allSettled(
        batch.map(text =>
          this.#callJson({
            url,
            apiKey: null, // key passed via x-goog-api-key header, not URL query param
            payload: { content: { parts: [{ text: String(text) }] } },
            timeoutMs: DEFAULT_TIMEOUTS.embeddingMs,
            provider: "gemini",
            extraHeaders: { "x-goog-api-key": apiKey },
          })
        )
      );
      return results;
    };

    for (let offset = 0; offset < input.length; offset += concurrencyCap) {
      const batchSize = Math.min(concurrencyCap, input.length - offset);
      const results = await runBatch(offset, batchSize);
      for (let i = 0; i < results.length; i++) {
        const settled = results[i];
        if (settled.status === "fulfilled" && settled.value?.embedding?.values) {
          allEmbeddings[offset + i] = settled.value.embedding.values;
        } else {
          allEmbeddings[offset + i] = [];
        }
      }
    }

    return {
      success: true,
      data: {
        embeddings: allEmbeddings,
        model: modelName,
        provider: "gemini",
        usage: { inputTokens: estimateTokenCount(input), totalTokens: estimateTokenCount(input) },
      },
    };
  }

  // --- Private: NVIDIA embedding ---

  async #nvidiaEmbedding({ apiKey, model, input }) {
    const baseUrl = PROVIDER_DEFAULTS.nvidia.baseUrl;
    const endpoint = PROVIDER_DEFAULTS.nvidia.embeddingEndpoint;
    const payload = {
      model: model || "NV-Embed-QA",
      input,
      input_type: "query",
      encoding_format: "float",
      truncate: "NONE",
    };

    const data = await this.#callJson({
      url: `${baseUrl}${endpoint}`,
      apiKey,
      payload,
      timeoutMs: DEFAULT_TIMEOUTS.embeddingMs,
      provider: "nvidia",
    });

    return normalizeOpenaiEmbeddingResult(data, { model: payload.model, provider: "nvidia" });
  }

  // --- Private: OpenAI-compatible TTS ---

  async #openaiTts({ apiKey, model, input, voice, responseFormat, speed, baseUrl, endpoint, provider }) {
    const resolvedBaseUrl = baseUrl || PROVIDER_DEFAULTS.openai.baseUrl;
    const resolvedEndpoint = endpoint || PROVIDER_DEFAULTS.openai.ttsEndpoint;
    const resolvedProvider = provider || "openai";
    const payload = {
      model: model || "tts-1",
      input,
      voice: voice || "alloy",
      response_format: responseFormat || "mp3",
    };
    if (speed && speed !== 1.0) payload.speed = speed;

    const audioBuffer = await this.#callBinary({
      url: `${resolvedBaseUrl}${resolvedEndpoint}`,
      apiKey,
      payload,
      timeoutMs: DEFAULT_TIMEOUTS.ttsMs,
      provider: resolvedProvider,
    });

    const contentType = formatToContentType(responseFormat || "mp3");
    return {
      success: true,
      binary: true,
      audioBuffer,
      contentType,
      data: {
        model: payload.model,
        provider: resolvedProvider,
        voice: payload.voice,
        format: payload.response_format,
        bytes: audioBuffer.length,
      },
    };
  }

  // --- Private: OpenAI-compatible STT ---

  async #openaiStt({ apiKey, model, audioBuffer, filename, language, responseFormat, baseUrl, endpoint, provider }) {
    const resolvedBaseUrl = baseUrl || PROVIDER_DEFAULTS.openai.baseUrl;
    const resolvedEndpoint = endpoint || PROVIDER_DEFAULTS.openai.sttEndpoint;
    const resolvedProvider = provider || "openai";

    const formData = buildMultipartFormData({
      file: { buffer: audioBuffer, filename: filename || "audio.wav", contentType: "audio/wav" },
      model: model || "whisper-1",
      response_format: responseFormat || "json",
      ...(language ? { language } : {}),
    });

    const data = await this.#callMultipart({
      url: `${resolvedBaseUrl}${resolvedEndpoint}`,
      apiKey,
      formData,
      timeoutMs: DEFAULT_TIMEOUTS.sttMs,
      provider: resolvedProvider,
    });

    return normalizeSttResult(data, { model: model || "whisper-1", provider: resolvedProvider });
  }

  // --- Private: HTTP helpers (delegated to multimodalHttpHelpers) ---

  #callJson(opts) { return callJson(this.#fetch, opts); }
  #callBinary(opts) { return callBinary(this.#fetch, opts); }
  #callMultipart(opts) { return callMultipart(this.#fetch, opts); }

  // --- Private: credential resolution ---

  #resolveApiKey(provider) {
    // Try runtime credential store first, then environment variables
    const storeKey = this.#runtimeCredentialStore?.getApiKey?.(provider);
    if (storeKey) return storeKey;

    const envMap = {
      openai: "OPENAI_API_KEY",
      dashscope: "DASHSCOPE_API_KEY",
      gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      nvidia: "NVIDIA_API_KEY",
      siliconflow: "SILICONFLOW_API_KEY",
      zhipu: "ZHIPU_API_KEY",
    };

    const envKeys = envMap[provider];
    if (!envKeys) return "";
    if (Array.isArray(envKeys)) {
      for (const key of envKeys) {
        if (this.#env[key]) return this.#env[key];
      }
      return "";
    }
    return this.#env[envKeys] ?? "";
  }

  #resolveBaseUrl(provider) {
    const storeEndpoint = this.#runtimeCredentialStore?.getEndpoint?.(provider);
    if (storeEndpoint) return storeEndpoint.replace(/\/+$/, "");
    const defaults = PROVIDER_DEFAULTS[provider];
    if (defaults?.baseUrl) return defaults.baseUrl;
    throw createAdapterError("unknown_provider", `No base URL configured for provider: ${provider}`, false);
  }
}
