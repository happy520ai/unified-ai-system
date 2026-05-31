import { discoverNvidiaCatalog, discoverNvidiaCatalogLive } from "./nvidiaCatalogDiscovery.js";
import { applySelectionRules, validateModelRecord } from "./modelCapabilityRules.js";

export const SUPPORTED_PROVIDERS = Object.freeze([
  {
    providerId: "nvidia",
    providerName: "NVIDIA NIM API Catalog",
    status: "phase312a-integrated",
  },
  {
    providerId: "openai",
    providerName: "OpenAI",
    status: "future-provider-slot",
  },
  {
    providerId: "claude",
    providerName: "Anthropic Claude",
    status: "future-provider-slot",
  },
  {
    providerId: "openrouter",
    providerName: "OpenRouter",
    status: "future-provider-slot",
  },
  {
    providerId: "mimo",
    providerName: "MiMo",
    status: "blocked-for-phase312a",
  },
  {
    providerId: "local",
    providerName: "Local",
    status: "future-provider-slot",
  },
]);

export function buildUnifiedModelRegistry({
  providerConfig = {},
  smokeState = {},
  taskDefaults = {},
  discovery = discoverNvidiaCatalog(),
} = {}) {
  const providerConfigured = Boolean(providerConfig?.nvidia?.apiKeyConfigured || providerConfig?.nvidia?.configured);
  const catalogRecords = dedupeRegistryRecords(discovery.records ?? []);
  const records = catalogRecords.map((record) => {
    const smoke = smokeState[record.providerId]?.[record.modelId] ?? smokeState[record.modelId] ?? {};
    const merged = applySelectionRules({
      ...record,
      testStatus: smoke.testStatus ?? record.testStatus,
      lastSmokeAt: smoke.lastSmokeAt ?? record.lastSmokeAt,
      lastSmokeResult: smoke.lastSmokeResult ?? record.lastSmokeResult,
      notes: smoke.notes ?? record.notes,
    }, providerConfigured);

    return {
      ...merged,
      state: {
        ...merged.state,
        default_candidate: merged.state.default_candidate && taskDefaults.chatDefaultModelId !== merged.modelId ? merged.state.default_candidate : merged.state.default_candidate,
      },
      taskDefault: taskDefaults.chatDefaultModelId === merged.modelId,
    };
  });
  const validation = records.map((model) => ({
    providerId: model.providerId,
    modelId: model.modelId,
    ...validateModelRecord(model),
  }));
  const failedValidation = validation.filter((item) => !item.valid);

  return {
    providers: SUPPORTED_PROVIDERS,
    models: records,
    summary: summarizeModelRegistry(records, discovery, failedValidation),
    discovery: discovery.discovery,
    validation,
  };
}

export async function buildUnifiedModelRegistryWithLiveDiscovery({
  providerConfig = {},
  smokeState = {},
  taskDefaults = {},
  fetchImpl,
  timeoutMs,
} = {}) {
  const discovery = await discoverNvidiaCatalogLive({ fetchImpl, timeoutMs });
  return buildUnifiedModelRegistry({ providerConfig, smokeState, taskDefaults, discovery });
}

export function summarizeModelRegistry(models = [], discovery = {}, failedValidation = []) {
  const directChatModels = models.filter((model) => model.uiVisibleInChat && model.capabilities.some((capability) => capability.startsWith("chat_") || capability === "rag_answer"));
  const taskToolModels = models.filter((model) => model.uiVisibleInChat && !directChatModels.includes(model));
  const smokePassed = models.filter((model) => model.state?.smoke_passed).length;
  const selectable = models.filter((model) => model.state?.selectable).length;
  const unverified = models.filter((model) => !model.state?.smoke_passed).length;

  return {
    providerCount: SUPPORTED_PROVIDERS.length,
    modelCount: models.length,
    nvidiaModelCount: models.filter((model) => model.providerId === "nvidia").length,
    directChatModelCount: directChatModels.length,
    taskToolModelCount: taskToolModels.length,
    smokePassedModelCount: smokePassed,
    selectableModelCount: selectable,
    unverifiedModelCount: unverified,
    deprecatedModelCount: models.filter((model) => model.deprecatedSoon).length,
    downloadableOnlyCount: models.filter((model) => model.downloadableOnly).length,
    freeEndpointCount: models.filter((model) => model.freeEndpoint).length,
    partnerEndpointCount: models.filter((model) => model.partnerEndpoint).length,
    sourceBreakdown: countBy(models, "source"),
    capabilityBreakdown: countCapabilities(models),
    blockers: Array.from(new Set([...(discovery.discovery?.blockers ?? discovery.blockers ?? []), ...failedValidation.map((item) => `validation:${item.modelId}`)])),
    failedValidationCount: failedValidation.length,
  };
}

export function findModel(registry, providerId, modelId) {
  return registry?.models?.find((model) => model.providerId === providerId && model.modelId === modelId) ?? null;
}

export function listDirectChatModels(registry) {
  return (registry?.models ?? []).filter((model) => model.uiVisibleInChat && model.capabilities.some((capability) => capability.startsWith("chat_") || capability === "rag_answer"));
}

export function listTaskToolModels(registry) {
  const direct = new Set(listDirectChatModels(registry).map((model) => `${model.providerId}:${model.modelId}`));
  return (registry?.models ?? []).filter((model) => model.uiVisibleInChat && !direct.has(`${model.providerId}:${model.modelId}`));
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function countCapabilities(models) {
  const counts = {};
  for (const model of models) {
    for (const capability of model.capabilities ?? []) {
      counts[capability] = (counts[capability] ?? 0) + 1;
    }
  }
  return counts;
}

function dedupeRegistryRecords(records = []) {
  const byId = new Map();
  for (const record of records) {
    const modelId = canonicalModelId(record.modelId);
    const existing = byId.get(modelId);
    if (!existing) {
      byId.set(modelId, { ...record, modelId });
      continue;
    }

    byId.set(modelId, {
      ...existing,
      ...record,
      modelId,
      displayName: existing.displayName ?? record.displayName,
      capabilities: Array.from(new Set([...(existing.capabilities ?? []), ...(record.capabilities ?? [])])),
      notes: [existing.notes, record.notes].filter(Boolean).join(" | "),
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.modelId.localeCompare(b.modelId));
}

function canonicalModelId(modelId) {
  const id = String(modelId ?? "");
  if (id === "nvidia/llama-3.1-nemotron-safety-guard-8b-v3") {
    return "nvidia/llama-3_1-nemotron-safety-guard-8b-v3";
  }
  return id;
}
