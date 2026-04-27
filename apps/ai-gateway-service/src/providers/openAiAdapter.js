import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

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
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body = await readJsonResponse(response);

      if (!response.ok) {
        throw createOpenAIHttpError(response, body, providerRequest);
      }

      return mapOpenAIResponseToProviderResponse(body, {
        providerRequest,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (error?.category === "provider") {
        throw error;
      }

      if (error?.name === "AbortError") {
        throw createProviderError({
          code: "OPENAI_REQUEST_TIMEOUT",
          type: "timeout",
          message: `OpenAI request timed out after ${timeoutMs}ms.`,
          retryable: true,
          details: {
            providerId: providerRequest.target.providerId,
            modelId: providerRequest.target.modelId,
            timeoutMs,
          },
        });
      }

      if (isNetworkError(error)) {
        throw createProviderError({
          code: "OPENAI_NETWORK_ERROR",
          type: "network",
          message: "OpenAI request failed before receiving a response.",
          retryable: true,
          details: {
            providerId: providerRequest.target.providerId,
            modelId: providerRequest.target.modelId,
          },
        });
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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  resolveApiKey() {
    return this.options.runtimeCredentialStore?.getApiKey(this.modelConfig.providerId) || this.modelConfig.apiKey || "";
  }
}

export function createOpenAIAdapter(modelConfig, options = {}) {
  return new OpenAIAdapter(modelConfig, options);
}

function mapGatewayRequestToOpenAI(providerRequest) {
  const { request, target } = providerRequest;

  return {
    model: target.modelId,
    messages: request.messages
      .filter((message) => message.role === "system" || message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
    temperature: request.options?.temperature,
    max_tokens: request.options?.maxOutputTokens,
  };
}

function mapOpenAIResponseToProviderResponse(body, { providerRequest, latencyMs }) {
  const content = body?.choices?.[0]?.message?.content ?? "";
  const text = content || `[openai:${providerRequest.target.modelId}] empty response`;

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

function createOpenAIHttpError(response, body, providerRequest) {
  const isRateLimit = response.status === 429;

  return createProviderError({
    code: isRateLimit ? "OPENAI_RATE_LIMIT" : "OPENAI_HTTP_ERROR",
    type: isRateLimit ? "rate_limit" : "http",
    message: extractOpenAIErrorMessage(body, response.status),
    retryable: isRateLimit || response.status >= 500,
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
  return body?.error?.message ?? body?.rawText ?? `OpenAI request failed with HTTP ${statusCode}`;
}

function isNetworkError(error) {
  return error instanceof TypeError || error?.code === "ECONNRESET" || error?.code === "ENOTFOUND" || error?.code === "EAI_AGAIN";
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl).replace(/\/+$/, "");
}
