import {
  chmodSync,
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
import { summarizeErrorForLog } from "../security/logSanitizationPolicy.ts";
import {
  createRuntimeCredentialCipher,
  isRuntimeCredentialEnvelope,
} from "../security/runtimeCredentialEncryption.ts";
import { createSqliteCredentialBackend } from "./runtimeCredentialStore-sqlite.js";

const STORE_VERSION = 2;
const logger = createPinoLogger({ app: "runtimeCredentialStore" });

export function createRuntimeCredentialStore({ env = process.env, storagePath } = {}) {
  const persistence = createPersistenceConfig({ env, storagePath });
  // Optional SQLite backend for cross-process credential sharing.
  const sqliteBackend = persistence.mode === "sqlite"
    ? createSqliteCredentialBackend(persistence.path)
    : null;
  const credentials = new Map();
  try {
    const loaded = loadPersistedRecords(persistence, sqliteBackend);
    for (const record of loaded.records) {
      credentials.set(record.providerId, record);
    }
    if (loaded.requiresMigration) {
      if (!persistCredentials(credentials, persistence, sqliteBackend)) {
        throw createPersistenceError(
          "RUNTIME_CREDENTIAL_MIGRATION_FAILED",
          "Runtime credential store migration could not be committed.",
        );
      }
      sqliteBackend?.compact?.();
    }
  } catch (error) {
    sqliteBackend?.close?.();
    throw error;
  }

  return {
    set({ providerId, apiKey, endpoint, source = "runtime", models = [] } = {}) {
      const normalizedProviderId = normalizeProviderId(providerId);
      const normalizedApiKey = normalizeApiKey(apiKey);
      const normalizedEndpoint = normalizeEndpoint(endpoint);

      if (!normalizedProviderId) {
        throw createCredentialError("RUNTIME_PROVIDER_ID_REQUIRED", "providerId is required.");
      }
      if (normalizedProviderId.length > 128) {
        throw createCredentialError("RUNTIME_PROVIDER_ID_TOO_LONG", "providerId exceeds 128 characters.");
      }

      if (!normalizedApiKey) {
        throw createCredentialError("RUNTIME_API_KEY_REQUIRED", "apiKey is required.");
      }
      if (normalizedApiKey.length > 16 * 1024) {
        throw createCredentialError("RUNTIME_API_KEY_TOO_LONG", "apiKey exceeds 16 KiB.");
      }
      if (normalizedEndpoint.length > 8192) {
        throw createCredentialError("RUNTIME_ENDPOINT_TOO_LONG", "endpoint exceeds 8 KiB.");
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
      const persisted = persistRecord(record, credentials, persistence, sqliteBackend);
      if (persistence.enabled && !persisted) {
        if (current) credentials.set(normalizedProviderId, current);
        else credentials.delete(normalizedProviderId);
        throw createPersistenceError(
          "RUNTIME_CREDENTIAL_PERSIST_FAILED",
          "Runtime credential was not accepted because encrypted persistence failed.",
        );
      }

      return describeCredential(record, persistence);
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
      return record
        ? describeCredential(record, persistence)
        : createEmptyDescription(normalizedProviderId, persistence);
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

      const current = credentials.get(normalizedProviderId);
      if (!current) return false;

      credentials.delete(normalizedProviderId);
      let persisted = true;
      if (persistence.enabled) {
        if (sqliteBackend) {
          try {
            persisted = sqliteBackend.remove(normalizedProviderId);
          } catch (error) {
            logger.warn(
              { event: "runtime_credential_clear_failed", error: summarizeErrorForLog(error) },
              "Runtime credential clear failed.",
            );
            persisted = false;
          }
        } else {
          persisted = persistCredentials(credentials, persistence, sqliteBackend);
        }
      }
      if (!persisted) {
        credentials.set(normalizedProviderId, current);
        throw createPersistenceError(
          "RUNTIME_CREDENTIAL_CLEAR_FAILED",
          "Runtime credential clear was not committed to persistent storage.",
        );
      }
      return true;
    },

    close() {
      sqliteBackend?.close?.();
    },
  };
}

function describeCredential(record, persistence) {
  return {
    providerId: record.providerId,
    apiKeyPresent: true,
    endpointConfigured: Boolean(record.endpoint),
    secretStorage: record.persisted ? describePersistence(persistence) : "memory-only",
    persisted: record.persisted === true,
    source: record.source,
    setAt: record.setAt,
    updatedAt: record.updatedAt,
    runtimeModelCount: Array.isArray(record.models) ? record.models.length : 0,
  };
}

function createEmptyDescription(providerId, persistence) {
  return {
    providerId,
    apiKeyPresent: false,
    endpointConfigured: false,
    secretStorage: describePersistence(persistence),
    persisted: false,
    source: null,
    setAt: null,
    updatedAt: null,
    runtimeModelCount: 0,
  };
}

function createPersistenceConfig({ env, storagePath }) {
  const configuredMode = String(env.PME_RUNTIME_CREDENTIAL_STORE_MODE ?? "memory").trim().toLowerCase();
  const mode = ["disabled", "off"].includes(configuredMode) ? "memory" : configuredMode;
  if (!["memory", "local-file", "sqlite"].includes(mode)) {
    throw createPersistenceError(
      "RUNTIME_CREDENTIAL_STORE_MODE_INVALID",
      "Runtime credential store mode must be memory, local-file, or sqlite.",
    );
  }
  const enabled = mode !== "memory";
  return {
    enabled,
    mode,
    path: storagePath || env.PME_RUNTIME_CREDENTIAL_STORE_PATH || createDefaultStorePath(env, mode),
    cipher: enabled ? createRuntimeCredentialCipher({ env }) : null,
    allowPlaintextMigration: String(
      env.PME_RUNTIME_CREDENTIAL_ALLOW_PLAINTEXT_MIGRATION ?? "",
    ).trim().toLowerCase() === "true",
  };
}

function createDefaultStorePath(env, mode) {
  const root = env.LOCALAPPDATA || join(homedir(), ".pme-moving-earth");
  const fileName = mode === "sqlite" ? "runtime-credentials.db" : "runtime-credentials.json";
  return join(root, "PME-Moving-Earth", "unified-ai-system", fileName);
}

function loadPersistedRecords(persistence, sqliteBackend) {
  if (!persistence.enabled || !persistence.path) {
    return { records: [], requiresMigration: false };
  }

  if (sqliteBackend) {
    return decodeStoredEntries(sqliteBackend.loadRecords(), persistence);
  }

  if (!existsSync(persistence.path)) {
    return { records: [], requiresMigration: false };
  }

  try {
    const parsed = JSON.parse(readFileSync(persistence.path, "utf8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.records)) {
      throw new Error("credential store root is invalid");
    }
    return decodeStoredEntries(parsed.records, persistence, parsed.version);
  } catch (error) {
    if (error?.code?.startsWith?.("RUNTIME_CREDENTIAL_")) throw error;
    throw createPersistenceError(
      "RUNTIME_CREDENTIAL_STORE_INVALID",
      "Runtime credential store is malformed or unreadable.",
    );
  }
}

function decodeStoredEntries(entries, persistence, declaredVersion) {
  if (!Array.isArray(entries)) {
    throw createPersistenceError(
      "RUNTIME_CREDENTIAL_STORE_INVALID",
      "Runtime credential entries are invalid.",
    );
  }
  if (entries.length === 0) {
    return {
      records: [],
      requiresMigration: declaredVersion !== undefined && declaredVersion !== STORE_VERSION,
    };
  }

  const encryptedCount = entries.filter(isRuntimeCredentialEnvelope).length;
  if (encryptedCount > 0 && encryptedCount !== entries.length) {
    throw createPersistenceError(
      "RUNTIME_CREDENTIAL_STORE_MIXED_FORMAT",
      "Runtime credential store contains mixed plaintext and encrypted records.",
    );
  }

  if (encryptedCount === entries.length) {
    if (declaredVersion !== undefined && declaredVersion !== STORE_VERSION) {
      throw createPersistenceError(
        "RUNTIME_CREDENTIAL_STORE_INVALID",
        "Encrypted credential store version is invalid.",
      );
    }
    const records = entries.map((entry) => normalizePersistedRecord(persistence.cipher.open(entry)));
    if (records.some((record) => !record)) {
      throw createPersistenceError(
        "RUNTIME_CREDENTIAL_STORE_INVALID",
        "Encrypted credential record is invalid.",
      );
    }
    return {
      records: records.map((record) => ({ ...record, persisted: true })),
      requiresMigration: entries.some((entry) => !persistence.cipher.isPrimaryEnvelope(entry)),
    };
  }

  if (!persistence.allowPlaintextMigration) {
    throw createPersistenceError(
      "RUNTIME_CREDENTIAL_PLAINTEXT_STORE_REJECTED",
      "Plaintext runtime credential persistence is rejected; use the one-time migration procedure.",
    );
  }
  const records = entries.map(normalizePersistedRecord);
  if (records.some((record) => !record)) {
    throw createPersistenceError(
      "RUNTIME_CREDENTIAL_STORE_INVALID",
      "Legacy credential record is invalid.",
    );
  }
  return {
    records: records.map((record) => ({ ...record, persisted: true })),
    requiresMigration: true,
  };
}

function persistRecord(record, credentials, persistence, sqliteBackend) {
  if (!persistence.enabled) {
    record.persisted = false;
    return true;
  }
  if (sqliteBackend) {
    if (!isPersistableRecord(record)) return false;
    try {
      sqliteBackend.upsert(persistence.cipher.seal({
        providerId: record.providerId,
        apiKey: record.apiKey,
        endpoint: record.endpoint,
        source: record.source,
        setAt: record.setAt,
        updatedAt: record.updatedAt,
        models: normalizeStoredModels(record.models),
      }));
      record.persisted = true;
      return true;
    } catch (error) {
      logger.warn(
        { event: "runtime_credential_persist_failed", error: summarizeErrorForLog(error) },
        "Runtime credential persistence failed.",
      );
      record.persisted = false;
      return false;
    }
  }
  return persistCredentials(credentials, persistence, sqliteBackend);
}

function persistCredentials(credentials, persistence, sqliteBackend) {
  if (!persistence.enabled || !persistence.path) {
    return false;
  }

  let records;
  try {
    records = Array.from(credentials.values())
      .filter(isPersistableRecord)
      .map((record) => persistence.cipher.seal({
        providerId: record.providerId,
        apiKey: record.apiKey,
        endpoint: record.endpoint,
        source: record.source,
        setAt: record.setAt,
        updatedAt: record.updatedAt,
        models: normalizeStoredModels(record.models),
      }));
  } catch (error) {
    logger.warn(
      { event: "runtime_credential_encrypt_failed", error: summarizeErrorForLog(error) },
      "Runtime credential encryption failed.",
    );
    return false;
  }

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
        error: summarizeErrorForLog(error),
      }, "Runtime credential persistence failed.");
      return false;
    }
  }

  let tmpPath = null;
  try {
    mkdirSync(dirname(persistence.path), { recursive: true, mode: 0o700 });
    try { chmodSync(dirname(persistence.path), 0o700); } catch { /* best effort on Windows */ }
    tmpPath = `${persistence.path}.${process.pid}.tmp`;
    writeFileSync(tmpPath, JSON.stringify({
      version: STORE_VERSION,
      encryption: "AES-256-GCM",
      warning: "Encrypted local credential store. Protect the master key separately.",
      records,
    }, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(tmpPath, persistence.path);
    hardenCredentialFilePermissions(persistence.path);
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
          error: summarizeErrorForLog(cleanupError),
        }, "Failed to clean up a runtime credential temp file.");
      }
    }
    logger.warn({
      event: "runtime_credential_persist_failed",
      error: summarizeErrorForLog(error),
    }, "Runtime credential persistence failed.");
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

function hardenCredentialFilePermissions(filePath) {
  try { chmodSync(filePath, 0o600); } catch { /* Windows ACL is handled below. */ }
  if (process.platform !== "win32") return;
  try {
    const user = process.env.USERNAME || process.env.USER || "";
    if (!user) return;
    const result = spawnSync("icacls", [
      filePath,
      "/inheritance:r",
      "/grant:r",
      user + ":F",
    ], { stdio: "ignore", timeout: 5000 });
    if (result.status !== 0) {
      logger.warn({
        event: "runtime_credential_acl_restriction_failed",
        status: result.status,
      }, "Could not restrict the Windows ACL on the encrypted credential file.");
    }
  } catch {
    logger.warn(
      { event: "runtime_credential_acl_restriction_failed" },
      "Could not restrict the encrypted credential file ACL.",
    );
  }
}

function describePersistence(persistence) {
  if (!persistence.enabled) return "memory-only";
  return persistence.mode === "sqlite" ? "encrypted-sqlite" : "encrypted-local-file";
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

function createPersistenceError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.category = "security";
  error.retryable = false;
  return error;
}
