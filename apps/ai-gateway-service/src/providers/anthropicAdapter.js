// =============================================================================
// anthropicAdapter.js — Anthropic Messages API native adapter
// Implements the Anthropic Messages API format (not OpenAI-compatible).
// =============================================================================

import { assertProviderAdapter } from "./providerAdapter.js";
import { fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";
import { inspectInlineImageDataUrl } from "@unified-ai-system/shared-utils";

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Create an Anthropic native provider adapter.
 * @param {Object} modelConfig - { providerId, apiKey, endpoint, models, priority, ... }
 * @param {Object} options - { timeoutMs, runtimeCredentialStore, ... }
 * @returns {Object} Provider adapter { descriptor, generate, generateStream? }
 */
export function createAnthropicAdapter(modelConfig = {}, options = {}) {
  const providerId = modelConfig.providerId ?? "anthropic";
  const providerDisplayName = modelConfig.providerDisplayName ?? "Anthropic";
  const baseUrl = (modelConfig.endpoint ?? options.baseUrl ?? DEFAULT_ANTHROPIC_BASE_URL).replace(/\/+$/, "");
  const anthropicVersion = modelConfig.anthropicVersion ?? DEFAULT_ANTHROPIC_VERSION;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runtimeCredentialStore = options.runtimeCredentialStore ?? null;

  // Build descriptor
  const descriptor = {
    id: providerId,
    displayName: providerDisplayName,
    kind: "llm",
    models: (modelConfig.models ?? []).map((m) => normalizeModel(m)),
    priority: modelConfig.priority ?? 100,
    health: { status: "unknown" },
    metadata: {
      providerType: "anthropic",
      endpoint: baseUrl,
      anthropicVersion,
    },
  };

  // Assert the adapter contract
  const adapter = {
    descriptor,
    async generate(providerRequest) {
      const { request, target } = providerRequest;
      const modelId = target?.modelId ?? descriptor.models[0]?.id ?? "claude-sonnet-4.5";

      // Resolve API key from runtime credential store or static config
      const apiKey = await resolveApiKey(providerId, modelConfig, runtimeCredentialStore);
      if (!apiKey) {
        const error = new Error(`Anthropic adapter requires an API key for provider "${providerId}".`);
        error.code = "ANTHROPIC_API_KEY_MISSING";
        error.category = "provider";
        error.retryable = false;
        throw error;
      }

      // Map GatewayRequest → Anthropic Messages API
      const anthropicRequest = mapToAnthropicRequest(request, modelId);

      // Execute the request
      const startTime = Date.now();
      const anthropicResponse = await callAnthropicApi({
        baseUrl,
        apiKey,
        anthropicVersion,
        body: anthropicRequest,
        timeoutMs,
      });
      const latencyMs = Date.now() - startTime;

      // Map Anthropic response → ProviderResponse
      return mapFromAnthropicResponse(anthropicResponse, latencyMs, target);
    },
  };

  assertProviderAdapter(adapter);
  return adapter;
}

// ── Request mapping: GatewayRequest → Anthropic Messages API ──

export function mapToAnthropicRequest(request, modelId) {
  const messages = request.messages ?? [];
  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  // Anthropic expects system as a top-level string, not in messages
  const system = systemMessages
    .map((m) => extractText(m.content))
    .filter(Boolean)
    .join("\n\n");

  // Map conversation messages to Anthropic format
  const anthropicMessages = nonSystemMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: mapToAnthropicContent(m.content),
  }));

  const options = request.options ?? {};

  return {
    model: modelId,
    max_tokens: options.maxOutputTokens ?? options.max_tokens ?? DEFAULT_MAX_TOKENS,
    ...(system ? { system } : {}),
    messages: anthropicMessages,
    ...(options.temperature != null ? { temperature: options.temperature } : {}),
    ...(options.topP != null ? { top_p: options.topP } : {}),
    ...(options.stop ? { stop_sequences: Array.isArray(options.stop) ? options.stop : [options.stop] } : {}),
  };
}

function mapToAnthropicContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((part) => {
    if (part?.type === "text") return { type: "text", text: part.text };
    if (part?.type === "image_url") {
      const inspected = inspectInlineImageDataUrl(part.image_url?.url);
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: inspected.mediaType,
          data: inspected.base64Data,
        },
      };
    }
    throw new TypeError("Unsupported gateway message content block for Anthropic.");
  });
}

// ── Response mapping: Anthropic → ProviderResponse ──

function mapFromAnthropicResponse(anthropicResponse, latencyMs, target) {
  const contentBlocks = anthropicResponse.content ?? [];
  const textParts = contentBlocks
    .filter((block) => block.type === "text")
    .map((block) => block.text);
  const text = textParts.join("\n");

  const usage = anthropicResponse.usage ?? {};
  const stopReason = anthropicResponse.stop_reason;

  return {
    text,
    message: {
      role: "assistant",
      content: text,
    },
    usage: {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    },
    latencyMs,
    executionStatus: "success",
    warnings: [],
    raw: anthropicResponse,
    ...(stopReason ? { finishReason: mapStopReason(stopReason) } : {}),
  };
}

// ── API call ──

async function callAnthropicApi({ baseUrl, apiKey, anthropicVersion, body, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Anthropic API request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    const destination = await resolveSafeOutboundUrl(`${baseUrl}/v1/messages`);
    const response = await fetchWithAgent(destination.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": anthropicVersion,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      lookup: destination.lookup,
    });

    const responseText = await response.text();

    if (!response.ok) {
      const error = new Error(
        `Anthropic API returned ${response.status}: ${redactApiKey(responseText.slice(0, 500))}`,
      );
      error.code = `ANTHROPIC_API_${response.status}`;
      error.category = "provider";
      error.retryable = response.status >= 500 || response.status === 429;
      error.statusCode = response.status;
      throw error;
    }

    return JSON.parse(responseText);
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(`Anthropic API request timed out after ${timeoutMs}ms`);
      timeoutError.code = "ANTHROPIC_API_TIMEOUT";
      timeoutError.category = "provider";
      timeoutError.retryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Helpers ──

async function resolveApiKey(providerId, modelConfig, runtimeCredentialStore) {
  // 1. Static config
  if (modelConfig.apiKey) return modelConfig.apiKey;

  // 2. Runtime credential store
  if (runtimeCredentialStore && typeof runtimeCredentialStore.getCredential === "function") {
    const credential = await runtimeCredentialStore.getCredential(providerId);
    if (credential?.apiKey) return credential.apiKey;
  }

  // 3. Environment variable fallback
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return envKey;

  return null;
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === "text" || typeof part === "string")
      .map((part) => (typeof part === "string" ? part : part.text))
      .join("");
  }
  return "";
}

function mapStopReason(reason) {
  const mapping = {
    end_turn: "stop",
    max_tokens: "length",
    stop_sequence: "stop",
    tool_use: "tool_calls",
  };
  return mapping[reason] ?? reason;
}

function normalizeModel(model) {
  if (typeof model === "string") {
    return { id: model, displayName: model, enabled: true, capabilities: ["chat"] };
  }
  return {
    id: model.id ?? model.modelId,
    displayName: model.displayName ?? model.modelDisplayName ?? model.id,
    enabled: model.enabled !== false,
    capabilities: model.capabilities ?? ["chat"],
    priority: model.priority,
    costTier: model.costTier,
    latencyTier: model.latencyTier,
  };
}

function redactApiKey(text) {
  return text.replace(/sk-ant-[0-9A-Za-z_-]{8,}/g, "sk-ant-****redacted");
}
