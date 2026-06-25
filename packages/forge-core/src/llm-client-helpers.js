/**
 * LLM client helpers — cache, provider registry, circuit breaker, direct call core, and shared state.
 * Extracted from llm-client.js to keep the main module under 500 lines.
 */

import { retryWithBackoff, isTransientError } from './resilience/index.js';
import { getTraceContext } from './tracing/index.js';

// ---- Distributed Tracing State ----
let _traceManager = null;
export function setTraceManager(tm) { _traceManager = tm; }
export function getTraceManager() { return _traceManager; }

// ---- LLM Response Cache ----
// Short-term in-memory cache for identical prompts within a session.
// Prevents redundant LLM calls when multiple workers read the same context.

export const CACHE_MAX_SIZE = 50;
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _llmCache = new Map();

export function cacheKey(systemPrompt, userPrompt, opts) {
  // Simple hash: first 200 chars of each + key options
  const s = (systemPrompt || '').slice(0, 200);
  const u = (userPrompt || '').slice(0, 200);
  const t = opts?.temperature ?? 0.2;
  const m = opts?.maxTokens ?? 4096;
  return `${s}|||${u}|||t=${t}|||m=${m}`;
}

export function cacheGet(key) {
  const entry = _llmCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _llmCache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value) {
  // Evict oldest if at capacity
  if (_llmCache.size >= CACHE_MAX_SIZE) {
    const oldest = _llmCache.keys().next().value;
    _llmCache.delete(oldest);
  }
  _llmCache.set(key, { value, timestamp: Date.now() });
}

export function clearLLMCache() { _llmCache.clear(); }
export function getLLMCacheSize() { return _llmCache.size; }
export function getCacheMap() { return _llmCache; }

// ---- Dynamic Provider Registry (injected from shared-config) ----

/** @type {import('./integration/provider-registry.js').ForgeProviderRegistry|null} */
let _providerRegistry = null;

/**
 * Inject a ForgeProviderRegistry (built from shared-config) for dynamic
 * provider resolution. When set, PROVIDERS lookups check the registry first.
 * @param {object|null} registry
 */
export function setProviderRegistry(registry) { _providerRegistry = registry; }
export function getProviderRegistry() { return _providerRegistry; }

// ---- P11 Cost Integration: LLMCache, TokenPredictor, BudgetEnforcer ----
let _p11Cache = null;         // LLMCache instance (P11)
let _tokenPredictor = null;   // TokenPredictor instance (P11)
let _budgetEnforcer = null;   // BudgetEnforcer instance (P11)

export function setP11Cache(cache) { _p11Cache = cache; }
export function setP11TokenPredictor(tp) { _tokenPredictor = tp; }
export function setP11BudgetEnforcer(be) { _budgetEnforcer = be; }
export function getP11Cache() { return _p11Cache; }
export function getP11TokenPredictor() { return _tokenPredictor; }
export function getP11BudgetEnforcer() { return _budgetEnforcer; }

// ---- Fallback Provider Map ----

const PROVIDERS = {
  xiaomi: {
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    envKey: 'MIMO_API_KEY',
    defaultModel: 'mimo-v2.5-pro',
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    envKey: 'NVIDIA_API_KEY',
    defaultModel: 'nvidia/llama-3.3-nemotron-super-49b-v1',
  },
};

/**
 * Resolve a provider config by name.
 * Checks the injected registry first, then falls back to the hardcoded map.
 */
export function resolveProvider(provider) {
  if (_providerRegistry) {
    const resolved = _providerRegistry.resolve(provider);
    if (resolved) return resolved;
  }
  return PROVIDERS[provider] || null;
}

export function getProviderNames() {
  return _providerRegistry ? _providerRegistry.list() : Object.keys(PROVIDERS);
}

// ---- Timeout / Retry Constants ----

/** Default LLM call timeout (can be overridden by AdaptiveTimeout). */
export const LLM_TIMEOUT_MS = parseInt(process.env.FORGE_LLM_TIMEOUT) || 90000;

/** Gateway call timeout — code generation needs longer than 15s. */
export const GATEWAY_TIMEOUT_MS = parseInt(process.env.FORGE_GATEWAY_TIMEOUT) || 120000;

/** Max retry attempts for transient HTTP errors. */
export const LLM_MAX_RETRIES = parseInt(process.env.FORGE_LLM_RETRIES) || 3;

// ============================================================================
// M5: Circuit Breaker
// ============================================================================

/**
 * Provider 熔断器状态
 * 每个 provider 独立跟踪失败次数,超过阈值后短路。
 */
const _breakerState = new Map(); // provider -> { failures, lastFailureMs, openUntil }

const BREAKER_THRESHOLD = 5;        // 连续失败 5 次后熔断
const BREAKER_RESET_MS = 60_000;    // 60 秒后尝试半开

/**
 * 检查 provider 是否被熔断
 * @param {string} provider
 * @returns {{ allowed: boolean, state: 'closed'|'open'|'half-open' }}
 */
export function getBreakerState(provider) {
  const s = _breakerState.get(provider);
  if (!s) return { allowed: true, state: 'closed' };
  if (s.openUntil && Date.now() < s.openUntil) {
    return { allowed: false, state: 'open' };
  }
  return { allowed: true, state: s.failures > 0 ? 'half-open' : 'closed' };
}

export function breakerSuccess(provider) {
  _breakerState.delete(provider);
}

export function breakerFailure(provider) {
  const s = _breakerState.get(provider) || { failures: 0, lastFailureMs: 0, openUntil: 0 };
  s.failures++;
  s.lastFailureMs = Date.now();
  if (s.failures >= BREAKER_THRESHOLD) {
    s.openUntil = Date.now() + BREAKER_RESET_MS;
  }
  _breakerState.set(provider, s);
}

/**
 * 重置指定 provider 的熔断器
 * @param {string} [provider] - 不传则重置全部
 */
export function resetBreaker(provider) {
  if (provider) {
    _breakerState.delete(provider);
  } else {
    _breakerState.clear();
  }
}

/**
 * 获取当前可用的 provider 列表(排除被熔断的)
 * @returns {string[]}
 */
export function getAvailableProviders() {
  const all = getProviderNames();
  return all.filter((p) => getBreakerState(p).allowed);
}

/**
 * 获取竞速 + 熔断 + 缓存的综合状态
 * @returns {Object}
 */
export function getRaceStatus() {
  const providers = getProviderNames();
  const breakerSummary = {};
  for (const p of providers) {
    breakerSummary[p] = getBreakerState(p);
  }
  return {
    cacheSize: getLLMCacheSize(),
    cacheMaxSize: CACHE_MAX_SIZE,
    cacheTtlMs: CACHE_TTL_MS,
    breakers: breakerSummary,
    availableProviders: getAvailableProviders(),
    totalProviders: providers.length,
  };
}

// ============================================================================
// Direct LLM Call Core
// ============================================================================

/**
 * Core LLM call — returns both completion text and token usage metadata.
 * Calls OpenAI-compatible chat/completions directly with retry and tracing.
 *
 * @param {object} opts
 * @param {string} opts.provider - 'xiaomi' or 'nvidia'
 * @param {string} [opts.model] - model name (defaults per provider)
 * @param {string} [opts.apiKey] - API key (defaults to env var)
 * @param {Array} opts.messages - chat messages
 * @param {number} [opts.temperature] - sampling temperature
 * @param {number} [opts.maxTokens] - max output tokens
 * @returns {{ text: string, usage: { inputTokens: number, outputTokens: number, totalTokens: number, model: string } }}
 */
export async function callLLMDirectCore({ provider = 'xiaomi', model, apiKey, messages, temperature = 0.2, maxTokens = 4096, timeoutMs, maxRetries, responseFormat }) {
  const config = resolveProvider(provider);
  const providerNames = getProviderNames();
  if (!config) throw new Error(`Unknown provider: ${provider}. Available: ${providerNames.join(', ')}`);

  const baseUrl = config.baseUrl;
  const resolvedModel = model || config.defaultModel;
  const resolvedKey = apiKey || process.env[config.envKey];
  const callTimeout = timeoutMs || LLM_TIMEOUT_MS;
  const retries = maxRetries ?? LLM_MAX_RETRIES;
  const traceManager = getTraceManager();

  if (!resolvedKey) {
    throw new Error(`API key not found. Set ${config.envKey} environment variable or pass apiKey directly.`);
  }

  // --- Distributed tracing: start span for direct LLM call ---
  const ctx = getTraceContext();
  const llmSpan = traceManager?.startSpan({
    traceId: ctx.traceId,
    parentSpanId: ctx.parentSpanId,
    operationName: 'llm_call',
    attributes: {
      'forge.llm.provider': provider || 'unknown',
      'forge.llm.model': resolvedModel || 'unknown',
      'forge.llm.route': 'direct',
      'forge.llm.temperature': temperature ?? 0.2,
      'forge.llm.max_tokens': maxTokens ?? 4096
    }
  });

  try {
    const result = await retryWithBackoff(async () => {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${resolvedKey}`,
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: false,
          ...(responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(callTimeout),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        const err = new Error(`Provider ${provider} returned ${res.status}: ${errorText.slice(0, 500)}`);
        err.status = res.status;
        throw err;
      }

      const json = await res.json();
      const choice = json.choices?.[0];
      if (!choice) {
        throw new Error(`Provider ${provider} returned no choices: ${JSON.stringify(json).slice(0, 500)}`);
      }

      // Extract usage from API response (prompt_tokens, completion_tokens, total_tokens)
      const usage = {
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        totalTokens: json.usage?.total_tokens ?? 0,
        model: resolvedModel,
      };

      let text = choice.message?.content || '';

      // Handle reasoning models (MiMo, etc.) that put thinking in reasoning_content
      // If content is empty but reasoning exists, the model was truncated — retry with more tokens
      if (!text && choice.message?.reasoning_content) {
        if (choice.finish_reason === 'length' && maxTokens < 32768) {
          console.log(`[forge:llm] Reasoning model returned empty content (truncated). Retrying with more tokens...`);
          const retryResult = await callLLMDirectCore({ provider, model, apiKey, messages, temperature, maxTokens: Math.min(maxTokens * 2, 32768), timeoutMs, maxRetries: 0, responseFormat });
          if (retryResult.text) return retryResult;
        }
        console.log(`[forge:llm] Using reasoning_content as fallback (${choice.message.reasoning_content.length} chars)`);
        text = choice.message.reasoning_content;
      }

      if (!text) {
        throw new Error(`Provider ${provider} returned no content. finish_reason=${choice.finish_reason}`);
      }

      return { text, usage };
    }, {
      maxAttempts: retries,
      baseDelay: 2000,
      maxDelay: 30000,
      jitter: 1500,
      shouldRetry: isTransientError,
      onRetry: (err, attempt, delay) => {
        console.log(`[forge:llm] Transient error (attempt ${attempt}/${retries}), retrying in ${delay}ms: ${err.message.slice(0, 120)}`);
      },
    });
    try {
      const usage = result?.usage;
      llmSpan?.end('ok', { 'forge.llm.input_tokens': usage?.inputTokens, 'forge.llm.output_tokens': usage?.outputTokens, 'forge.llm.total_tokens': usage?.totalTokens });
    } catch { /* best-effort: span telemetry must not break main flow */ }
    return result;
  } catch (err) {
    try { llmSpan?.end('error', { 'forge.llm.error': err.message }); } catch { /* best-effort */ }
    throw err;
  } finally {
    try { llmSpan?.end('ok'); } catch { /* best-effort */ }
  }
}
