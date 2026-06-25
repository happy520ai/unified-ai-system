import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const STORE_VERSION = 1;

export function createRuntimeCredentialStore({ env = process.env, storagePath } = {}) {
  const persistence = createPersistenceConfig({ env, storagePath });
  const credentials = new Map();
  for (const record of loadPersistedRecords(persistence)) {
    credentials.set(record.providerId, record);
  }

  return {
    set({ providerId, apiKey, endpoint, source = "runtime", models = [] } = {}) {
      const normalizedProviderId = normalizeProviderId(providerId);
      const normalizedApiKey = normalizeApiKey(apiKey);
      const normalizedEndpoint = normalizeEndpoint(endpoint);

      if (!normalizedProviderId) {
        throw createCredentialError("RUNTIME_PROVIDER_ID_REQUIRED", "providerId is required.");
      }

      if (!normalizedApiKey) {
        throw createCredentialError("RUNTIME_API_KEY_REQUIRED", "apiKey is required.");
      }

      const current = credentials.get(normalizedProviderId);
      const record = {
        providerId: normalizedProviderId,
        apiKey: normalizedApiKey,
        endpoint: normalizedEndpoint,
        source,
        setAt: current?.setAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        models: mergeModels(current?.models, models),
        persisted: false,
      };
      credentials.set(normalizedProviderId, record);
      persistCredentials(credentials, persistence);

      return describeCredential(record);
    },

    getApiKey(providerId) {
      return credentials.get(normalizeProviderId(providerId))?.apiKey ?? "";
    },

    getEndpoint(providerId) {
      return credentials.get(normalizeProviderId(providerId))?.endpoint ?? "";
    },

    describe(providerId) {
      const normalizedProviderId = normalizeProviderId(providerId);
      if (!normalizedProviderId) {
        return null;
      }

      const record = credentials.get(normalizedProviderId);
      return record ? describeCredential(record) : createEmptyDescription(normalizedProviderId);
    },

    has(providerId) {
      return credentials.has(normalizeProviderId(providerId));
    },

    listRecords() {
      return Array.from(credentials.values()).map((record) => ({
        providerId: record.providerId,
        apiKeyPresent: !!record.apiKey,
        apiKeyPreview: record.apiKey ? `${String(record.apiKey).slice(0, 4)}...${String(record.apiKey).slice(-4)}` : null,
        endpoint: record.endpoint,
        source: record.source,
        setAt: record.setAt,
        updatedAt: record.updatedAt,
        models: Array.isArray(record.models) ? record.models.map((model) => ({ ...model })) : [],
        persisted: record.persisted === true,
      }));
    },

    clear(providerId) {
      const normalizedProviderId = normalizeProviderId(providerId);
      if (!normalizedProviderId) {
        return false;
      }

      const deleted = credentials.delete(normalizedProviderId);
      if (deleted) {
        persistCredentials(credentials, persistence);
      }
      return deleted;
    },
  };
}

function describeCredential(record) {
  return {
    providerId: record.providerId,
    apiKeyPresent: true,
    endpointConfigured: Boolean(record.endpoint),
    secretStorage: record.persisted ? "local-user-file" : "memory-only",
    persisted: record.persisted === true,
    source: record.source,
    setAt: record.setAt,
    updatedAt: record.updatedAt,
    runtimeModelCount: Array.isArray(record.models) ? record.models.length : 0,
  };
}

function createEmptyDescription(providerId) {
  return {
    providerId,
    apiKeyPresent: false,
    endpointConfigured: false,
    secretStorage: "local-user-file",
    persisted: false,
    source: null,
    setAt: null,
    updatedAt: null,
    runtimeModelCount: 0,
  };
}

function createPersistenceConfig({ env, storagePath }) {
  const mode = String(env.PME_RUNTIME_CREDENTIAL_STORE_MODE ?? "local-file").trim().toLowerCase();
  const enabled = mode !== "memory" && mode !== "disabled" && mode !== "off";
  return {
    enabled,
    path: storagePath || env.PME_RUNTIME_CREDENTIAL_STORE_PATH || createDefaultStorePath(env),
  };
}

function createDefaultStorePath(env) {
  const root = env.LOCALAPPDATA || join(homedir(), ".pme-moving-earth");
  return join(root, "PME-Moving-Earth", "unified-ai-system", "runtime-credentials.json");
}

function loadPersistedRecords(persistence) {
  if (!persistence.enabled || !persistence.path || !existsSync(persistence.path)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(persistence.path, "utf8"));
    const records = Array.isArray(parsed?.records) ? parsed.records : [];
    return records
      .map(normalizePersistedRecord)
      .filter(Boolean)
      .map((record) => ({ ...record, persisted: true }));
  } catch {
    return [];
  }
}

function persistCredentials(credentials, persistence) {
  if (!persistence.enabled || !persistence.path) {
    return false;
  }

  const records = Array.from(credentials.values())
    .filter(isPersistableRecord)
    .map((record) => ({
      providerId: record.providerId,
      apiKey: record.apiKey,
      endpoint: record.endpoint,
      source: record.source,
      setAt: record.setAt,
      updatedAt: record.updatedAt,
      models: normalizeStoredModels(record.models),
    }));

  try {
    mkdirSync(dirname(persistence.path), { recursive: true });
    const tmpPath = `${persistence.path}.${process.pid}.tmp`;
    writeFileSync(tmpPath, JSON.stringify({
      version: STORE_VERSION,
      warning: "Local user credential store. Do not commit or share this file.",
      records,
    }, null, 2));
    renameSync(tmpPath, persistence.path);
    const persistedProviders = new Set(records.map((record) => record.providerId));
    for (const record of credentials.values()) {
      record.persisted = persistedProviders.has(record.providerId);
    }
    return true;
  } catch {
    // Clean up orphaned temp file if rename failed
    try {
      const tmpPath = `${persistence.path}.${process.pid}.tmp`;
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch { /* ignore cleanup errors */ }
    for (const record of credentials.values()) {
      record.persisted = false;
    }
    return false;
  }
}

function normalizePersistedRecord(record) {
  const providerId = normalizeProviderId(record?.providerId);
  const apiKey = normalizeApiKey(record?.apiKey);
  if (!providerId || !apiKey || !isPersistableApiKey(apiKey)) {
    return null;
  }

  return {
    providerId,
    apiKey,
    endpoint: normalizeEndpoint(record?.endpoint),
    source: String(record?.source ?? "local-user-file"),
    setAt: normalizeTimestamp(record?.setAt),
    updatedAt: normalizeTimestamp(record?.updatedAt),
    models: normalizeStoredModels(record?.models),
  };
}

function isPersistableRecord(record) {
  return Boolean(record?.providerId && record?.apiKey && isPersistableApiKey(record.apiKey));
}

function isPersistableApiKey(apiKey) {
  return !String(apiKey || "").toLowerCase().includes("secret-must-not-persist");
}

function mergeModels(currentModels = [], nextModels = []) {
  const merged = new Map();
  for (const model of normalizeStoredModels(currentModels)) {
    merged.set(model.id, model);
  }
  for (const model of normalizeStoredModels(nextModels)) {
    merged.set(model.id, model);
  }
  return Array.from(merged.values());
}

function normalizeStoredModels(models = []) {
  if (!Array.isArray(models)) {
    return [];
  }

  return models
    .map((model) => {
      const id = String(model?.id ?? model?.modelId ?? "").trim();
      if (!id) return null;
      return {
        id,
        displayName: String(model?.displayName ?? model?.modelDisplayName ?? id),
        capabilities: normalizeCapabilities(model?.capabilities),
        source: String(model?.source ?? "runtime-credential-persisted"),
        metadata: {
          ...(model?.metadata ?? {}),
          persistedRuntimeModel: true,
        },
      };
    })
    .filter(Boolean);
}

function normalizeCapabilities(capabilities) {
  const normalized = Array.isArray(capabilities)
    ? capabilities.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return normalized.length ? normalized : ["chat", "summary"];
}

function normalizeTimestamp(value) {
  const text = String(value ?? "").trim();
  return text || new Date().toISOString();
}

function normalizeProviderId(providerId) {
  return String(providerId ?? "").trim();
}

function normalizeApiKey(apiKey) {
  return String(apiKey ?? "").trim();
}

function normalizeEndpoint(endpoint) {
  return String(endpoint ?? "").trim().replace(/\/+$/, "");
}

function createCredentialError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  error.retryable = false;
  return error;
}
