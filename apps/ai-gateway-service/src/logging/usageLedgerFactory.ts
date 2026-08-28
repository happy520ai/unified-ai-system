import { createRequestLogger } from "./requestLogger.js";
import {
  createPostgresUsageLedger,
  type UsageLedgerPostgresPool,
} from "./postgresUsageLedger.ts";

type RuntimeEnv = Record<string, string | undefined>;
type UsageLedgerStoreMode = "file" | "postgres";

export function createUsageLedger({
  env = process.env,
  realProviderEnabled = false,
  postgresPool,
}: {
  env?: RuntimeEnv;
  realProviderEnabled?: boolean;
  postgresPool?: UsageLedgerPostgresPool;
} = {}) {
  const mode = resolveMode(env);
  const centralRequired = readBoolean(
    env.AI_GATEWAY_USAGE_LEDGER_CENTRAL_REQUIRED,
    false,
    "AI_GATEWAY_USAGE_LEDGER_CENTRAL_REQUIRED",
  ) || (
    realProviderEnabled
    && readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false, "AI_GATEWAY_MULTI_INSTANCE")
  );
  if (centralRequired && mode !== "postgres") {
    throw configurationError(
      "USAGE_LEDGER_CENTRAL_STORE_REQUIRED",
      "Multi-instance real-provider execution requires the central PostgreSQL usage ledger.",
    );
  }

  if (mode === "file") {
    return createRequestLogger({
      logDir: env.AI_GATEWAY_USAGE_LOG_DIR,
      enableBodyLogging: false,
      durableWrites: realProviderEnabled,
    });
  }

  const connectionString = String(
    env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL ?? "",
  ).trim();
  if (!connectionString && !postgresPool) {
    throw configurationError(
      "USAGE_LEDGER_POSTGRES_URL_REQUIRED",
      "AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL is required in postgres mode.",
    );
  }
  if (connectionString) assertSecurePostgresUrl(connectionString, env);

  return createPostgresUsageLedger({
    connectionString: connectionString || undefined,
    pool: postgresPool,
    namespace: normalizeNamespace(env.AI_GATEWAY_USAGE_LEDGER_NAMESPACE ?? "default"),
    maxRows: readBoundedInteger(
      env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_MAX_ROWS,
      1_000_000,
      1,
      100_000_000,
      "AI_GATEWAY_USAGE_LEDGER_POSTGRES_MAX_ROWS",
    ),
    retentionDays: readBoundedInteger(
      env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_RETENTION_DAYS,
      90,
      1,
      3_650,
      "AI_GATEWAY_USAGE_LEDGER_POSTGRES_RETENTION_DAYS",
    ),
    poolMax: readBoundedInteger(
      env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_POOL_MAX,
      4,
      1,
      32,
      "AI_GATEWAY_USAGE_LEDGER_POSTGRES_POOL_MAX",
    ),
    statementTimeoutMs: readBoundedInteger(
      env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_STATEMENT_TIMEOUT_MS,
      5_000,
      100,
      30_000,
      "AI_GATEWAY_USAGE_LEDGER_POSTGRES_STATEMENT_TIMEOUT_MS",
    ),
  });
}

function resolveMode(env: RuntimeEnv): UsageLedgerStoreMode {
  const configured = String(env.AI_GATEWAY_USAGE_LEDGER_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (!configured) {
    return String(env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL ?? "").trim()
      ? "postgres"
      : "file";
  }
  if (configured === "file" || configured === "postgres") return configured;
  throw configurationError(
    "USAGE_LEDGER_STORE_MODE_INVALID",
    "AI_GATEWAY_USAGE_LEDGER_STORE_MODE must be file or postgres.",
  );
}

function assertSecurePostgresUrl(connectionString: string, env: RuntimeEnv) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw configurationError(
      "USAGE_LEDGER_POSTGRES_URL_INVALID",
      "The central usage ledger PostgreSQL URL is invalid.",
    );
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw configurationError(
      "USAGE_LEDGER_POSTGRES_URL_INVALID",
      "The central usage ledger URL must use PostgreSQL.",
    );
  }
  const tlsRequired = readBoolean(
    env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_TLS_REQUIRED,
    true,
    "AI_GATEWAY_USAGE_LEDGER_POSTGRES_TLS_REQUIRED",
  );
  if (!tlsRequired || isLoopbackHostname(url.hostname)) return;
  const sslMode = String(
    url.searchParams.get("sslmode") ?? env.PGSSLMODE ?? "",
  ).trim().toLowerCase();
  if (sslMode !== "verify-full") {
    throw configurationError(
      "USAGE_LEDGER_POSTGRES_TLS_VERIFY_REQUIRED",
      "A non-loopback central usage ledger must use sslmode=verify-full.",
    );
  }
}

function normalizeNamespace(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw configurationError(
      "USAGE_LEDGER_NAMESPACE_INVALID",
      "The usage ledger namespace must be 1-128 portable identifier characters.",
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
    "USAGE_LEDGER_CONFIGURATION_INVALID",
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
      "USAGE_LEDGER_CONFIGURATION_INVALID",
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

export const usageLedgerFactoryInternals = Object.freeze({
  assertSecurePostgresUrl,
  resolveMode,
});
