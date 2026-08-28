import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { isAbsolute } from "node:path";
import {
  createPostgresAuditStore,
  type AuditPostgresPool,
} from "./postgresAuditStore.ts";

type RuntimeEnv = Record<string, string | undefined>;
type AuditStoreMode = "file" | "postgres";

export function createEnterpriseAuditStore({
  env = process.env,
  realProviderEnabled = false,
  postgresPool,
}: {
  env?: RuntimeEnv;
  realProviderEnabled?: boolean;
  postgresPool?: AuditPostgresPool;
} = {}) {
  const mode = resolveMode(env);
  const centralRequired = readBoolean(
    env.PME_AUDIT_CENTRAL_REQUIRED,
    false,
    "PME_AUDIT_CENTRAL_REQUIRED",
  ) || (
    realProviderEnabled
    && readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false, "AI_GATEWAY_MULTI_INSTANCE")
  );
  if (centralRequired && mode !== "postgres") {
    throw configurationError(
      "AUDIT_CENTRAL_STORE_REQUIRED",
      "Multi-instance real-provider execution requires the central PostgreSQL audit store.",
    );
  }
  if (mode === "file") {
    return Object.freeze({
      mode,
      required: false,
      store: null,
    });
  }

  const connectionString = String(env.PME_AUDIT_POSTGRES_URL ?? "").trim();
  if (!connectionString && !postgresPool) {
    throw configurationError(
      "AUDIT_POSTGRES_URL_REQUIRED",
      "PME_AUDIT_POSTGRES_URL is required in postgres audit mode.",
    );
  }
  if (connectionString) assertSecurePostgresUrl(connectionString, env);
  const hmacKey = readHmacKey(env);

  return Object.freeze({
    mode,
    required: centralRequired,
    store: createPostgresAuditStore({
      connectionString: connectionString || undefined,
      pool: postgresPool,
      namespace: normalizeNamespace(env.PME_AUDIT_POSTGRES_NAMESPACE ?? "default"),
      hmacKey,
      maxRows: readBoundedInteger(
        env.PME_AUDIT_POSTGRES_MAX_ROWS,
        10_000_000,
        1,
        1_000_000_000,
        "PME_AUDIT_POSTGRES_MAX_ROWS",
      ),
      poolMax: readBoundedInteger(
        env.PME_AUDIT_POSTGRES_POOL_MAX,
        4,
        1,
        32,
        "PME_AUDIT_POSTGRES_POOL_MAX",
      ),
      statementTimeoutMs: readBoundedInteger(
        env.PME_AUDIT_POSTGRES_STATEMENT_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "PME_AUDIT_POSTGRES_STATEMENT_TIMEOUT_MS",
      ),
      minimumSequence: readBoundedInteger(
        env.PME_AUDIT_POSTGRES_MINIMUM_SEQUENCE,
        0,
        0,
        Number.MAX_SAFE_INTEGER,
        "PME_AUDIT_POSTGRES_MINIMUM_SEQUENCE",
      ),
      trustedHash: String(env.PME_AUDIT_POSTGRES_TRUSTED_HASH ?? "").trim() || undefined,
    }),
  });
}

function resolveMode(env: RuntimeEnv): AuditStoreMode {
  const configured = String(env.PME_AUDIT_STORE_MODE ?? "").trim().toLowerCase();
  if (!configured) {
    return String(env.PME_AUDIT_POSTGRES_URL ?? "").trim() ? "postgres" : "file";
  }
  if (configured === "file" || configured === "postgres") return configured;
  throw configurationError(
    "AUDIT_STORE_MODE_INVALID",
    "PME_AUDIT_STORE_MODE must be file or postgres.",
  );
}

function readHmacKey(env: RuntimeEnv): Buffer {
  const inline = String(env.PME_AUDIT_POSTGRES_HMAC_KEY ?? "").trim();
  const filePath = String(env.PME_AUDIT_POSTGRES_HMAC_KEY_FILE ?? "").trim();
  if (inline && filePath) {
    throw configurationError(
      "AUDIT_POSTGRES_HMAC_KEY_AMBIGUOUS",
      "Configure either the central audit HMAC key or its file, not both.",
    );
  }
  if (!inline && !filePath) {
    throw configurationError(
      "AUDIT_POSTGRES_HMAC_KEY_REQUIRED",
      "The central audit store requires a dedicated 256-bit HMAC key.",
    );
  }
  return parseKey(inline || readKeyFile(filePath));
}

function readKeyFile(filePath: string): string {
  if (!isAbsolute(filePath)) {
    throw configurationError(
      "AUDIT_POSTGRES_HMAC_KEY_PATH_NOT_ABSOLUTE",
      "The central audit HMAC key-file path must be absolute.",
    );
  }
  let descriptor: number | undefined;
  try {
    descriptor = openSync(filePath, fsConstants.O_RDONLY);
    const fileStat = fstatSync(descriptor);
    if (!fileStat.isFile() || fileStat.size <= 0 || fileStat.size > 4_096) {
      throw configurationError(
        "AUDIT_POSTGRES_HMAC_KEY_FILE_INVALID",
        "The central audit HMAC key file has an invalid type or size.",
      );
    }
    if (process.platform !== "win32" && (fileStat.mode & 0o077) !== 0) {
      throw configurationError(
        "AUDIT_POSTGRES_HMAC_KEY_FILE_PERMISSIONS",
        "The central audit HMAC key file must not be accessible by group or other users.",
      );
    }
    return readFileSync(descriptor, "utf8").trim();
  } catch (error) {
    if (isConfigurationError(error)) throw error;
    throw configurationError(
      "AUDIT_POSTGRES_HMAC_KEY_FILE_INVALID",
      "The central audit HMAC key file could not be read securely.",
    );
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // Do not expose a secret path or descriptor through shutdown errors.
      }
    }
  }
}

function parseKey(value: string): Buffer {
  const normalizedHex = value.replace(/^hex:/u, "");
  if (/^[a-fA-F0-9]{64}$/u.test(normalizedHex)) {
    return Buffer.from(normalizedHex, "hex");
  }
  const base64 = value.replace(/^base64:/u, "");
  if (/^[A-Za-z0-9+/]{43}=$/u.test(base64)) {
    const decoded = Buffer.from(base64, "base64");
    if (decoded.length === 32 && decoded.toString("base64") === base64) return decoded;
  }
  throw configurationError(
    "AUDIT_POSTGRES_HMAC_KEY_INVALID",
    "The central audit HMAC key must be exactly 32 bytes in canonical hex or base64 form.",
  );
}

function assertSecurePostgresUrl(connectionString: string, env: RuntimeEnv) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw configurationError("AUDIT_POSTGRES_URL_INVALID", "The central audit PostgreSQL URL is invalid.");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw configurationError("AUDIT_POSTGRES_URL_INVALID", "The central audit URL must use PostgreSQL.");
  }
  const tlsRequired = readBoolean(
    env.PME_AUDIT_POSTGRES_TLS_REQUIRED,
    true,
    "PME_AUDIT_POSTGRES_TLS_REQUIRED",
  );
  if (!tlsRequired || isLoopbackHostname(url.hostname)) return;
  const sslMode = String(url.searchParams.get("sslmode") ?? env.PGSSLMODE ?? "")
    .trim()
    .toLowerCase();
  if (sslMode !== "verify-full") {
    throw configurationError(
      "AUDIT_POSTGRES_TLS_VERIFY_REQUIRED",
      "A non-loopback central audit database must use sslmode=verify-full.",
    );
  }
}

function normalizeNamespace(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw configurationError(
      "AUDIT_POSTGRES_NAMESPACE_INVALID",
      "The central audit namespace must be 1-128 portable identifier characters.",
    );
  }
  return normalized;
}

function readBoolean(
  value: string | undefined,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw configurationError(
    "AUDIT_POSTGRES_CONFIGURATION_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw configurationError(
      "AUDIT_POSTGRES_CONFIGURATION_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "127.0.0.1"
    || normalized === "[::1]"
    || normalized === "::1";
}

function configurationError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    category: "configuration" as const,
  });
}

function isConfigurationError(
  error: unknown,
): error is Error & { code: string; category: "configuration" } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "configuration" && typeof candidate.code === "string";
}

export const enterpriseAuditStoreFactoryInternals = Object.freeze({
  assertSecurePostgresUrl,
  resolveMode,
});
