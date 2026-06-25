// src/providers/multimodalConstants.js
// Shared constants for the multimodal provider adapter.

export const DEFAULT_TIMEOUTS = {
  imageMs: 60_000,
  embeddingMs: 30_000,
  ttsMs: 60_000,
  sttMs: 120_000,
};

export const PROVIDER_DEFAULTS = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    imageEndpoint: "/images/generations",
    embeddingEndpoint: "/embeddings",
    ttsEndpoint: "/audio/speech",
    sttEndpoint: "/audio/transcriptions",
  },
  dashscope: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    imageBaseUrl: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image",
    embeddingEndpoint: "/embeddings",
    ttsEndpoint: "/audio/speech",
    sttEndpoint: "/audio/transcriptions",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1",
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    embeddingEndpoint: "/embeddings",
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1",
    imageEndpoint: "/images/generations",
    embeddingEndpoint: "/embeddings",
    ttsEndpoint: "/audio/speech",
    sttEndpoint: "/audio/transcriptions",
  },
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    imageEndpoint: "/images/generations",
    embeddingEndpoint: "/embeddings",
  },
};

// Model-to-provider auto-detection map
// NOTE: DashScope v-series embedding patterns must appear before the generic
// OpenAI text-embedding pattern to prevent DashScope models like
// "text-embedding-v3" from being misrouted to OpenAI.
export const MODEL_PROVIDER_HINTS = [
  { pattern: /^dall-e/i, provider: "openai" },
  { pattern: /^gpt-image/i, provider: "openai" },
  { pattern: /^tts-|^whisper-/i, provider: "openai" },
  { pattern: /^text-embedding-v\d/i, provider: "dashscope" },  // DashScope v-series
  { pattern: /^text-embedding/i, provider: "openai" },
  { pattern: /^wanx/i, provider: "dashscope" },
  { pattern: /^flux/i, provider: "dashscope" },
  { pattern: /^imagen/i, provider: "gemini" },
  { pattern: /^gemini-.*embedding/i, provider: "gemini" },
  { pattern: /^nvidia\//i, provider: "nvidia" },
  { pattern: /^NV-Embed/i, provider: "nvidia" },
];
