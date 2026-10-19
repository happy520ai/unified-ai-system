// =============================================================================
// credentialPoolStore.js — 多 Key 池的加密持久化
//
// 与 runtimeCredentialStore 的区别：那里是「一 provider 一 Key」，且 apiKey
// 字段被自身校验限制在 16 KiB；这里要装一个 provider 的整池 Key。
// 加密复用 security/runtimeCredentialEncryption（单条明文上限 1 MiB，
// 约合一万个 Key），因此每个 provider 一条信封即可，池容量不设人为上限。
// =============================================================================

import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createRuntimeCredentialCipher } from "../security/runtimeCredentialEncryption.ts";
import { createPinoLogger } from "../logging/pinoLogger.js";
import { summarizeErrorForLog } from "../security/logSanitizationPolicy.ts";

const logger = createPinoLogger({ app: "credentialPoolStore" });
const STORE_VERSION = 1;

export type CredentialPoolStoreOptions = {
  env?: Record<string, string | undefined>;
  storagePath?: string;
};

export type StoredPoolRecord = {
  providerId: string;
  keys: Array<{ key: string; balance?: number; expire?: string | null; label?: string }>;
};

export function createCredentialPoolStore({
  env = process.env as Record<string, string | undefined>,
  storagePath,
}: CredentialPoolStoreOptions = {}) {
  const persistence = createPersistenceConfig({ env, storagePath });

  function readAll(): StoredPoolRecord[] {
    if (!persistence.enabled) return [];
    const path = persistence.path;
    if (!existsSync(path)) return [];
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      const envelopes = Array.isArray(parsed?.envelopes) ? parsed.envelopes : null;
      if (!envelopes) throw new Error("pool store root is invalid");
      const cipher = persistence.cipher;
      if (!cipher) return [];
      return envelopes.map((envelope: never) => cipher.open(envelope));
    } catch (error) {
      logger.warn({ event: "credential_pool_store_unreadable", error: summarizeErrorForLog(error) },
        "Credential pool store could not be read; treating as empty.");
      return [];
    }
  }

  function writeAll(records: StoredPoolRecord[]): boolean {
    if (!persistence.enabled) return false;
    let envelopes;
    try {
      const cipher = persistence.cipher;
      if (!cipher) return false;
      envelopes = records.map((record) => cipher.seal(record as never));
    } catch (error) {
      logger.warn({ event: "credential_pool_encrypt_failed", error: summarizeErrorForLog(error) },
        "Credential pool encryption failed.");
      return false;
    }
    let tmpPath = null;
    try {
      mkdirSync(dirname(persistence.path), { recursive: true, mode: 0o700 });
      try { chmodSync(dirname(persistence.path), 0o700); } catch { /* best effort on Windows */ }
      tmpPath = `${persistence.path}.${process.pid}.tmp`;
      writeFileSync(tmpPath, JSON.stringify({
        version: STORE_VERSION,
        encryption: "AES-256-GCM",
        records: envelopes.length,
        envelopes,
      }, null, 2), { encoding: "utf8", mode: 0o600 });
      renameSync(tmpPath, persistence.path);
      try { chmodSync(persistence.path, 0o600); } catch { /* Windows ACL handled elsewhere */ }
      return true;
    } catch (error) {
      if (tmpPath && existsSync(tmpPath)) {
        try { unlinkSync(tmpPath); } catch { /* best effort */ }
      }
      logger.warn({ event: "credential_pool_persist_failed", error: summarizeErrorForLog(error) },
        "Credential pool persistence failed.");
      return false;
    }
  }

  return {
    enabled: persistence.enabled,
    readAll,
    writeAll,
    path: persistence.path,
  };
}

function createPersistenceConfig({ env = {} as Record<string, string | undefined>, storagePath }: CredentialPoolStoreOptions = {}) {
  const configuredMode = String(
    env.PME_CREDENTIAL_POOL_STORE_MODE ?? env.PME_RUNTIME_CREDENTIAL_STORE_MODE ?? "memory",
  ).trim().toLowerCase();
  const mode = ["disabled", "off"].includes(configuredMode) ? "memory" : configuredMode;
  const enabled = mode !== "memory";
  return {
    enabled,
    mode,
    path: storagePath || env.PME_CREDENTIAL_POOL_STORE_PATH || createDefaultPoolPath(env),
    cipher: enabled ? createRuntimeCredentialCipher({ env }) : null,
  };
}

function createDefaultPoolPath(env: Record<string, string | undefined>): string {
  const root = env.LOCALAPPDATA || join(homedir(), ".pme-moving-earth");
  return join(root, "PME-Moving-Earth", "unified-ai-system", "credential-pool.json");
}
