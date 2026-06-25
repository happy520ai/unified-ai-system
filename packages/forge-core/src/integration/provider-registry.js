/**
 * ForgeProviderRegistry — bridges shared-config's provider models
 * with Forge's LLM client for unified provider resolution.
 *
 * When integrated with the gateway, this registry is populated from
 * shared-config's loadRuntimeConfig() output, giving Forge access to
 * 30+ configured LLM providers with proper endpoints, API keys, and
 * capability-based selection.
 *
 * In standalone mode, Forge continues to use its hardcoded PROVIDERS map.
 */

import { loadRuntimeConfig } from '@unified-ai-system/shared-config';

export class ForgeProviderRegistry {
  /** @type {Map<string, object>} provider configs keyed by providerId */
  #providers = new Map();

  /** @type {string|null} */
  #defaultProviderId = null;

  /** @type {string|null} */
  #defaultModelId = null;

  /** @type {string} gateway URL */
  #gatewayEndpoint = null;

  /** @type {string} provider mode (fake/real/auto) */
  #providerMode = 'fake';

  /**
   * Load providers from shared-config's runtime config.
   * Can be called with an existing config object or will load from env.
   *
   * @param {object} [runtimeConfig] - Output of loadRuntimeConfig(), or undefined to auto-load
   */
  loadFromSharedConfig(runtimeConfig) {
    const config = runtimeConfig || loadRuntimeConfig(process.env);
    const svc = config.aiGatewayService;

    // Gateway endpoint
    const ep = svc.endpoint;
    this.#gatewayEndpoint = `http://${ep.host}:${ep.port}`;
    this.#providerMode = svc.providerMode || 'fake';

    // Provider selection defaults
    this.#defaultProviderId = svc.providerSelection?.defaultProviderId || null;
    this.#defaultModelId = svc.providerSelection?.defaultModelId || null;

    // Register all provider models from config
    for (const pm of (svc.providerModels || [])) {
      if (!pm.providerId) continue;

      // Skip fake providers — they're only useful within the gateway process
      if (pm.providerType === 'fake') continue;

      // Build a Forge-compatible provider config
      const forgeConfig = {
        providerId: pm.providerId,
        baseUrl: pm.endpoint || '',
        envKey: this.#inferEnvKey(pm.providerId),
        defaultModel: pm.modelId || '',
        providerType: pm.providerType,
        displayName: pm.providerDisplayName || pm.providerId,
        modelDisplayName: pm.modelDisplayName || pm.modelId,
        enabled: pm.enabled || false,
        priority: pm.priority ?? 100,
        capabilities: pm.capabilities || ['chat'],
        apiKey: pm.apiKey || null,
        apiKeyPresent: pm.apiKeyPresent || false,
      };

      this.#providers.set(pm.providerId, forgeConfig);
    }
  }

  /**
   * Resolve a provider by name/ID.
   * Supports both Forge legacy names ('xiaomi' → 'mimo') and shared-config IDs.
   *
   * @param {string} providerName
   * @returns {object|null} Forge-compatible provider config
   */
  resolve(providerName) {
    // Direct match
    if (this.#providers.has(providerName)) {
      return this.#providers.get(providerName);
    }

    // Legacy name mapping
    const legacyMap = {
      xiaomi: 'mimo',
      'xiaomi-mimo': 'mimo',
    };
    const mapped = legacyMap[providerName];
    if (mapped && this.#providers.has(mapped)) {
      return this.#providers.get(mapped);
    }

    // Fuzzy match by providerId substring
    for (const [id, config] of this.#providers) {
      if (id.includes(providerName) || providerName.includes(id)) {
        return config;
      }
    }

    return null;
  }

  /**
   * Select the best provider for a given task type based on capabilities and priority.
   *
   * @param {string} [taskType='chat'] - Required capability
   * @returns {object|null} Best matching provider config
   */
  selectForTask(taskType = 'chat') {
    const candidates = [];
    for (const config of this.#providers.values()) {
      if (!config.enabled) continue;
      if (!config.baseUrl) continue;
      if (config.capabilities.includes(taskType) || config.capabilities.includes('chat')) {
        candidates.push(config);
      }
    }

    // Sort by priority (lower = higher priority)
    candidates.sort((a, b) => (a.priority || 100) - (b.priority || 100));
    return candidates[0] || null;
  }

  /**
   * Get the default provider config.
   * @returns {object|null}
   */
  getDefaultProvider() {
    if (this.#defaultProviderId && this.#providers.has(this.#defaultProviderId)) {
      const config = this.#providers.get(this.#defaultProviderId);
      if (config.enabled) return config;
    }
    // Fall back to first enabled provider
    return this.selectForTask('chat');
  }

  /**
   * Get the gateway endpoint URL.
   * @returns {string|null}
   */
  getGatewayEndpoint() {
    return this.#gatewayEndpoint;
  }

  /**
   * Get the provider mode.
   * @returns {string}
   */
  getProviderMode() {
    return this.#providerMode;
  }

  /**
   * List all registered provider IDs.
   * @returns {string[]}
   */
  list() {
    return [...this.#providers.keys()];
  }

  /**
   * List enabled providers with their details.
   * @returns {object[]}
   */
  listEnabled() {
    return [...this.#providers.values()]
      .filter(p => p.enabled)
      .map(p => ({
        providerId: p.providerId,
        modelId: p.defaultModel,
        providerType: p.providerType,
        displayName: p.displayName,
        priority: p.priority,
        capabilities: p.capabilities,
      }));
  }

  /**
   * Get a status summary for the dashboard.
   * @returns {object}
   */
  getStatus() {
    const all = [...this.#providers.values()];
    return {
      totalProviders: all.length,
      enabledProviders: all.filter(p => p.enabled).length,
      providerMode: this.#providerMode,
      gatewayEndpoint: this.#gatewayEndpoint,
      defaultProvider: this.#defaultProviderId,
      defaultModel: this.#defaultModelId,
      providers: all.map(p => ({
        id: p.providerId,
        name: p.displayName,
        model: p.defaultModel,
        enabled: p.enabled,
        type: p.providerType,
        priority: p.priority,
      })),
    };
  }

  /**
   * Infer the environment variable name for a provider's API key.
   * @param {string} providerId
   * @returns {string}
   */
  #inferEnvKey(providerId) {
    const envKeyMap = {
      openai: 'OPENAI_API_KEY',
      nvidia: 'NVIDIA_API_KEY',
      mimo: 'MIMO_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      openrouter: 'OPENROUTER_API_KEY',
      groq: 'GROQ_API_KEY',
      together: 'TOGETHER_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      xai: 'XAI_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
      fireworks: 'FIREWORKS_API_KEY',
      cerebras: 'CEREBRAS_API_KEY',
      moonshot: 'MOONSHOT_API_KEY',
      siliconflow: 'SILICONFLOW_API_KEY',
      dashscope: 'DASHSCOPE_API_KEY',
      'tencent-hunyuan': 'HUNYUAN_API_KEY',
      qianfan: 'QIANFAN_API_KEY',
      zhipu: 'ZHIPU_API_KEY',
      'xunfei-spark': 'SPARK_API_KEY',
      cohere: 'COHERE_API_KEY',
      minimax: 'MINIMAX_API_KEY',
      stepfun: 'STEPFUN_API_KEY',
      baichuan: 'BAICHUAN_API_KEY',
      yi: 'YI_API_KEY',
    };
    return envKeyMap[providerId] || `${providerId.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  }
}

/**
 * Create and initialize a ForgeProviderRegistry from shared-config.
 * Convenience factory for quick setup.
 *
 * @param {object} [runtimeConfig] - Optional pre-loaded config
 * @returns {ForgeProviderRegistry}
 */
export function createForgeProviderRegistry(runtimeConfig) {
  const registry = new ForgeProviderRegistry();
  registry.loadFromSharedConfig(runtimeConfig);
  return registry;
}
