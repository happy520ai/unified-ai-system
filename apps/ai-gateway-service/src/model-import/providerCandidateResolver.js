/**
 * Provider candidate resolver — determines which providers to probe based on
 * an API key prefix, explicit hint, or base URL.
 *
 * Extracted from providerProbeRegistry.js to keep that module under 500 lines.
 */

import { PROVIDER_PROBES } from "./providerProbeCatalog.js";
import { cleanSecretValue } from "../security/secretSafety.js";

function normalizeBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function createCandidate(providerId, options = {}) {
  const config = PROVIDER_PROBES[providerId] ?? {};
  const baseUrl = normalizeBaseUrl(options.baseUrl || config.baseUrl);
  return {
    providerId,
    providerDisplayName: config.displayName ?? providerId,
    providerGroup: config.providerGroup ?? providerId,
    baseUrl,
    requiresBaseUrl: Boolean(config.requiresBaseUrl && !baseUrl),
  };
}

function createHintCandidates(hint, baseUrl) {
  if (PROVIDER_PROBES[hint]) {
    return [createCandidate(hint, { baseUrl })];
  }

  if (hint === "openai_compatible" || hint === "compatible" || hint === "generic-openai-compatible") {
    return [createCandidate("openai-compatible", { baseUrl })];
  }

  return [];
}

function createOpenAiStyleCandidates() {
  return [
    createCandidate("openai"),
    createCandidate("dashscope"),
    createCandidate("deepseek"),
    createCandidate("together"),
    createCandidate("mistral"),
    createCandidate("moonshot"),
    createCandidate("siliconflow"),
    createCandidate("tencent-hunyuan"),
    createCandidate("zhipu"),
    createCandidate("xunfei-spark"),
    createCandidate("qianfan"),
    createCandidate("modelscope"),
    createCandidate("cohere"),
    createCandidate("volcengine-doubao"),
    createCandidate("minimax"),
    createCandidate("stepfun"),
    createCandidate("novita"),
    createCandidate("baichuan"),
    createCandidate("yi"),
    createCandidate("infini-ai"),
  ];
}

export function resolveProviderCandidates({ apiKey, providerHint = "auto", baseUrl } = {}) {
  const clean = cleanSecretValue(apiKey);
  const hint = String(providerHint ?? "auto").trim().toLowerCase();
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (!clean) {
    return [];
  }

  if (hint && hint !== "auto") {
    return createHintCandidates(hint, normalizedBaseUrl);
  }

  if (normalizedBaseUrl) {
    return [createCandidate("openai-compatible", { baseUrl: normalizedBaseUrl })];
  }

  if (clean.startsWith("nvapi-")) {
    return [createCandidate("nvidia")];
  }

  if (clean.startsWith("sk-or-v1-")) {
    return [createCandidate("openrouter")];
  }

  if (clean.startsWith("gsk_")) {
    return [createCandidate("groq")];
  }

  if (clean.startsWith("xai-")) {
    return [createCandidate("xai")];
  }

  if (clean.startsWith("csk-")) {
    return [createCandidate("cerebras")];
  }

  if (clean.startsWith("pplx-")) {
    return [createCandidate("perplexity")];
  }

  if (clean.startsWith("fw_")) {
    return [createCandidate("fireworks")];
  }

  if (clean.startsWith("ms-")) {
    return [createCandidate("modelscope")];
  }

  if (clean.startsWith("bce-v3/")) {
    return [createCandidate("qianfan")];
  }

  if (clean.startsWith("sk-ant-")) {
    return [createCandidate("anthropic")];
  }

  if (clean.startsWith("hf_")) {
    return [createCandidate("huggingface")];
  }

  if (clean.startsWith("AIza")) {
    return [createCandidate("gemini")];
  }

  if (clean.startsWith("sk-")) {
    const candidates = createOpenAiStyleCandidates();
    candidates.push(createCandidate("openai-compatible", { baseUrl: normalizedBaseUrl }));
    return candidates;
  }

  return [];
}
