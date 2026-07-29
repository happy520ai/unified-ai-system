export const OFFICIAL_SOURCE_URLS = Object.freeze({
  llmApis: "https://docs.api.nvidia.com/nim/reference/llm-apis",
  retrievalApis: "https://docs.api.nvidia.com/nim/reference/retrieval-apis",
  buildModels: "https://build.nvidia.com/models",
  buildNvidia: "https://build.nvidia.com/nvidia",
});

export const LIVE_PROVIDER_PREFIX_ALLOWLIST = Object.freeze([
  "abacusai",
  "ai21labs",
  "bytedance",
  "deepseek-ai",
  "google",
  "hive",
  "ipd",
  "meta",
  "microsoft",
  "minimaxai",
  "mistralai",
  "mit",
  "moonshotai",
  "nvidia",
  "openai",
  "opengpt-x",
  "qwen",
  "sarvamai",
  "snowflake",
  "stabilityai",
  "stepfun-ai",
  "stockmark",
  "upstage",
  "z-ai",
]);

export const LIVE_MODEL_ID_BLOCKLIST = Object.freeze([
  /^cdn\./,
  /^image\//,
  /^reference\//,
  /^tag__\//,
  /^[^/]+\/(?:generate|inference|process|multimodal-apis|visual-models-apis)$/i,
  /^[^/]+\/(?:og-image|x-icon)$/i,
]);
