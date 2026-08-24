// =============================================================================
// geminiAdapter.ts — Google Gemini generateContent API native adapter
// Implements the Gemini v1beta generateContent / streamGenerateContent (SSE)
// surface. Real calls stay behind the same three-gate real-provider whitelist
// as every other adapter; the credential-free fake provider remains default.
// =============================================================================

import { assertProviderAdapter } from "./providerAdapter.js";
import { fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";
import { inspectInlineImageDataUrl } from "@unified-ai-system/shared-utils";

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_API_VERSION = "v1beta";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

interface GeminiModelConfig {
  providerId?: string;
  providerDisplayName?: string;
  apiKey?: string;
  endpoint?: string;
  models?: unknown[];
  priority?: number;
}

interface GeminiAdapterOptions {
  timeoutMs?: number;
  runtimeCredentialStore?: {
    getCredential(providerId: string): { apiKey?: string } | null | Promise<{ apiKey?: string } | null>;
  } | null;
  baseUrl?: string;
}

interface ProviderRequestLike {
  request: {
    messages?: Array<{ role: string; content: unknown }>;
    options?: Record<string, unknown>;
  };
  target?: { providerId?: string; modelId?: string };
  execution?: { signal?: AbortSignal };
}

export function createGeminiAdapter(modelConfig: GeminiModelConfig = {}, options: GeminiAdapterOptions = {}) {
  const providerId = modelConfig.providerId ?? "gemini";
  const providerDisplayName = modelConfig.providerDisplayName ?? "Google Gemini";
  const baseUrl = (modelConfig.endpoint ?? options.baseUrl ?? DEFAULT_GEMINI_BASE_URL).replace(/\/+$/, "");
  const apiVersion = DEFAULT_API_VERSION;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runtimeCredentialStore = options.runtimeCredentialStore ?? null;

  const descriptor = {
    id: providerId,
    displayName: providerDisplayName,
    kind: "llm",
    models: (modelConfig.models ?? []).map((m) => normalizeModel(m)),
    priority: modelConfig.priority ?? 100,
    health: { status: "unknown" },
    metadata: {
      providerType: "gemini",
      endpoint: baseUrl,
      apiVersion,
    },
  };

  const adapter = {
    descriptor,
    async generate(providerRequest: ProviderRequestLike) {
      const { request, target } = providerRequest;
      const modelId = target?.modelId ?? descriptor.models[0]?.id ?? "gemini-2.5-pro";

      const apiKey = await resolveApiKey(providerId, modelConfig, runtimeCredentialStore);
      if (!apiKey) {
        throw createGeminiError(
          `Gemini adapter requires an API key for provider "${providerId}".`,
          "GEMINI_API_KEY_MISSING",
          false,
        );
      }

      const geminiRequest = mapToGeminiRequest(request, modelId);
      const startTime = Date.now();
      const geminiResponse = await callGeminiApi({
        baseUrl,
        apiVersion,
        apiKey,
        modelId,
        body: geminiRequest,
        timeoutMs,
        stream: false,
      });
      const latencyMs = Date.now() - startTime;

      return mapFromGeminiResponse(geminiResponse, latencyMs, target);
    },

    async *generateStream(providerRequest: ProviderRequestLike) {
      const { request, target, execution } = providerRequest;
      const modelId = target?.modelId ?? descriptor.models[0]?.id ?? "gemini-2.5-pro";

      const apiKey = await resolveApiKey(providerId, modelConfig, runtimeCredentialStore);
      if (!apiKey) {
        throw createGeminiError(
          `Gemini adapter requires an API key for provider "${providerId}".`,
          "GEMINI_API_KEY_MISSING",
          false,
        );
      }

      const geminiRequest = mapToGeminiRequest(request, modelId);

      yield* streamGeminiApi({
        baseUrl,
        apiVersion,
        apiKey,
        modelId,
        body: geminiRequest,
        timeoutMs,
        signal: execution?.signal,
      });
    },
  };

  assertProviderAdapter(adapter);
  return adapter;
}

// ── Request mapping: GatewayRequest → Gemini generateContent ──

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export function mapToGeminiRequest(
  request: { messages?: Array<{ role: string; content: unknown }>; options?: Record<string, unknown> },
  modelId: string,
): Record<string, unknown> {
  const messages = request.messages ?? [];
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  // Gemini takes the system prompt as a top-level systemInstruction, not a turn.
  const systemText = systemMessages
    .map((m) => extractText(m.content))
    .filter(Boolean)
    .join("\n\n");

  const contents: GeminiContent[] = nonSystemMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: mapToGeminiParts(m.content),
  }));

  const options = request.options ?? {};
  const generationConfig: Record<string, unknown> = {};
  const maxOutputTokens = options.maxOutputTokens ?? options.max_tokens;
  if (maxOutputTokens != null) generationConfig.maxOutputTokens = maxOutputTokens;
  if (options.temperature != null) generationConfig.temperature = options.temperature;
  if (options.topP != null) generationConfig.topP = options.topP;
  if (options.stop) {
    generationConfig.stopSequences = Array.isArray(options.stop) ? options.stop : [options.stop];
  }

  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  };
}

function mapToGeminiParts(content: unknown): GeminiPart[] {
  if (typeof content === "string") return content ? [{ text: content }] : [];
  if (!Array.isArray(content)) return [];
  const parts: GeminiPart[] = [];
  for (const part of content) {
    if (part?.type === "text" && part.text) {
      parts.push({ text: part.text });
    } else if (part?.type === "image_url") {
      const inspected = inspectInlineImageDataUrl(part.image_url?.url);
      parts.push({
        inlineData: {
          mimeType: inspected.mediaType,
          data: inspected.base64Data,
        },
      });
    }
  }
  return parts;
}

// ── Response mapping: Gemini → ProviderResponse ──

function mapFromGeminiResponse(geminiResponse: Record<string, any>, latencyMs: number, _target: unknown) {
  const promptFeedback = geminiResponse?.promptFeedback;
  if (promptFeedback?.blockReason) {
    throw createGeminiError(
      `Gemini blocked the prompt: ${redactApiKey(String(promptFeedback.blockReason))}`,
      "GEMINI_CONTENT_BLOCKED",
      false,
      400,
    );
  }

  const candidate = geminiResponse?.candidates?.[0] ?? {};
  const text = (candidate?.content?.parts ?? [])
    .map((part: GeminiPart) => part?.text ?? "")
    .join("");

  const usage = geminiResponse?.usageMetadata ?? {};
  const inputTokens = Number(usage.promptTokenCount ?? 0);
  const outputTokens = Number(usage.candidatesTokenCount ?? 0);
  const finishReason = candidate?.finishReason ? mapFinishReason(candidate.finishReason) : undefined;

  return {
    text,
    message: {
      role: "assistant",
      content: text,
    },
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: Number(usage.totalTokenCount ?? inputTokens + outputTokens),
    },
    latencyMs,
    executionStatus: "success",
    warnings: [],
    raw: geminiResponse,
    ...(finishReason ? { finishReason } : {}),
  };
}

// ── API call ──

async function callGeminiApi(params: {
  baseUrl: string;
  apiVersion: string;
  apiKey: string;
  modelId: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  stream: boolean;
}): Promise<Record<string, any>> {
  const { baseUrl, apiVersion, apiKey, modelId, body, timeoutMs, stream } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Gemini API request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const method = stream ? "streamGenerateContent" : "generateContent";
    // The key travels in a header, never in the URL query string, so it cannot
    // leak into access logs or error messages that echo the request URL.
    const destination = await resolveSafeOutboundUrl(
      `${baseUrl}/${apiVersion}/models/${encodeURIComponent(modelId)}:${method}${stream ? "?alt=sse" : ""}`,
    );
    const response = await fetchWithAgent(destination.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      lookup: destination.lookup,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw createGeminiHttpError(response.status, responseText);
    }

    return JSON.parse(responseText);
  } catch (error) {
    throw normalizeGeminiTransportError(error, timeoutMs);
  } finally {
    clearTimeout(timeout);
  }
}

// ── Streaming: Gemini streamGenerateContent SSE → provider chunks ──
//
// Emits { textDelta, raw } chunks. The final chunk carries finishReason and
// usage in `raw` so the gateway's done event exposes them as rawProviderMeta.

async function* streamGeminiApi(params: {
  baseUrl: string;
  apiVersion: string;
  apiKey: string;
  modelId: string;
  body: Record<string, unknown>;
  timeoutMs: number;
  signal?: AbortSignal;
}) {
  const { baseUrl, apiVersion, apiKey, modelId, body, timeoutMs, signal } = params;
  const controller = new AbortController();
  // Inactivity bound, not a whole-request bound: every received frame refreshes
  // it so legitimate long generations are not cut.
  let timeout = setTimeout(() => {
    controller.abort(new Error(`Gemini API stream stalled for ${timeoutMs}ms`));
  }, timeoutMs);
  const refreshTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      controller.abort(new Error(`Gemini API stream stalled for ${timeoutMs}ms`));
    }, timeoutMs);
  };
  const onExternalAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  let inputTokens = 0;
  let outputTokens = 0;
  let finishReason: string | undefined;
  let sawUsage = false;

  const emitFinalChunk = () => ({
    textDelta: "",
    raw: {
      gemini: true,
      ...(finishReason ? { finishReason } : {}),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    },
  });

  try {
    const method = "streamGenerateContent";
    const destination = await resolveSafeOutboundUrl(
      `${baseUrl}/${apiVersion}/models/${encodeURIComponent(modelId)}:${method}?alt=sse`,
    );
    const response = await fetchWithAgent(destination.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      lookup: destination.lookup,
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw createGeminiHttpError(response.status, responseText);
    }
    if (!response.body) {
      throw createGeminiError(
        "Gemini API returned a streaming response without a body.",
        "GEMINI_STREAM_BODY_MISSING",
        true,
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    for await (const rawChunk of response.body) {
      refreshTimeout();
      buffer += decoder.decode(rawChunk, { stream: true });

      let frameSeparator = buffer.indexOf("\n\n");
      while (frameSeparator >= 0) {
        const frame = buffer.slice(0, frameSeparator);
        buffer = buffer.slice(frameSeparator + 2);
        frameSeparator = buffer.indexOf("\n\n");

        const event = parseGeminiSseFrame(frame);
        if (!event) continue;

        if (event.error) {
          throw createGeminiError(
            `Gemini API stream error: ${redactApiKey(String(event.error?.message ?? "unknown stream error").slice(0, 500))}`,
            "GEMINI_STREAM_ERROR",
            event.error?.status === "UNAVAILABLE",
          );
        }

        const blockReason = event?.promptFeedback?.blockReason;
        if (blockReason) {
          throw createGeminiError(
            `Gemini blocked the prompt mid-stream: ${redactApiKey(String(blockReason))}`,
            "GEMINI_CONTENT_BLOCKED",
            false,
            400,
          );
        }

        const candidate = event?.candidates?.[0];
        if (candidate?.finishReason) {
          finishReason = mapFinishReason(candidate.finishReason);
        }
        const usage = event?.usageMetadata;
        if (usage) {
          sawUsage = true;
          inputTokens = Number(usage.promptTokenCount ?? inputTokens);
          outputTokens = Number(usage.candidatesTokenCount ?? outputTokens);
        }

        const textDelta = (candidate?.content?.parts ?? [])
          .map((part: GeminiPart) => part?.text ?? "")
          .join("");
        if (textDelta) {
          yield { textDelta, raw: { gemini: true } };
        }

        if (finishReason && sawUsage) {
          yield emitFinalChunk();
          return;
        }
      }
    }

    // Stream ended without an explicit terminal frame (connection cut or
    // Gemini omitted usage): surface what we captured so the done event still
    // carries usage and finish reason.
    yield emitFinalChunk();
  } catch (error) {
    throw normalizeGeminiTransportError(error, timeoutMs);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

function parseGeminiSseFrame(frame: string): Record<string, any> | null {
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!dataLines.length) return null;
  try {
    return JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
}

// ── Errors and helpers ──

function createGeminiError(message: string, code: string, retryable: boolean, statusCode?: number): Error & {
  code: string;
  category: string;
  retryable: boolean;
  statusCode?: number;
} {
  const error = new Error(message) as Error & {
    code: string;
    category: string;
    retryable: boolean;
    statusCode?: number;
  };
  error.code = code;
  error.category = "provider";
  error.retryable = retryable;
  if (statusCode != null) error.statusCode = statusCode;
  return error;
}

function createGeminiHttpError(status: number, responseText: string) {
  return createGeminiError(
    `Gemini API returned ${status}: ${redactApiKey(String(responseText).slice(0, 500))}`,
    `GEMINI_API_${status}`,
    status >= 500 || status === 429,
    status,
  );
}

function normalizeGeminiTransportError(error: unknown, timeoutMs: number): unknown {
  if (error instanceof Error && (error.name === "AbortError" || (error as any).code === "ABORT_ERR")) {
    return createGeminiError(
      `Gemini API request timed out after ${timeoutMs}ms`,
      "GEMINI_API_TIMEOUT",
      true,
    );
  }
  return error;
}

async function resolveApiKey(
  providerId: string,
  modelConfig: GeminiModelConfig,
  runtimeCredentialStore: GeminiAdapterOptions["runtimeCredentialStore"],
): Promise<string | null> {
  // 1. Static config
  if (modelConfig.apiKey) return modelConfig.apiKey;

  // 2. Runtime credential store
  if (runtimeCredentialStore && typeof runtimeCredentialStore.getCredential === "function") {
    const credential = await runtimeCredentialStore.getCredential(providerId);
    if (credential?.apiKey) return credential.apiKey;
  }

  // 3. Environment variable fallback
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text" || typeof part === "string")
      .map((part) => (typeof part === "string" ? part : part.text))
      .join("");
  }
  return "";
}

function mapFinishReason(reason: string): string {
  const mapping: Record<string, string> = {
    STOP: "stop",
    MAX_TOKENS: "length",
    SAFETY: "content_filter",
    PROHIBITED_CONTENT: "content_filter",
    RECITATION: "content_filter",
    BLOCKLIST: "content_filter",
    SPII: "content_filter",
    OTHER: "stop",
    FINISH_REASON_UNSPECIFIED: "stop",
  };
  return mapping[reason] ?? reason;
}

interface NormalizedGeminiModel {
  id: string;
  displayName: string;
  enabled: boolean;
  capabilities: string[];
  priority?: number;
  costTier?: string;
  latencyTier?: string;
}

function normalizeModel(model: unknown): NormalizedGeminiModel {
  if (typeof model === "string") {
    return { id: model, displayName: model, enabled: true, capabilities: ["chat"] };
  }
  const m = (model ?? {}) as Record<string, unknown>;
  const id = typeof m.id === "string" ? m.id : typeof m.modelId === "string" ? m.modelId : "";
  const displayName = typeof m.displayName === "string"
    ? m.displayName
    : typeof m.modelDisplayName === "string"
      ? m.modelDisplayName
      : id;
  return {
    id,
    displayName,
    enabled: m.enabled !== false,
    capabilities: Array.isArray(m.capabilities)
      ? m.capabilities.filter((value): value is string => typeof value === "string")
      : ["chat"],
    ...(typeof m.priority === "number" ? { priority: m.priority } : {}),
    ...(typeof m.costTier === "string" ? { costTier: m.costTier } : {}),
    ...(typeof m.latencyTier === "string" ? { latencyTier: m.latencyTier } : {}),
  };
}

function redactApiKey(text: string): string {
  return text.replace(/AIza[0-9A-Za-z_-]{10,}/g, "AIza****redacted");
}
