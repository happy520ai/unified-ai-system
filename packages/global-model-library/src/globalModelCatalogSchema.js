export const GLOBAL_MODEL_STATUSES = Object.freeze([
  "discovered",
  "cataloged",
  "credential_missing",
  "credential_ready",
  "smoke_pending",
  "smoke_passed",
  "selectable_candidate",
  "selectable",
  "failed",
  "high_risk",
  "blocked",
  "deprecated",
]);

export const GLOBAL_MODEL_SOURCES = Object.freeze([
  "seed",
  "manual",
  "provider_discovery",
  "aggregator_catalog",
  "local_runtime",
  "user_import",
]);

export function buildGlobalModelCatalogSchema() {
  return {
    schemaVersion: "phase761-780.global-model-catalog.v1",
    requiredFields: [
      "modelId",
      "canonicalModelId",
      "providerFamily",
      "providerId",
      "source",
      "status",
      "credentialPolicy",
      "capabilities",
      "limits",
      "pricing",
      "risk",
      "evidence",
      "selectableGate",
    ],
    statuses: GLOBAL_MODEL_STATUSES,
    sources: GLOBAL_MODEL_SOURCES,
    defaultRecord: createGlobalModelRecord({
      modelId: "provider-family/model-name",
      canonicalModelId: "provider-family/model-name",
      providerFamily: "provider-family",
      providerId: "provider-family",
    }),
    constraints: {
      rawSecretAllowed: false,
      selectableRequiresSmokePassed: true,
      seedModelsSelectableByDefault: false,
      credentialMissingIsNotUsable: true,
      dryRunImportIsNotRuntime: true,
    },
  };
}

export function createGlobalModelRecord(input = {}) {
  const modelId = String(input.modelId ?? "");
  const providerFamily = String(input.providerFamily ?? input.providerId ?? "unknown");
  const status = normalizeGlobalModelStatus(input.status ?? "credential_missing");
  return {
    modelId,
    canonicalModelId: String(input.canonicalModelId ?? canonicalizeModelId(modelId)),
    providerFamily,
    providerId: String(input.providerId ?? providerFamily),
    source: normalizeSource(input.source ?? "seed"),
    status,
    credentialPolicy: {
      userOwnedApiKeyRequired: input.credentialPolicy?.userOwnedApiKeyRequired ?? true,
      credentialRefRequired: input.credentialPolicy?.credentialRefRequired ?? true,
      rawSecretAllowed: false,
    },
    capabilities: normalizeCapabilities(input.capabilities),
    limits: {
      contextWindow: input.limits?.contextWindow ?? null,
      maxOutputTokens: input.limits?.maxOutputTokens ?? null,
    },
    pricing: {
      inputUsdPer1M: input.pricing?.inputUsdPer1M ?? null,
      outputUsdPer1M: input.pricing?.outputUsdPer1M ?? null,
      source: input.pricing?.source ?? "unknown",
    },
    risk: {
      highRisk: input.risk?.highRisk === true,
      blocked: input.risk?.blocked === true,
      deprecated: input.risk?.deprecated === true,
      reason: input.risk?.reason ?? null,
    },
    evidence: {
      discoveryRef: input.evidence?.discoveryRef ?? null,
      smokeRef: input.evidence?.smokeRef ?? null,
      lastVerifiedAt: input.evidence?.lastVerifiedAt ?? null,
    },
    selectableGate: {
      eligible: false,
      reason: input.selectableGate?.reason ?? "not_smoke_verified",
    },
  };
}

export function normalizeGlobalModelStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return GLOBAL_MODEL_STATUSES.includes(normalized) ? normalized : "blocked";
}

export function normalizeSource(source) {
  const normalized = String(source ?? "").trim().toLowerCase();
  return GLOBAL_MODEL_SOURCES.includes(normalized) ? normalized : "seed";
}

export function canonicalizeModelId(modelId) {
  return String(modelId ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/\/+/g, "/");
}

export function normalizeCapabilities(capabilities = {}) {
  return {
    chat: capabilities.chat === true,
    completion: capabilities.completion === true,
    reasoning: capabilities.reasoning === true,
    coding: capabilities.coding === true,
    vision: capabilities.vision === true,
    audio: capabilities.audio === true,
    image: capabilities.image === true,
    video: capabilities.video === true,
    embedding: capabilities.embedding === true,
    rerank: capabilities.rerank === true,
    toolCalling: capabilities.toolCalling === true,
    jsonMode: capabilities.jsonMode === true,
    longContext: capabilities.longContext === true,
    chineseOptimized: capabilities.chineseOptimized === true,
    lowLatency: capabilities.lowLatency === true,
    lowCost: capabilities.lowCost === true,
  };
}

export function validateGlobalModelRecord(record = {}) {
  const failures = [];
  for (const field of buildGlobalModelCatalogSchema().requiredFields) {
    if (!(field in record)) failures.push(`missing:${field}`);
  }
  if (!GLOBAL_MODEL_STATUSES.includes(record.status)) failures.push(`invalid_status:${record.status}`);
  if (!GLOBAL_MODEL_SOURCES.includes(record.source)) failures.push(`invalid_source:${record.source}`);
  if (record.credentialPolicy?.rawSecretAllowed !== false) failures.push("raw_secret_allowed");
  if (record.selectableGate?.eligible === true) failures.push("seed_record_selectable");
  return {
    valid: failures.length === 0,
    failures,
  };
}
