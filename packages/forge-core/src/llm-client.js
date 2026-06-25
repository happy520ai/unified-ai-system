/**
 * Direct LLM client — calls OpenAI-compatible APIs directly, bypassing the AI Gateway.
 * Used when the Gateway is in fake mode or when Forge needs direct provider access.
 *
 * Resilience: AbortSignal timeout, exponential backoff retry, circuit breaker.
 *
 * Integration: When a ForgeProviderRegistry is injected via setProviderRegistry(),
 * providers are resolved from the shared-config provider list (30+ models).
 * Without injection, falls back to the legacy hardcoded PROVIDERS map.
 *
 * State and helpers (cache, breaker, provider registry, P11, direct call core)
 * live in ./llm-client-helpers.js to keep this file focused on gateway-routed
 * call logic and racing.
 */

import { getTraceContext } from './tracing/index.js';
import {
  getTraceManager, resolveProvider, getProviderNames,
  cacheKey, cacheGet, cacheSet,
  GATEWAY_TIMEOUT_MS,
  getBreakerState, breakerSuccess, breakerFailure, getAvailableProviders,
  getP11Cache, getP11TokenPredictor, getP11BudgetEnforcer,
  getProviderRegistry, callLLMDirectCore,
} from './llm-client-helpers.js';

// Re-export all public helpers so existing imports from llm-client.js keep working
export {
  setTraceManager, clearLLMCache, getLLMCacheSize,
  setProviderRegistry, getProviderRegistry,
  setP11Cache, setP11TokenPredictor, setP11BudgetEnforcer,
  getP11Cache, getP11TokenPredictor, getP11BudgetEnforcer,
  getBreakerState, resetBreaker, getRaceStatus,
} from './llm-client-helpers.js';

// ============================================================================
// Direct LLM Call Wrappers
// ============================================================================

/**
 * Call an LLM directly via OpenAI-compatible chat completions API.
 * Returns only the completion text (backward-compatible).
 */
export async function callLLMDirect(opts) {
  const { text } = await callLLMDirectCore(opts);
  return text;
}

/**
 * Call an LLM directly via OpenAI-compatible chat completions API.
 * Returns both completion text and token usage metadata.
 */
export async function callLLMDirectWithUsage(opts) {
  return callLLMDirectCore(opts);
}

// ============================================================================
// Gateway-Routed Smart LLM Calls
// ============================================================================

/**
 * Core smart LLM call — tries Gateway first, falls back to direct API.
 * Returns both text and usage metadata.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts
 * @returns {{ text: string, usage: { inputTokens: number, outputTokens: number, totalTokens: number, model: string } }}
 */
async function _callLLMCore(systemPrompt, userPrompt, opts = {}) {
  const _p11Cache = getP11Cache();
  const _tokenPredictor = getP11TokenPredictor();
  const _budgetEnforcer = getP11BudgetEnforcer();
  const _providerRegistry = getProviderRegistry();
  const traceManager = getTraceManager();

  // Check cache first (skip for structured output — those are task-specific)
  const ck = !opts.responseFormat ? cacheKey(systemPrompt, userPrompt, opts) : null;
  if (ck) {
    const cached = cacheGet(ck);
    if (cached) {
      console.log(`[forge:llm] Cache hit (saved ~1 LLM call)`);
      return cached;
    }
  }

  // P11 LLMCache: check advanced cache (fuzzy match + LRU)
  if (_p11Cache && !opts.responseFormat) {
    const p11Hit = _p11Cache.get(systemPrompt, userPrompt);
    if (p11Hit) {
      console.log(`[forge:llm] P11 cache hit (similarity=${p11Hit.similarity ?? 'exact'})`);
      return p11Hit.response
        ? { text: typeof p11Hit.response === 'string' ? p11Hit.response : p11Hit.response.text || JSON.stringify(p11Hit.response), usage: p11Hit.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0, model: 'cached' } }
        : p11Hit;
    }
  }

  // Resolve gateway URL: env var > provider registry > default
  let gatewayUrl = process.env.FORGE_GATEWAY_URL;
  if (!gatewayUrl && _providerRegistry) {
    const ep = _providerRegistry.getGatewayEndpoint();
    if (ep) gatewayUrl = ep;
  }
  gatewayUrl = gatewayUrl || 'http://127.0.0.1:3100';

  // Resolve provider/model: env var > provider registry default > hardcoded
  let provider = process.env.FORGE_LLM_PROVIDER;
  let model = process.env.FORGE_LLM_MODEL;
  if (!provider && _providerRegistry) {
    const def = _providerRegistry.getDefaultProvider();
    if (def) { provider = def.providerId; model = model || def.modelId; }
  }
  provider = provider || 'xiaomi';
  model = model || 'mimo-v2.5-pro';

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // --- Distributed tracing: start span for gateway attempt ---
  const ctx = getTraceContext();
  const gatewaySpan = traceManager?.startSpan({
    traceId: ctx.traceId,
    parentSpanId: ctx.parentSpanId,
    operationName: 'llm_call',
    attributes: {
      'forge.llm.provider': provider || 'unknown',
      'forge.llm.model': model || 'unknown',
      'forge.llm.route': 'gateway',
      'forge.llm.temperature': opts.temperature ?? 0.2,
      'forge.llm.max_tokens': opts.maxTokens ?? 4096
    }
  });

  // P11 BudgetEnforcer: check budget before calling
  if (_budgetEnforcer) {
    const goalId = opts.goalId || 'default';
    if (!_budgetEnforcer.canProceed(goalId)) {
      const report = _budgetEnforcer.getSpendingReport();
      throw new Error(`Budget exceeded: ${JSON.stringify(report)}`);
    }
  }

  // Try Gateway first (with timeout)
  try {
    const res = await fetch(`${gatewayUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        messages,
        options: {
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: opts.maxTokens ?? 4096,
          ...(opts.responseFormat ? { responseFormat: opts.responseFormat } : {}),
        },
      }),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        const textCandidate = json.data?.outputText || json.data?.text;
        // Check if it's from a fake provider (echo back)
        if (textCandidate && !textCandidate.startsWith('[fake:')) {
          console.log(`[forge:llm] Response via Gateway (${json.data?.selectedProvider || 'unknown'})`);
          const usage = {
            inputTokens: json.data?.usage?.prompt_tokens ?? json.data?.usage?.inputTokens ?? 0,
            outputTokens: json.data?.usage?.completion_tokens ?? json.data?.usage?.outputTokens ?? 0,
            totalTokens: json.data?.usage?.total_tokens ?? json.data?.usage?.totalTokens ?? 0,
            model: json.data?.selectedModel || model,
          };
          try { gatewaySpan?.end('ok', { 'forge.llm.input_tokens': usage?.inputTokens, 'forge.llm.output_tokens': usage?.outputTokens, 'forge.llm.total_tokens': usage?.totalTokens }); } catch { /* best-effort */ }
          const result = { text: textCandidate, usage };
          if (_tokenPredictor) {
            _tokenPredictor.recordActual({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens, model: usage.model });
          }
          if (_budgetEnforcer) {
            try { _budgetEnforcer.recordUsage(opts.goalId || 'default', usage); } catch { /* goal not registered */ }
          }
          if (_p11Cache && ck) {
            _p11Cache.set(systemPrompt, userPrompt, result, usage);
          }
          if (ck) cacheSet(ck, result);
          return result;
        }
      }
    }
    try { gatewaySpan?.end('ok'); } catch { /* best-effort */ }
  } catch (err) {
    try { gatewaySpan?.end('error', { 'forge.llm.error': err.message }); } catch { /* best-effort */ }
  }

  // Fallback to direct API
  console.log(`[forge:llm] Gateway unavailable/fake, calling ${provider} directly...`);
  const directResult = await callLLMDirectCore({
    provider, model, messages,
    temperature: opts.temperature ?? 0.2,
    maxTokens: opts.maxTokens ?? 4096,
    responseFormat: opts.responseFormat,
  });
  if (_tokenPredictor && directResult.usage) {
    _tokenPredictor.recordActual({
      inputTokens: directResult.usage.inputTokens,
      outputTokens: directResult.usage.outputTokens,
      totalTokens: directResult.usage.totalTokens,
      model: directResult.usage.model,
    });
  }
  if (_budgetEnforcer && directResult.usage) {
    try { _budgetEnforcer.recordUsage(opts.goalId || 'default', directResult.usage); } catch { /* goal not registered */ }
  }
  if (_p11Cache && ck) {
    _p11Cache.set(systemPrompt, userPrompt, directResult, directResult.usage);
  }
  if (ck) cacheSet(ck, directResult);
  return directResult;
}

/**
 * Streaming LLM call via Gateway's SSE endpoint (/chat/stream).
 * Falls back to non-streaming if gateway is unavailable.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts — same as callLLMWithUsage plus:
 * @param {function(string): void} [opts.onChunk] — called for each text delta
 * @param {string} [opts.goalId] — goal ID for budget tracking
 * @returns {Promise<{ text: string, usage: object }>}
 */
export async function callLLMStream(systemPrompt, userPrompt, opts = {}) {
  const onChunk = opts.onChunk || (() => {});
  const _p11Cache = getP11Cache();
  const _tokenPredictor = getP11TokenPredictor();
  const _budgetEnforcer = getP11BudgetEnforcer();
  const _providerRegistry = getProviderRegistry();

  // Resolve gateway URL
  let gatewayUrl = process.env.FORGE_GATEWAY_URL;
  if (!gatewayUrl && _providerRegistry) {
    const ep = _providerRegistry.getGatewayEndpoint();
    if (ep) gatewayUrl = ep;
  }
  gatewayUrl = gatewayUrl || 'http://127.0.0.1:3100';

  // P11 Budget check
  if (_budgetEnforcer) {
    const goalId = opts.goalId || 'default';
    if (!_budgetEnforcer.canProceed(goalId)) {
      throw new Error(`Budget exceeded: ${JSON.stringify(_budgetEnforcer.getSpendingReport())}`);
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    const res = await fetch(`${gatewayUrl}/chat/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'text/event-stream' },
      body: JSON.stringify({
        messages,
        options: {
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: opts.maxTokens ?? 4096,
          ...(opts.responseFormat ? { responseFormat: opts.responseFormat } : {}),
        },
      }),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`Gateway stream returned ${res.status}`);

    // Parse SSE stream
    let fullText = '';
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, model: '' };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content' || parsed.type === 'chunk') {
              const delta = parsed.text || parsed.content || parsed.delta || '';
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } else if (parsed.type === 'done' || parsed.type === 'complete') {
              if (parsed.usage) {
                usage = {
                  inputTokens: parsed.usage.prompt_tokens ?? parsed.usage.inputTokens ?? 0,
                  outputTokens: parsed.usage.completion_tokens ?? parsed.usage.outputTokens ?? 0,
                  totalTokens: parsed.usage.total_tokens ?? parsed.usage.totalTokens ?? 0,
                  model: parsed.model || parsed.usage.model || '',
                };
              }
            } else if (parsed.type === 'error') {
              throw new Error(`Stream error: ${parsed.error || parsed.message}`);
            }
          } catch (e) {
            if (e.message.startsWith('Stream error:')) throw e;
            // Skip unparseable SSE lines
          }
        }
      }
    }

    if (!fullText) {
      throw new Error('Gateway stream returned empty response');
    }

    // Record usage
    if (_tokenPredictor) {
      _tokenPredictor.recordActual({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens, model: usage.model });
    }
    if (_budgetEnforcer && usage.totalTokens > 0) {
      try { _budgetEnforcer.recordUsage(opts.goalId || 'default', usage); } catch { /* goal not registered */ }
    }
    if (_p11Cache) {
      _p11Cache.set(systemPrompt, userPrompt, { text: fullText, usage }, usage);
    }

    console.log(`[forge:llm] Stream complete (${fullText.length} chars, ${usage.totalTokens} tokens)`);
    return { text: fullText, usage };
  } catch (err) {
    console.log(`[forge:llm] Stream failed (${err.message}), falling back to non-streaming...`);
    return _callLLMCore(systemPrompt, userPrompt, opts);
  }
}

/**
 * Smart LLM call — tries Gateway first, falls back to direct API.
 * Returns only the completion text (backward-compatible).
 */
export async function callLLM(systemPrompt, userPrompt, opts = {}) {
  const { text } = await _callLLMCore(systemPrompt, userPrompt, opts);
  return text;
}

/**
 * Smart LLM call — tries Gateway first, falls back to direct API.
 * Returns both completion text and token usage metadata.
 */
export async function callLLMWithUsage(systemPrompt, userPrompt, opts = {}) {
  return _callLLMCore(systemPrompt, userPrompt, opts);
}

// ============================================================================
// M5: 竞速调用 (Racing) + 增强熔断
// ============================================================================

/**
 * 竞速调用 — 同时请求多个 provider,返回最先成功的结果。
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {Object} [opts]
 * @param {string[]} [opts.providers] - 参与竞速的 provider 列表
 * @param {number} [opts.raceTimeoutMs=30000] - 竞速总超时
 * @param {boolean} [opts.useCache=true] - 是否使用缓存
 * @returns {Promise<{ text: string, provider: string, usage: object, winnerIndex: number }>}
 */
export async function callLLMRace(systemPrompt, userPrompt, opts = {}) {
  const providers = opts.providers || getAvailableProviders();
  if (providers.length === 0) {
    throw new Error('callLLMRace: no providers available');
  }
  if (providers.length === 1) {
    const result = await callLLMWithUsage(systemPrompt, userPrompt, { ...opts, provider: providers[0] });
    return { ...result, provider: providers[0], winnerIndex: 0 };
  }

  const ck = cacheKey(systemPrompt, userPrompt, { ...opts, race: providers.join(',') });
  if (opts.useCache !== false) {
    const cached = cacheGet(ck);
    if (cached) {
      return { ...cached, provider: cached.provider || 'cache', winnerIndex: -1 };
    }
  }

  const raceTimeoutMs = opts.raceTimeoutMs || 30_000;

  const racers = providers.map(async (provider, index) => {
    const breaker = getBreakerState(provider);
    if (!breaker.allowed) {
      throw new Error(`Provider ${provider} circuit breaker is ${breaker.state}`);
    }
    try {
      const result = await callLLMWithUsage(systemPrompt, userPrompt, { ...opts, provider });
      breakerSuccess(provider);
      return { ...result, provider, winnerIndex: index };
    } catch (err) {
      breakerFailure(provider);
      throw err;
    }
  });

  try {
    const winner = await Promise.any([
      ...racers,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Race timeout after ${raceTimeoutMs}ms`)), raceTimeoutMs)
      ),
    ]);

    if (opts.useCache !== false) {
      cacheSet(ck, { text: winner.text, usage: winner.usage, provider: winner.provider });
    }

    return winner;
  } catch (aggregateError) {
    const errors = aggregateError.errors || [aggregateError];
    throw new Error(`callLLMRace: all ${providers.length} providers failed. First error: ${errors[0]?.message || 'unknown'}`);
  }
}
