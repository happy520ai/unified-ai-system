import {
  endpointPathFor,
  inferCapabilitiesFromModel,
  inferEndpointType,
  normalizeCapabilities,
  primaryCapability,
  uiGroupFor,
} from "./modelCapabilityRules.js";

import { CHAT_MODELS, NVIDIA_TOOL_MODELS } from "./nvidiaCatalogSeeds.js";
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";
import {
  LIVE_MODEL_ID_BLOCKLIST,
  LIVE_PROVIDER_PREFIX_ALLOWLIST,
  OFFICIAL_SOURCE_URLS,
} from "./nvidiaCatalogSources.js";

export const NVIDIA_PROVIDER = Object.freeze({
  providerId: "nvidia",
  providerName: "NVIDIA NIM API Catalog",
  defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
  retrievalBaseUrl: "https://ai.api.nvidia.com/v1",
});

export function discoverNvidiaCatalog({ allowNetwork = false, fetchImpl = safeOutboundFetch } = {}) {
  const seedRecords = createSeedCatalogRecords();
  const discovery = {
    providerId: NVIDIA_PROVIDER.providerId,
    source: "official-docs-seed",
    sourceUrls: Object.values(OFFICIAL_SOURCE_URLS),
    liveDiscoveryAttempted: Boolean(allowNetwork),
    liveDiscoverySucceeded: false,
    blockers: [],
    notes: allowNetwork
      ? ["Live discovery is attempted by refresh endpoints; static official-doc seeds remain the safe fallback."]
      : ["Static official-source seed is being used; live discovery is verified by Phase312A verification and records catalog_discovery_unavailable only if that attempt fails."],
  };

  return {
    provider: NVIDIA_PROVIDER,
    records: seedRecords,
    discovery,
    fetchImplAvailable: typeof fetchImpl === "function",
  };
}

export async function discoverNvidiaCatalogLive({ fetchImpl = safeOutboundFetch, timeoutMs = 6000 } = {}) {
  const base = discoverNvidiaCatalog({ allowNetwork: true, fetchImpl });
  if (typeof fetchImpl !== "function") {
    return {
      ...base,
      discovery: {
        ...base.discovery,
        blockers: ["catalog_discovery_unavailable"],
        notes: ["fetch is not available in this runtime."],
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(OFFICIAL_SOURCE_URLS.llmApis, { signal: controller.signal });
    const text = await response.text();
    const liveIds = parseModelIdsFromDocs(text);
    return {
      ...base,
      records: mergeLiveModelIds(base.records, liveIds),
      discovery: {
        ...base.discovery,
        liveDiscoverySucceeded: response.ok && liveIds.length > 0,
        blockers: response.ok && liveIds.length > 0 ? [] : ["catalog_discovery_unavailable"],
        liveModelCount: liveIds.length,
        notes: response.ok && liveIds.length > 0
          ? ["Live official docs scan succeeded; records were merged with the static seed."]
          : [`Live discovery returned HTTP ${response.status} or no model ids.`],
      },
    };
  } catch (error) {
    return {
      ...base,
      discovery: {
        ...base.discovery,
        blockers: ["catalog_discovery_unavailable"],
        errorCode: error?.name === "AbortError" ? "catalog_discovery_timeout" : "catalog_discovery_fetch_failed",
        notes: [`Live discovery failed: ${error instanceof Error ? error.message : String(error)}`],
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function createSeedCatalogRecords() {
  return dedupeRecords([
    ...CHAT_MODELS.map((modelId) => createRecord({
      modelId,
      capabilities: inferCapabilitiesFromModel({ modelId }),
      source: "nvidia-api-docs-llm",
      sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
      freeEndpoint: true,
      partnerEndpoint: !modelId.startsWith("nvidia/"),
    })),
    ...NVIDIA_TOOL_MODELS.map((entry) => createRecord(entry)),
  ]);
}

function createRecord(entry) {
  const capabilities = normalizeCapabilities(entry.capabilities ?? inferCapabilitiesFromModel(entry));
  const endpointType = entry.endpointType ?? inferEndpointType(capabilities, entry);
  const endpointPath = entry.endpointPath ?? endpointPathFor(endpointType);
  const publisher = entry.publisher ?? String(entry.modelId).split("/")[0] ?? "nvidia";
  const downloadableOnly = Boolean(entry.downloadableOnly || endpointType === "downloadable_only");
  const deprecatedSoon = Boolean(entry.deprecatedSoon);
  const commercialSafe = entry.commercialSafe === undefined ? true : Boolean(entry.commercialSafe);

  return {
    providerId: NVIDIA_PROVIDER.providerId,
    providerName: NVIDIA_PROVIDER.providerName,
    modelId: entry.modelId,
    displayName: entry.displayName ?? toDisplayName(entry.modelId),
    publisher,
    source: entry.source ?? "nvidia-catalog-seed",
    sourceUrlOrDiscoveryNote: entry.sourceUrlOrDiscoveryNote ?? OFFICIAL_SOURCE_URLS.llmApis,
    catalogStatus: "catalog_known",
    endpointType,
    endpointPath,
    capabilities,
    primaryCapability: primaryCapability(capabilities),
    chatSelectable: false,
    taskToolSelectable: false,
    uiVisibleInChat: true,
    uiGroup: uiGroupFor(capabilities),
    freeEndpoint: Boolean(entry.freeEndpoint),
    partnerEndpoint: Boolean(entry.partnerEndpoint),
    downloadableOnly,
    deprecatedSoon,
    deprecationNote: deprecatedSoon ? "Marked deprecated or deprecated-free-endpoint in NVIDIA catalog/search evidence." : "",
    commercialSafe,
    usageRestriction: entry.usageRestriction ?? "",
    requiresSpecialPayload: Boolean(entry.requiresSpecialPayload),
    testStatus: "unverified",
    lastSmokeAt: null,
    lastSmokeResult: null,
    notes: entry.notes ?? "Known catalog record. Not selectable until a real smoke pass is recorded.",
  };
}

function mergeLiveModelIds(records, liveIds) {
  const existing = new Map(records.map((record) => [record.modelId, record]));
  for (const modelId of liveIds) {
    if (!existing.has(modelId)) {
      existing.set(modelId, createRecord({
        modelId,
        capabilities: inferCapabilitiesFromModel({ modelId }),
        source: "nvidia-api-docs-live-discovery",
        sourceUrlOrDiscoveryNote: OFFICIAL_SOURCE_URLS.llmApis,
        freeEndpoint: true,
        partnerEndpoint: !modelId.startsWith("nvidia/"),
      }));
    }
  }
  return Array.from(existing.values());
}

function parseModelIdsFromDocs(text) {
  const matches = Array.from(String(text || "").matchAll(/\b([a-z0-9][a-z0-9_.-]+)\s*\/\s*([a-z0-9][a-z0-9_.:-]+)/gi));
  return Array.from(new Set(matches
    .map((match) => `${match[1].toLowerCase()}/${match[2].toLowerCase()}`)
    .filter(isPlausibleLiveModelId))).sort();
}

function isPlausibleLiveModelId(modelId) {
  const [provider, model] = String(modelId).split("/");
  if (!LIVE_PROVIDER_PREFIX_ALLOWLIST.includes(provider)) return false;
  if (!model || model.length < 3) return false;
  if (LIVE_MODEL_ID_BLOCKLIST.some((pattern) => pattern.test(modelId))) return false;
  return true;
}

function dedupeRecords(records) {
  const byId = new Map();
  for (const record of records) {
    byId.set(record.modelId, {
      ...(byId.get(record.modelId) ?? {}),
      ...record,
      capabilities: normalizeCapabilities([...(byId.get(record.modelId)?.capabilities ?? []), ...(record.capabilities ?? [])]),
    });
  }
  return Array.from(byId.values()).sort((a, b) => a.modelId.localeCompare(b.modelId));
}

function toDisplayName(modelId) {
  return String(modelId)
    .split("/")
    .pop()
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
