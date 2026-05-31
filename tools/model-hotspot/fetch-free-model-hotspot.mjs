import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const phaseId = "FreeModelHotspotTracker";
const evidenceDir = "apps/ai-gateway-service/evidence/model-hotspot";
const outputJson = path.join(evidenceDir, "free-model-hotspot.json");
const outputMd = path.join(evidenceDir, "free-model-hotspot.md");

const FREE_MODEL_SOURCES = [
  {
    id: "openrouter-free",
    name: "OpenRouter Free Tier",
    url: "https://openrouter.ai/api/v1/models",
    type: "aggregator",
    parse: parseOpenRouterModels,
  },
  {
    id: "groq-free",
    name: "Groq Free Tier",
    url: "https://api.groq.com/openai/v1/models",
    type: "direct",
    parse: parseGenericModels,
  },
  {
    id: "nvidia-nim-free",
    name: "NVIDIA NIM Free",
    url: "https://integrate.api.nvidia.com/v1/models",
    type: "direct",
    parse: parseNvidiaModels,
  },
  {
    id: "cerebras-free",
    name: "Cerebras Free",
    url: "https://api.cerebras.ai/v1/models",
    type: "direct",
    parse: parseGenericModels,
  },
  {
    id: "sambanova-free",
    name: "SambaNova Free",
    url: "https://api.sambanova.ai/v1/models",
    type: "direct",
    parse: parseGenericModels,
  },
  {
    id: "huggingface-trending",
    name: "HuggingFace Trending",
    url: "https://huggingface.co/api/models?sort=trending&direction=-1&limit=50",
    type: "open_source",
    parse: parseHuggingFaceModels,
  },
];

const CAPABILITY_RULES = {
  chat: [
    /instruct/i, /chat/i, /it$/i, /conversation/i,
    /deepseek/i, /qwen/i, /yi/i, /glm/i, /kimi/i,
    /mistral/i, /mixtral/i, /gemma/i, /phi/i,
    /llama/i, /nemotron/i, /command-r/i,
  ],
  vision: [
    /vision/i, /vl$/i, /visual/i, /multimodal/i,
    /llava/i, /cogvlm/i, /internvl/i, /qwen-vl/i,
  ],
  reasoning: [
    /reasoning/i, /think/i, /o1/i, /o3/i, /deepseek-r/i,
    /qwq/i, /marco/i, /dracarys/i,
  ],
  coding: [
    /code/i, /coder/i, /codestral/i, /deepseek-coder/i,
    /starcoder/i, /codegemma/i, /codellama/i,
  ],
  embedding: [
    /embed/i, /embedding/i, /e5-/i, /bge-/i, /gte-/i,
    /nomic/i, /cohere-embed/i,
  ],
  longContext: [
    /128k/i, /256k/i, /1m/i, /long/i, /extended/i,
    /mistral-large/i, /claude/i, /gemini/i,
  ],
  chineseOptimized: [
    /qwen/i, /yi/i, /glm/i, /deepseek/i, /baichuan/i,
    /internlm/i, /moonshot/i, /kimi/i, /minimax/i,
    /hunyuan/i, /spark/i, /ernie/i,
  ],
};

function detectCapabilities(modelId) {
  const caps = {};
  for (const [cap, patterns] of Object.entries(CAPABILITY_RULES)) {
    caps[cap] = patterns.some((p) => p.test(modelId));
  }
  return caps;
}

function parseOpenRouterModels(data) {
  if (!data?.data) return [];
  return data.data
    .filter((m) => {
      const pricing = m.pricing || {};
      const promptCost = parseFloat(pricing.prompt || "1");
      const completionCost = parseFloat(pricing.completion || "1");
      return promptCost === 0 && completionCost === 0;
    })
    .map((m) => ({
      modelId: m.id,
      displayName: m.name || m.id,
      provider: "openrouter",
      contextLength: m.context_length || null,
      capabilities: detectCapabilities(m.id),
      pricing: {
        inputUsdPer1M: 0,
        outputUsdPer1M: 0,
        source: "openrouter_free_tier",
      },
      free: true,
      freeType: "openrouter_free_tier",
      trending: true,
    }));
}

function parseGenericModels(data) {
  if (!data?.data) return [];
  return data.data.map((m) => ({
    modelId: m.id,
    displayName: m.id,
    contextLength: m.context_length || null,
    capabilities: detectCapabilities(m.id),
    pricing: {
      inputUsdPer1M: 0,
      outputUsdPer1M: 0,
      source: "free_tier",
    },
    free: true,
    freeType: "provider_free_tier",
    trending: false,
  }));
}

function parseNvidiaModels(data) {
  if (!data?.data) return [];
  return data.data.map((m) => ({
    modelId: m.id,
    displayName: m.id,
    contextLength: null,
    capabilities: detectCapabilities(m.id),
    pricing: {
      inputUsdPer1M: 0,
      outputUsdPer1M: 0,
      source: "nvidia_nim_free",
    },
    free: true,
    freeType: "nvidia_nim_free",
    trending: false,
  }));
}

function parseHuggingFaceModels(data) {
  if (!Array.isArray(data)) return [];
  return data
    .filter((m) => m.pipeline_tag === "text-generation" || m.pipeline_tag === "text2text-generation")
    .map((m) => ({
      modelId: m.id || m.modelId,
      displayName: m.id || m.modelId,
      provider: "huggingface",
      downloads: m.downloads || 0,
      likes: m.likes || 0,
      pipeline_tag: m.pipeline_tag,
      capabilities: detectCapabilities(m.id || ""),
      pricing: {
        inputUsdPer1M: 0,
        outputUsdPer1M: 0,
        source: "open_source",
      },
      free: true,
      freeType: "open_source",
      trending: true,
      trendingScore: (m.downloads || 0) + (m.likes || 0) * 100,
    }));
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "UnifiedAI-System/1.0" },
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

async function fetchAllSources() {
  const allModels = [];
  const sourceResults = [];

  for (const source of FREE_MODEL_SOURCES) {
    console.log(`[Hotspot] Fetching ${source.name}...`);
    const startTime = Date.now();
    const data = await fetchWithTimeout(source.url);
    const elapsed = Date.now() - startTime;

    if (data) {
      const models = source.parse(data);
      const enriched = models.map((m) => ({
        ...m,
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type,
        fetchedAt: new Date().toISOString(),
      }));
      allModels.push(...enriched);
      sourceResults.push({
        sourceId: source.id,
        sourceName: source.name,
        status: "success",
        modelCount: models.length,
        elapsedMs: elapsed,
      });
      console.log(`[Hotspot] ${source.name}: ${models.length} free models (${elapsed}ms)`);
    } else {
      sourceResults.push({
        sourceId: source.id,
        sourceName: source.name,
        status: "failed",
        modelCount: 0,
        elapsedMs: elapsed,
      });
      console.log(`[Hotspot] ${source.name}: FAILED`);
    }
  }

  return { allModels, sourceResults };
}

function deduplicateModels(models) {
  const seen = new Map();
  for (const m of models) {
    const key = m.modelId.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, m);
    } else {
      const existing = seen.get(key);
      if (m.trendingScore && (!existing.trendingScore || m.trendingScore > existing.trendingScore)) {
        seen.set(key, m);
      }
    }
  }
  return [...seen.values()];
}

function rankModels(models) {
  return models.sort((a, b) => {
    const scoreA = (a.trendingScore || 0) + (a.downloads || 0) + (a.likes || 0) * 100;
    const scoreB = (b.trendingScore || 0) + (b.downloads || 0) + (b.likes || 0) * 100;
    return scoreB - scoreA;
  });
}

function buildResult(allModels, sourceResults) {
  const deduped = deduplicateModels(allModels);
  const ranked = rankModels(deduped);

  const chatModels = ranked.filter((m) => m.capabilities.chat);
  const visionModels = ranked.filter((m) => m.capabilities.vision);
  const reasoningModels = ranked.filter((m) => m.capabilities.reasoning);
  const codingModels = ranked.filter((m) => m.capabilities.coding);
  const chineseModels = ranked.filter((m) => m.capabilities.chineseOptimized);

  return {
    phase: "FreeModelHotspotTracker",
    fetchedAt: new Date().toISOString(),
    summary: {
      totalFetched: allModels.length,
      totalDeduped: deduped.length,
      totalRanked: ranked.length,
      chatCapable: chatModels.length,
      visionCapable: visionModels.length,
      reasoningCapable: reasoningModels.length,
      codingCapable: codingModels.length,
      chineseOptimized: chineseModels.length,
    },
    sourceResults,
    models: ranked.slice(0, 200),
    topChatModels: chatModels.slice(0, 20).map((m) => m.modelId),
    topVisionModels: visionModels.slice(0, 10).map((m) => m.modelId),
    topReasoningModels: reasoningModels.slice(0, 10).map((m) => m.modelId),
    topCodingModels: codingModels.slice(0, 10).map((m) => m.modelId),
    topChineseModels: chineseModels.slice(0, 10).map((m) => m.modelId),
    providerFamilyMapping: buildProviderFamilyMapping(ranked),
    safety: {
      providerCallsMade: false,
      secretRead: false,
      deployExecuted: false,
      rawSecretPrinted: false,
    },
  };
}

function buildProviderFamilyMapping(models) {
  const mapping = {};
  for (const m of models) {
    const provider = m.provider || m.sourceId.replace(/-free$/, "").replace(/-trending$/, "");
    if (!mapping[provider]) {
      mapping[provider] = { modelCount: 0, models: [] };
    }
    mapping[provider].modelCount++;
    if (mapping[provider].models.length < 5) {
      mapping[provider].models.push(m.modelId);
    }
  }
  return mapping;
}

function buildMarkdownReport(result) {
  const lines = [
    "# Free Model Hotspot Report",
    "",
    `> Generated: ${result.fetchedAt}`,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Total Fetched | ${result.summary.totalFetched} |`,
    `| After Dedup | ${result.summary.totalDeduped} |`,
    `| Chat Capable | ${result.summary.chatCapable} |`,
    `| Vision Capable | ${result.summary.visionCapable} |`,
    `| Reasoning Capable | ${result.summary.reasoningCapable} |`,
    `| Coding Capable | ${result.summary.codingCapable} |`,
    `| Chinese Optimized | ${result.summary.chineseOptimized} |`,
    "",
    "## Source Results",
    "",
    "| Source | Status | Models | Time |",
    "| --- | --- | --- | --- |",
  ];

  for (const s of result.sourceResults) {
    lines.push(`| ${s.sourceName} | ${s.status} | ${s.modelCount} | ${s.elapsedMs}ms |`);
  }

  lines.push("");
  lines.push("## Top Chat Models (Free)");
  lines.push("");
  for (const m of result.topChatModels) {
    lines.push(`- ${m}`);
  }

  lines.push("");
  lines.push("## Top Chinese-Optimized Models (Free)");
  lines.push("");
  for (const m of result.topChineseModels) {
    lines.push(`- ${m}`);
  }

  lines.push("");
  lines.push("## Provider Family Mapping");
  lines.push("");
  for (const [provider, info] of Object.entries(result.providerFamilyMapping)) {
    lines.push(`### ${provider} (${info.modelCount} models)`);
    for (const m of info.models) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  console.log(`[${phaseId}] Starting free model hotspot fetch...`);

  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const { allModels, sourceResults } = await fetchAllSources();
  const result = buildResult(allModels, sourceResults);
  const markdown = buildMarkdownReport(result);

  writeFileSync(outputJson, JSON.stringify(result, null, 2), "utf-8");
  writeFileSync(outputMd, markdown, "utf-8");

  console.log(`[${phaseId}] Results written to ${outputJson}`);
  console.log(`[${phaseId}] Report written to ${outputMd}`);
  console.log(`[${phaseId}] Summary:`);
  console.log(`  Total free models: ${result.summary.totalDeduped}`);
  console.log(`  Chat capable: ${result.summary.chatCapable}`);
  console.log(`  Chinese optimized: ${result.summary.chineseOptimized}`);
  console.log(`  Top chat: ${result.topChatModels.slice(0, 5).join(", ")}`);
}

main().catch((err) => {
  console.error(`[${phaseId}] Fatal error:`, err.message);
  process.exit(1);
});
