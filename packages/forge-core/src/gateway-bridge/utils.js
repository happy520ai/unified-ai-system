/**
 * GatewayBridge — constants, safe-fetch helper, and heuristic model selection.
 *
 * Extracted from index.js to keep the class module under the 500-line limit (分层律).
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:3100';

/**
 * Default provider used for direct LLM fallback calls.
 * Must match a key in llm-client.js's PROVIDERS map.
 */
export const DEFAULT_DIRECT_PROVIDER = 'xiaomi';

/**
 * Default model used for direct LLM fallback calls and heuristic selection.
 */
export const DEFAULT_DIRECT_MODEL = 'mimo-v2.5-pro';

/**
 * Heuristic model map used when the gateway is unavailable.
 * Maps task types to recommended model + reasoning string.
 */
export const TASK_TYPE_MODEL_MAP = {
  explore:   { model: 'mimo-v2.5-pro', reason: 'fast exploration' },
  plan:      { model: 'mimo-v2.5-pro', reason: 'architecture planning' },
  implement: { model: 'mimo-v2.5-pro', reason: 'code generation' },
  test:      { model: 'mimo-v2.5-pro', reason: 'test writing' },
  verify:    { model: 'mimo-v2.5-pro', reason: 'verification' },
  review:    { model: 'mimo-v2.5-pro', reason: 'code review' },
  debug:     { model: 'mimo-v2.5-pro', reason: 'debugging' },
  refactor:  { model: 'mimo-v2.5-pro', reason: 'refactoring' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Perform a fetch with an AbortSignal timeout, returning null on any failure
 * (network error, timeout, non-2xx status). Used internally for optional
 * requests where a clean fallback is preferred over thrown errors.
 *
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 * @returns {Promise<Response|null>}
 */
export async function safeFetch(url, init, timeoutMs) {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? res : null;
  } catch {
    return null;
  }
}

/**
 * Select model based on task type heuristics (when gateway is unavailable).
 *
 * @param {string} taskType
 * @returns {{ model: string, provider: string, reason: string, source: string }}
 */
export function selectModelByTaskType(taskType) {
  const entry = TASK_TYPE_MODEL_MAP[taskType] || { model: DEFAULT_DIRECT_MODEL, reason: 'default' };
  return {
    model: entry.model,
    provider: DEFAULT_DIRECT_PROVIDER,
    reason: entry.reason,
    source: 'heuristic',
  };
}
