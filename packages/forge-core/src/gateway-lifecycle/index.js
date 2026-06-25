/**
 * Gateway Lifecycle Manager — manages the AI Gateway service lifecycle for Forge.
 *
 * Responsibilities:
 *   1. Health check — detect if the gateway is running
 *   2. Provider status — list configured providers and their readiness
 *   3. API key management — set runtime credentials via the gateway API
 *   4. Model discovery — discover available models for a provider
 *   5. Connection management — wait for gateway readiness
 *
 * Gateway endpoints used:
 *   GET  /health/check                    — health check
 *   GET  /setup/readiness                 — full readiness check
 *   GET  /providers                       — list providers
 *   POST /providers/runtime-credential     — set API key (memory-only)
 *   POST /models/import/preview           — discover models
 *   POST /models/import/confirm           — confirm model selection
 *   GET  /config/runtime                  — runtime configuration
 *
 * @module gateway-lifecycle
 */

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:3100';
const HEALTH_TIMEOUT_MS = 3000;
const READY_POLL_INTERVAL_MS = 1000;
const READY_MAX_WAIT_MS = 30000;

export class GatewayLifecycle {
  #gatewayUrl;
  #connected = false;
  #lastHealthCheck = null;
  #providers = [];
  #selectedProvider = null;
  #selectedModel = null;

  /**
   * @param {object} [opts]
   * @param {string} [opts.gatewayUrl] — gateway base URL (default: http://127.0.0.1:3100)
   */
  constructor(opts = {}) {
    this.#gatewayUrl = (opts.gatewayUrl || process.env.FORGE_GATEWAY_URL || DEFAULT_GATEWAY_URL).replace(/\/$/, '');
  }

  /** @returns {string} The configured gateway URL. */
  get gatewayUrl() { return this.#gatewayUrl; }

  /** @returns {boolean} Whether the gateway is currently connected. */
  get connected() { return this.#connected; }

  /** @returns {string|null} Currently selected provider ID. */
  get selectedProvider() { return this.#selectedProvider; }

  /** @returns {string|null} Currently selected model ID. */
  get selectedModel() { return this.#selectedModel; }

  /** @returns {object[]} Last known provider list. */
  get providers() { return this.#providers; }

  // ---------------------------------------------------------------------------
  // Health & Connectivity
  // ---------------------------------------------------------------------------

  /**
   * Check if the gateway is running and healthy.
   * Uses GET /health/check with a short timeout.
   * @returns {Promise<{ healthy: boolean, latency: number, error?: string }>}
   */
  async checkHealth() {
    const start = Date.now();
    try {
      const res = await fetch(`${this.#gatewayUrl}/health/check`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      const latency = Date.now() - start;
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        this.#connected = true;
        this.#lastHealthCheck = { healthy: true, latency, timestamp: Date.now(), data: json };
        return { healthy: true, latency };
      }
      this.#connected = false;
      this.#lastHealthCheck = { healthy: false, latency, timestamp: Date.now(), error: `HTTP ${res.status}` };
      return { healthy: false, latency, error: `HTTP ${res.status}` };
    } catch (err) {
      const latency = Date.now() - start;
      this.#connected = false;
      this.#lastHealthCheck = { healthy: false, latency, timestamp: Date.now(), error: err.message };
      return { healthy: false, latency, error: err.message };
    }
  }

  /**
   * Full readiness check — includes provider config, knowledge, etc.
   * Uses GET /setup/readiness.
   * @returns {Promise<object>}
   */
  async checkReadiness() {
    try {
      const res = await fetch(`${this.#gatewayUrl}/setup/readiness`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS * 2),
      });
      if (res.ok) {
        return await res.json();
      }
      return { ready: false, error: `HTTP ${res.status}` };
    } catch (err) {
      return { ready: false, error: err.message };
    }
  }

  /**
   * Wait for the gateway to become ready.
   * Polls /health/check until it responds or timeout is reached.
   * @param {object} [opts]
   * @param {number} [opts.maxWaitMs] — max wait time (default: 30s)
   * @param {number} [opts.intervalMs] — poll interval (default: 1s)
   * @param {function} [opts.onPoll] — called each poll with { attempt, healthy }
   * @returns {Promise<{ ready: boolean, attempts: number, elapsed: number }>}
   */
  async waitForReady(opts = {}) {
    const maxWait = opts.maxWaitMs ?? READY_MAX_WAIT_MS;
    const interval = opts.intervalMs ?? READY_POLL_INTERVAL_MS;
    const onPoll = opts.onPoll || (() => {});
    const start = Date.now();
    let attempts = 0;

    while (Date.now() - start < maxWait) {
      attempts++;
      const health = await this.checkHealth();
      onPoll({ attempt: attempts, healthy: health.healthy, latency: health.latency });

      if (health.healthy) {
        return { ready: true, attempts, elapsed: Date.now() - start };
      }

      await new Promise(r => setTimeout(r, interval));
    }

    return { ready: false, attempts, elapsed: Date.now() - start };
  }

  // ---------------------------------------------------------------------------
  // Provider Management
  // ---------------------------------------------------------------------------

  /**
   * Fetch the list of configured providers from the gateway.
   * Uses GET /providers.
   * @returns {Promise<{ providers: object[], error?: string }>}
   */
  async getProviders() {
    try {
      const res = await fetch(`${this.#gatewayUrl}/providers`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS * 2),
      });
      if (!res.ok) {
        return { providers: [], error: `HTTP ${res.status}` };
      }
      const json = await res.json();
      const providers = json.data?.providers || json.providers || [];
      this.#providers = providers;
      return { providers };
    } catch (err) {
      return { providers: [], error: err.message };
    }
  }

  /**
   * Get the runtime configuration of the gateway.
   * Uses GET /config/runtime.
   * @returns {Promise<object>}
   */
  async getRuntimeConfig() {
    try {
      const res = await fetch(`${this.#gatewayUrl}/config/runtime`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      if (res.ok) {
        return await res.json();
      }
      return { error: `HTTP ${res.status}` };
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Set a runtime API key for a provider.
   * The key is stored in gateway memory only — never persisted to disk.
   * Uses POST /providers/runtime-credential.
   *
   * @param {string} providerId — e.g. 'openai', 'anthropic', 'dashscope'
   * @param {string} apiKey — the API key value
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async setApiKey(providerId, apiKey) {
    if (!providerId || !apiKey) {
      return { success: false, error: 'providerId and apiKey are required' };
    }
    try {
      const res = await fetch(`${this.#gatewayUrl}/providers/runtime-credential`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey }),
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS * 2),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = await res.json().catch(() => ({}));
      this.#selectedProvider = providerId;
      console.log(`[forge:gateway] API key set for provider "${providerId}" (memory-only)`);
      return { success: true, data: json };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Model Discovery & Selection
  // ---------------------------------------------------------------------------

  /**
   * Discover available models for a provider using an API key.
   * Uses POST /models/import/preview.
   *
   * @param {string} apiKey — API key for the provider
   * @param {string} [providerHint] — optional provider ID hint
   * @returns {Promise<{ models: object[], providerId?: string, needsSelection?: boolean, error?: string }>}
   */
  async discoverModels(apiKey, providerHint) {
    try {
      const res = await fetch(`${this.#gatewayUrl}/models/import/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey, providerHint }),
        signal: AbortSignal.timeout(30000), // Model discovery can take longer
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { models: [], error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = await res.json();
      const models = json.data?.models || json.models || [];
      const providerId = json.data?.providerId || json.providerId;
      const needsSelection = json.data?.status === 'needs_user_selection' || json.data?.status === 'needs_provider_selection';

      return { models, providerId, needsSelection };
    } catch (err) {
      return { models: [], error: err.message };
    }
  }

  /**
   * Confirm a model selection and import it into the gateway.
   * Uses POST /models/import/confirm.
   *
   * @param {object} selection
   * @param {string} selection.providerId — provider ID
   * @param {string} selection.modelId — model ID
   * @param {string} selection.apiKey — API key
   * @param {string} [selection.baseUrl] — optional base URL override
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async selectModel(selection) {
    const { providerId, modelId, apiKey, baseUrl } = selection;
    if (!providerId || !modelId || !apiKey) {
      return { success: false, error: 'providerId, modelId, and apiKey are required' };
    }
    try {
      const body = { providerId, modelId, apiKey };
      if (baseUrl) body.baseUrl = baseUrl;

      const res = await fetch(`${this.#gatewayUrl}/models/import/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS * 3),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = await res.json().catch(() => ({}));
      this.#selectedProvider = providerId;
      this.#selectedModel = modelId;
      console.log(`[forge:gateway] Model selected: ${providerId}/${modelId}`);
      return { success: true, data: json };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Connection & Status
  // ---------------------------------------------------------------------------

  /**
   * Full connection sequence: health check → provider list → readiness.
   * @returns {Promise<GatewayStatus>}
   */
  async connect() {
    const health = await this.checkHealth();
    if (!health.healthy) {
      return {
        connected: false,
        gatewayUrl: this.#gatewayUrl,
        error: health.error || 'Gateway unreachable',
        health,
        providers: [],
      };
    }

    const { providers, error: providerError } = await this.getProviders();

    return {
      connected: true,
      gatewayUrl: this.#gatewayUrl,
      health,
      providers,
      providerError,
      selectedProvider: this.#selectedProvider,
      selectedModel: this.#selectedModel,
    };
  }

  /**
   * Get a snapshot of the current gateway status.
   * @returns {GatewayStatus}
   */
  getStatus() {
    return {
      connected: this.#connected,
      gatewayUrl: this.#gatewayUrl,
      lastHealthCheck: this.#lastHealthCheck,
      providers: this.#providers,
      selectedProvider: this.#selectedProvider,
      selectedModel: this.#selectedModel,
    };
  }

  /**
   * Format the gateway status for console output.
   * @returns {string}
   */
  formatStatus() {
    const status = this.getStatus();
    const lines = [
      `Gateway: ${status.connected ? 'CONNECTED' : 'DISCONNECTED'} (${status.gatewayUrl})`,
    ];

    if (status.lastHealthCheck) {
      lines.push(`  Last health: ${status.lastHealthCheck.healthy ? 'OK' : 'FAIL'} (${status.lastHealthCheck.latency}ms)`);
    }

    if (status.providers.length > 0) {
      lines.push(`  Providers: ${status.providers.length}`);
      for (const p of status.providers) {
        const id = p.id || p.providerId || 'unknown';
        const hasCred = p.hasCredential || p.hasApiKey ? '✓' : '✗';
        lines.push(`    ${hasCred} ${id}`);
      }
    }

    if (status.selectedProvider) {
      lines.push(`  Selected: ${status.selectedProvider}/${status.selectedModel || 'default'}`);
    }

    return lines.join('\n');
  }
}

/**
 * @typedef {object} GatewayStatus
 * @property {boolean} connected
 * @property {string} gatewayUrl
 * @property {object} [lastHealthCheck]
 * @property {object[]} providers
 * @property {string|null} selectedProvider
 * @property {string|null} selectedModel
 * @property {string} [error]
 */
