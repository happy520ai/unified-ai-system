import { buildProviderFamilyRegistry } from "./providerFamilyRegistry.js";
import { createGlobalModelRecord } from "./globalModelCatalogSchema.js";
import { inferCapabilityTagsFromModelId } from "./modelCapabilityTags.js";
import { CHINESE_MODEL_SEED_NAMES } from "./chineseModelEcosystemCatalog.js";

const BASE_MODEL_NAMES = Object.freeze({
  nvidia: ["llama-3.3-nemotron-super-49b-v1", "llama-3.1-nemotron-nano-8b-v1", "nemotron-3-super-120b-a12b", "nemotron-mini-4b-instruct", "llama-3.3-nemotron-super-49b-v1.5", "nemotron-3-nano-30b-a3b", "nvidia-nemotron-nano-9b-v2", "llama-3.2-nv-embedqa-1b-v2", "llama-nemotron-rerank-1b-v2", "nemoguard-jailbreak-detect"],
  openai: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2", "gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini", "text-embedding-3-large", "gpt-image-1", "sora-preview"],
  anthropic: ["claude-opus-4.5", "claude-sonnet-4.5", "claude-haiku-4.5", "claude-3.7-sonnet", "claude-3.5-haiku", "claude-3-opus", "claude-3-haiku", "claude-code"],
  "google-gemini": ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-embedding", "imagen", "veo"],
  xai: ["grok-4", "grok-4-fast", "grok-3", "grok-3-mini", "grok-code-fast", "grok-vision"],
  mistral: ["mistral-large", "mistral-medium", "mistral-small", "ministral-8b", "codestral", "devstral", "pixtral-large", "mistral-embed"],
  cohere: ["command-a", "command-r-plus", "command-r", "command-light", "embed-v4", "rerank-v3.5"],
  ai21: ["jamba-large", "jamba-mini", "jamba-instruct", "jurassic-2-ultra", "jurassic-2-mid"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b", "gemma2-9b-it", "deepseek-r1-distill", "whisper-large-v3"],
  together: ["meta-llama-3.1-405b", "meta-llama-3.3-70b", "qwen2.5-72b", "deepseek-v3", "mixtral-8x22b", "flux-schnell"],
  fireworks: ["llama-v3p1-405b-instruct", "llama-v3p3-70b-instruct", "deepseek-v3", "qwen2p5-coder", "mixtral-8x22b", "stable-diffusion-xl"],
  deepinfra: ["llama-3.3-70b", "deepseek-v3", "qwen2.5-coder-32b", "mistral-small", "bge-large-en", "bge-reranker"],
  replicate: ["llama-3-70b", "mistral-7b", "stable-diffusion", "flux-dev", "whisper", "llava"],
  "huggingface-inference": ["meta-llama-3.1-8b", "mistral-7b-instruct", "qwen2.5-coder", "bge-large", "clip-vit", "stable-diffusion-xl"],
  cerebras: ["llama3.1-8b", "llama3.3-70b", "qwen3-32b", "gpt-oss-120b", "qwen-coder"],
  sambanova: ["llama-4-maverick", "llama-3.3-70b", "deepseek-r1", "qwen2.5-coder", "whisper"],
  perplexity: ["sonar", "sonar-pro", "sonar-reasoning", "sonar-deep-research", "r1-1776"],
  openrouter: ["openrouter/auto", "openrouter/qwen", "openrouter/deepseek", "openrouter/claude", "openrouter/gemini", "openrouter/mistral"],
  "litellm-compatible": ["litellm/openai-compatible", "litellm/anthropic-compatible", "litellm/vertex-compatible", "litellm/ollama-compatible", "litellm/custom-router"],
  "ollama-local": ["llama3.3", "qwen2.5", "deepseek-r1", "mistral", "gemma3", "nomic-embed-text"],
  "lm-studio-local": ["local-llama", "local-qwen", "local-mistral", "local-coder", "local-vision"],
  "vllm-private": ["private-llama", "private-qwen", "private-mistral", "private-coder", "private-embedding"],
});

const EXTRA_SUFFIXES = Object.freeze(["chat", "reasoning", "coder", "vision", "long-context", "mini", "flash", "turbo"]);

export function buildGlobalCatalogSeedPack({ minModelCount = 420 } = {}) {
  const registry = buildProviderFamilyRegistry();
  const models = [];
  for (const family of registry.providerFamilies) {
    const baseNames = modelNamesForFamily(family.providerFamily);
    for (const name of baseNames) {
      models.push(createSeedModel(family.providerFamily, name));
    }
    let index = 1;
    while (models.filter((model) => model.providerFamily === family.providerFamily).length < 12) {
      const suffix = EXTRA_SUFFIXES[(index - 1) % EXTRA_SUFFIXES.length];
      models.push(createSeedModel(family.providerFamily, `${family.providerFamily}-${suffix}-${index}`));
      index += 1;
    }
  }
  let syntheticIndex = 1;
  while (models.length < minModelCount) {
    const family = registry.providerFamilies[(syntheticIndex - 1) % registry.providerFamilies.length].providerFamily;
    models.push(createSeedModel(family, `${family}-catalog-seed-${syntheticIndex}`));
    syntheticIndex += 1;
  }

  const deduped = Array.from(new Map(models.map((model) => [model.canonicalModelId, model])).values());
  return {
    phase: "Phase770",
    generatedBy: "static_seed_no_provider_call",
    providerFamilyCount: registry.providerFamilyCount,
    catalogSeedModelCount: deduped.length,
    models: deduped,
    safety: {
      providerCallsMade: false,
      discoveryApiCalled: false,
      secretRead: false,
      authJsonRead: false,
      selectableModified: false,
      newSelectableModelsAdded: 0,
    },
  };
}

function modelNamesForFamily(providerFamily) {
  if (CHINESE_MODEL_SEED_NAMES[providerFamily]) return CHINESE_MODEL_SEED_NAMES[providerFamily];
  return BASE_MODEL_NAMES[providerFamily] ?? [
    `${providerFamily}-chat`,
    `${providerFamily}-reasoning`,
    `${providerFamily}-coder`,
    `${providerFamily}-vision`,
    `${providerFamily}-embedding`,
    `${providerFamily}-rerank`,
  ];
}

function createSeedModel(providerFamily, modelName) {
  const modelId = `${providerFamily}/${modelName}`;
  const capabilities = inferCapabilityTagsFromModelId(modelId);
  return createGlobalModelRecord({
    modelId,
    canonicalModelId: modelId,
    providerFamily,
    providerId: providerFamily,
    source: "seed",
    status: providerFamily.includes("local") || providerFamily === "vllm-private" ? "cataloged" : "credential_missing",
    capabilities,
    evidence: {
      discoveryRef: "phase770-static-seed",
      smokeRef: null,
      lastVerifiedAt: null,
    },
    selectableGate: {
      reason: "seed_only_not_smoke_verified",
    },
  });
}
