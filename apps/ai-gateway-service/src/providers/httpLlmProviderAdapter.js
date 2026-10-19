import { createProviderDescriptor } from "./providerAdapter.js";
import { createProviderResponse } from "./providerMapping.js";
import { getOrCreateAgent, fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";
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
    // Descriptor introspection must never throw or consume a pooled key; it only
    // reports whether some credential exists.
    const apiKeyPresent = this._hasUsableCredential();
    const baseUrl = this.resolveBaseUrl();

    const descriptor = createProviderDescriptor(this.modelConfig, {
      costTier: "medium",
      latencyTier: "medium",
      healthStatus: this.modelConfig.enabled && apiKeyPresent ? "unknown" : "unavailable",
      metadata: {
        endpointConfigured: Boolean(baseUrl),
        apiKeyPresent,
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
    const configuredModels = normalizeConfiguredModels(this.modelConfig, descriptor.models[0]);
    return configuredModels.length
      ? { ...descriptor, models: configuredModels }
      : descriptor;
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
    const credential = this._resolveCredential();
    const apiKey = credential.apiKey;
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
      let destination;
      try {
        const resolveOutboundUrl = this.options.resolveOutboundUrl ?? resolveSafeOutboundUrl;
        destination = await resolveOutboundUrl(`${baseUrl}/chat/completions`);
      } catch {
        throw createProviderError({
          code: `${this.errorPrefix}_SSRF_BLOCKED`,
          type: "security",
          message: "SSRF blocked: provider endpoint resolves to a private or reserved address.",
          retryable: false,
          details: createErrorDetails(providerRequest),
        });
      }

      if (providerRequest.execution?.workforceDispatchFence !== undefined) {
        const workforceFence = await this._authorizeWorkforceDispatch(providerRequest, requestControl.signal);
        throwIfExecutionAborted(requestControl.signal);
        workforceFence.onDispatch();
      }
      const response = await fetchWithAgent(destination.url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: requestControl.signal,
        agent: getOrCreateAgent(baseUrl),
        lookup: destination.lookup,
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
      if (providerRequest.execution?.workforceDispatchFence !== undefined) {
        const reported = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
        const content = body?.choices?.[0]?.message?.content;
        providerResponse.raw = { ...providerResponse.raw, workforceObservation: {
          contentPresent: typeof content === "string" && content.trim().length > 0,
          usageReported: { inputTokens: reported(body?.usage?.prompt_tokens),
            outputTokens: reported(body?.usage?.completion_tokens), totalTokens: reported(body?.usage?.total_tokens) },
        } };
      }

      this._health.successfulRequests++;
      this._health.totalLatencyMs += Date.now() - requestStartedAt;
      this._health.lastSuccessAt = new Date().toISOString();
      this._recordPoolOutcome(credential, true);
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
      // classifyNonStreamError always throws a structured provider error; catch
      // it so the credential actually used can ride along for pool rotation.
      let classified;
      try {
        classifyNonStreamError(effectiveError, {
          errorPrefix: this.errorPrefix,
          providerName: this.modelConfig.providerDisplayName ?? this.modelConfig.providerId,
          providerRequest,
          timeoutMs,
        });
      } catch (normalized) {
        classified = normalized;
      }
      this._recordPoolOutcome(credential, false, classified ?? effectiveError);
      if (classified && typeof classified === "object" && !classified.credentialRef) {
        classified.credentialRef = credential;
      }
      throw classified ?? effectiveError;
    } finally {
      requestControl.cleanup();
    }
  }

  _recordPoolOutcome(credential, ok, error) {
    if (!credential?.pooled) return;
    const pool = this.options.credentialPool;
    if (!pool?.record) return;
    pool.record(this.modelConfig.providerId, credential.apiKey, ok, {
      benchOnFailure: ok ? false : this._isPoolSwapFailure(error),
    });
  }

  async *generateStream(providerRequest) {
    if (providerRequest.execution?.workforceDispatchFence !== undefined) {
      throw createProviderError({ code: "WORKFORCE_PROVIDER_STREAM_UNSUPPORTED", type: "authorization",
        message: "Workforce role contributions require the non-streaming Provider path.", retryable: false });
    }
    if (this.modelConfig.dryRun) {
      const text = `[dry-run:${providerRequest.target.providerId}/${providerRequest.target.modelId}] streaming provider adapter reserved`;
      yield { textDelta: text, raw: { dryRun: true } };
      return;
    }

    this.assertReady(providerRequest);
    const credential = this._resolveCredential();
    const apiKey = credential.apiKey;
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
    const pooled = credential.pooled;

    const streamConnection = await openStreamWithRetry({
      baseUrl,
      apiKey,
      payload,
      providerRequest,
      errorPrefix: this.errorPrefix,
      providerName,
      timeoutMs,
      maxRetries: pooled ? retryConfig.poolMaxAttempts : retryConfig.maxAttempts,
      retryDelay: (attempt, error, signal) => this._retryDelay(attempt, retryConfig, error, signal),
      resolveOutboundUrl: this.options.resolveOutboundUrl,
      signal: executionSignal,
      resolveApiKey: pooled ? () => this._pickPooledKey() : undefined,
      onAttemptOutcome: pooled
        ? (usedKey, ok, error) => this._recordPoolOutcome({ apiKey: usedKey, pooled: true }, ok, error)
        : undefined,
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
    const baseConfig = this.resolveRetryConfig();
    // The loop must be able to outlast the plain retry budget: a pooled provider
    // may legitimately need more attempts than maxRetries, because each attempt
    // consumes a *different* credential rather than repeating the same one.
    const loopBound = Math.max(baseConfig.maxAttempts, baseConfig.poolMaxAttempts);
    let lastError;
    for (let attempt = 1; attempt <= loopBound; attempt++) {
      throwIfExecutionAborted(signal);
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const swap = this._shouldRotatePooledKey(error);
        // Rotating to a fresh pool key is a different action from retrying the
        // same key, so it carries its own, larger budget.
        const allowedAttempts = swap ? baseConfig.poolMaxAttempts : baseConfig.maxAttempts;
        if (attempt >= allowedAttempts) {
          throw error;
        }
        if (swap) {
          // A pooled key swap does not need exponential backoff: the point is to
          // try a different credential, not to wait on the one just rejected.
          if (this._hasUntriedPooledKey(error)) continue;
          throw error;
        }
        if (!error?.retryable) {
          throw error;
        }
        await this._retryDelay(attempt, baseConfig, error, signal);
      }
    }
    throw lastError;
  }

  _shouldRotatePooledKey(error) {
    return Boolean(error?.credentialRef?.pooled) && this._isPoolSwapFailure(error);
  }

  _hasUntriedPooledKey(error) {
    const pool = this.options.credentialPool;
    if (!pool?.has?.(this.modelConfig.providerId)) return false;
    return pool.describe?.(this.modelConfig.providerId)?.alive > 0;
  }

  resolveRetryConfig() {
    const maxRetries = this.options.maxRetries ?? this.modelConfig.maxRetries ?? DEFAULT_MAX_RETRIES;
    // Historical HTTP adapter semantics: this is the total attempt count, including the first.
    if (!Number.isSafeInteger(maxRetries) || maxRetries < 1) {
      throw createProviderError({
        code: `${this.errorPrefix}_RETRY_CONFIG_INVALID`,
        type: "configuration",
        message: "HTTP provider maxRetries must be a positive safe integer counting total attempts; use 1 for no retries.",
        retryable: false,
        details: { parameter: "maxRetries", minimum: 1, semantics: "total-attempts" },
      });
    }
    const pooled = this.options.credentialPool?.has?.(this.modelConfig.providerId) === true;
    return {
      maxRetries,
      maxAttempts: maxRetries,
      poolMaxAttempts: this._resolveAttemptBudget(pooled),
      baseDelayMs: this.options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
      maxDelayMs: this.options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS,
    };
  }

  async _authorizeWorkforceDispatch(providerRequest, signal) {
    const fence = providerRequest.execution?.workforceDispatchFence;
    if (fence === undefined) return;
    const denied = () => createProviderError({ code: "WORKFORCE_PROVIDER_DISPATCH_DENIED", type: "authorization",
      message: "The Workforce task claim or binding no longer authorizes Provider dispatch.", retryable: false });
    if (!fence || typeof fence.assertActive !== "function" || typeof fence.onDispatch !== "function"
      || fence.providerId !== providerRequest.target?.providerId || fence.modelId !== providerRequest.target?.modelId) throw denied();
    try {
      await fence.assertActive("commit");
      throwIfExecutionAborted(signal);
    } catch (error) {
      const cancellation = findExecutionAbortError(error, signal);
      if (cancellation) throw cancellation;
      if (error?.category === "provider" && String(error.code).startsWith("WORKFORCE_")) throw error;
      throw denied();
    }
    return fence;
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
    if (!this._hasUsableCredential()) {
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
    // Kept as a pure lookup for compatibility with existing callers: it returns
    // the pool's next key, else the single configured key, else "". It never
    // throws — the exhaustion error belongs to the dispatch path, below.
    const pooled = this._pickPooledKey();
    if (pooled) return pooled;
    return this.options.runtimeCredentialStore?.getApiKey(this.modelConfig.providerId) || this.modelConfig.apiKey || "";
  }

  /**
   * Resolve one credential for a single outbound attempt.
   * A configured multi-key pool takes precedence; otherwise the pre-existing
   * single-key lookup is used unchanged, so providers without a pool behave
   * exactly as before.
   */
  _resolveCredential() {
    const pool = this.options.credentialPool;
    if (pool?.has?.(this.modelConfig.providerId)) {
      const pooled = this._pickPooledKey();
      if (pooled) return { apiKey: pooled, pooled: true };
      // Every pooled key is benched or exhausted. Rather than send an empty
      // Authorization header, surface an explicit, non-retryable pool error.
      throw createProviderError({
        code: `${this.errorPrefix}_CREDENTIAL_POOL_EXHAUSTED`,
        type: "configuration",
        message: `${this.modelConfig.providerDisplayName ?? this.modelConfig.providerId} credential pool has no usable key.`,
        retryable: false,
        details: {
          providerId: this.modelConfig.providerId,
          modelId: this.modelConfig.modelId,
          poolAlive: pool.describe?.(this.modelConfig.providerId)?.alive ?? 0,
        },
      });
    }
    return {
      apiKey: this.options.runtimeCredentialStore?.getApiKey(this.modelConfig.providerId) || this.modelConfig.apiKey || "",
      pooled: false,
    };
  }

  /**
   * True when some credential exists. A configured pool counts even while all
   * its keys are momentarily benched, so a transient bench never downgrades the
   * provider into an "API key missing" configuration error.
   */
  _hasUsableCredential() {
    if (this.options.runtimeCredentialStore?.getApiKey(this.modelConfig.providerId) || this.modelConfig.apiKey) {
      return true;
    }
    return this.options.credentialPool?.has?.(this.modelConfig.providerId) === true;
  }

  _pickPooledKey() {
    const pool = this.options.credentialPool;
    if (!pool?.has?.(this.modelConfig.providerId)) return "";
    return pool.pick(this.modelConfig.providerId) || "";
  }

  /** Attempt budget: a pool can rotate through several keys before giving up. */
  _resolveAttemptBudget(pooled) {
    const configuredRaw = this.options.maxRetries ?? this.modelConfig.maxRetries;
    const configured = Number.isSafeInteger(configuredRaw) && configuredRaw >= 1
      ? configuredRaw
      : undefined;
    if (!pooled) return configured ?? DEFAULT_MAX_RETRIES;
    const poolSize = this.options.credentialPool?.describe?.(this.modelConfig.providerId)?.alive ?? 0;
    const poolBudget = Math.max(2, Math.min(poolSize || 2, 8));
    return Math.max(configured ?? DEFAULT_MAX_RETRIES, poolBudget);
  }

  /**
   * Auth/quota failures are not retryable against the *same* key, but they are
   * exactly the signal to swap to another key from the pool.
   */
  _isPoolSwapFailure(error) {
    return error?.code === `${this.errorPrefix}_UNAUTHORIZED`
      || error?.code === `${this.errorPrefix}_FORBIDDEN`
      || error?.code === `${this.errorPrefix}_RATE_LIMIT`
      || error?.type === "authentication"
      || error?.type === "authorization"
      || error?.type === "rate_limit";
  }

  resolveBaseUrl() {
    if (this.modelConfig.fixedEndpoint === true) {
      return this.baseUrl || "";
    }
    return this.options.runtimeCredentialStore?.getEndpoint(this.modelConfig.providerId) || this.baseUrl || "";
  }

  async warmConnection() {
    const baseUrl = this.resolveBaseUrl();
    if (!baseUrl) {
      return { warmed: false, error: "No base URL configured" };
    }

    const startedAt = Date.now();
    try {
      await safeOutboundFetch(`${baseUrl}/models`, {
        method: "HEAD",
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

function normalizeConfiguredModels(modelConfig, fallbackModel) {
  if (!Array.isArray(modelConfig.models) || modelConfig.models.length === 0) {
    return [];
  }

  const seen = new Set();
  const explicitSelectionRequired = modelConfig.staticModelsRequireExplicitSelection === true;
  const configured = modelConfig.models.flatMap((model) => {
    const id = String(model?.id ?? model?.modelId ?? "").trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const capabilities = Array.isArray(model?.capabilities)
      ? model.capabilities.map((value) => String(value).trim()).filter(Boolean)
      : modelConfig.capabilities;
    const configuredDefaultModel = id === String(modelConfig.modelId ?? "").trim();
    const enabled = explicitSelectionRequired
      ? configuredDefaultModel
        && modelConfig.modelSelectionExplicit === true
        && modelConfig.enabled !== false
      : model?.enabled !== false && modelConfig.enabled !== false;
    return [{
      ...fallbackModel,
      id,
      displayName: String(model?.displayName ?? model?.modelDisplayName ?? id),
      capabilities: capabilities.length ? [...new Set(capabilities)] : ["chat", "summary"],
      enabled,
      priority: Number.isFinite(Number(model?.priority))
        ? Number(model.priority)
        : modelConfig.priority,
      metadata: {
        ...(fallbackModel?.metadata ?? {}),
        ...(model?.metadata ?? {}),
        staticProviderModel: true,
        configuredDefaultModel,
        observedUnverified: explicitSelectionRequired,
      },
    }];
  });
  if (fallbackModel?.id && !seen.has(fallbackModel.id)) {
    configured.unshift({
      ...fallbackModel,
      enabled: explicitSelectionRequired
        ? modelConfig.modelSelectionExplicit === true && fallbackModel.enabled !== false
        : fallbackModel.enabled,
      metadata: {
        ...(fallbackModel.metadata ?? {}),
        staticProviderModel: false,
        configuredDefaultModel: true,
      },
    });
  }
  return configured;
}

export function createHttpLLMProviderAdapter(modelConfig, options = {}) {
  return new HttpLLMProviderAdapter(modelConfig, options);
}
