import { createExecutionApprovalGate } from "./executionApprovalGate.js";
import { createExecutionLifecycle } from "./executionLifecycle.js";
import {
  createPostgresExecutionApprovalGate,
} from "./postgresExecutionApprovalGate.ts";
import {
  createPostgresExecutionLifecycle,
} from "./postgresExecutionLifecycle.ts";
import type {
  WorkforceClaimPostgresClient as PostgresClient,
  WorkforceClaimPostgresPool as PostgresPool,
} from "./postgresTaskClaimLease.ts";

type RuntimeEnv = Record<string, string | undefined>;
type ControlMode = "local" | "postgres";

export type WorkforceExecutionControlOptions = {
  env?: RuntimeEnv;
  executionDir?: string;
  approvalTtlMs?: number;
  postgresPool?: PostgresPool;
  now?: () => number;
};

const DEFAULT_APPROVAL_TTL_MS = 24 * 60 * 60_000;
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60_000;
const DEFAULT_MAX_APPROVALS = 10_000;
const DEFAULT_MAX_EXECUTIONS = 10_000;
const DEFAULT_MAX_STATE_BYTES = 1024 * 1024;

export function createWorkforceExecutionControl(
  options: WorkforceExecutionControlOptions = {},
) {
  const env = options.env ?? process.env;
  const mode = resolveMode(env);
  const centralRequired = readBoolean(
    env.AI_GATEWAY_WORKFORCE_CONTROL_CENTRAL_REQUIRED,
    false,
    "AI_GATEWAY_WORKFORCE_CONTROL_CENTRAL_REQUIRED",
  ) || (
    readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false, "AI_GATEWAY_MULTI_INSTANCE")
    && readBoolean(env.WORKFORCE_EXECUTION_ENABLED, false, "WORKFORCE_EXECUTION_ENABLED")
  );
  if (centralRequired && mode !== "postgres") {
    throw configurationError(
      "WORKFORCE_CONTROL_CENTRAL_STORE_REQUIRED",
      "Multi-instance Workforce execution requires central PostgreSQL approval and lifecycle state.",
    );
  }

  if (mode === "local") {
    const approvalGate = createExecutionApprovalGate({
      storePath: options.executionDir ? `${options.executionDir}/approvals.json` : undefined,
      ttlMs: options.approvalTtlMs,
    }) as any;
    const lifecycle = createExecutionLifecycle({
      lifecycleDir: options.executionDir ?? undefined,
    }) as any;
    const health = Object.freeze({
      mode: "local-atomic-json",
      durable: true,
      distributed: false,
      centralRequired,
      available: true,
    });
    return {
      mode,
      approvalGate,
      lifecycle,
      getHealth: () => health,
      checkHealth: async () => health,
      close: async () => undefined,
    };
  }

  const connectionString = String(
    env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
      ?? "",
  ).trim();
  if (!connectionString && !options.postgresPool) {
    throw configurationError(
      "WORKFORCE_CONTROL_POSTGRES_URL_REQUIRED",
      "Central Workforce approval/lifecycle state requires a PostgreSQL URL.",
    );
  }
  if (connectionString) assertSecurePostgresUrl(connectionString, env);
  for (const peer of [
    env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL,
    env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL,
  ]) {
    const peerUrl = String(peer ?? "").trim();
    if (connectionString && peerUrl && !samePostgresTarget(connectionString, peerUrl)) {
      throw configurationError(
        "WORKFORCE_CONTROL_DATABASE_MISMATCH",
        "Workforce control, queue, and claim state must use the same PostgreSQL database.",
      );
    }
  }

  const namespace = portableIdentifier(
    env.AI_GATEWAY_WORKFORCE_CONTROL_NAMESPACE
      ?? env.AI_GATEWAY_WORKFORCE_QUEUE_NAMESPACE
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE
      ?? "default",
    "AI_GATEWAY_WORKFORCE_CONTROL_NAMESPACE",
  );
  const poolMax = boundedInteger(
    env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_POOL_MAX,
    4,
    1,
    32,
    "AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_POOL_MAX",
  );
  const statementTimeoutMs = boundedInteger(
    env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_STATEMENT_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_STATEMENT_TIMEOUT_MS",
  );
  const ownsPool = !options.postgresPool;
  const poolPromise = options.postgresPool
    ? Promise.resolve(options.postgresPool)
    : loadPool(connectionString, poolMax, statementTimeoutMs);
  const pool = lazyPool(poolPromise);
  const retentionMs = boundedInteger(
    env.AI_GATEWAY_WORKFORCE_CONTROL_RETENTION_MS,
    DEFAULT_RETENTION_MS,
    60_000,
    365 * 24 * 60 * 60_000,
    "AI_GATEWAY_WORKFORCE_CONTROL_RETENTION_MS",
  );
  const approvalGate = createPostgresExecutionApprovalGate({
    pool,
    namespace,
    ttlMs: boundedInteger(
      options.approvalTtlMs ?? env.AI_GATEWAY_WORKFORCE_CONTROL_APPROVAL_TTL_MS,
      DEFAULT_APPROVAL_TTL_MS,
      1_000,
      30 * 24 * 60 * 60_000,
      "AI_GATEWAY_WORKFORCE_CONTROL_APPROVAL_TTL_MS",
    ),
    retentionMs,
    maxApprovals: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_CONTROL_MAX_APPROVALS,
      DEFAULT_MAX_APPROVALS,
      1,
      1_000_000,
      "AI_GATEWAY_WORKFORCE_CONTROL_MAX_APPROVALS",
    ),
    now: options.now,
  });
  const lifecycle = createPostgresExecutionLifecycle({
    pool,
    namespace,
    retentionMs,
    maxExecutions: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_CONTROL_MAX_EXECUTIONS,
      DEFAULT_MAX_EXECUTIONS,
      1,
      1_000_000,
      "AI_GATEWAY_WORKFORCE_CONTROL_MAX_EXECUTIONS",
    ),
    maxStateBytes: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_CONTROL_MAX_STATE_BYTES,
      DEFAULT_MAX_STATE_BYTES,
      4_096,
      16 * 1024 * 1024,
      "AI_GATEWAY_WORKFORCE_CONTROL_MAX_STATE_BYTES",
    ),
    maxTransitions: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_CONTROL_MAX_TRANSITIONS,
      1_000,
      10,
      10_000,
      "AI_GATEWAY_WORKFORCE_CONTROL_MAX_TRANSITIONS",
    ),
    maxCompletedAgents: boundedInteger(
      env.AI_GATEWAY_WORKFORCE_CONTROL_MAX_COMPLETED_AGENTS,
      1_000,
      1,
      10_000,
      "AI_GATEWAY_WORKFORCE_CONTROL_MAX_COMPLETED_AGENTS",
    ),
    now: options.now,
  });
  let closed = false;

  return {
    mode,
    approvalGate,
    lifecycle,
    getHealth() {
      return combineHealth(approvalGate.getHealth(), lifecycle.getHealth(), centralRequired);
    },
    async checkHealth() {
      const [approval, execution] = await Promise.all([
        approvalGate.checkHealth(),
        lifecycle.checkHealth(),
      ]);
      return combineHealth(approval, execution, centralRequired);
    },
    async close() {
      if (closed) return;
      closed = true;
      if (!ownsPool) return;
      try {
        const resolved = await poolPromise;
        await resolved.end();
      } catch {
        // Initialization failure leaves no required close work.
      }
    },
  };
}

function combineHealth(
  approval: Record<string, any>,
  execution: Record<string, any>,
  centralRequired: boolean,
) {
  return {
    mode: "postgres-central",
    durable: true,
    distributed: true,
    centralRequired,
    available: approval.available === true && execution.available === true,
    approval: {
      available: approval.available === true,
      activeApprovals: Number(approval.activeApprovals ?? 0),
      maxApprovals: Number(approval.maxApprovals ?? 0),
      statsUpdatedAt: approval.statsUpdatedAt ?? null,
    },
    lifecycle: {
      available: execution.available === true,
      activeExecutions: Number(execution.activeExecutions ?? 0),
      maxExecutions: Number(execution.maxExecutions ?? 0),
      maxStateBytes: Number(execution.maxStateBytes ?? 0),
      statsUpdatedAt: execution.statsUpdatedAt ?? null,
    },
  };
}

function resolveMode(env: RuntimeEnv): ControlMode {
  const configured = String(env.AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (configured === "local" || configured === "postgres") return configured;
  if (configured) {
    throw configurationError(
      "WORKFORCE_CONTROL_STORE_MODE_INVALID",
      "AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE must be local or postgres.",
    );
  }
  if (String(env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL ?? "").trim()) return "postgres";
  if (
    readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false, "AI_GATEWAY_MULTI_INSTANCE")
    && readBoolean(env.WORKFORCE_EXECUTION_ENABLED, false, "WORKFORCE_EXECUTION_ENABLED")
    && String(
      env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
        ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
        ?? "",
    ).trim()
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
    throw configurationError("WORKFORCE_CONTROL_POSTGRES_URL_INVALID", "The Workforce control PostgreSQL URL is invalid.");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw configurationError("WORKFORCE_CONTROL_POSTGRES_URL_INVALID", "The Workforce control URL must use PostgreSQL.");
  }
  const tlsRequired = readBoolean(
    env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_TLS_REQUIRED,
    true,
    "AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_TLS_REQUIRED",
  );
  if (!tlsRequired || isLoopbackHostname(url.hostname)) return;
  const sslMode = String(url.searchParams.get("sslmode") ?? env.PGSSLMODE ?? "")
    .trim()
    .toLowerCase();
  if (sslMode !== "verify-full") {
    throw configurationError(
      "WORKFORCE_CONTROL_POSTGRES_TLS_VERIFY_REQUIRED",
      "A non-loopback Workforce control database must use sslmode=verify-full.",
    );
  }
}

function samePostgresTarget(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol.replace("postgresql:", "postgres:") === b.protocol.replace("postgresql:", "postgres:")
      && a.hostname.toLowerCase() === b.hostname.toLowerCase()
      && (a.port || "5432") === (b.port || "5432")
      && a.pathname === b.pathname;
  } catch {
    return false;
  }
}

function lazyPool(poolPromise: Promise<PostgresPool>): PostgresPool {
  return {
    async query<Row = Record<string, unknown>>(text: string, values?: unknown[]) {
      const pool = await poolPromise;
      return pool.query<Row>(text, values);
    },
    async connect(): Promise<PostgresClient> {
      const pool = await poolPromise;
      return pool.connect();
    },
    async end() {
      const pool = await poolPromise;
      await pool.end();
    },
    on(event: "error", listener: (error: Error) => void) {
      void poolPromise.then((pool) => pool.on?.(event, listener)).catch(() => undefined);
      return undefined;
    },
  };
}

async function loadPool(connectionString: string, max: number, statementTimeoutMs: number) {
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => PostgresPool;
  };
  return new module.Pool({
    connectionString,
    max,
    connectionTimeoutMillis: Math.min(10_000, statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: statementTimeoutMs,
    application_name: "unified-ai-system-workforce-control",
    allowExitOnIdle: true,
  });
}

function portableIdentifier(value: unknown, name: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw configurationError("WORKFORCE_CONTROL_NAMESPACE_INVALID", `${name} is invalid.`);
  }
  return normalized;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw configurationError(
      "WORKFORCE_CONTROL_CONFIGURATION_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function readBoolean(value: unknown, fallback: boolean, name: string) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw configurationError("WORKFORCE_CONTROL_CONFIGURATION_INVALID", `${name} must be true or false.`);
}

function isLoopbackHostname(hostname: string) {
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

export const workforceExecutionControlFactoryInternals = Object.freeze({
  assertSecurePostgresUrl,
  resolveMode,
  samePostgresTarget,
});
