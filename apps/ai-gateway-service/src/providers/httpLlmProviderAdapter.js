import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";
import { getOrCreateAgent } from "../http/connectionPool.js";

export class HttpLLMProviderAdapter {
  constructor(modelConfig, options = {}) {
    this.modelConfig = modelConfig;
    this.options = options;
    this.baseUrl = normalizeBaseUrl(modelConfig.endpoint);
    this.errorPrefix = createErrorPrefix(modelConfig.providerId);
  }

  get descriptor() {
    const apiKey = this.resolveApiKey();
    const baseUrl = this.resolveBaseUrl();

    return createProviderDescriptor(this.modelConfig, {
      costTier: "medium",
      latencyTier: "medium",
      healthStatus: this.modelConfig.enabled && apiKey ? "unknown" : "unavailable",
      metadata: {
        endpointConfigured: Boolean(baseUrl),
        apiKeyPresent: Boolean(apiKey),
        openAiCompatible: true,
        reservedAdapter: this.modelConfig.dryRun ?? false,
        realProvider: !(this.modelConfig.dryRun ?? false),
        runtimeCredentialSupported: true,
        runtimeCredentialPresent: Boolean(this.options.runtimeCredentialStore?.has(this.modelConfig.providerId)),
      },
      modelMetadata: {
        openAiCompatible: true,
        realProvider: !(this.modelConfig.dryRun ?? false),
      },
    });
  }

  async generate(providerRequest) {
    if (this.modelConfig.dryRun) {
      const text = `[dry-run:${providerRequest.target.providerId}/${providerRequest.target.modelId}] real provider adapter reserved`;

      return createProviderResponse({
        text,
        message: {
          role: "assistant",
          content: text,
        },
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        latencyMs: 0,
        executionStatus: "dry_run",
        warnings: [
          {
            code: "real_provider_not_connected",
            message: "HTTP LLM provider adapter is reserved but external API calls are disabled.",
          },
        ],
      });
    }

    const startedAt = Date.now();

    this.assertReady(providerRequest);
    const apiKey = this.resolveApiKey();
    const baseUrl = this.resolveBaseUrl();

    const payload = mapGatewayRequestToChatCompletions(providerRequest);
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        agent: getOrCreateAgent(baseUrl),
      });
      const body = await readJsonResponse(response);

      if (!response.ok) {
        throw createHttpProviderError({
          response,
          body,
          providerRequest,
          prefix: this.errorPrefix,
          providerName: this.modelConfig.providerDisplayName ?? this.modelConfig.providerId,
        });
      }

      return mapChatCompletionsResponseToProviderResponse(body, {
        providerRequest,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (error?.category === "provider") {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw createProviderError({
          code: `${this.errorPrefix}_REQUEST_TIMEOUT`,
          type: "timeout",
          message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} request timed out after ${timeoutMs}ms.`,
          retryable: true,
          details: createErrorDetails(providerRequest, {
            timeoutMs,
          }),
        });
      }

      if (isNetworkError(error)) {
        throw createProviderError({
          code: `${this.errorPrefix}_NETWORK_ERROR`,
          type: "network",
          message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} request failed before receiving a response.`,
          retryable: true,
          details: createErrorDetails(providerRequest),
        });
      }

      throw createProviderError({
        code: `${this.errorPrefix}_UNKNOWN_ERROR`,
        type: "unknown",
        message: error instanceof Error ? error.message : "HTTP LLM provider request failed.",
        retryable: false,
        details: createErrorDetails(providerRequest),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async *generateStream(providerRequest) {
    if (this.modelConfig.dryRun) {
      const text = `[dry-run:${providerRequest.target.providerId}/${providerRequest.target.modelId}] streaming provider adapter reserved`;

      yield {
        textDelta: text,
        raw: {
          dryRun: true,
        },
      };
      return;
    }

    this.assertReady(providerRequest);
    const apiKey = this.resolveApiKey();
    const baseUrl = this.resolveBaseUrl();

    const payload = {
      ...mapGatewayRequestToChatCompletions(providerRequest),
      stream: true,
    };
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw createHttpProviderError({
          response,
          body: await readJsonResponse(response),
          providerRequest,
          prefix: this.errorPrefix,
          providerName: this.modelConfig.providerDisplayName ?? this.modelConfig.providerId,
        });
      }

      for await (const chunk of readChatCompletionsStream(response, providerRequest)) {
        yield chunk;
      }
    } catch (error) {
      if (error?.category === "provider") {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw createProviderError({
          code: `${this.errorPrefix}_REQUEST_TIMEOUT`,
          type: "timeout",
          message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} request timed out after ${timeoutMs}ms.`,
          retryable: true,
          details: createErrorDetails(providerRequest, {
            timeoutMs,
          }),
        });
      }

      if (isNetworkError(error)) {
        throw createProviderError({
          code: `${this.errorPrefix}_NETWORK_ERROR`,
          type: "network",
          message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} request failed before receiving a response.`,
          retryable: true,
          details: createErrorDetails(providerRequest),
        });
      }

      throw createProviderError({
        code: `${this.errorPrefix}_UNKNOWN_ERROR`,
        type: "unknown",
        message: error instanceof Error ? error.message : "HTTP LLM provider stream failed.",
        retryable: false,
        details: createErrorDetails(providerRequest),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  assertReady(providerRequest) {
    if (!this.resolveApiKey()) {
      throw createProviderError({
        code: `${this.errorPrefix}_API_KEY_MISSING`,
        type: "configuration",
        message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} API key is not configured.`,
        retryable: false,
        details: createErrorDetails(providerRequest, {
          apiKeyPresent: false,
        }),
      });
    }

    if (!this.resolveBaseUrl()) {
      throw createProviderError({
        code: `${this.errorPrefix}_ENDPOINT_MISSING`,
        type: "configuration",
        message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} endpoint is not configured.`,
        retryable: false,
        details: createErrorDetails(providerRequest, {
          endpointConfigured: false,
        }),
      });
    }
  }

  resolveApiKey() {
    return this.options.runtimeCredentialStore?.getApiKey(this.modelConfig.providerId) || this.modelConfig.apiKey || "";
  }

  resolveBaseUrl() {
    return this.options.runtimeCredentialStore?.getEndpoint(this.modelConfig.providerId) || this.baseUrl || "";
  }
}

export function createHttpLLMProviderAdapter(modelConfig, options = {}) {
  return new HttpLLMProviderAdapter(modelConfig, options);
}

function mapGatewayRequestToChatCompletions(providerRequest) {
  const { request, target } = providerRequest;
  const maxOutputTokens = request.options?.maxOutputTokens;
  const body = {
    model: target.modelId,
    messages: request.messages
      .filter((message) => message.role === "system" || message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
    temperature: request.options?.temperature,
    max_tokens: maxOutputTokens,
    stream: false,
  };

  if (target.providerId === "mimo") {
    body.max_completion_tokens = maxOutputTokens;
    body.thinking = {
      type: "disabled",
    };
  }

  return body;
}

function mapChatCompletionsResponseToProviderResponse(body, { providerRequest, latencyMs }) {
  const content = body?.choices?.[0]?.message?.content ?? "";
  const text = content || `[${providerRequest.target.providerId}:${providerRequest.target.modelId}] empty response`;

  return createProviderResponse({
    text,
    message: {
      role: "assistant",
      content: text,
    },
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
      finishReason: body?.choices?.[0]?.finish_reason,
    },
  });
}

async function* readChatCompletionsStream(response, providerRequest) {
  if (!response.body) {
    throw createProviderError({
      code: `${createErrorPrefix(providerRequest.target.providerId)}_STREAM_BODY_MISSING`,
      type: "http",
      message: "HTTP LLM provider returned no stream body.",
      retryable: false,
      details: createErrorDetails(providerRequest),
    });
  }

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const parsed = parseStreamLine(line);

      if (parsed === "done") {
        return;
      }

      if (parsed?.textDelta) {
        yield parsed;
      }
    }
  }

  const remaining = parseStreamLine(buffer);

  if (remaining?.textDelta) {
    yield remaining;
  }
}

function parseStreamLine(line) {
  const trimmed = line.trim();

  if (!trimmed || !trimmed.startsWith("data:")) {
    return null;
  }

  const data = trimmed.slice("data:".length).trim();

  if (data === "[DONE]") {
    return "done";
  }

  try {
    const parsed = JSON.parse(data);
    const textDelta = parsed?.choices?.[0]?.delta?.content ?? "";

    if (!textDelta) {
      return null;
    }

    return {
      textDelta,
      raw: {
        id: parsed?.id,
        model: parsed?.model,
        finishReason: parsed?.choices?.[0]?.finish_reason,
      },
    };
  } catch {
    return null;
  }
}

function createHttpProviderError({ response, body, providerRequest, prefix, providerName }) {
  const statusDescriptor = describeHttpErrorStatus(response.status, prefix, providerName);

  return createProviderError({
    code: statusDescriptor.code,
    type: statusDescriptor.type,
    message: extractProviderErrorMessage(body, response.status, statusDescriptor.message),
    retryable: statusDescriptor.retryable,
    details: createErrorDetails(providerRequest, {
      statusCode: response.status,
      errorType: body?.error?.type,
      errorCode: body?.error?.code,
    }),
  });
}

function describeHttpErrorStatus(statusCode, prefix, providerName) {
  const name = providerName || "HTTP LLM provider";
  if (statusCode === 401) {
    return {
      code: `${prefix}_UNAUTHORIZED`,
      type: "authentication",
      message: `${name} rejected the request with HTTP 401. Check the provider-specific API key, base URL, and model access.`,
      retryable: false,
    };
  }

  if (statusCode === 403) {
    return {
      code: `${prefix}_FORBIDDEN`,
      type: "authorization",
      message: `${name} rejected the request with HTTP 403. Check account permissions, subscription scope, and model access.`,
      retryable: false,
    };
  }

  if (statusCode === 429) {
    return {
      code: `${prefix}_RATE_LIMIT`,
      type: "rate_limit",
      message: `${name} rejected the request with HTTP 429. The provider rate limit or quota was reached; retry later or use another model.`,
      retryable: true,
    };
  }

  return {
    code: `${prefix}_HTTP_ERROR`,
    type: "http",
    message: `${name} request failed with HTTP ${statusCode}.`,
    retryable: statusCode >= 500,
  };
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

function createErrorDetails(providerRequest, extra = {}) {
  return {
    providerId: providerRequest.target.providerId,
    modelId: providerRequest.target.modelId,
    ...extra,
  };
}

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

function extractProviderErrorMessage(body, statusCode, fallbackMessage) {
  return body?.error?.message ?? body?.rawText ?? fallbackMessage ?? `HTTP LLM provider request failed with HTTP ${statusCode}`;
}

function isNetworkError(error) {
  return (
    error instanceof TypeError ||
    error?.code === "ECONNRESET" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "EAI_AGAIN"
  );
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return "";
  }

  return String(baseUrl).replace(/\/+$/, "");
}

function createErrorPrefix(providerId) {
  return String(providerId ?? "HTTP_LLM")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}
