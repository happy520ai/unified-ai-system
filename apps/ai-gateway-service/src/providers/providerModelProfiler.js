import {
  CAPABILITY_ORDER,
  CHAT_EXCLUSIVE_BLOCKERS,
} from "./providerCatalog.js";

export function normalizeDiscoveredModels(body) {
  const rawModels = Array.isArray(body?.data)
    ? body.data
    : Array.isArray(body?.models)
      ? body.models
      : Array.isArray(body)
        ? body
        : [];

  return dedupeModels(rawModels.map((model) => {
    const id = typeof model === "string" ? model : model?.id ?? model?.name ?? model?.model;
    if (!id) return null;
    const supportedParameters = normalizeStringList(model?.supported_parameters ?? model?.supportedParameters);
    const modalities = extractRawModalities(model);
    return {
      modelId: String(id),
      modelDisplayName: String(model?.displayName ?? model?.display_name ?? model?.name ?? id),
      capabilities: normalizeCapabilityList(model?.capabilities ?? model?.capability),
      modalities,
      supportedParameters,
      source: "provider-models-api",
      metadata: {
        ownedBy: model?.owned_by,
        created: model?.created,
        contextLength: model?.context_length ?? model?.contextLength,
        pricing: model?.pricing,
        architecture: model?.architecture
          ? {
              modality: model.architecture.modality,
              tokenizer: model.architecture.tokenizer,
            }
          : undefined,
      },
    };
  }).filter(Boolean));
}

export function withModelSource(models, source) {
  return (Array.isArray(models) ? models : []).map((model) => ({
    ...model,
    source,
  }));
}

export function rankDiscoveredModels(family, models) {
  return [...models].sort((left, right) => {
    const diff = scoreDiscoveredModel(family, right) - scoreDiscoveredModel(family, left);
    if (diff !== 0) return diff;
    return String(left.modelId).localeCompare(String(right.modelId));
  });
}

export function scoreDiscoveredModel(family, model) {
  const profile = createModelProfile(family, model);
  const id = String(model.modelId ?? "").toLowerCase();
  const defaultModelIds = (family.defaultModels ?? []).map((item) => String(item.modelId ?? "").toLowerCase());
  const defaults = new Set(defaultModelIds);
  const defaultIndex = defaultModelIds.indexOf(id);
  let score = 0;

  if (defaults.has(id)) score += 1_000 + Math.max(0, 400 - defaultIndex * 80);
  if (profile.capabilities.includes("chat")) score += 500;
  if (profile.capabilities.includes("vision")) score += 130;
  if (profile.capabilities.includes("reasoning")) score += 120;
  if (profile.capabilities.includes("coding")) score += 110;
  if (profile.capabilities.includes("tool-use")) score += 70;
  if (profile.capabilities.includes("structured-output")) score += 60;
  if (id.includes("instruct")) score += 180;
  if (id.includes("chat")) score += 160;
  if (id.includes("llama")) score += 130;
  if (id.includes("qwen")) score += 120;
  if (id.includes("deepseek")) score += 110;
  if (id.includes("mistral")) score += 100;
  if (id.includes("kimi")) score += 90;
  if (id.includes("gpt")) score += 85;
  if (id.includes("reason")) score += 70;
  if (id.includes("turbo")) score += 45;
  if (id.includes("mini") || id.includes("small") || id.includes("8b")) score += 20;
  if (!profile.capabilities.includes("chat")) score -= 600;
  return score;
}

export function createModelCandidates({ family, descriptor, modelConfigs, discovery, supportedByRuntime }) {
  const discovered = (discovery.models ?? []).map((model) => createModelCandidate({
    family,
    model,
    source: model.source ?? discovery.source ?? "provider-catalog",
    supportedByRuntime,
  }));

  if (discovered.length) {
    return dedupeModels(discovered);
  }

  const fromDescriptor = (descriptor?.models ?? []).map((model) => createModelCandidate({
    family,
    model: {
      modelId: model.id,
      modelDisplayName: model.displayName ?? model.id,
      capabilities: model.capabilities,
      metadata: model.metadata,
    },
    source: "runtime-descriptor",
    supportedByRuntime,
  }));

  if (fromDescriptor.length) {
    return dedupeModels(fromDescriptor);
  }

  const fromConfig = modelConfigs
    .map((model) => createModelCandidate({
      family,
      model: {
        modelId: model.modelId,
        modelDisplayName: model.modelDisplayName ?? model.modelId,
        capabilities: model.capabilities,
        metadata: model.metadata,
      },
      source: "runtime-config",
      supportedByRuntime,
    }))
    .filter((model) => model.modelId);

  return dedupeModels(fromConfig);
}

export function createModelCandidate({ family, model, source, supportedByRuntime }) {
  const profile = createModelProfile(family, model);
  const execution = createExecutionProfile({ family, profile, supportedByRuntime });
  return {
    providerId: family.providerId,
    modelId: profile.modelId,
    modelDisplayName: profile.modelDisplayName,
    capabilities: profile.capabilities,
    modalities: profile.modalities,
    supportedParameters: profile.supportedParameters,
    execution,
    source,
    metadata: {
      ...(model.metadata ?? {}),
      capabilitySource: profile.capabilitySource,
      executionReason: execution.chatReason,
    },
  };
}

export function createModelProfile(family, model) {
  const modelId = String(model?.modelId ?? model?.id ?? "").trim();
  const modelDisplayName = String(model?.modelDisplayName ?? model?.displayName ?? modelId);
  const supportedParameters = normalizeStringList(model?.supportedParameters ?? model?.supported_parameters);
  const rawModalities = normalizeModalities(model?.modalities);
  const capabilities = inferCapabilities({
    family,
    modelId,
    modelDisplayName,
    explicitCapabilities: model?.capabilities,
    modalities: rawModalities,
    supportedParameters,
  });
  const modalities = rawModalities.input.length || rawModalities.output.length
    ? rawModalities
    : inferModalitiesFromCapabilities(capabilities);

  return {
    modelId,
    modelDisplayName,
    capabilities,
    modalities,
    supportedParameters,
    capabilitySource: normalizeCapabilityList(model?.capabilities).length ? "provider-or-catalog" : "name-and-modality-inference",
  };
}

export function inferCapabilities({ family, modelId, modelDisplayName, explicitCapabilities, modalities, supportedParameters }) {
  const id = `${modelId} ${modelDisplayName}`.toLowerCase();
  const input = new Set(modalities.input.map((item) => item.toLowerCase()));
  const output = new Set(modalities.output.map((item) => item.toLowerCase()));
  const capabilities = new Set(normalizeCapabilityList(explicitCapabilities));

  if (input.has("image") || id.includes("vision") || id.includes("-vl") || id.includes("vl-") || id.includes("pixtral") || id.includes("llava") || id.includes("fuyu")) {
    capabilities.add("vision");
  }
  if (id.includes("coder") || id.includes("coding") || id.includes("codex") || id.includes("code-") || id.includes("devstral") || id.includes("starcoder")) {
    capabilities.add("coding");
  }
  if (id.includes("reason") || /^o[134]/.test(id) || id.includes("r1") || id.includes("thinking")) {
    capabilities.add("reasoning");
  }
  if (id.includes("embedding") || id.includes("embed") || id.includes("bge") || output.has("embedding")) {
    capabilities.add("embedding");
  }
  if (id.includes("rerank") || id.includes("reranker")) {
    capabilities.add("rerank");
  }
  if (id.includes("moderation") || id.includes("safety") || id.includes("guard") || id.includes("detector")) {
    capabilities.add("moderation");
  }
  if (id.includes("whisper") || id.includes("transcribe") || id.includes("asr") || input.has("audio")) {
    capabilities.add("audio-input");
  }
  if (id.includes("tts") || id.includes("speech") || output.has("audio")) {
    capabilities.add("speech-output");
  }
  if (id.includes("dall-e") || id.includes("gpt-image") || id.includes("imagen") || id.includes("flux") || id.includes("stable-diffusion") || id.includes("sdxl") || output.has("image")) {
    capabilities.add("image-generation");
  }
  if (id.includes("sora") || id.includes("veo") || id.includes("wan") || id.includes("video") || output.has("video")) {
    capabilities.add("video-generation");
  }

  const params = supportedParameters.map((item) => item.toLowerCase());
  if (params.some((item) => item.includes("tool") || item.includes("function"))) {
    capabilities.add("tool-use");
  }
  if (params.some((item) => item.includes("response_format") || item.includes("json_schema"))) {
    capabilities.add("structured-output");
  }

  const exclusiveNonChat = Array.from(capabilities).some((capability) => CHAT_EXCLUSIVE_BLOCKERS.has(capability)) &&
    !capabilities.has("vision") &&
    !capabilities.has("coding") &&
    !capabilities.has("reasoning");
  const looksTextChat = !exclusiveNonChat &&
    !id.includes("embedding") &&
    !id.includes("embed") &&
    !id.includes("rerank") &&
    !id.includes("whisper") &&
    !id.includes("transcribe") &&
    !id.includes("tts") &&
    !id.includes("speech") &&
    !id.includes("dall-e") &&
    !id.includes("imagen") &&
    !id.includes("video") &&
    !id.includes("sora") &&
    !id.includes("veo") &&
    !output.has("image") &&
    !output.has("video") &&
    !output.has("audio") &&
    !output.has("embedding");

  if (looksTextChat || output.has("text")) {
    capabilities.add("chat");
    capabilities.add("summary");
  }

  if (family.family === "local-fake") {
    capabilities.add("chat");
    capabilities.add("summary");
  }

  return sortCapabilities(Array.from(capabilities));
}

export function createExecutionProfile({ family, profile, supportedByRuntime }) {
  const hasChat = profile.capabilities.includes("chat");
  const providerChatWired = family.availableForChat === true;
  const executable = providerChatWired && supportedByRuntime && hasChat;
  const blockedReason = !hasChat
    ? "model-is-not-a-chat-model"
    : !providerChatWired
      ? "provider-recognized-but-chat-adapter-not-wired"
      : !supportedByRuntime
        ? "provider-not-registered-in-current-runtime"
        : "chat-executable";

  return {
    chat: executable,
    chatReason: blockedReason,
    currentRuntime: executable ? "current-chat-lane" : "recognized-only",
    executableCapabilities: executable ? ["chat"] : [],
    recognizedOnlyCapabilities: profile.capabilities.filter((capability) => !executable || capability !== "chat"),
  };
}

export function inferModalitiesFromCapabilities(capabilities) {
  const caps = new Set(capabilities);
  const input = new Set(["text"]);
  const output = new Set();

  if (caps.has("vision")) input.add("image");
  if (caps.has("audio-input")) input.add("audio");
  if (caps.has("chat") || caps.has("summary") || caps.has("rerank") || caps.has("audio-input")) output.add("text");
  if (caps.has("image-generation")) output.add("image");
  if (caps.has("speech-output")) output.add("audio");
  if (caps.has("video-generation")) output.add("video");
  if (caps.has("embedding")) output.add("embedding");

  return {
    input: Array.from(input),
    output: output.size ? Array.from(output) : ["text"],
  };
}

export function extractRawModalities(model) {
  const architecture = model?.architecture && typeof model.architecture === "object" ? model.architecture : {};
  const modalities = model?.modalities && typeof model.modalities === "object" ? model.modalities : {};
  return normalizeModalities({
    input: model?.input_modalities ?? model?.inputModalities ?? architecture.input_modalities ?? architecture.inputModalities ?? modalities.input,
    output: model?.output_modalities ?? model?.outputModalities ?? architecture.output_modalities ?? architecture.outputModalities ?? modalities.output,
  });
}

export function normalizeModalities(value) {
  if (!value) return { input: [], output: [] };
  if (Array.isArray(value)) {
    return { input: normalizeStringList(value), output: [] };
  }
  return {
    input: normalizeStringList(value.input ?? value.inputs ?? value.input_modalities ?? value.inputModalities),
    output: normalizeStringList(value.output ?? value.outputs ?? value.output_modalities ?? value.outputModalities),
  };
}

export function normalizeCapabilityList(value) {
  const aliases = {
    audio: "audio-input",
    speech: "speech-output",
    image: "image-generation",
    video: "video-generation",
    "image_generation": "image-generation",
    "video_generation": "video-generation",
    "audio_input": "audio-input",
    "speech_output": "speech-output",
    "tool": "tool-use",
    "tool_use": "tool-use",
    "structured_output": "structured-output",
  };
  return sortCapabilities(normalizeStringList(value).map((item) => aliases[item] ?? item));
}

export function normalizeStringList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  return Array.from(new Set(source.map((item) => String(item ?? "").trim().toLowerCase()).filter(Boolean)));
}

export function sortCapabilities(capabilities) {
  const unique = Array.from(new Set((Array.isArray(capabilities) ? capabilities : []).filter(Boolean)));
  return unique.sort((left, right) => {
    const leftIndex = CAPABILITY_ORDER.indexOf(left);
    const rightIndex = CAPABILITY_ORDER.indexOf(right);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }
    return left.localeCompare(right);
  });
}
