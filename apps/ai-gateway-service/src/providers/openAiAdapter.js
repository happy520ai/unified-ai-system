import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";
import { getOrCreateAgent, fetchWithAgent } from "../http/connectionPool.js";
import { sleep } from "../entrypoints/entrypointUtils.js"


const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_RETRY_MAX_MS = 30_000;

export class OpenAIAdapter {
  constructor(modelConfig, options = {}) {
    this.modelConfig = {
      ...modelConfig,
      providerId: modelConfig.providerId ?? "openai",
      providerDisplayName: modelConfig.providerDisplayName ?? "OpenAI",
      providerType: "openai",
    };
    this.options = options;
    this.baseUrl = normalizeBaseUrl(this.modelConfig.endpoint ?? DEFAULT_OPENAI_BASE_URL);
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
    this.retryMaxMs = options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS;
  }

  get descriptor() {
    const apiKey = this.resolveApiKey();

    return createProviderDescriptor(this.modelConfig, {
      costTier: "medium",
      latencyTier: "medium",
      healthStatus: apiKey ? "unknown" : "unavailable",
      metadata: {
        endpointConfigured: Boolean(this.baseUrl),
        apiKeyPresent: Boolean(apiKey),
        realProvider: true,
        runtimeCredentialSupported: true,
        runtimeCredentialPresent: Boolean(this.options.runtimeCredentialStore?.has(this.modelConfig.providerId)),
        maxRetries: this.maxRetries,
        toolCallingSupported: true,
      },
      modelMetadata: {
        realProvider: true,
      },
    });
  }

  async generate(providerRequest) {
    const startedAt = Date.now();
    const apiKey = this.resolveApiKey();

    if (!apiKey) {
      throw createProviderError({
        code: "OPENAI_API_KEY_MISSING",
        type: "configuration",
        message: "OpenAI API key is not configured.",
        retryable: false,
        details: {
          providerId: providerRequest.target.providerId,
          modelId: providerRequest.target.modelId,
          apiKeyPresent: false,
        },
      });
    }

    const payload = mapGatewayRequestToOpenAI(providerRequest);
    let lastError = null;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0 && lastError) {
        const delayMs = calculateBackoff(attempt, this.retryBaseMs, this.retryMaxMs);
        if (this.options.onRetry) {
          this.options.onRetry({ attempt, delayMs, error: lastError.message });
        }
        await sleep(delayMs);
      }

      const controller = new AbortController();
      const timeoutMs = this.options.timeoutMs ?? 10_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const agent = getOrCreateAgent(this.baseUrl);
        const response = await fetchWithAgent(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          agent,
          timeout: timeoutMs,
        });
        const body = await readJsonResponse(response);

        if (!response.ok) {
          const error = createOpenAIHttpError(response, body, providerRequest);
          if (error.retryable && attempt < this.maxRetries) {
            lastError = error;
            clearTimeout(timeoutId);
            continue; // Retry
          }
          throw error;
        }

        clearTimeout(timeoutId);
        return mapOpenAIResponseToProviderResponse(body, {
          providerRequest,
          latencyMs: Date.now() - startedAt,
        });
      } catch (error) {
        clearTimeout(timeoutId);

        if (error?.category === "provider") {
          if (error.retryable && attempt < this.maxRetries) {
            lastError = error;
            continue; // Retry
          }
          throw error;
        }

        if (error?.name === "AbortError") {
          const timeoutError = createProviderError({
            code: "OPENAI_REQUEST_TIMEOUT",
            type: "timeout",
            message: `OpenAI request timed out after ${timeoutMs}ms.`,
            retryable: true,
            details: {
              providerId: providerRequest.target.providerId,
              modelId: providerRequest.target.modelId,
              timeoutMs,
              attempt: attempt + 1,
            },
          });
          if (attempt < this.maxRetries) {
            lastError = timeoutError;
            continue; // Retry
          }
          throw timeoutError;
        }

        if (isNetworkError(error)) {
          const networkError = createProviderError({
            code: "OPENAI_NETWORK_ERROR",
            type: "network",
            message: "OpenAI request failed before receiving a response.",
            retryable: true,
            details: {
              providerId: providerRequest.target.providerId,
              modelId: providerRequest.target.modelId,
              attempt: attempt + 1,
            },
          });
          if (attempt < this.maxRetries) {
            lastError = networkError;
            continue; // Retry
          }
          throw networkError;
        }

        throw createProviderError({
          code: "OPENAI_UNKNOWN_ERROR",
          type: "unknown",
          message: error instanceof Error ? error.message : "OpenAI request failed before receiving a response.",
          retryable: false,
          details: {
            providerId: providerRequest.target.providerId,
            modelId: providerRequest.target.modelId,
          },
        });
      }
    }

    // Should not reach here, but safety fallback
    throw lastError || createProviderError({
      code: "OPENAI_RETRY_EXHAUSTED",
      type: "unknown",
      message: `All ${this.maxRetries + 1} attempts failed.`,
      retryable: false,
      details: {
        providerId: providerRequest.target.providerId,
        modelId: providerRequest.target.modelId,
        attempts: this.maxRetries + 1,
      },
    });
  }

  resolveApiKey() {
    return this.options.runtimeCredentialStore?.getApiKey(this.modelConfig.providerId) || this.modelConfig.apiKey || "";
  }
}

export function createOpenAIAdapter(modelConfig, options = {}) {
  return new OpenAIAdapter(modelConfig, options);
}

// ============================================================
// Request Mapping — includes tool-calling support
// ============================================================

function mapGatewayRequestToOpenAI(providerRequest) {
  const { request, target } = providerRequest;

  const payload = {
    model: target.modelId,
    messages: request.messages
      .filter((message) =>
        message.role === "system" ||
        message.role === "user" ||
        message.role === "assistant" ||
        message.role === "tool"
      )
      .map((message) => {
        const mapped = { role: message.role, content: message.content };
        // Include tool_call_id for tool result messages
        if (message.role === "tool" && message.tool_call_id) {
          mapped.tool_call_id = message.tool_call_id;
        }
        // Include tool_calls for assistant messages with tool calls
        if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
          mapped.tool_calls = message.tool_calls;
          // OpenAI requires content to be null when tool_calls are present
          if (!mapped.content) mapped.content = null;
        }
        return mapped;
      }),
    temperature: request.options?.temperature,
    max_tokens: request.options?.maxOutputTokens,
  };

  // Tool-calling support: include tools and tool_choice
  if (Array.isArray(request.tools) && request.tools.length > 0) {
    payload.tools = request.tools;
    payload.tool_choice = request.toolChoice || "auto";
  }

  return payload;
}

// ============================================================
// Response Mapping — includes tool_calls parsing
// ============================================================

function mapOpenAIResponseToProviderResponse(body, { providerRequest, latencyMs }) {
  const choice = body?.choices?.[0];
  const message = choice?.message;
  const content = message?.content ?? "";
  const finishReason = choice?.finish_reason;

  // Parse tool_calls from the response
  const rawToolCalls = message?.tool_calls;
  const hasToolCallsResult = Array.isArray(rawToolCalls) && rawToolCalls.length > 0;

  // Build the message object for provider response
  const responseMessage = {
    role: "assistant",
    content: content || "",
  };

  // Include tool_calls in message if present (for extractToolCalls priority 2)
  if (hasToolCallsResult) {
    responseMessage.tool_calls = rawToolCalls;
  }

  // Parse tool calls into the standardized format (for extractToolCalls priority 1)
  let parsedToolCalls = null;
  if (hasToolCallsResult) {
    parsedToolCalls = rawToolCalls.map((tc) => ({
      id: tc.id,
      type: tc.type || "function",
      name: tc.function?.name || "",
      arguments: safeParseArguments(tc.function?.arguments),
    }));
  }

  const text = content || (hasToolCallsResult
    ? `[openai:${providerRequest.target.modelId}] tool_calls: ${parsedToolCalls.map(tc => tc.name).join(", ")}`
    : `[openai:${providerRequest.target.modelId}] empty response`);

  return createProviderResponse({
    text,
    message: responseMessage,
    toolCalls: parsedToolCalls,
    usage: {
      inputTokens: body?.usage?.prompt_tokens ?? 0,
      outputTokens: body?.usage?.completion_tokens ?? 0,
      totalTokens: body?.usage?.total_tokens ?? 0,
    },
    latencyMs,
    executionStatus: "success",
    raw: {
      id: body?.id,
      model: body?.model,
      finishReason: finishReason,
      toolCallsCount: hasToolCallsResult ? rawToolCalls.length : 0,
    },
  });
}

// ============================================================
// Error handling
// ============================================================

function createOpenAIHttpError(response, body, providerRequest) {
  const isRateLimit = response.status === 429;
  const isServerError = response.status >= 500;

  return createProviderError({
    code: isRateLimit ? "OPENAI_RATE_LIMIT" : "OPENAI_HTTP_ERROR",
    type: isRateLimit ? "rate_limit" : "http",
    message: extractOpenAIErrorMessage(body, response.status),
    retryable: isRateLimit || isServerError,
    details: {
      providerId: providerRequest.target.providerId,
      modelId: providerRequest.target.modelId,
      statusCode: response.status,
      errorType: body?.error?.type,
      errorCode: body?.error?.code,
    },
  });
}

function createProviderError({ code, type, message, retryable, details }) {
  const error = new Error(message);
  error.code = code;
  error.type = type;
  error.category = "provider";
  error.retryable = retryable;
  error.details = details;
  return error;
}

// ============================================================
// Retry helpers
// ============================================================

/**
 * Calculate exponential backoff with jitter.
 */
function calculateBackoff(attempt, baseMs, maxMs) {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * baseMs * 0.5;
  return Math.min(exponential + jitter, maxMs);
}

// ============================================================
// Utility helpers
// ============================================================

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function extractOpenAIErrorMessage(body, statusCode) {
  const raw = body?.error?.message ?? body?.rawText ?? `OpenAI request failed with HTTP ${statusCode}`;
  // Redact any credential-shaped substrings from error messages
  return String(raw).replace(/(?:sk-[A-Za-z0-9_-]{4,}|key-[A-Za-z0-9_-]{4,}|Bearer\s+[A-Za-z0-9_.\-]{4,})/g, "[REDACTED]");
}

function isNetworkError(error) {
  return error instanceof TypeError || error?.code === "ECONNRESET" || error?.code === "ENOTFOUND" || error?.code === "EAI_AGAIN";
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl).replace(/\/+$/, "");
}

function safeParseArguments(args) {
  if (!args) return {};
  if (typeof args === "object") return args;
  try {
    return JSON.parse(args);
  } catch {
    return { _raw: args };
  }
}
