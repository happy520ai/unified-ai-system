import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";
import { getOrCreateAgent, fetchWithAgent } from "../http/connectionPool.js";
import { createPinoLogger } from "../logging/pinoLogger.js";
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

// Re-export for backward compatibility
export { tryPartialToolArgs };

// ── Retry configuration ──
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 2_000;
const DEFAULT_RETRY_MAX_DELAY_MS = 30_000;

// ── Array size caps ──
const MAX_QUALITY_SAMPLES = 1000;

// ── Cost Tracking — default token pricing ──
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
      totalRequests: 0, successfulRequests: 0, failedRequests: 0,
      retriedRequests: 0, totalLatencyMs: 0, errors: {},
      lastSuccessAt: null, lastFailureAt: null, startedAt: Date.now(),
    };
    this._streamState = null;
    this._qualityScores = [];
    this._costTracker = {
      totalInputTokens: 0, totalOutputTokens: 0,
      estimatedCostUsd: 0, pricingPerRequest: [],
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
    return this.withRetry(() => this._generateOnce(providerRequest), providerRequest);
  }

  async _generateOnce(providerRequest) {
    const startedAt = Date.now();
    this._health.totalRequests++;
    const reqStart = Date.now();

    this.assertReady(providerRequest);
    const apiKey = this.resolveApiKey();
    const baseUrl = this.resolveBaseUrl();
    const payload = mapGatewayRequestToChatCompletions(providerRequest);
    const controller = new AbortController();
    const timeoutMs = this.options.timeoutMs ?? 10_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (isPrivateOrReservedUrl(`${baseUrl}/chat/completions`)) {
        throw createHttpProviderError({
          response: null, body: null, providerRequest,
          message: `SSRF blocked: baseUrl resolves to a private or reserved address.`,
          retryable: false,
        });
      }

      const agent = getOrCreateAgent(baseUrl);
      const response = await fetchWithAgent(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
        agent,
        timeout: controller.signal ? undefined : 60_000,
      });
      const body = await readJsonResponse(response);

      if (!response.ok) {
        throw createHttpProviderError({
          response, body, providerRequest,
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

      this._health.successfulRequests++;
      this._health.totalLatencyMs += Date.now() - reqStart;
      this._health.lastSuccessAt = new Date().toISOString();

      const providerResponse = mapChatCompletionsResponseToProviderResponse(body, {
        providerRequest, latencyMs: Date.now() - startedAt,
      });

      // Score response quality
      const qualityScore = scoreResponseQuality(providerResponse);
      this._qualityScores.push(qualityScore);
      if (this._qualityScores.length > MAX_QUALITY_SAMPLES) {
        this._qualityScores.splice(0, this._qualityScores.length - MAX_QUALITY_SAMPLES);
      }

      // Accumulate cost tracking
      const usage = providerResponse?.usage;
      if (usage) {
        const inputTokens = usage.inputTokens ?? 0;
        const outputTokens = usage.outputTokens ?? 0;
        const pricing = providerRequest?.options?.tokenPricing ?? DEFAULT_TOKEN_PRICING;
        const requestCost = (inputTokens / 1000 * pricing.inputPer1k) + (outputTokens / 1000 * pricing.outputPer1k);
        this._costTracker.totalInputTokens += inputTokens;
        this._costTracker.totalOutputTokens += outputTokens;
        this._costTracker.estimatedCostUsd += requestCost;
        this._costTracker.pricingPerRequest.push({
          inputTokens, outputTokens, costUsd: requestCost, pricing: { ...pricing },
        });
        if (this._costTracker.pricingPerRequest.length > MAX_QUALITY_SAMPLES) {
          this._costTracker.pricingPerRequest.splice(0, this._costTracker.pricingPerRequest.length - MAX_QUALITY_SAMPLES);
        }
      }

      return providerResponse;
    } catch (error) {
      this._health.failedRequests++;
      this._health.lastFailureAt = new Date().toISOString();
      const errCode = error?.code || "UNKNOWN";
      this._health.errors[errCode] = (this._health.errors[errCode] || 0) + 1;
      classifyNonStreamError(error, {
        errorPrefix: this.errorPrefix,
        providerName: this.modelConfig.providerDisplayName ?? this.modelConfig.providerId,
        providerRequest,
        timeoutMs,
      });
    } finally {
      clearTimeout(timeoutId);
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
    const cfg = this.resolveRetryConfig();
    const providerName = this.modelConfig.providerDisplayName ?? this.modelConfig.providerId;
    const timeoutMs = this.options.timeoutMs ?? 10_000;

    const payload = {
      ...mapGatewayRequestToChatCompletions(providerRequest),
      stream: true,
    };

    const response = await openStreamWithRetry({
      baseUrl, apiKey, payload, providerRequest,
      errorPrefix: this.errorPrefix,
      providerName,
      timeoutMs,
      maxRetries: cfg.maxRetries,
      retryDelay: (attempt, error) => this._retryDelay(attempt, cfg, error),
    });

    // ── Stream phase: no retry once chunks start flowing ──
    this._streamState = {
      chunksReceived: 0, textLength: 0, toolCallsPartial: [],
      startedAt: Date.now(), interrupted: false, partialToolArgs: [],
    };

    try {
      for await (const chunk of readChatCompletionsStream(response, providerRequest)) {
        if (this._streamState) {
          this._streamState.chunksReceived++;
          if (chunk.textDelta) {
            this._streamState.textLength += chunk.textDelta.length;
          }
          if (chunk.raw?.toolCallArgs && this._streamState.toolCallsPartial.length > 0) {
            const idx = chunk.raw.toolCallIndex ?? 0;
            const accumulated = this._streamState.toolCallsPartial[idx] ?? "";
            const partial = tryPartialToolArgs(accumulated);
            if (partial) {
              this._streamState.partialToolArgs[idx] = partial;
            }
          }
        }
        yield chunk;
      }
    } catch (streamError) {
      if (this._streamState) {
        this._streamState.interrupted = true;
        this._streamState.interruptedAt = new Date().toISOString();
      }
      throw streamError;
    }
  }

  async _retryDelay(attempt, cfg, error) {
    this._health.retriedRequests++;
    const delay = Math.min(cfg.baseDelayMs * Math.pow(2, attempt - 1), cfg.maxDelayMs);
    const jitter = delay * (0.8 + Math.random() * 0.4);
    const waitMs = Math.round(jitter);
    const providerName = this.modelConfig.providerDisplayName ?? this.modelConfig.providerId;
    logger.warn({
      event: "provider_retry",
      provider: providerName,
      attempt,
      maxRetries: cfg.maxRetries,
      errorCode: error?.code,
      errorMessage: error?.message,
      waitMs,
    }, `Retry ${providerName} attempt ${attempt}/${cfg.maxRetries} in ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
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

  async withRetry(fn, providerRequest) {
    const cfg = this.resolveRetryConfig();
    let lastError;
    for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (!error?.retryable || attempt >= cfg.maxRetries) throw error;
        await this._retryDelay(attempt, cfg, error);
        lastError = error;
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

  assertReady(providerRequest) {
    if (!this.resolveApiKey()) {
      throw createProviderError({
        code: `${this.errorPrefix}_API_KEY_MISSING`,
        type: "configuration",
        message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} API key is not configured.`,
        retryable: false,
        details: createErrorDetails(providerRequest, { apiKey_present: false }),
      });
    }
    if (!this.resolveBaseUrl()) {
      throw createProviderError({
        code: `${this.errorPrefix}_ENDPOINT_MISSING`,
        type: "configuration",
        message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} endpoint is not configured.`,
        retryable: false,
        details: createErrorDetails(providerRequest, { endpointConfigured: false }),
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
    if (!baseUrl) return { warmed: false, error: "No base URL configured" };
    const startMs = Date.now();
    try {
      const agent = getOrCreateAgent(baseUrl);
      await fetchWithAgent(`${baseUrl}/models`, { method: "HEAD", agent, timeout: 5000 });
      return { warmed: true, latencyMs: Date.now() - startMs };
    } catch (err) {
      return { warmed: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  get health() {
    const h = this._health;
    return {
      providerId: this.modelConfig.providerId,
      modelId: this.modelConfig.modelId,
      totalRequests: h.totalRequests,
      successfulRequests: h.successfulRequests,
      failedRequests: h.failedRequests,
      retriedRequests: h.retriedRequests,
      successRate: h.totalRequests > 0 ? h.successfulRequests / h.totalRequests : null,
      averageLatencyMs: h.successfulRequests > 0 ? Math.round(h.totalLatencyMs / h.successfulRequests) : null,
      errorDistribution: { ...h.errors },
      lastSuccessAt: h.lastSuccessAt,
      lastFailureAt: h.lastFailureAt,
      uptimeMs: Date.now() - h.startedAt,
    };
  }

  resetHealth() {
    this._health = {
      totalRequests: 0, successfulRequests: 0, failedRequests: 0,
      retriedRequests: 0, totalLatencyMs: 0, errors: {},
      lastSuccessAt: null, lastFailureAt: null, startedAt: Date.now(),
    };
  }

  get streamState() {
    return this._streamState ? { ...this._streamState } : null;
  }

  get qualityStats() {
    const scores = this._qualityScores;
    if (scores.length === 0) {
      return { averageScore: null, minScore: null, maxScore: null, sampleSize: 0 };
    }
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      averageScore: Math.round((sum / scores.length) * 1000) / 1000,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      sampleSize: scores.length,
    };
  }

  resetQuality() { this._qualityScores = []; }

  get costSummary() {
    return {
      totalInputTokens: this._costTracker.totalInputTokens,
      totalOutputTokens: this._costTracker.totalOutputTokens,
      estimatedCostUsd: Math.round(this._costTracker.estimatedCostUsd * 1_000_000) / 1_000_000,
      requestCount: this._costTracker.pricingPerRequest.length,
    };
  }

  resetCost() {
    this._costTracker = {
      totalInputTokens: 0, totalOutputTokens: 0,
      estimatedCostUsd: 0, pricingPerRequest: [],
    };
  }
}

export function createHttpLLMProviderAdapter(modelConfig, options = {}) {
  return new HttpLLMProviderAdapter(modelConfig, options);
}
