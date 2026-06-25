// src/providers/multimodalNormalize.js
// Response normalization helpers for the multimodal provider adapter.

export function normalizeImageResponse(data, { model, provider }) {
  const rawImages = Array.isArray(data?.data) ? data.data : [];
  const images = rawImages.map((item) => ({
    url: item.url ?? null,
    b64_json: item.b64_json ?? null,
    revised_prompt: item.revised_prompt ?? null,
  }));

  return {
    success: true,
    data: {
      images,
      model,
      provider,
      usage: { images: images.length },
    },
  };
}

export function normalizeDashscopeImageResult(data, { model }) {
  const results = Array.isArray(data?.output?.results) ? data.output.results : [];
  const images = results.map((item) => ({
    url: item.url ?? item.b64_image ?? null,
    b64_json: item.b64_image ?? null,
    revised_prompt: item.actual_prompt ?? null,
  }));

  return {
    success: true,
    data: {
      images,
      model,
      provider: "dashscope",
      usage: { images: images.length },
    },
  };
}

export function normalizeDashscopeDirectResult(data, { model }) {
  const results = Array.isArray(data?.output?.results) ? data.output.results : [];
  const images = results.map((item) => ({
    url: item.url ?? null,
    b64_json: item.b64_json ?? null,
    revised_prompt: item.actual_prompt ?? null,
  }));

  return {
    success: true,
    data: {
      images,
      model,
      provider: "dashscope",
      usage: { images: images.length },
    },
  };
}

export function normalizeGeminiImageResult(data, { model, responseFormat }) {
  const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
  const images = predictions.map((item) => ({
    url: item?.bytesBase64Encoded && responseFormat !== "url" ? null : (item?.raiFilteredReason ?? null),
    b64_json: item?.bytesBase64Encoded ?? null,
    revised_prompt: null,
  }));

  return {
    success: true,
    data: {
      images,
      model,
      provider: "gemini",
      usage: { images: images.length },
    },
  };
}

export function normalizeOpenaiEmbeddingResult(data, { model, provider }) {
  const rawData = Array.isArray(data?.data) ? data.data : [];
  const embeddings = rawData
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => Array.isArray(item.embedding) ? item.embedding : []);

  const usage = data?.usage;
  return {
    success: true,
    data: {
      embeddings,
      model,
      provider,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
      },
    },
  };
}

export function normalizeSttResult(data, { model, provider }) {
  // OpenAI whisper returns { text: "..." } in json mode
  const text = typeof data === "string" ? data : (data?.text ?? "");
  return {
    success: true,
    data: {
      text,
      model,
      provider,
      language: data?.language ?? null,
      duration: data?.duration ?? null,
    },
  };
}
