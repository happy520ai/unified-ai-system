export const MODEL_CAPABILITY_BUCKETS = Object.freeze([
  "chat",
  "reasoning_chat",
  "embedding",
  "rerank",
  "safety",
  "pii",
  "translation",
  "multimodal",
  "vision",
  "audio",
  "voice",
  "video",
  "biology",
  "openusd",
  "autonomous_driving",
  "code",
  "unknown",
  "deprecated",
]);

export const DIRECT_CHAT_BUCKETS = Object.freeze(["chat", "reasoning_chat", "code"]);

export const TASK_TOOL_BUCKETS = Object.freeze([
  "embedding",
  "rerank",
  "safety",
  "pii",
  "translation",
  "multimodal",
  "vision",
  "audio",
  "voice",
  "video",
  "biology",
  "openusd",
  "autonomous_driving",
  "deprecated",
]);

const BUCKET_SET = new Set(MODEL_CAPABILITY_BUCKETS);

export function normalizeCapabilityBucket(bucket) {
  const normalized = String(bucket ?? "").trim().toLowerCase();
  return BUCKET_SET.has(normalized) ? normalized : "unknown";
}

export function isDirectChatBucket(bucket) {
  return DIRECT_CHAT_BUCKETS.includes(normalizeCapabilityBucket(bucket));
}

export function isTaskToolBucket(bucket) {
  return TASK_TOOL_BUCKETS.includes(normalizeCapabilityBucket(bucket));
}

export function bucketForModel(model = {}) {
  const capabilities = Array.isArray(model.capabilities) ? model.capabilities.map((item) => String(item)) : [];
  const text = [
    model.modelId,
    model.displayName,
    model.primaryCapability,
    model.endpointType,
    model.uiGroup,
    ...capabilities,
  ]
    .join(" ")
    .toLowerCase();

  if (model.deprecatedSoon === true) return "deprecated";
  if (capabilities.includes("openusd") || /\b(openusd|usdcode|usd)\b/.test(text)) return "openusd";
  if (capabilities.includes("biology") || /(protein|genmol|molmim|diffdock|boltz|esm|rfdiffusion|vista3d|alphafold|bio)/.test(text)) return "biology";
  if (capabilities.includes("autonomous_driving") || /(bevformer|sparsedrive|streampetr|autonomous|driving|vehicle)/.test(text)) return "autonomous_driving";
  if (capabilities.includes("video") || /(video|cosmos|text2world|lipsync|speaker)/.test(text)) return "video";
  if (capabilities.includes("voice_tts") || capabilities.includes("voice_chat") || /(voice|tts|riva)/.test(text)) return "voice";
  if (/(audio|asr|speech|parakeet)/.test(text)) return "audio";
  if (capabilities.includes("multimodal_image") && /(multimodal|omni|phi-4-multimodal)/.test(text)) return "multimodal";
  if (capabilities.includes("multimodal_image") || /(vision|vlm|image|visual|ocr|parse|dinov2|grounding|paligemma)/.test(text)) return "vision";
  if (capabilities.includes("translation") || /translat/.test(text)) return "translation";
  if (capabilities.includes("pii_detection") || /(pii|gliner|redact)/.test(text)) return "pii";
  if (capabilities.includes("safety") || /(safety|guard|jailbreak|moderation|deepfake|hive)/.test(text)) return "safety";
  if (capabilities.includes("rerank") || /(rerank|ranking)/.test(text)) return "rerank";
  if (capabilities.includes("embedding_text") || capabilities.includes("embedding_code") || /(embed|embedding)/.test(text)) return "embedding";
  if (capabilities.includes("chat_coding") || /(code|coder|coding|devstral|codestral|codegemma)/.test(text)) return "code";
  if (capabilities.includes("chat_reasoning") || /(reason|thinking|nemotron|deepseek|qwen|qwq|kimi|magistral|glm|mistral)/.test(text)) return "reasoning_chat";
  if (capabilities.some((capability) => capability.startsWith("chat_")) || capabilities.includes("rag_answer")) return "chat";
  return "unknown";
}

export function bucketLabel(bucket) {
  const normalized = normalizeCapabilityBucket(bucket);
  return normalized.replace(/_/g, " ");
}
