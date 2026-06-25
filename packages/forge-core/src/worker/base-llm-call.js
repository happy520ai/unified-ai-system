/**
 * LLM calling utilities for BaseWorker.
 * Handles caching, token tracking, and retry logic.
 */

import { callLLMWithUsage } from '../llm-client.js';

/**
 * Call the LLM with caching and token tracking.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @param {object} opts — extra options for the LLM call
 * @param {object} params — { llmCache, logger, tokenUsage }
 *   tokenUsage is mutated in place to accumulate token counts.
 * @returns {Promise<string>} — the LLM response text
 */
export async function callLLM(systemPrompt, userPrompt, maxTokens = 8192, opts = {}, params) {
  const { llmCache, logger, tokenUsage } = params;
  if (llmCache) {
    const cached = llmCache.get(systemPrompt, userPrompt, opts);
    if (cached.hit) {
      logger.info(`LLM cache hit (age: ${Math.round(cached.age / 1000)}s)`);
      if (cached.usage && tokenUsage) {
        tokenUsage.inputTokens += cached.usage.inputTokens || 0;
        tokenUsage.outputTokens += cached.usage.outputTokens || 0;
        tokenUsage.totalTokens += cached.usage.totalTokens || 0;
        tokenUsage.llmCalls += 1;
      }
      return cached.text;
    }
  }
  const result = await callLLMWithUsage(systemPrompt, userPrompt, { temperature: 0.1, maxTokens, ...opts });
  if (result.usage && tokenUsage) {
    tokenUsage.inputTokens += result.usage.inputTokens || 0;
    tokenUsage.outputTokens += result.usage.outputTokens || 0;
    tokenUsage.totalTokens += result.usage.totalTokens || 0;
    tokenUsage.llmCalls += 1;
  }
  if (llmCache) llmCache.set(systemPrompt, userPrompt, opts, { text: result.text, usage: result.usage });
  return result.text;
}

/**
 * Call the LLM with retry logic for transient network errors.
 * @param {string} systemPrompt
 * @param {string} prompt
 * @param {number} maxTokens
 * @param {object} opts
 * @param {object} params — { llmCache, logger, tokenUsage }
 * @param {number} maxAttempts
 */
export async function callLLMWithRetry(systemPrompt, prompt, maxTokens = 8192, opts = {}, params, maxAttempts = 3) {
  const { logger } = params;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await callLLM(systemPrompt, prompt, maxTokens, opts, params);
    } catch (err) {
      const isTransient = err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('network') || err.message.includes('ETIMEDOUT') || err.message.includes('timeout');
      if (attempt < maxAttempts - 1 && isTransient) {
        const delay = 2000 * (attempt + 1);
        logger.info(`LLM call failed (attempt ${attempt + 1}/${maxAttempts}): ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else { throw err; }
    }
  }
}
