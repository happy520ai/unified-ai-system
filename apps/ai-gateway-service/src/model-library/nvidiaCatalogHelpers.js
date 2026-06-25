/**
 * Pure helper functions for NVIDIA catalog record creation, live-model
 * parsing, deduplication, and display-name formatting.
 *
 * Extracted from nvidiaCatalogDiscovery.js to keep that orchestrator under the
 * 500-line anti-entropy size limit.
 */

import {
  endpointPathFor,
  inferCapabilitiesFromModel,
  inferEndpointType,
  normalizeCapabilities,
  primaryCapability,
  uiGroupFor,
} from "./modelCapabilityRules.js";

import {
  LIVE_MODEL_ID_BLOCKLIST,
  LIVE_PROVIDER_PREFIX_ALLOWLIST,
  NVIDIA_PROVIDER,
  OFFICIAL_SOURCE_URLS,
} from "./nvidiaCatalogData.js";

/**
 * Convert a modelId like "meta/llama-3.1-8b-instruct" into a human-readable
 * display name like "Llama 3.1 8B Instruct".
 */
export function toDisplayName(modelId) {
  return String(modelId)
    .split("/")
    .pop()
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Check whether a parsed modelId passes the provider allowlist, minimum
 * length, and blocklist filters.
 */
export function isPlausibleLiveModelId(modelId) {
  const [provider, model] = String(modelId).split("/");
  if (!LIVE_PROVIDER_PREFIX_ALLOWLIST.includes(provider)) return false;
  if (!model || model.length < 3) return false;
  if (LIVE_MODEL_ID_BLOCKLIST.some((pattern) => pattern.test(modelId))) return false;
  return true;
}

/**
 * Build a full catalog record from a partial entry, filling in defaults for
 * display name, endpoint path, capabilities, UI group, etc.
 */
export function createRecord(entry) {
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

/**
 * Merge freshly discovered live model ids into an existing record set, creating
 * new records for any modelId not already present.
 */
export function mergeLiveModelIds(records, liveIds) {
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

/**
 * Parse provider/model pairs from raw documentation text, returning a sorted
 * deduplicated list of plausible live model ids.
 */
export function parseModelIdsFromDocs(text) {
  const matches = Array.from(String(text || "").matchAll(/\b([a-z0-9][a-z0-9_.-]+)\s*\/\s*([a-z0-9][a-z0-9_.:-]+)/gi));
  return Array.from(new Set(matches
    .map((match) => `${match[1].toLowerCase()}/${match[2].toLowerCase()}`)
    .filter(isPlausibleLiveModelId))).sort();
}

/**
 * Deduplicate catalog records by modelId, merging capabilities when the same
 * model appears more than once. Returns records sorted by modelId.
 */
export function dedupeRecords(records) {
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
