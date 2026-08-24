import { TaskQueueManager } from "./taskQueueManager.js";
import {
  createPostgresWorkforceTaskQueue,
  type WorkforceQueuePostgresPool,
} from "./postgresWorkforceTaskQueue.ts";

type RuntimeEnv = Record<string, string | undefined>;
type QueueStoreMode = "local" | "postgres";

export type WorkforceTaskQueueFactoryOptions = {
  env?: RuntimeEnv;
  dataDir?: string;
  queueFile?: string;
  claimTtlMs?: number;
  clock?: () => number;
  postgresPool?: WorkforceQueuePostgresPool;
  claimManager?: Record<string, unknown>;
};

const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60_000;
const DEFAULT_MAX_ENTRIES = 3_000;
const DEFAULT_MAX_TASK_BYTES = 1024 * 1024;

/**
 * Keep the local atomic-JSON queue as the credential-free default while making
 * central PostgreSQL state mandatory for real multi-instance execution.
 */
export function createWorkforceTaskQueueManager(
  options: WorkforceTaskQueueFactoryOptions = {},
) {
  const env = options.env ?? process.env;
  const mode = resolveQueueStoreMode(env);
  const centralRequired = readBoolean(
    env.AI_GATEWAY_WORKFORCE_QUEUE_CENTRAL_REQUIRED,
    false,
    "AI_GATEWAY_WORKFORCE_QUEUE_CENTRAL_REQUIRED",
  ) || (
    readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false, "AI_GATEWAY_MULTI_INSTANCE")
    && readBoolean(env.WORKFORCE_EXECUTION_ENABLED, false, "WORKFORCE_EXECUTION_ENABLED")
  );
  if (centralRequired && mode !== "postgres") {
    throw configurationError(
      "WORKFORCE_QUEUE_CENTRAL_STORE_REQUIRED",
      "Multi-instance Workforce execution requires the central PostgreSQL queue and result store.",
    );
  }
  if (mode === "local") {
    return new TaskQueueManager(options);
  }

  const queueUrl = String(
    env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
      ?? "",
  ).trim();
  const claimUrl = String(env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL ?? queueUrl).trim();
  if (!queueUrl && !options.postgresPool) {
    throw configurationError(
      "WORKFORCE_QUEUE_POSTGRES_URL_REQUIRED",
      "Central Workforce task state requires AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL or the claim-store PostgreSQL URL.",
    );
  }
  if (queueUrl && claimUrl && !samePostgresTarget(queueUrl, claimUrl)) {
    throw configurationError(
      "WORKFORCE_QUEUE_CLAIM_DATABASE_MISMATCH",
      "The central Workforce queue and fenced claims must use the same PostgreSQL database.",
    );
  }
  if (queueUrl) assertSecurePostgresUrl(queueUrl, env);

  const configuredClaimMode = String(env.AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (configuredClaimMode && configuredClaimMode !== "postgres") {
    throw configurationError(
      "WORKFORCE_QUEUE_FENCED_CLAIM_REQUIRED",
      "The central Workforce queue requires the PostgreSQL fenced claim store.",
    );
  }
  const effectiveEnv: RuntimeEnv = {
    ...env,
    AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "postgres",
    AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL: claimUrl || queueUrl,
  };

  return createPostgresWorkforceTaskQueue({
    env: effectiveEnv,
    connectionString: queueUrl || undefined,
    pool: options.postgresPool,
    claimManager: options.claimManager,
    namespace: portableIdentifier(
      env.AI_GATEWAY_WORKFORCE_QUEUE_NAMESPACE
        ?? env.AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE
        ?? "default",
      "AI_GATEWAY_WORKFORCE_QUEUE_NAMESPACE",
    ),
    claimNamespace: portableIdentifier(
      env.AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE ?? "default",
      "AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE",
    ),
    claimTtlMs: boundedInteger(options.claimTtlMs, 5 * 60_000, 10, 24 * 60 * 60_000),
    retentionMs: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_QUEUE_RETENTION_MS,
      DEFAULT_RETENTION_MS,
      60_000,
      365 * 24 * 60 * 60_000,
    ),
    maxEntries: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_QUEUE_MAX_ENTRIES,
      DEFAULT_MAX_ENTRIES,
      1,
      1_000_000,
    ),
    maxTaskBytes: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_QUEUE_MAX_TASK_BYTES,
      DEFAULT_MAX_TASK_BYTES,
      4_096,
      16 * 1024 * 1024,
    ),
    poolMax: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_POOL_MAX,
      4,
      1,
      32,
    ),
    statementTimeoutMs: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_STATEMENT_TIMEOUT_MS,
      5_000,
      100,
      30_000,
    ),
    now: options.clock ?? Date.now,
  });
}

// GatewayServiceBus resolves createTaskQueue() for its "taskQueue" service.
export function createTaskQueue() {
  return createWorkforceTaskQueueManager();
}

function resolveQueueStoreMode(env: RuntimeEnv): QueueStoreMode {
  const configured = String(env.AI_GATEWAY_WORKFORCE_QUEUE_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (configured === "local" || configured === "postgres") return configured;
  if (configured) {
    throw configurationError(
      "WORKFORCE_QUEUE_STORE_MODE_INVALID",
      "AI_GATEWAY_WORKFORCE_QUEUE_STORE_MODE must be local or postgres.",
    );
  }
  if (String(env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL ?? "").trim()) return "postgres";
  if (
    readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false, "AI_GATEWAY_MULTI_INSTANCE")
    && readBoolean(env.WORKFORCE_EXECUTION_ENABLED, false, "WORKFORCE_EXECUTION_ENABLED")
    && String(env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL ?? "").trim()
  ) {
    return "postgres";
  }
  return "local";
}

function assertSecurePostgresUrl(connectionString: string, env: RuntimeEnv) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw configurationError("WORKFORCE_QUEUE_POSTGRES_URL_INVALID", "The Workforce queue PostgreSQL URL is invalid.");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw configurationError("WORKFORCE_QUEUE_POSTGRES_URL_INVALID", "The Workforce queue store URL must use PostgreSQL.");
  }
  const tlsRequired = readBoolean(
    env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_TLS_REQUIRED
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_TLS_REQUIRED,
    true,
    "AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_TLS_REQUIRED",
  );
  if (!tlsRequired || isLoopbackHostname(url.hostname)) return;
  const sslMode = String(url.searchParams.get("sslmode") ?? env.PGSSLMODE ?? "")
    .trim()
    .toLowerCase();
  if (sslMode !== "verify-full") {
    throw configurationError(
      "WORKFORCE_QUEUE_POSTGRES_TLS_VERIFY_REQUIRED",
      "A non-loopback Workforce queue database must use sslmode=verify-full.",
    );
  }
}

function samePostgresTarget(left: string, right: string): boolean {
  try {
    const a = new URL(left);
    const b = new URL(right);
    const portA = a.port || "5432";
    const portB = b.port || "5432";
    return a.protocol.replace("postgresql:", "postgres:") === b.protocol.replace("postgresql:", "postgres:")
      && a.hostname.toLowerCase() === b.hostname.toLowerCase()
      && portA === portB
      && a.pathname === b.pathname;
  } catch {
    return false;
  }
}

function portableIdentifier(value: unknown, name: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw configurationError(
      "WORKFORCE_QUEUE_NAMESPACE_INVALID",
      `${name} must be 1-128 portable identifier characters.`,
    );
  }
  return normalized;
}

function readBoolean(value: unknown, fallback: boolean, name: string): boolean {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw configurationError("WORKFORCE_QUEUE_CONFIGURATION_INVALID", `${name} must be true or false when configured.`);
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw configurationError(
      "WORKFORCE_QUEUE_CONFIGURATION_INVALID",
      `A Workforce queue integer must be between ${minimum} and ${maximum}.`,
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
  return Object.assign(new Error(message), { code, category: "configuration" as const });
}

export const workforceTaskQueueFactoryInternals = Object.freeze({
  assertSecurePostgresUrl,
  resolveQueueStoreMode,
  samePostgresTarget,
});
