import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createPinoLogger } from "../logging/pinoLogger.js";
import { createSqliteCredentialBackend } from "./runtimeCredentialStore-sqlite.js";

const STORE_VERSION = 1;
const logger = createPinoLogger({ app: "runtimeCredentialStore" });

export function createRuntimeCredentialStore({ env = process.env, storagePath } = {}) {
  const persistence = createPersistenceConfig({ env, storagePath });
  // Optional SQLite backend for cross-process credential sharing.
  const sqliteBackend = persistence.mode === "sqlite"
    ? createSqliteCredentialBackend(persistence.path)
    : null;
  const credentials = new Map();
  for (const record of loadPersistedRecords(persistence, sqliteBackend)) {
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
      persistRecord(record, credentials, persistence, sqliteBackend);

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
        apiKeyPresent: Boolean(record.apiKey),
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
        if (sqliteBackend) {
          try { sqliteBackend.remove(normalizedProviderId); } catch { /* ignore */ }
        } else {
          persistCredentials(credentials, persistence);
        }
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
    mode,
    path: storagePath || env.PME_RUNTIME_CREDENTIAL_STORE_PATH || createDefaultStorePath(env),
  };
}

function createDefaultStorePath(env) {
  const root = env.LOCALAPPDATA || join(homedir(), ".pme-moving-earth");
  return join(root, "PME-Moving-Earth", "unified-ai-system", "runtime-credentials.json");
}

function loadPersistedRecords(persistence, sqliteBackend) {
  if (!persistence.enabled || !persistence.path) {
    return [];
  }

  if (sqliteBackend) {
    return sqliteBackend.loadRecords()
      .map(normalizePersistedRecord)
      .filter(Boolean)
      .map((record) => ({ ...record, persisted: true }));
  }

  if (!existsSync(persistence.path)) {
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

function persistRecord(record, credentials, persistence, sqliteBackend) {
  if (sqliteBackend) {
    if (!isPersistableRecord(record)) return;
    try {
      sqliteBackend.upsert({
        providerId: record.providerId,
        apiKey: record.apiKey,
        endpoint: record.endpoint,
        source: record.source,
        setAt: record.setAt,
        updatedAt: record.updatedAt,
        models: normalizeStoredModels(record.models),
      });
      record.persisted = true;
    } catch (error) {
      logger.warn({ event: "runtime_credential_persist_failed", err: error }, "Runtime credential persistence failed.");
      record.persisted = false;
    }
    return;
  }
  persistCredentials(credentials, persistence);
}

function persistCredentials(credentials, persistence, sqliteBackend) {
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

  if (sqliteBackend) {
    try {
      sqliteBackend.saveRecords(records);
      const persistedProviders = new Set(records.map((record) => record.providerId));
      for (const record of credentials.values()) {
        record.persisted = persistedProviders.has(record.providerId);
      }
      return true;
    } catch (error) {
      logger.warn({
        event: "runtime_credential_persist_failed",
        err: error,
      }, "Runtime credential persistence failed.");
      for (const record of credentials.values()) {
        record.persisted = false;
      }
      return false;
    }
  }

  let tmpPath = null;
  try {
    mkdirSync(dirname(persistence.path), { recursive: true });
    tmpPath = `${persistence.path}.${process.pid}.tmp`;
    writeFileSync(tmpPath, JSON.stringify({
      version: STORE_VERSION,
      warning: "Local user credential store. Do not commit or share this file.",
      records,
    }, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(tmpPath, persistence.path);
    restrictCredentialFilePermissions(persistence.path);
    const persistedProviders = new Set(records.map((record) => record.providerId));
    for (const record of credentials.values()) {
      record.persisted = persistedProviders.has(record.providerId);
    }
    return true;
  } catch (error) {
    if (tmpPath && existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch (cleanupError) {
        logger.warn({
          event: "runtime_credential_temp_cleanup_failed",
          err: cleanupError,
        }, "Failed to clean up a runtime credential temp file.");
      }
    }
    logger.warn({
      event: "runtime_credential_persist_failed",
      err: error,
    }, "Runtime credential persistence failed.");
    for (const record of credentials.values()) {
      record.persisted = false;
    }
    return false;
  }
}

// Windows 忽略 POSIX mode（0o600 不映射 ACL），凭证文件会以默认可继承 ACL
// 落盘。这里 best-effort 用 icacls 切断继承、仅保留当前用户；失败不阻断
// 持久化（与 fail-open 的持久化语义一致），只记一条审计日志。
function restrictCredentialFilePermissions(filePath) {
  if (process.platform !== "win32") return;
  try {
    const user = process.env.USERNAME || process.env.USER || "";
    if (!user) return;
    const result = spawnSync("icacls", [
      filePath,
      "/inheritance:r",
      `/grant:${user}:F`,
    ], { stdio: "ignore", timeout: 5000 });
    if (result.status !== 0) {
      logger.warn({
        event: "runtime_credential_acl_restriction_failed",
        status: result.status,
      }, "Could not restrict the Windows ACL on the runtime credential file.");
    }
  } catch {
    // ACL 加固失败不影响凭证可用性；管理员可参照文档手工收紧。
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
