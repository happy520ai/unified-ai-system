export const MODEL_CAPABILITIES = Object.freeze([
  "chat_general",
  "chat_reasoning",
  "chat_coding",
  "chat_multilingual",
  "chat_agent_tool",
  "rag_answer",
  "embedding_text",
  "embedding_code",
  "rerank",
  "safety",
  "pii_detection",
  "translation",
  "multimodal_image",
  "voice_tts",
  "voice_chat",
  "video",
  "autonomous_driving",
  "openusd",
  "biology",
  "specialized_hidden",
]);

export const DIRECT_CHAT_CAPABILITIES = Object.freeze([
  "chat_general",
  "chat_reasoning",
  "chat_coding",
  "chat_multilingual",
  "chat_agent_tool",
  "rag_answer",
]);

export const TASK_TOOL_CAPABILITIES = Object.freeze([
  "embedding_text",
  "embedding_code",
  "rerank",
  "safety",
  "pii_detection",
  "translation",
  "multimodal_image",
  "voice_tts",
  "voice_chat",
  "video",
  "autonomous_driving",
  "openusd",
  "biology",
  "specialized_hidden",
]);

export const ENDPOINT_TYPES = Object.freeze({
  chat: "chat_completions",
  embeddings: "embeddings",
  rerank: "rerank",
  safety: "safety",
  pii: "pii_detection",
  translation: "translation",
  multimodal: "multimodal",
  voice: "voice",
  video: "video",
  hostedSpecialized: "hosted_specialized",
  downloadableOnly: "downloadable_only",
});

const UI_GROUP_BY_CAPABILITY = Object.freeze({
  chat_general: "Direct Chat",
  chat_reasoning: "Direct Chat",
  chat_coding: "Direct Chat",
  chat_multilingual: "Direct Chat",
  chat_agent_tool: "Direct Chat",
  rag_answer: "Direct Chat",
  embedding_text: "Task Tools - Embedding",
  embedding_code: "Task Tools - Embedding",
  rerank: "Task Tools - Rerank",
  safety: "Task Tools - Safety",
  pii_detection: "Task Tools - PII",
  translation: "Task Tools - Translation",
  multimodal_image: "Task Tools - Multimodal",
  voice_tts: "Task Tools - Voice",
  voice_chat: "Task Tools - Voice",
  video: "Task Tools - Video",
  autonomous_driving: "Task Tools - Autonomous Driving",
  openusd: "Task Tools - OpenUSD",
  biology: "Task Tools - Biology",
  specialized_hidden: "Specialized / Hidden",
});

export function normalizeCapabilities(capabilities = []) {
  const normalized = Array.isArray(capabilities)
    ? capabilities.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const known = normalized.filter((item) => MODEL_CAPABILITIES.includes(item));
  return known.length ? Array.from(new Set(known)) : ["specialized_hidden"];
}

export function inferCapabilitiesFromModel(input = {}) {
  const text = [
    input.modelId,
    input.displayName,
    input.description,
    ...(Array.isArray(input.tags) ? input.tags : []),
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(pii|gliner|entity|redact)\b/.test(text)) return ["pii_detection"];
  if (/\b(safety|guard|moderation|jailbreak|topic-control|content-safety)\b/.test(text)) return ["safety"];
  if (/\b(translat|riva-translate)\b/.test(text)) return ["translation", "chat_multilingual"];
  if (/\b(embed|embedding|embedqa|embedcode)\b/.test(text)) {
    return text.includes("code") ? ["embedding_code"] : ["embedding_text"];
  }
  if (/\b(rerank|rank|ranking)\b/.test(text)) return ["rerank"];
  if (/\b(vision|vlm|image|multimodal|ocr|parse|visual|dinov2|grounding)\b/.test(text)) return ["multimodal_image"];
  if (/\b(tts|voice|audio|asr|parakeet|riva|speech)\b/.test(text)) {
    return text.includes("tts") ? ["voice_tts"] : ["voice_chat"];
  }
  if (/\b(video|cosmos|synthetic-video|lipsync|speaker)\b/.test(text)) return ["video"];
  if (/\b(usd|openusd)\b/.test(text)) return ["openusd"];
  if (/\b(bevformer|sparsedrive|streampetr|autonomous|driving|vehicle)\b/.test(text)) return ["autonomous_driving"];
  if (/\b(protein|mol|genmol|alphafold|boltz|diffdock|bio|health|esm|rfdiffusion|vista3d)\b/.test(text)) return ["biology"];
  if (/\b(code|coder|coding|devstral|codestral|codegemma)\b/.test(text)) return ["chat_coding", "chat_general"];
  if (/\b(reason|thinking|qwq|magistral|nemotron|glm|mistral|deepseek|qwen|kimi)\b/.test(text)) return ["chat_reasoning", "chat_general"];
  if (/\b(multilingual|sarvam|teuken|glm)\b/.test(text)) return ["chat_multilingual", "chat_general"];
  return ["chat_general"];
}

export function inferEndpointType(capabilities = [], input = {}) {
  const normalized = normalizeCapabilities(capabilities);
  if (input.downloadableOnly) return ENDPOINT_TYPES.downloadableOnly;
  if (normalized.includes("embedding_text") || normalized.includes("embedding_code")) return ENDPOINT_TYPES.embeddings;
  if (normalized.includes("rerank")) return ENDPOINT_TYPES.rerank;
  if (normalized.includes("pii_detection")) return ENDPOINT_TYPES.pii;
  if (normalized.includes("safety")) return ENDPOINT_TYPES.safety;
  if (normalized.includes("translation")) return ENDPOINT_TYPES.translation;
  if (normalized.includes("multimodal_image")) return ENDPOINT_TYPES.multimodal;
  if (normalized.includes("voice_tts") || normalized.includes("voice_chat")) return ENDPOINT_TYPES.voice;
  if (normalized.includes("video")) return ENDPOINT_TYPES.video;
  if (normalized.some((capability) => DIRECT_CHAT_CAPABILITIES.includes(capability))) return ENDPOINT_TYPES.chat;
  return ENDPOINT_TYPES.hostedSpecialized;
}

export function endpointPathFor(endpointType) {
  if (endpointType === ENDPOINT_TYPES.chat || endpointType === ENDPOINT_TYPES.safety || endpointType === ENDPOINT_TYPES.pii || endpointType === ENDPOINT_TYPES.translation) {
    return "/chat/completions";
  }
  if (endpointType === ENDPOINT_TYPES.embeddings) return "/embeddings";
  if (endpointType === ENDPOINT_TYPES.rerank) return "/retrieval/nvidia/reranking";
  if (endpointType === ENDPOINT_TYPES.multimodal) return "blocked:specialized-multimodal-payload-required";
  if (endpointType === ENDPOINT_TYPES.voice) return "blocked:specialized-voice-payload-required";
  if (endpointType === ENDPOINT_TYPES.video) return "blocked:specialized-video-payload-required";
  if (endpointType === ENDPOINT_TYPES.downloadableOnly) return "blocked:downloadable-only";
  return "blocked:specialized-endpoint-not-enabled";
}

export function primaryCapability(capabilities = []) {
  return normalizeCapabilities(capabilities)[0] ?? "specialized_hidden";
}

export function uiGroupFor(capabilities = []) {
  return UI_GROUP_BY_CAPABILITY[primaryCapability(capabilities)] ?? "Specialized / Hidden";
}

export function isDirectChatCapable(capabilities = []) {
  return normalizeCapabilities(capabilities).some((capability) => DIRECT_CHAT_CAPABILITIES.includes(capability));
}

export function isTaskToolCapable(capabilities = []) {
  return normalizeCapabilities(capabilities).some((capability) => TASK_TOOL_CAPABILITIES.includes(capability));
}

export function canBecomeSelectable(model = {}) {
  return Boolean(
    model?.state?.smoke_passed === true &&
      model?.downloadableOnly !== true &&
      model?.deprecatedSoon !== true &&
      model?.endpointType !== ENDPOINT_TYPES.downloadableOnly,
  );
}

export function canBecomeDefaultCandidate(model = {}) {
  return Boolean(
    canBecomeSelectable(model) &&
      isDirectChatCapable(model.capabilities) &&
      model?.commercialSafe !== false &&
      model?.partnerEndpoint !== true,
  );
}

export function applySelectionRules(model = {}, providerConfigured = false) {
  const state = {
    catalog_known: true,
    configured: Boolean(providerConfigured),
    smoke_passed: model?.testStatus === "smoke_passed" || model?.lastSmokeResult?.success === true,
    selectable: false,
    default_candidate: false,
  };
  const withState = { ...model, state };
  state.selectable = canBecomeSelectable(withState);
  state.default_candidate = canBecomeDefaultCandidate(withState);

  return {
    ...withState,
    state,
    chatSelectable: state.selectable && isDirectChatCapable(model.capabilities),
    taskToolSelectable: state.selectable && isTaskToolCapable(model.capabilities) && !isDirectChatCapable(model.capabilities),
    uiVisibleInChat: true,
    defaultCandidate: state.default_candidate,
    directChat: state.selectable && isDirectChatCapable(model.capabilities),
  };
}

export function validateModelRecord(model = {}) {
  const missing = [];
  for (const field of [
    "providerId",
    "providerName",
    "modelId",
    "displayName",
    "publisher",
    "source",
    "sourceUrlOrDiscoveryNote",
    "catalogStatus",
    "endpointType",
    "endpointPath",
    "capabilities",
    "primaryCapability",
    "uiGroup",
    "testStatus",
    "notes",
  ]) {
    if (model[field] === undefined || model[field] === null || model[field] === "") {
      missing.push(field);
    }
  }

  if (!Array.isArray(model.capabilities) || model.capabilities.length === 0) {
    missing.push("capabilities_non_empty");
  }

  const violations = [];
  if (model.state?.selectable && model.state?.smoke_passed !== true) {
    violations.push("selectable_requires_smoke_passed");
  }
  if ((model.directChat || model.chatSelectable) && !isDirectChatCapable(model.capabilities)) {
    violations.push("non_chat_model_cannot_direct_chat");
  }
  if (model.state?.default_candidate && model.deprecatedSoon) {
    violations.push("deprecated_model_cannot_default");
  }
  if (model.commercialDefault && model.commercialSafe === false) {
    violations.push("commercial_default_requires_commercial_safe");
  }
  if (model.downloadableOnly && model.state?.selectable) {
    violations.push("downloadable_only_cannot_be_selectable_hosted");
  }

  return {
    valid: missing.length === 0 && violations.length === 0,
    missing,
    violations,
  };
}
