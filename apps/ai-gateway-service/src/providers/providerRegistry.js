import { assertProviderAdapter } from "./providerAdapter.js";
import { createPriorityProviderSelectionPolicy } from "../core/providerSelectionPolicy.js";

export class ProviderRegistry {
  #providers = new Map();
  #runtimeModels = new Map();
  #selectionPolicy;

  constructor({ selectionPolicy = createPriorityProviderSelectionPolicy(), enabledProviders = [] } = {}) {
    this.#selectionPolicy = selectionPolicy;
    this.enabledProviders = new Set(enabledProviders);
  }

  register(provider) {
    assertProviderAdapter(provider);

    const providerId = provider?.descriptor?.id;

    if (!providerId) {
      throw new Error("Provider descriptor id is required");
    }

    if (this.#providers.has(providerId)) {
      throw new Error(`Provider already registered: ${providerId}`);
    }

    this.#providers.set(providerId, provider);
    this.#registryVersion += 1;
  }

  has(providerId) {
    return this.#providers.has(providerId);
  }

  enableProvider(providerId) {
    if (!this.#providers.has(providerId)) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    this.enabledProviders.add(providerId);
    this.#registryVersion += 1;
  }

  addRuntimeModels(providerId, models = []) {
    if (!this.#providers.has(providerId)) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const provider = this.#providers.get(providerId);
    const current = this.#runtimeModels.get(providerId) ?? new Map();

    for (const model of Array.isArray(models) ? models : []) {
      const normalized = normalizeRuntimeModel(model, provider.descriptor);
      if (normalized) {
        current.set(normalized.id, normalized);
      }
    }

    this.#runtimeModels.set(providerId, current);
    return Array.from(current.values());
  }

  get(providerId) {
    const provider = this.#providers.get(providerId);

    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    return provider;
  }

  list() {
    return Array.from(this.#providers.values()).filter((provider) => {
      return this.enabledProviders.size === 0 || this.enabledProviders.has(provider.descriptor.id);
    });
  }

  listAll() {
    return Array.from(this.#providers.values());
  }

  listAllDescriptors() {
    return this.listAll().map((provider) => this.#createMergedDescriptor(provider));
  }

  // 版本化缓存:register/unregister/enable 变更时失效;避免每请求重建全部 descriptor。
  #descriptorCache = { version: -1, list: null };
  #registryVersion = 0;

  listDescriptors() {
    if (this.#descriptorCache.version !== this.#registryVersion) {
      this.#descriptorCache = {
        version: this.#registryVersion,
        list: Object.freeze(this.list().map((provider) => this.#createMergedDescriptor(provider))),
      };
    }
    return this.#descriptorCache.list;
  }

  select(request) {
    const candidates = this.#buildCandidates(request);
    if (candidates.length === 0 && request.requiredCapabilities?.length) {
      const error = new Error(
        `No provider route satisfies required capabilities: ${request.requiredCapabilities.join(", ")}`,
      );
      error.code = "NO_CAPABLE_PROVIDER_ROUTE";
      error.category = "routing";
      error.retryable = false;
      error.details = { requiredCapabilities: [...request.requiredCapabilities] };
      throw error;
    }
    return this.#selectionPolicy.select({
      request,
      candidates,
    });
  }

  #buildCandidates(request) {
    return this.list().flatMap((provider) => {
      const descriptor = this.#createMergedDescriptor(provider);
      return descriptor.models
        .filter((model) => model.enabled)
        .filter((model) => model.capabilities.includes(request.taskType))
        .filter((model) => (request.requiredCapabilities ?? [])
          .every((capability) => model.capabilities.includes(capability)))
        .map((model) => ({
          provider,
          target: {
            providerId: descriptor.id,
            modelId: model.id,
          },
          providerType: descriptor.metadata?.providerType ?? "unknown",
          providerPriority: descriptor.priority ?? 100,
          modelPriority: model.priority ?? descriptor.priority ?? 100,
          model,
        }));
    });
  }

  #createMergedDescriptor(provider) {
    const descriptor = provider.descriptor;
    const runtimeModels = Array.from(this.#runtimeModels.get(descriptor.id)?.values() ?? []);
    if (!runtimeModels.length) {
      return descriptor;
    }

    const merged = new Map();
    for (const model of descriptor.models ?? []) {
      merged.set(model.id, model);
    }
    for (const model of runtimeModels) {
      merged.set(model.id, {
        ...(merged.get(model.id) ?? {}),
        ...model,
        metadata: {
          ...(merged.get(model.id)?.metadata ?? {}),
          ...(model.metadata ?? {}),
          runtimeDiscovered: true,
        },
      });
    }

    return {
      ...descriptor,
      models: Array.from(merged.values()),
      metadata: {
        ...(descriptor.metadata ?? {}),
        runtimeModelCount: runtimeModels.length,
      },
    };
  }
}

function normalizeRuntimeModel(model, descriptor) {
  const id = String(model?.id ?? model?.modelId ?? "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    displayName: String(model?.displayName ?? model?.modelDisplayName ?? id),
    capabilities: normalizeCapabilities(model?.capabilities),
    costTier: model?.costTier ?? "medium",
    latencyTier: model?.latencyTier ?? "medium",
    enabled: model?.enabled !== false,
    priority: Number.isFinite(Number(model?.priority)) ? Number(model.priority) : descriptor.priority ?? 100,
    metadata: {
      providerType: descriptor.metadata?.providerType,
      source: model?.source ?? "runtime-detection",
      ...(model?.metadata ?? {}),
    },
  };
}

function normalizeCapabilities(capabilities) {
  const normalized = Array.isArray(capabilities) ? capabilities.filter(Boolean) : [];
  return normalized.length ? normalized : ["chat", "summary"];
}
