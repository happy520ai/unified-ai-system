/**
 * Bridge between Forge and the AI Gateway.
 *
 * The AI Gateway (core API at http://127.0.0.1:3100, frontend proxy at
 * http://127.0.0.1:5191) provides OpenAI-compatible chat completions with
 * provider routing, automatic failover, and usage tracking.
 *
 * This module gives Forge tasks a high-level interface to those capabilities
 * while transparently falling back to direct LLM calls when the gateway is
 * unreachable.
 *
 * Gateway endpoints used:
 *   POST /chat             - Chat completion with provider routing
 *   POST /chat/auto        - Auto-routing based on task classification
 *   GET  /providers        - List configured AI providers
 *   GET  /routing/data     - Model routing data and scores
 *   POST /routing/preview  - Preview routing decision without sending a request
 *
 * @module gateway-bridge
 */

import { callLLMDirectWithUsage } from '../llm-client.js';
import {
  DEFAULT_GATEWAY_URL,
  DEFAULT_DIRECT_PROVIDER,
  DEFAULT_DIRECT_MODEL,
  safeFetch,
  selectModelByTaskType as _selectModelByTaskType,
} from './utils.js';

// ---------------------------------------------------------------------------
// GatewayBridge
// ---------------------------------------------------------------------------

/**
 * Bridge between Forge and the AI Gateway.
 *
 * Provides:
 * 1. Model selection based on task type (via gateway routing engine)
 * 2. Provider failover (gateway handles fallback automatically)
 * 3. Usage tracking through gateway responses
 * 4. Streaming support for real-time task updates (future)
 *
 * @example
 * const bridge = new GatewayBridge();
 * const ok = await bridge.checkAvailability();
 * const { text, usage } = await bridge.chat([
 *   { role: 'user', content: 'Explain quicksort in 3 lines.' },
 * ]);
 */
export class GatewayBridge {
  /** @type {string} */
  #gatewayUrl;

  /** @type {boolean} */
  #fallbackDirect;

  /** @type {boolean|null} null = not yet checked */
  #available = null;

  /** @type {Array<object>} */
  #providers = [];

  /** @type {object|null} */
  #routingData = null;

  /**
   * @param {object} [options]
   * @param {string} [options.gatewayUrl='http://127.0.0.1:3100']
   *   Gateway core API base URL.
   * @param {boolean} [options.fallbackDirect=true]
   *   Whether to fall back to direct LLM calls when the gateway is unavailable.
   */
  constructor({ gatewayUrl = DEFAULT_GATEWAY_URL, fallbackDirect = true } = {}) {
    this.#gatewayUrl = gatewayUrl.replace(/\/+$/, ''); // strip trailing slash
    this.#fallbackDirect = fallbackDirect;
  }

  // -------------------------------------------------------------------------
  // Availability
  // -------------------------------------------------------------------------

  /**
   * Probe the gateway and cache its availability state.
   * Also pre-fetches the provider list for later use.
   *
   * Safe to call multiple times; each call performs a fresh check.
   *
   * @returns {Promise<boolean>} true if the gateway responded successfully
   */
  async checkAvailability() {
    const res = await safeFetch(
      `${this.#gatewayUrl}/providers`,
      { method: 'GET' },
      3000,
    );

    if (res) {
      try {
        const body = await res.json();
        this.#available = true;
        // The gateway may return an array directly or an object with a providers field.
        this.#providers = Array.isArray(body) ? body : (body.providers ?? []);
        return true;
      } catch {
        // Response was not valid JSON — treat as unavailable.
      }
    }

    this.#available = false;
    this.#providers = [];
    return false;
  }

  /**
   * Ensure availability has been checked at least once.
   * Does not re-check if already determined.
   */
  async #ensureAvailable() {
    if (this.#available === null) {
      await this.checkAvailability();
    }
  }

  // -------------------------------------------------------------------------
  // Model selection
  // -------------------------------------------------------------------------

  /**
   * Get the best model for a given task type.
   *
   * When the gateway is available, uses the `/routing/preview` endpoint to
   * leverage the gateway's scoring and routing engine. Falls back to a
   * local heuristic map when the gateway is unreachable.
   *
   * @param {string} taskType - Forge task type (explore, plan, implement, etc.)
   * @param {string} [context=''] - Optional context string to improve routing
   * @returns {Promise<{ model: string, provider: string, reason: string, source: string }>}
   */
  async selectModel(taskType, context = '') {
    await this.#ensureAvailable();

    if (this.#available) {
      const res = await safeFetch(
        `${this.#gatewayUrl}/routing/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: context || `Task type: ${taskType}`,
            mode: 'standard',
          }),
        },
        5000,
      );

      if (res) {
        try {
          const data = await res.json();
          return {
            model: data.selectedModel || data.model || DEFAULT_DIRECT_MODEL,
            provider: data.provider || data.selectedProvider || 'unknown',
            reason: data.reason || 'gateway routing',
            source: 'gateway',
          };
        } catch {
          // Malformed response — fall through to heuristic.
        }
      }
    }

    return _selectModelByTaskType(taskType);
  }

  // -------------------------------------------------------------------------
  // Chat completion
  // -------------------------------------------------------------------------

  /**
   * Send a chat completion request through the gateway.
   *
   * Accepts standard OpenAI-format messages. The gateway routes to the best
   * provider automatically. If the gateway is unavailable and fallbackDirect
   * is enabled, falls back to a direct LLM call via llm-client.js.
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @param {object} [options]
   * @param {string} [options.model='auto'] - Model name, or 'auto' for gateway routing
   * @param {number} [options.temperature=0.1]
   * @param {number} [options.maxTokens=8192]
   * @returns {Promise<{ text: string, usage: object|null, model: string, source: string }>}
   * @throws {Error} If gateway is unavailable and fallbackDirect is false
   */
  async chat(messages, { model = 'auto', temperature = 0.1, maxTokens = 8192 } = {}) {
    await this.#ensureAvailable();

    if (this.#available) {
      try {
        const res = await fetch(`${this.#gatewayUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(120000),
        });

        if (res.ok) {
          const data = await res.json();

          // The gateway may return in OpenAI format or its own wrapper format.
          // Handle both: { choices: [...] } or { success: true, data: { outputText, ... } }
          const choice = data.choices?.[0];
          const gatewayData = data.data;

          let text = '';
          if (choice?.message?.content) {
            text = choice.message.content;
          } else if (gatewayData?.outputText) {
            text = gatewayData.outputText;
          } else if (gatewayData?.text) {
            text = gatewayData.text;
          }

          const usage = data.usage
            ? {
                inputTokens: data.usage.prompt_tokens ?? data.usage.inputTokens ?? 0,
                outputTokens: data.usage.completion_tokens ?? data.usage.outputTokens ?? 0,
                totalTokens: data.usage.total_tokens ?? data.usage.totalTokens ?? 0,
                model: data.model || model,
              }
            : gatewayData?.usage
              ? {
                  inputTokens: gatewayData.usage.prompt_tokens ?? gatewayData.usage.inputTokens ?? 0,
                  outputTokens: gatewayData.usage.completion_tokens ?? gatewayData.usage.outputTokens ?? 0,
                  totalTokens: gatewayData.usage.total_tokens ?? gatewayData.usage.totalTokens ?? 0,
                  model: gatewayData.selectedModel || data.model || model,
                }
              : null;

          return {
            text,
            usage,
            model: data.model || gatewayData?.selectedModel || model,
            source: 'gateway',
          };
        }
      } catch (err) {
        console.log(`[forge:gateway] Chat request failed: ${err.message}, falling back to direct`);
      }
    }

    return this.#chatDirect(messages, { model, temperature, maxTokens });
  }

  /**
   * Send a chat completion using the gateway's auto-routing endpoint.
   *
   * The `/chat/auto` endpoint classifies the message content and selects
   * the optimal provider and model automatically. This is ideal for
   * general-purpose requests where you don't need explicit model control.
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @param {object} [options]
   * @param {number} [options.temperature=0.1]
   * @param {number} [options.maxTokens=8192]
   * @returns {Promise<{ text: string, usage: object|null, model: string, provider: string, source: string }>}
   * @throws {Error} If gateway is unavailable and fallbackDirect is false
   */
  async chatAuto(messages, { temperature = 0.1, maxTokens = 8192 } = {}) {
    await this.#ensureAvailable();

    if (this.#available) {
      try {
        const res = await fetch(`${this.#gatewayUrl}/chat/auto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(120000),
        });

        if (res.ok) {
          const data = await res.json();
          const gatewayData = data.data;

          let text = '';
          const choice = data.choices?.[0];
          if (choice?.message?.content) {
            text = choice.message.content;
          } else if (gatewayData?.outputText) {
            text = gatewayData.outputText;
          } else if (gatewayData?.text) {
            text = gatewayData.text;
          }

          const usage = data.usage
            ? {
                inputTokens: data.usage.prompt_tokens ?? data.usage.inputTokens ?? 0,
                outputTokens: data.usage.completion_tokens ?? data.usage.outputTokens ?? 0,
                totalTokens: data.usage.total_tokens ?? data.usage.totalTokens ?? 0,
                model: data.model || 'auto',
              }
            : gatewayData?.usage
              ? {
                  inputTokens: gatewayData.usage.prompt_tokens ?? gatewayData.usage.inputTokens ?? 0,
                  outputTokens: gatewayData.usage.completion_tokens ?? gatewayData.usage.outputTokens ?? 0,
                  totalTokens: gatewayData.usage.total_tokens ?? gatewayData.usage.totalTokens ?? 0,
                  model: gatewayData.selectedModel || 'auto',
                }
              : null;

          return {
            text,
            usage,
            model: data.model || gatewayData?.selectedModel || 'auto',
            provider: gatewayData?.selectedProvider || data.provider || 'auto',
            source: 'gateway-auto',
          };
        }
      } catch (err) {
        console.log(`[forge:gateway] Auto-chat failed: ${err.message}, falling back to direct`);
      }
    }

    // Auto-routing only makes sense via the gateway; fall back to direct with default model.
    return this.#chatDirect(messages, { model: DEFAULT_DIRECT_MODEL, temperature, maxTokens });
  }

  // -------------------------------------------------------------------------
  // Routing data and provider introspection
  // -------------------------------------------------------------------------

  /**
   * Get routing data for visualization / analysis.
   *
   * Returns model scores, weights, and routing configuration from the
   * gateway. Useful for dashboards and debugging routing decisions.
   *
   * @returns {Promise<object|null>} Routing data, or null if unavailable
   */
  async getRoutingData() {
    await this.#ensureAvailable();
    if (!this.#available) return null;

    const res = await safeFetch(
      `${this.#gatewayUrl}/routing/data`,
      { method: 'GET' },
      5000,
    );

    if (res) {
      try {
        this.#routingData = await res.json();
        return this.#routingData;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Get list of available providers and their configured models.
   *
   * @returns {Promise<Array<object>>} Provider list (empty if gateway unavailable)
   */
  async getProviders() {
    await this.#ensureAvailable();
    return this.#providers;
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  /**
   * Check gateway health for dashboard status indicators.
   *
   * Performs a fresh availability check and returns a summary object.
   *
   * @returns {Promise<{ available: boolean, url: string, providers: number, lastCheck: string }>}
   */
  async health() {
    const available = await this.checkAvailability();
    return {
      available,
      url: this.#gatewayUrl,
      providers: available ? this.#providers.length : 0,
      lastCheck: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Direct LLM fallback using llm-client.js.
   *
   * Constructs the correct options object for callLLMDirectWithUsage,
   * which expects { provider, model, messages, temperature, maxTokens }.
   *
   * @param {Array<{ role: string, content: string }>} messages
   * @param {object} opts
   * @param {string} opts.model
   * @param {number} opts.temperature
   * @param {number} opts.maxTokens
   * @returns {Promise<{ text: string, usage: object|null, model: string, source: string }>}
   * @throws {Error} If fallbackDirect is disabled
   */
  async #chatDirect(messages, { model, temperature, maxTokens }) {
    if (!this.#fallbackDirect) {
      throw new Error('Gateway unavailable and direct fallback disabled');
    }

    // callLLMDirectWithUsage expects a single options object with a messages array.
    const result = await callLLMDirectWithUsage({
      provider: DEFAULT_DIRECT_PROVIDER,
      model: DEFAULT_DIRECT_MODEL,
      messages,
      temperature,
      maxTokens,
    });

    return {
      text: result.text,
      usage: result.usage || null,
      model: result.usage?.model || DEFAULT_DIRECT_MODEL,
      source: 'direct',
    };
  }
}

/**
 * Pre-configured singleton for convenience.
 * Uses default settings (gateway at 127.0.0.1:3100, direct fallback enabled).
 *
 * @type {GatewayBridge}
 */
export const gatewayBridge = new GatewayBridge();

export default GatewayBridge;
