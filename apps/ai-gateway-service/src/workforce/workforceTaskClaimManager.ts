import { createTaskClaimLeaseManager } from "./taskClaimLease.ts";
import {
  createPostgresTaskClaimLeaseManager,
  type WorkforceClaimPostgresPool,
} from "./postgresTaskClaimLease.ts";

type RuntimeEnv = Record<string, string | undefined>;
type ClaimStoreMode = "memory" | "postgres";

export function createWorkforceTaskClaimManager({
  env = process.env,
  ttlMs,
  maxClaims,
  clock,
  postgresPool,
}: {
  env?: RuntimeEnv;
  ttlMs?: number;
  maxClaims?: number;
  clock?: () => number;
  postgresPool?: WorkforceClaimPostgresPool;
} = {}) {
  const mode = resolveMode(env);
  const distributedRequired = readBoolean(
    env.AI_GATEWAY_WORKFORCE_CLAIM_STORE_REQUIRED,
    false,
    "AI_GATEWAY_WORKFORCE_CLAIM_STORE_REQUIRED",
  ) || (
    readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false, "AI_GATEWAY_MULTI_INSTANCE")
    && readBoolean(env.WORKFORCE_EXECUTION_ENABLED, false, "WORKFORCE_EXECUTION_ENABLED")
  );
  if (distributedRequired && mode !== "postgres") {
    throw configurationError(
      "WORKFORCE_CLAIM_DISTRIBUTED_STORE_REQUIRED",
      "Multi-instance or explicitly required Workforce execution needs the PostgreSQL claim store.",
    );
  }
  if (mode === "memory") {
    return createTaskClaimLeaseManager({ ttlMs, maxClaims, clock });
  }

  const connectionString = String(
    env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL ?? "",
  ).trim();
  if (!connectionString && !postgresPool) {
    throw configurationError(
      "WORKFORCE_CLAIM_POSTGRES_URL_REQUIRED",
      "AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL is required in postgres claim mode.",
    );
  }
  if (connectionString) assertSecurePostgresUrl(connectionString, env);

  return createPostgresTaskClaimLeaseManager({
    connectionString: connectionString || undefined,
    pool: postgresPool,
    namespace: normalizeNamespace(
      env.AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE ?? "default",
    ),
    ttlMs: boundedInteger(ttlMs, 5 * 60_000, 10, 24 * 60 * 60_000),
    maxClaims: boundedInteger(maxClaims, 2_000, 1, 1_000_000),
    poolMax: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_POOL_MAX,
      4,
      1,
      32,
    ),
    statementTimeoutMs: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_STATEMENT_TIMEOUT_MS,
      5_000,
      100,
      30_000,
    ),
    now: clock,
  });
}

function resolveMode(env: RuntimeEnv): ClaimStoreMode {
  const configured = String(env.AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (!configured) {
    return String(env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL ?? "").trim()
      ? "postgres"
      : "memory";
  }
  if (configured === "memory" || configured === "postgres") return configured;
  throw configurationError(
    "WORKFORCE_CLAIM_STORE_MODE_INVALID",
    "AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE must be memory or postgres.",
  );
}

function assertSecurePostgresUrl(connectionString: string, env: RuntimeEnv) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw configurationError(
      "WORKFORCE_CLAIM_POSTGRES_URL_INVALID",
      "The Workforce claim PostgreSQL URL is invalid.",
    );
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw configurationError(
      "WORKFORCE_CLAIM_POSTGRES_URL_INVALID",
      "The Workforce claim store URL must use PostgreSQL.",
    );
  }
  const tlsRequired = readBoolean(
    env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_TLS_REQUIRED,
    true,
    "AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_TLS_REQUIRED",
  );
  if (!tlsRequired || isLoopbackHostname(url.hostname)) return;
  const sslMode = String(
    url.searchParams.get("sslmode") ?? env.PGSSLMODE ?? "",
  ).trim().toLowerCase();
  if (sslMode !== "verify-full") {
    throw configurationError(
      "WORKFORCE_CLAIM_POSTGRES_TLS_VERIFY_REQUIRED",
      "A non-loopback Workforce claim database must use sslmode=verify-full.",
    );
  }
}

function normalizeNamespace(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (
    !normalized
    || normalized.length > 128
    || !/^[A-Za-z0-9._:-]+$/u.test(normalized)
  ) {
    throw configurationError(
      "WORKFORCE_CLAIM_NAMESPACE_INVALID",
      "The Workforce claim namespace must be 1-128 portable identifier characters.",
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
    "WORKFORCE_CLAIM_CONFIGURATION_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw configurationError(
      "WORKFORCE_CLAIM_CONFIGURATION_INVALID",
      `A Workforce claim integer must be between ${minimum} and ${maximum}.`,
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

export const workforceTaskClaimManagerInternals = Object.freeze({
  assertSecurePostgresUrl,
  resolveMode,
});
