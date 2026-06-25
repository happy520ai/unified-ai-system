/**
 * Provider model normalization — transforms raw provider API responses into
 * a uniform model descriptor shape.
 *
 * Extracted from providerProbeRegistry.js to keep that module under 500 lines.
 */

import { MODEL_IMPORT_SOURCE } from "./providerProbeCatalog.js";

export function normalizeProviderModels({ providerId, defaultCapabilities = ["chat"], body } = {}) {
  const rawModels = readRawModels(body);
  return rawModels
    .map((model) => normalizeProviderModel({ providerId, defaultCapabilities, model }))
    .filter(Boolean);
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

export function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}
