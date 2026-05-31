import { createRequestId } from "../../../../../packages/shared-utils/src/index.js";
import { ENDPOINT_TYPES, isDirectChatCapable } from "../../model-library/modelCapabilityRules.js";
import { findModel } from "../../model-library/unifiedModelRegistry.js";

const DEFAULT_INTEGRATE_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_RETRIEVAL_BASE_URL = "https://ai.api.nvidia.com/v1";

export function createNvidiaUnifiedClient({ env = process.env, runtimeCredentialStore, modelLibraryStore, fetchImpl = globalThis.fetch, timeoutMs = 60_000 } = {}) {
  function resolveApiKey() {
    return runtimeCredentialStore?.getApiKey?.("nvidia") || env.NVIDIA_API_KEY || "";
  }

  function resolveBaseUrl(endpointType) {
    if (endpointType === ENDPOINT_TYPES.rerank) {
      return String(env.NVIDIA_RETRIEVAL_BASE_URL || DEFAULT_RETRIEVAL_BASE_URL).replace(/\/+$/, "");
    }
    return String(runtimeCredentialStore?.getEndpoint?.("nvidia") || env.NVIDIA_BASE_URL || DEFAULT_INTEGRATE_BASE_URL).replace(/\/+$/, "");
  }

  function getRegistry() {
    return modelLibraryStore?.getRegistry?.();
  }

  async function chatCompletion({ modelId, messages, prompt, maxTokens = 64, temperature = 0, capability = "chat_general" } = {}) {
    const normalizedMessages = Array.isArray(messages) && messages.length
      ? messages
      : [{ role: "user", content: String(prompt ?? "Hello") }];
    return callNvidia({
      modelId,
      expectedEndpointType: endpointTypeForCapability(capability, ENDPOINT_TYPES.chat),
      payload: {
        model: modelId,
        messages: normalizedMessages.map((message) => ({
          role: message.role === "assistant" || message.role === "system" ? message.role : "user",
          content: String(message.content ?? ""),
        })),
        temperature,
        max_tokens: maxTokens,
        stream: false,
      },
      outputMapper: mapChatOutput,
    });
  }

  async function embeddings({ modelId, input = "phase312a embedding smoke", inputType = "query" } = {}) {
    return callNvidia({
      modelId,
      expectedEndpointType: ENDPOINT_TYPES.embeddings,
      payload: {
        model: modelId,
        input,
        input_type: inputType,
        encoding_format: "float",
        truncate: "NONE",
      },
      outputMapper: mapEmbeddingOutput,
    });
  }

  async function rerank({ modelId, query = "What is Phase312A?", passages = ["Phase312A validates NVIDIA models.", "Bananas are yellow."] } = {}) {
    return callNvidia({
      modelId,
      expectedEndpointType: ENDPOINT_TYPES.rerank,
      payload: {
        model: modelId,
        query: { text: query },
        passages: passages.map((text) => ({ text: String(text) })),
        truncate: "END",
      },
      outputMapper: mapRerankOutput,
    });
  }

  async function safety({ modelId, text = "This is a harmless provider smoke test." } = {}) {
    return chatCompletion({
      modelId,
      capability: "safety",
      messages: [{ role: "user", content: text }],
      maxTokens: 96,
    });
  }

  async function piiDetection({ modelId, text = "Contact Jane Doe at jane@example.com for the harmless test." } = {}) {
    return callNvidia({
      modelId,
      expectedEndpointType: ENDPOINT_TYPES.pii,
      payload: {
        model: modelId,
        messages: [{ role: "user", content: text }],
        threshold: 0.3,
        stream: false,
      },
      outputMapper: mapChatOutput,
    });
  }

  async function translation({ modelId, text = "Hello world.", targetLanguage = "Chinese" } = {}) {
    return chatCompletion({
      modelId,
      capability: "translation",
      messages: [{ role: "user", content: `Translate to ${targetLanguage}: ${text}` }],
      maxTokens: 96,
    });
  }

  async function callNvidia({ modelId, expectedEndpointType, payload, outputMapper }) {
    const startedAt = Date.now();
    const requestId = createRequestId("phase312a_nvidia");
    const registry = getRegistry();
    const model = findModel(registry, "nvidia", modelId);
    const baseMeta = {
      providerId: "nvidia",
      modelId,
      endpointType: expectedEndpointType,
      providerCalled: false,
      modelCalled: null,
      requestId,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: null,
      durationMs: 0,
      providerTimeoutMs: timeoutMs,
      timeoutHit: false,
      timeoutType: "none",
      lateResponseReceived: false,
      httpStatus: null,
      realExternalCall: false,
      fallbackUsed: false,
      invalidProviderCalled: false,
    };

    if (!model) {
      return envelope({
        success: false,
        code: "model_not_in_library",
        message: "Blocked before provider call: modelId is not present in the unified model library.",
        meta: withTiming(baseMeta, startedAt),
      });
    }

    const compatibility = validateEndpointCompatibility(model, expectedEndpointType);
    if (!compatibility.ok) {
      return envelope({
        success: false,
        code: compatibility.code,
        message: compatibility.message,
        error: compatibility,
        data: { model },
        meta: withTiming(baseMeta, startedAt, { endpointType: model.endpointType }),
      });
    }

    const apiKey = resolveApiKey();
    if (!apiKey) {
      return envelope({
        success: false,
        code: "nvidia_api_key_missing",
        message: "Blocked before provider call: NVIDIA_API_KEY is not configured.",
        meta: withTiming(baseMeta, startedAt, { endpointType: model.endpointType }),
      });
    }

    if (typeof fetchImpl !== "function") {
      return envelope({
        success: false,
        code: "fetch_unavailable",
        message: "Blocked before provider call: fetch is not available in this runtime.",
        meta: withTiming(baseMeta, startedAt, { endpointType: model.endpointType }),
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const baseUrl = resolveBaseUrl(model.endpointType);
    const endpointPath = model.endpointPath || endpointPathForModel(model);

    try {
      const response = await fetchImpl(`${baseUrl}${endpointPath}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await readJsonResponse(response);
      const mapped = outputMapper(body, response);
      const success = response.ok && mapped.completed;
      return envelope({
        success,
        code: success ? "nvidia_call_ok" : statusCodeToCode(response.status),
        message: success ? "NVIDIA call completed and returned usable data." : `NVIDIA call did not complete successfully (HTTP ${response.status}).`,
        data: {
          ...mapped.data,
          httpStatus: response.status,
        },
        error: success
          ? null
          : {
              code: statusCodeToCode(response.status),
              message: redactSecrets(body?.error?.message ?? body?.rawText ?? `HTTP ${response.status}`),
            },
        meta: {
          ...withTiming(baseMeta, startedAt, {
            endpointType: model.endpointType,
            providerCalled: true,
            modelCalled: payload.model,
            httpStatus: response.status,
            realExternalCall: true,
          }),
        },
      });
    } catch (error) {
      const timeoutHit = error?.name === "AbortError";
      return envelope({
        success: false,
        code: timeoutHit ? "nvidia_request_timeout" : "nvidia_request_failed",
        message: redactSecrets(error instanceof Error ? error.message : "NVIDIA request failed."),
        error: {
          code: timeoutHit ? "nvidia_request_timeout" : "nvidia_request_failed",
          message: redactSecrets(error instanceof Error ? error.message : String(error)),
        },
        meta: {
          ...withTiming(baseMeta, startedAt, {
            endpointType: model.endpointType,
            providerCalled: true,
            modelCalled: payload.model,
            realExternalCall: true,
            timeoutHit,
            timeoutType: timeoutHit ? "client_timeout" : "none",
          }),
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    chatCompletion,
    embeddings,
    rerank,
    safety,
    piiDetection,
    translation,
    callNvidia,
  };
}

function withTiming(baseMeta, startedAt, extra = {}) {
  const completedAt = Date.now();
  return {
    ...baseMeta,
    ...extra,
    completedAt: new Date(completedAt).toISOString(),
    durationMs: completedAt - startedAt,
  };
}

function endpointTypeForCapability(capability, fallback) {
  if (capability === "safety") return ENDPOINT_TYPES.safety;
  if (capability === "pii_detection") return ENDPOINT_TYPES.pii;
  if (capability === "translation") return ENDPOINT_TYPES.translation;
  return fallback;
}

function validateEndpointCompatibility(model, expectedEndpointType) {
  if (model.downloadableOnly || model.endpointType === ENDPOINT_TYPES.downloadableOnly) {
    return {
      ok: false,
      code: "downloadable_only_blocked",
      message: "Downloadable-only models cannot be called as hosted NVIDIA API models.",
    };
  }

  if (model.requiresSpecialPayload && [ENDPOINT_TYPES.multimodal, ENDPOINT_TYPES.voice, ENDPOINT_TYPES.video, ENDPOINT_TYPES.hostedSpecialized].includes(model.endpointType)) {
    return {
      ok: false,
      code: "special_payload_not_enabled",
      message: "This model requires a specialized payload and is visible as a task tool only; it cannot be called through the generic chat route.",
    };
  }

  const allowed = new Set([model.endpointType]);
  if (isDirectChatCapable(model.capabilities) && model.endpointType === ENDPOINT_TYPES.chat) {
    allowed.add(ENDPOINT_TYPES.chat);
  }
  if (model.endpointType === ENDPOINT_TYPES.safety) allowed.add(ENDPOINT_TYPES.safety);
  if (model.endpointType === ENDPOINT_TYPES.translation) allowed.add(ENDPOINT_TYPES.translation);
  if (!allowed.has(expectedEndpointType)) {
    return {
      ok: false,
      code: "endpoint_type_mismatch",
      message: `Model endpointType=${model.endpointType} does not match requested endpointType=${expectedEndpointType}.`,
    };
  }
  return { ok: true };
}

function endpointPathForModel(model) {
  if (model.endpointType === ENDPOINT_TYPES.rerank) return "/retrieval/nvidia/reranking";
  if (model.endpointType === ENDPOINT_TYPES.embeddings) return "/embeddings";
  return "/chat/completions";
}

function mapChatOutput(body) {
  const outputText = String(body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.text ?? "").trim();
  return {
    completed: outputText.length > 0,
    data: {
      outputText,
      text: outputText,
      finishReason: body?.choices?.[0]?.finish_reason ?? null,
      usage: body?.usage ?? null,
      rawModel: body?.model ?? null,
    },
  };
}

function mapEmbeddingOutput(body) {
  const embedding = body?.data?.[0]?.embedding;
  return {
    completed: Array.isArray(embedding) && embedding.length > 0,
    data: {
      vectorLength: Array.isArray(embedding) ? embedding.length : 0,
      embeddingReturned: Array.isArray(embedding) && embedding.length > 0,
      rawModel: body?.model ?? null,
    },
  };
}

function mapRerankOutput(body) {
  const rankings = Array.isArray(body?.rankings) ? body.rankings : Array.isArray(body?.data) ? body.data : [];
  return {
    completed: rankings.length > 0 || Array.isArray(body?.results),
    data: {
      rankingCount: rankings.length || (Array.isArray(body?.results) ? body.results.length : 0),
      rankings,
    },
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function envelope({ success, code, message, data = null, error = null, meta }) {
  return {
    success: Boolean(success),
    code,
    message,
    data,
    error,
    meta,
  };
}

function statusCodeToCode(status) {
  if (status === 401) return "nvidia_unauthorized";
  if (status === 403) return "nvidia_forbidden";
  if (status === 429) return "nvidia_rate_limited";
  if (status === 402) return "nvidia_payment_required";
  if (status >= 500) return "nvidia_server_error";
  return "nvidia_http_error";
}

function redactSecrets(text) {
  return String(text)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/\b(nvapi|sk|pk|ak|sk-proj)[A-Za-z0-9._-]{8,}\b/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}
