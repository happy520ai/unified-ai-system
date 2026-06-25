/**
 * NVIDIA catalog discovery orchestrator.
 *
 * Static data (model lists, source URLs, allowlists) lives in
 * ./nvidiaCatalogData.js; pure helper functions (record creation, parsing,
 * deduplication) live in ./nvidiaCatalogHelpers.js.  This file wires them
 * together and exposes the three public entry points.
 */

import { inferCapabilitiesFromModel } from "./modelCapabilityRules.js";

import {
  CHAT_MODELS,
  NVIDIA_PROVIDER,
  NVIDIA_TOOL_MODELS,
  OFFICIAL_SOURCE_URLS,
} from "./nvidiaCatalogData.js";

import {
  createRecord,
  dedupeRecords,
  mergeLiveModelIds,
  parseModelIdsFromDocs,
} from "./nvidiaCatalogHelpers.js";

// Re-export so existing consumers keep working unchanged.
export { NVIDIA_PROVIDER };

export function discoverNvidiaCatalog({ allowNetwork = false, fetchImpl = globalThis.fetch } = {}) {
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

export async function discoverNvidiaCatalogLive({ fetchImpl = globalThis.fetch, timeoutMs = 6000 } = {}) {
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
