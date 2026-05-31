export const MODEL_CAPABILITY_TAGS = Object.freeze([
  "chat",
  "completion",
  "reasoning",
  "coding",
  "vision",
  "audio",
  "image",
  "video",
  "embedding",
  "rerank",
  "toolCalling",
  "jsonMode",
  "longContext",
  "chineseOptimized",
  "lowLatency",
  "lowCost",
]);

export function buildModelCapabilityTagTaxonomy() {
  return {
    contractName: "model-capability-tag-taxonomy",
    version: "phase769.v1",
    tags: MODEL_CAPABILITY_TAGS,
    chatDropdownAllowedBuckets: ["chat", "reasoning", "coding"],
    taskToolOnlyTags: ["embedding", "rerank", "safety", "audio", "image", "video"],
    seedTagInferenceIsHeuristic: true,
    providerCallsMade: false,
    selectableModified: false,
  };
}

export function inferCapabilityTagsFromModelId(modelId = "") {
  const id = String(modelId).toLowerCase();
  return {
    chat: !/(embed|embedding|rerank|tts|speech|image|video|vision-only)/.test(id),
    completion: /instruct|chat|gpt|claude|gemini|qwen|deepseek|kimi|glm|hunyuan|yi|mistral|llama/.test(id),
    reasoning: /(reason|r1|o1|o3|think|thinking|nemotron|qwq)/.test(id),
    coding: /(code|coder|codestral|devstral)/.test(id),
    vision: /(vision|vl|multimodal|omni|pixtral|image)/.test(id),
    audio: /(audio|speech|tts|whisper|riva)/.test(id),
    image: /(image|dall|flux|sdxl|stable-diffusion)/.test(id),
    video: /(video|sora|veo|kling)/.test(id),
    embedding: /(embed|embedding)/.test(id),
    rerank: /rerank/.test(id),
    toolCalling: /(tool|function|gpt|claude|gemini|qwen|kimi|glm)/.test(id),
    jsonMode: /(gpt|claude|gemini|qwen|deepseek|kimi|glm|mistral)/.test(id),
    longContext: /(128k|200k|1m|long|context|gemini|claude|kimi)/.test(id),
    chineseOptimized: /(qwen|deepseek|kimi|glm|hunyuan|qianfan|baichuan|yi|mimo|doubao|minimax)/.test(id),
    lowLatency: /(mini|flash|nano|small|lite|turbo|instant)/.test(id),
    lowCost: /(mini|flash|nano|small|lite|8b|7b|3b|1b)/.test(id),
  };
}
