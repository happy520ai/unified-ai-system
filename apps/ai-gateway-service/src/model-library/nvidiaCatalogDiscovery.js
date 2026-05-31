import {
  endpointPathFor,
  inferCapabilitiesFromModel,
  inferEndpointType,
  normalizeCapabilities,
  primaryCapability,
  uiGroupFor,
} from "./modelCapabilityRules.js";

export const NVIDIA_PROVIDER = Object.freeze({
  providerId: "nvidia",
  providerName: "NVIDIA NIM API Catalog",
  defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
  retrievalBaseUrl: "https://ai.api.nvidia.com/v1",
});

const OFFICIAL_SOURCE_URLS = Object.freeze({
  llmApis: "https://docs.api.nvidia.com/nim/reference/llm-apis",
  retrievalApis: "https://docs.api.nvidia.com/nim/reference/retrieval-apis",
  buildModels: "https://build.nvidia.com/models",
  buildNvidia: "https://build.nvidia.com/nvidia",
});

const LIVE_PROVIDER_PREFIX_ALLOWLIST = Object.freeze([
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

const LIVE_MODEL_ID_BLOCKLIST = Object.freeze([
  /^cdn\./,
  /^image\//,
  /^reference\//,
  /^tag__\//,
  /^[^/]+\/(?:generate|inference|process|multimodal-apis|visual-models-apis)$/i,
  /^[^/]+\/(?:og-image|x-icon)$/i,
]);

const CHAT_MODELS = [
  "abacusai/dracarys-llama-3.1-70b-instruct",
  "bytedance/seed-oss-36b-instruct",
  "deepseek-ai/deepseek-v3.1-terminus",
  "deepseek-ai/deepseek-v3.2",
  "deepseek-ai/deepseek-v4-flash",
  "deepseek-ai/deepseek-v4-pro",
  "google/codegemma-7b",
  "google/gemma-2-2b-it",
  "google/gemma-7b",
  "meta/llama2-70b",
  "meta/llama3-8b",
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.2-1b-instruct",
  "meta/llama-3.2-3b-instruct",
  "meta/llama-3.3-70b-instruct",
  "microsoft/phi-3-medium-128k-instruct",
  "microsoft/phi-3-mini-4k-instruct",
  "microsoft/phi-4-mini-instruct",
  "microsoft/phi-4-mini-flash-reasoning",
  "minimaxai/minimax-m2.5",
  "minimaxai/minimax-m2.7",
  "mistralai/devstral-2-123b-instruct-2512",
  "mistralai/magistral-small-2506",
  "mistralai/mamba-codestral-7b-v0.1",
  "mistralai/mistral-7b-instruct",
  "mistralai/mistral-7b-instruct-v0.3",
  "mistralai/mistral-nemotron",
  "mistralai/mistral-small-24b-instruct",
  "mistralai/mixtral-8x22b-instruct",
  "moonshotai/kimi-k2-instruct",
  "moonshotai/kimi-k2-instruct-0905",
  "moonshotai/kimi-k2-thinking",
  "nvidia/llama-3.1-nemotron-nano-8b-v1",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "nvidia/nemotron-3-nano-30b-a3b",
  "nvidia/nemotron-3-super-120b-a12b",
  "nvidia/nemotron-mini-4b-instruct",
  "nvidia/nvidia-nemotron-nano-9b-v2",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "opengpt-x/teuken-7b-instruct-commercial-v0.4",
  "qwen/qwen2.5-7b-instruct",
  "qwen/qwen2.5-coder-7b-instruct",
  "qwen/qwen2.5-coder-32b-instruct",
  "qwen/qwen3-5-122b-a10b",
  "qwen/qwen3-coder-480b-a35b-instruct",
  "qwen/qwen3-next-80b-a3b-instruct",
  "qwen/qwen3-next-80b-a3b-thinking",
  "qwen/qwq-32b",
  "sarvamai/sarvam-m",
  "stepfun-ai/step-3-5-flash",
  "stockmark/stockmark-2-100b-instruct",
  "upstage/solar-10.7b-instruct",
  "z-ai/glm4.7",
  "z-ai/glm5.1",
];

const NVIDIA_TOOL_MODELS = [
  {
    modelId: "nvidia/gliner-pii",
    displayName: "GLiNER PII",
    capabilities: ["pii_detection"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/gliner-pii",
    freeEndpoint: true,
    commercialSafe: true,
    endpointType: "pii_detection",
  },
  {
    modelId: "nvidia/llama-3.1-nemoguard-8b-content-safety",
    capabilities: ["safety"],
    source: "nvidia-api-docs-llm",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "safety",
  },
  {
    modelId: "nvidia/llama-3.1-nemoguard-8b-topic-control",
    capabilities: ["safety"],
    source: "nvidia-api-docs-llm",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "safety",
  },
  {
    modelId: "nvidia/llama-3_1-nemotron-safety-guard-8b-v3",
    capabilities: ["safety", "chat_multilingual"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/llama-3_1-nemotron-safety-guard-8b-v3/modelcard",
    freeEndpoint: true,
    endpointType: "safety",
  },
  {
    modelId: "nvidia/nemoguard-jailbreak-detect",
    capabilities: ["safety"],
    source: "nvidia-api-docs-llm",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "safety",
  },
  {
    modelId: "nvidia/nemotron-content-safety-reasoning-4b",
    capabilities: ["safety", "chat_reasoning"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/nemotron-content-safety-reasoning-4b",
    freeEndpoint: true,
    endpointType: "safety",
  },
  {
    modelId: "nvidia/nemotron-3-content-safety",
    capabilities: ["safety", "multimodal_image"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/models",
    freeEndpoint: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/riva-translate-4b-instruct-v1_1",
    capabilities: ["translation", "chat_multilingual"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/riva-translate-4b-instruct-v1_1",
    freeEndpoint: true,
    endpointType: "translation",
  },
  {
    modelId: "nvidia/llama-3.2-nemoretriever-300m-embed-v1",
    capabilities: ["embedding_text"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/llama-3_2-nemoretriever-300m-embed-v1/modelcard",
    freeEndpoint: true,
    endpointType: "embeddings",
  },
  {
    modelId: "nvidia/llama-3.2-nemoretriever-300m-embed-v2",
    capabilities: ["embedding_text"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: true,
    endpointType: "embeddings",
  },
  {
    modelId: "nvidia/llama-3.2-nv-embedqa-1b-v1",
    capabilities: ["embedding_text"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: true,
    endpointType: "embeddings",
  },
  {
    modelId: "nvidia/llama-3.2-nv-embedqa-1b-v2",
    capabilities: ["embedding_text"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
  },
  {
    modelId: "nvidia/llama-nemotron-embed-1b-v2",
    capabilities: ["embedding_text"],
    source: "build-nvidia-downloadable",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/llama-nemotron-embed-1b-v2",
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
  },
  {
    modelId: "nvidia/llama-nemotron-embed-vl-1b-v2",
    capabilities: ["embedding_text", "multimodal_image"],
    source: "build-nvidia-downloadable",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/llama-nemotron-embed-vl-1b-v2/modelcard",
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/nvclip",
    capabilities: ["embedding_text", "multimodal_image"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/nv-embed-v1",
    capabilities: ["embedding_text"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/nv-embed-v1",
    freeEndpoint: true,
    commercialSafe: false,
    usageRestriction: "Non-commercial use only marker from NVIDIA catalog.",
    endpointType: "embeddings",
  },
  {
    modelId: "nvidia/nv-embedcode-7b-v1",
    capabilities: ["embedding_code"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: true,
    endpointType: "embeddings",
  },
  {
    modelId: "nvidia/nv-embedqa-e5-v5",
    capabilities: ["embedding_text"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://docs.api.nvidia.com/nim/reference/nvidia-nv-embedqa-e5-v5-infer",
    freeEndpoint: true,
    endpointType: "embeddings",
  },
  {
    modelId: "nvidia/llama-3.2-nemoretriever-500m-rerank-v2",
    capabilities: ["rerank"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: true,
    endpointType: "rerank",
  },
  {
    modelId: "nvidia/llama-3.2-nv-rerankqa-1b-v1",
    capabilities: ["rerank"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: true,
    endpointType: "rerank",
  },
  {
    modelId: "nvidia/llama-3.2-nv-rerankqa-1b-v2",
    capabilities: ["rerank"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.retrievalApis,
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
  },
  {
    modelId: "nvidia/llama-nemotron-rerank-1b-v2",
    capabilities: ["rerank"],
    source: "build-nvidia-downloadable",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/llama-nemotron-rerank-1b-v2",
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
  },
  {
    modelId: "nvidia/llama-nemotron-rerank-vl-1b-v2",
    capabilities: ["rerank", "multimodal_image"],
    source: "build-nvidia-downloadable",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/llama-nemotron-rerank-vl-1b-v2",
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/nv-rerankqa-mistral-4b-v3",
    capabilities: ["rerank"],
    source: "nvidia-api-docs-retrieval",
    sourceUrlOrDiscoveryNote: "https://docs.api.nvidia.com/nim/reference/nvidia-nv-rerankqa-mistral-4b-v3-infer",
    freeEndpoint: true,
    endpointType: "rerank",
  },
  {
    modelId: "nvidia/rerank-qa-mistral-4b",
    capabilities: ["rerank"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/nvidia/rerank-qa-mistral-4b",
    freeEndpoint: true,
    endpointType: "rerank",
  },
  {
    modelId: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    capabilities: ["multimodal_image", "voice_chat", "video", "chat_reasoning"],
    source: "build-nvidia-downloadable",
    sourceUrlOrDiscoveryNote: "https://build.nvidia.com/models",
    freeEndpoint: false,
    downloadableOnly: true,
    endpointType: "downloadable_only",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/nemotron-nano-12b-v2-vl",
    capabilities: ["multimodal_image"],
    source: "nvidia-api-docs-visual",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    capabilities: ["multimodal_image"],
    source: "nvidia-api-docs-multimodal",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/ising-calibration-1-35b-a3b",
    capabilities: ["multimodal_image", "specialized_hidden"],
    source: "build-nvidia-catalog",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildModels,
    freeEndpoint: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/nemoretriever-parse",
    capabilities: ["multimodal_image"],
    source: "nvidia-api-docs-visual",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/nemotron-parse",
    capabilities: ["multimodal_image"],
    source: "nvidia-api-docs-visual",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/ocdrnet",
    capabilities: ["multimodal_image"],
    source: "nvidia-api-docs-visual",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    deprecatedSoon: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/retail-object-detection",
    capabilities: ["multimodal_image", "video"],
    source: "build-nvidia-deprecated-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildNvidia,
    freeEndpoint: true,
    deprecatedSoon: true,
    endpointType: "video",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/visual-changenet",
    capabilities: ["multimodal_image"],
    source: "build-nvidia-deprecated-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildNvidia,
    freeEndpoint: true,
    deprecatedSoon: true,
    endpointType: "multimodal",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/cosmos-predict1-5b",
    capabilities: ["video"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildNvidia,
    freeEndpoint: true,
    endpointType: "video",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/cosmos-transfer2.5-2b",
    capabilities: ["video"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildModels,
    freeEndpoint: true,
    endpointType: "video",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/synthetic-video-detector",
    capabilities: ["video", "safety"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildModels,
    freeEndpoint: true,
    endpointType: "video",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/nemotron-voicechat",
    capabilities: ["voice_chat"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildNvidia,
    freeEndpoint: true,
    endpointType: "voice",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/audio2face-3d-claire-notongue",
    capabilities: ["voice_tts", "specialized_hidden"],
    source: "build-nvidia-deprecated-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildNvidia,
    freeEndpoint: true,
    deprecatedSoon: true,
    endpointType: "voice",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/magpie-tts-flow",
    capabilities: ["voice_tts"],
    source: "build-nvidia-deprecated-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.buildNvidia,
    freeEndpoint: true,
    deprecatedSoon: true,
    endpointType: "voice",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/bevformer",
    capabilities: ["autonomous_driving"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "hosted_specialized",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/sparsedrive",
    capabilities: ["autonomous_driving"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "hosted_specialized",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/streampetr",
    capabilities: ["autonomous_driving"],
    source: "build-nvidia-free-endpoint",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "hosted_specialized",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/usdcode",
    capabilities: ["openusd", "chat_coding"],
    source: "nvidia-api-docs-llm",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: true,
    endpointType: "chat_completions",
  },
  {
    modelId: "nvidia/genmol",
    capabilities: ["biology"],
    source: "nvidia-api-docs-healthcare",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: false,
    endpointType: "hosted_specialized",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/molmim",
    capabilities: ["biology"],
    source: "nvidia-api-docs-healthcare",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: false,
    endpointType: "hosted_specialized",
    requiresSpecialPayload: true,
  },
  {
    modelId: "nvidia/vista3d",
    capabilities: ["biology", "multimodal_image"],
    source: "nvidia-api-docs-healthcare",
    sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
    freeEndpoint: false,
    endpointType: "hosted_specialized",
    requiresSpecialPayload: true,
  },
];

export function discoverNvidiaCatalog({ allowNetwork = false, fetchImpl = globalThis.fetch } = {}) {
  const seedRecords = createSeedCatalogRecords();
  const discovery = {
    providerId: NVIDIA_PROVIDER.providerId,
    source: "official-docs-seed",
    sourceUrls: Object.values(OFFICIAL_SOURCE_URLS),
    liveDiscoveryAttempted: Boolean(allowNetwork),
    liveDiscoverySucceeded: false,
    blockers: [],
    notes: allowNetwork
      ? ["Live discovery is attempted by refresh endpoints; static official-doc seeds remain the safe fallback."]
      : ["Static official-source seed is being used; live discovery is verified by Phase312A verification and records catalog_discovery_unavailable only if that attempt fails."],
  };

  return {
    provider: NVIDIA_PROVIDER,
    records: seedRecords,
    discovery,
    fetchImplAvailable: typeof fetchImpl === "function",
  };
}

export async function discoverNvidiaCatalogLive({ fetchImpl = globalThis.fetch, timeoutMs = 6000 } = {}) {
  const base = discoverNvidiaCatalog({ allowNetwork: true, fetchImpl });
  if (typeof fetchImpl !== "function") {
    return {
      ...base,
      discovery: {
        ...base.discovery,
        blockers: ["catalog_discovery_unavailable"],
        notes: ["fetch is not available in this runtime."],
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(OFFICIAL_SOURCE_URLS.llmApis, { signal: controller.signal });
    const text = await response.text();
    const liveIds = parseModelIdsFromDocs(text);
    return {
      ...base,
      records: mergeLiveModelIds(base.records, liveIds),
      discovery: {
        ...base.discovery,
        liveDiscoverySucceeded: response.ok && liveIds.length > 0,
        blockers: response.ok && liveIds.length > 0 ? [] : ["catalog_discovery_unavailable"],
        liveModelCount: liveIds.length,
        notes: response.ok && liveIds.length > 0
          ? ["Live official docs scan succeeded; records were merged with the static seed."]
          : [`Live discovery returned HTTP ${response.status} or no model ids.`],
      },
    };
  } catch (error) {
    return {
      ...base,
      discovery: {
        ...base.discovery,
        blockers: ["catalog_discovery_unavailable"],
        errorCode: error?.name === "AbortError" ? "catalog_discovery_timeout" : "catalog_discovery_fetch_failed",
        notes: [`Live discovery failed: ${error instanceof Error ? error.message : String(error)}`],
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function createSeedCatalogRecords() {
  return dedupeRecords([
    ...CHAT_MODELS.map((modelId) => createRecord({
      modelId,
      capabilities: inferCapabilitiesFromModel({ modelId }),
      source: "nvidia-api-docs-llm",
      sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
      freeEndpoint: true,
      partnerEndpoint: !modelId.startsWith("nvidia/"),
    })),
    ...NVIDIA_TOOL_MODELS.map((entry) => createRecord(entry)),
  ]);
}

function createRecord(entry) {
  const capabilities = normalizeCapabilities(entry.capabilities ?? inferCapabilitiesFromModel(entry));
  const endpointType = entry.endpointType ?? inferEndpointType(capabilities, entry);
  const endpointPath = entry.endpointPath ?? endpointPathFor(endpointType);
  const publisher = entry.publisher ?? String(entry.modelId).split("/")[0] ?? "nvidia";
  const downloadableOnly = Boolean(entry.downloadableOnly || endpointType === "downloadable_only");
  const deprecatedSoon = Boolean(entry.deprecatedSoon);
  const commercialSafe = entry.commercialSafe === undefined ? true : Boolean(entry.commercialSafe);

  return {
    providerId: NVIDIA_PROVIDER.providerId,
    providerName: NVIDIA_PROVIDER.providerName,
    modelId: entry.modelId,
    displayName: entry.displayName ?? toDisplayName(entry.modelId),
    publisher,
    source: entry.source ?? "nvidia-catalog-seed",
    sourceUrlOrDiscoveryNote: entry.sourceUrlOrDiscoveryNote ?? OFFICIAL_SOURCE_URLS.llmApis,
    catalogStatus: "catalog_known",
    endpointType,
    endpointPath,
    capabilities,
    primaryCapability: primaryCapability(capabilities),
    chatSelectable: false,
    taskToolSelectable: false,
    uiVisibleInChat: true,
    uiGroup: uiGroupFor(capabilities),
    freeEndpoint: Boolean(entry.freeEndpoint),
    partnerEndpoint: Boolean(entry.partnerEndpoint),
    downloadableOnly,
    deprecatedSoon,
    deprecationNote: deprecatedSoon ? "Marked deprecated or deprecated-free-endpoint in NVIDIA catalog/search evidence." : "",
    commercialSafe,
    usageRestriction: entry.usageRestriction ?? "",
    requiresSpecialPayload: Boolean(entry.requiresSpecialPayload),
    testStatus: "unverified",
    lastSmokeAt: null,
    lastSmokeResult: null,
    notes: entry.notes ?? "Known catalog record. Not selectable until a real smoke pass is recorded.",
  };
}

function mergeLiveModelIds(records, liveIds) {
  const existing = new Map(records.map((record) => [record.modelId, record]));
  for (const modelId of liveIds) {
    if (!existing.has(modelId)) {
      existing.set(modelId, createRecord({
        modelId,
        capabilities: inferCapabilitiesFromModel({ modelId }),
        source: "nvidia-api-docs-live-discovery",
        sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
        freeEndpoint: true,
        partnerEndpoint: !modelId.startsWith("nvidia/"),
      }));
    }
  }
  return Array.from(existing.values());
}

function parseModelIdsFromDocs(text) {
  const matches = Array.from(String(text || "").matchAll(/\b([a-z0-9][a-z0-9_.-]+)\s*\/\s*([a-z0-9][a-z0-9_.:-]+)/gi));
  return Array.from(new Set(matches
    .map((match) => `${match[1].toLowerCase()}/${match[2].toLowerCase()}`)
    .filter(isPlausibleLiveModelId))).sort();
}

function isPlausibleLiveModelId(modelId) {
  const [provider, model] = String(modelId).split("/");
  if (!LIVE_PROVIDER_PREFIX_ALLOWLIST.includes(provider)) return false;
  if (!model || model.length < 3) return false;
  if (LIVE_MODEL_ID_BLOCKLIST.some((pattern) => pattern.test(modelId))) return false;
  return true;
}

function dedupeRecords(records) {
  const byId = new Map();
  for (const record of records) {
    byId.set(record.modelId, {
      ...(byId.get(record.modelId) ?? {}),
      ...record,
      capabilities: normalizeCapabilities([...(byId.get(record.modelId)?.capabilities ?? []), ...(record.capabilities ?? [])]),
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.modelId.localeCompare(b.modelId));
}

function toDisplayName(modelId) {
  return String(modelId)
    .split("/")
    .pop()
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
