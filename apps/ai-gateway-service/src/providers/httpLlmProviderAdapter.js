import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";
import { getOrCreateAgent, fetchWithAgent } from "../http/connectionPool.js";
import { createPinoLogger } from "../logging/pinoLogger.js";
import {
  abortableSleep,
  createLinkedAbortController,
  findExecutionAbortError,
  throwIfExecutionAborted,
} from "@unified-ai-system/shared-utils";
import {
  createProviderError,
  createErrorDetails,
  createErrorPrefix,
  normalizeBaseUrl,
  isPrivateOrReservedUrl,
  readJsonResponse,
  createHttpProviderError,
  classifyNonStreamError,
} from "./httpProviderErrorHelpers.js";
import {
  scoreResponseQuality,
  tryPartialToolArgs,
  validateChatResponse,
  mapGatewayRequestToChatCompletions,
  mapChatCompletionsResponseToProviderResponse,
  readChatCompletionsStream,
  openStreamWithRetry,
} from "./httpProviderMapping.js";

export { tryPartialToolArgs };

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 2_000;
const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;
const MAX_QUALITY_SAMPLES = 1000;
const DEFAULT_TOKEN_PRICING = Object.freeze({
  inputPer1k: 0.0025,
  outputPer1k: 0.01,
});

const logger = createPinoLogger({ app: "httpLlmProviderAdapter" });

export class HttpLLMProviderAdapter {
  constructor(modelConfig, options = {}) {
    this.modelConfig = modelConfig;
    this.options = options;
    this.baseUrl = normalizeBaseUrl(modelConfig.endpoint);
    this.errorPrefix = createErrorPrefix(modelConfig.providerId);
    this._health = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cancelledRequests: 0,
      retriedRequests: 0,
      totalLatencyMs: 0,
      errors: {},
      lastSuccessAt: null,
      lastFailureAt: null,
      lastCancellationAt: null,
      startedAt: Date.now(),
    };
    this._streamState = null;
    this._qualityScores = [];
    this._costTracker = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCostUsd: 0,
      pricingPerRequest: [],
    };
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
      return this._dryRunResponse(providerRequest);
    }
    return this.withRetry(
      () => this._generateOnce(providerRequest),
      providerRequest.execution?.signal,
    );
  }

  async _generateOnce(providerRequest) {
    const startedAt = Date.now();
    const requestStartedAt = Date.now();
    const executionSignal = providerRequest.execution?.signal;
    throwIfExecutionAborted(executionSignal);
    this._health.totalRequests++;

    this.assertReady(providerRequest);
    const apiKey = this.resolveApiKey();
    const baseUrl = this.resolveBaseUrl();
    const payload = mapGatewayRequestToChatCompletions(providerRequest);
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const timeoutError = createProviderError({
      code: `${this.errorPrefix}_REQUEST_TIMEOUT`,
      type: "timeout",
      message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} request timed out after ${timeoutMs}ms.`,
      retryable: true,
      details: createErrorDetails(providerRequest, { timeoutMs }),
    });
    const requestControl = createLinkedAbortController({
      signal: executionSignal,
      timeoutMs,
      timeoutReason: timeoutError,
    });

    try {
      if (isPrivateOrReservedUrl(`${baseUrl}/chat/completions`)) {
        throw createProviderError({
          code: `${this.errorPrefix}_SSRF_BLOCKED`,
          type: "security",
          message: "SSRF blocked: provider endpoint resolves to a private or reserved address.",
          retryable: false,
          details: createErrorDetails(providerRequest),
        });
      }

      const response = await fetchWithAgent(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: requestControl.signal,
        agent: getOrCreateAgent(baseUrl),
        timeout: timeoutMs,
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

      try {
        validateChatResponse(body);
      } catch (validationError) {
        throw createProviderError({
          code: `${this.errorPrefix}_MALFORMED_RESPONSE`,
          type: "malformed",
          message: validationError.message,
          retryable: false,
          details: createErrorDetails(providerRequest),
        });
      }

      const providerResponse = mapChatCompletionsResponseToProviderResponse(body, {
        providerRequest,
        latencyMs: Date.now() - startedAt,
      });

      this._health.successfulRequests++;
      this._health.totalLatencyMs += Date.now() - requestStartedAt;
      this._health.lastSuccessAt = new Date().toISOString();
      this._recordQuality(providerResponse);
      this._recordCost(providerResponse, providerRequest);

      return providerResponse;
    } catch (error) {
      const cancellation = findExecutionAbortError(error, executionSignal);
      if (cancellation) {
        this._health.cancelledRequests++;
        this._health.lastCancellationAt = new Date().toISOString();
        throw cancellation;
      }
      const effectiveError = requestControl.signal.aborted && requestControl.signal.reason instanceof Error
        ? requestControl.signal.reason
        : error;
      this._health.failedRequests++;
      this._health.lastFailureAt = new Date().toISOString();
      const errorCode = effectiveError?.code || "UNKNOWN";
      this._health.errors[errorCode] = (this._health.errors[errorCode] || 0) + 1;
      classifyNonStreamError(effectiveError, {
        errorPrefix: this.errorPrefix,
        providerName: this.modelConfig.providerDisplayName ?? this.modelConfig.providerId,
        providerRequest,
        timeoutMs,
      });
    } finally {
      requestControl.cleanup();
    }
  }

  async *generateStream(providerRequest) {
    if (this.modelConfig.dryRun) {
      const text = `[dry-run:${providerRequest.target.providerId}/${providerRequest.target.modelId}] streaming provider adapter reserved`;
      yield { textDelta: text, raw: { dryRun: true } };
      return;
    }

    this.assertReady(providerRequest);
    const apiKey = this.resolveApiKey();
    const baseUrl = this.resolveBaseUrl();
    const retryConfig = this.resolveRetryConfig();
    const providerName = this.modelConfig.providerDisplayName ?? this.modelConfig.providerId;
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const executionSignal = providerRequest.execution?.signal;
    throwIfExecutionAborted(executionSignal);
    const payload = {
      ...mapGatewayRequestToChatCompletions(providerRequest),
      stream: true,
    };

    const streamConnection = await openStreamWithRetry({
      baseUrl,
      apiKey,
      payload,
      providerRequest,
      errorPrefix: this.errorPrefix,
      providerName,
      timeoutMs,
      maxRetries: retryConfig.maxRetries,
      retryDelay: (attempt, error, signal) => this._retryDelay(attempt, retryConfig, error, signal),
      signal: executionSignal,
    });

    this._streamState = {
      chunksReceived: 0,
      textLength: 0,
      toolCallsPartial: [],
      startedAt: Date.now(),
      interrupted: false,
      partialToolArgs: [],
    };

    try {
      for await (const chunk of readChatCompletionsStream(
        streamConnection.response,
        providerRequest,
        streamConnection.signal,
      )) {
        this._streamState.chunksReceived++;
        if (chunk.textDelta) {
          this._streamState.textLength += chunk.textDelta.length;
        }
        if (chunk.raw?.toolCallArgs && this._streamState.toolCallsPartial.length > 0) {
          const index = chunk.raw.toolCallIndex ?? 0;
          const accumulated = this._streamState.toolCallsPartial[index] ?? "";
          const partial = tryPartialToolArgs(accumulated);
          if (partial) {
            this._streamState.partialToolArgs[index] = partial;
          }
        }
        yield chunk;
      }
    } catch (error) {
      this._streamState.interrupted = true;
      this._streamState.interruptedAt = new Date().toISOString();
      const cancellation = findExecutionAbortError(error, executionSignal);
      if (cancellation) throw cancellation;
      throw streamConnection.signal.aborted && streamConnection.signal.reason instanceof Error
        ? streamConnection.signal.reason
        : error;
    } finally {
      streamConnection.cleanup();
    }
  }

  async _retryDelay(attempt, config, error, signal) {
    this._health.retriedRequests++;
    const delay = Math.min(
      config.baseDelayMs * Math.pow(2, attempt - 1),
      config.maxDelayMs,
    );
    const waitMs = Math.round(delay * (0.8 + Math.random() * 0.4));
    const providerName = this.modelConfig.providerDisplayName ?? this.modelConfig.providerId;
    logger.warn({
      event: "provider_retry",
      provider: providerName,
      attempt,
      maxRetries: config.maxRetries,
      errorCode: error?.code,
      errorMessage: error?.message,
      waitMs,
    }, `Retry ${providerName} attempt ${attempt}/${config.maxRetries} in ${waitMs}ms`);
    await abortableSleep(waitMs, signal);
  }

  _dryRunResponse(providerRequest) {
    const text = `[dry-run:${providerRequest.target.providerId}/${providerRequest.target.modelId}] real provider adapter reserved`;
    return createProviderResponse({
      text,
      message: { role: "assistant", content: text },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latencyMs: 0,
      executionStatus: "dry_run",
      warnings: [{
        code: "real_provider_not_connected",
        message: "HTTP LLM provider adapter is reserved but external API calls are disabled.",
      }],
    });
  }

  async withRetry(operation, signal) {
    const config = this.resolveRetryConfig();
    let lastError;
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      throwIfExecutionAborted(signal);
      try {
        return await operation();
      } catch (error) {
        if (!error?.retryable || attempt >= config.maxRetries) {
          throw error;
        }
        lastError = error;
        await this._retryDelay(attempt, config, error, signal);
      }
    }
    throw lastError;
  }

  resolveRetryConfig() {
    return {
      maxRetries: this.options.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseDelayMs: this.options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
      maxDelayMs: this.options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS,
    };
  }

  _recordQuality(providerResponse) {
    this._qualityScores.push(scoreResponseQuality(providerResponse));
    if (this._qualityScores.length > MAX_QUALITY_SAMPLES) {
      this._qualityScores.splice(0, this._qualityScores.length - MAX_QUALITY_SAMPLES);
    }
  }

  _recordCost(providerResponse, providerRequest) {
    const usage = providerResponse?.usage;
    if (!usage) return;

    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    const pricing = providerRequest?.options?.tokenPricing
      ?? this.options.tokenPricing
      ?? DEFAULT_TOKEN_PRICING;
    const requestCost = (
      (inputTokens / 1000) * pricing.inputPer1k
      + (outputTokens / 1000) * pricing.outputPer1k
    );
    this._costTracker.totalInputTokens += inputTokens;
    this._costTracker.totalOutputTokens += outputTokens;
    this._costTracker.estimatedCostUsd += requestCost;
    this._costTracker.pricingPerRequest.push({
      inputTokens,
      outputTokens,
      costUsd: requestCost,
      pricing: { ...pricing },
    });
    if (this._costTracker.pricingPerRequest.length > MAX_QUALITY_SAMPLES) {
      this._costTracker.pricingPerRequest.splice(
        0,
        this._costTracker.pricingPerRequest.length - MAX_QUALITY_SAMPLES,
      );
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

  async warmConnection() {
    const baseUrl = this.resolveBaseUrl();
    if (!baseUrl) {
      return { warmed: false, error: "No base URL configured" };
    }

    const startedAt = Date.now();
    try {
      const agent = getOrCreateAgent(baseUrl);
      await fetchWithAgent(`${baseUrl}/models`, {
        method: "HEAD",
        agent,
        timeout: 5_000,
      });
      return { warmed: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const nestedError = Array.isArray(error?.errors)
        ? error.errors.find((item) => item?.message || item?.code)
        : null;
      return {
        warmed: false,
        error: error?.message || nestedError?.message || error?.code || nestedError?.code
          || error?.name || "Connection warm-up failed",
      };
    }
  }

  get health() {
    const health = this._health;
    return {
      providerId: this.modelConfig.providerId,
      modelId: this.modelConfig.modelId,
      totalRequests: health.totalRequests,
      successfulRequests: health.successfulRequests,
      failedRequests: health.failedRequests,
      cancelledRequests: health.cancelledRequests,
      retriedRequests: health.retriedRequests,
      successRate: health.totalRequests - health.cancelledRequests > 0
        ? health.successfulRequests / (health.totalRequests - health.cancelledRequests)
        : null,
      averageLatencyMs: health.successfulRequests > 0
        ? Math.round(health.totalLatencyMs / health.successfulRequests)
        : null,
      errorDistribution: { ...health.errors },
      lastSuccessAt: health.lastSuccessAt,
      lastFailureAt: health.lastFailureAt,
      lastCancellationAt: health.lastCancellationAt,
      uptimeMs: Date.now() - health.startedAt,
    };
  }

  resetHealth() {
    this._health = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cancelledRequests: 0,
      retriedRequests: 0,
      totalLatencyMs: 0,
      errors: {},
      lastSuccessAt: null,
      lastFailureAt: null,
      lastCancellationAt: null,
      startedAt: Date.now(),
    };
  }

  get streamState() {
    return this._streamState ? { ...this._streamState } : null;
  }

  get qualityStats() {
    const scores = this._qualityScores;
    if (scores.length === 0) {
      return {
        averageScore: null,
        minScore: null,
        maxScore: null,
        sampleSize: 0,
      };
    }

    const sum = scores.reduce((total, score) => total + score, 0);
    return {
      averageScore: Math.round((sum / scores.length) * 1000) / 1000,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      sampleSize: scores.length,
    };
  }

  resetQuality() {
    this._qualityScores = [];
  }

  get costSummary() {
    return {
      totalInputTokens: this._costTracker.totalInputTokens,
      totalOutputTokens: this._costTracker.totalOutputTokens,
      estimatedCostUsd: Math.round(
        this._costTracker.estimatedCostUsd * 1_000_000,
      ) / 1_000_000,
      requestCount: this._costTracker.pricingPerRequest.length,
    };
  }

  resetCost() {
    this._costTracker = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      estimatedCostUsd: 0,
      pricingPerRequest: [],
    };
  }
}

export function createHttpLLMProviderAdapter(modelConfig, options = {}) {
  return new HttpLLMProviderAdapter(modelConfig, options);
}
