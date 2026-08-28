import { createHash, randomUUID } from "node:crypto";
import {
  createPostgresTaskClaimLeaseManager,
  type TaskClaimIssueGuard,
  type WorkforceClaimPostgresPool,
} from "../workforce/postgresTaskClaimLease.ts";

type RuntimeEnv = Record<string, string | undefined>;
type LeaseMode = "disabled" | "postgres";

export type A2AExecutionScope = {
  tenant: string;
  owner: string;
};

type LeaseIdentity = {
  planId: string;
  taskId: string;
  agentId: string;
  fencingToken: string;
};

export type A2AExecutionLease = {
  readonly mode: "postgres-fenced";
  readonly token: string;
  readonly fencingToken: string;
  readonly expiresAt: string;
  readonly identity: LeaseIdentity;
};

export type A2AExecutionLeaseStatus = {
  readonly mode: "disabled" | "postgres-fenced";
  readonly enabled: boolean;
  readonly distributed: boolean;
  readonly required: boolean;
  readonly ttlMs: number;
  readonly heartbeatMs: number;
  readonly maxLeases: number;
  readonly atomicTerminalFence: boolean;
};

export type A2AExecutionLeaseManager = {
  readonly status: A2AExecutionLeaseStatus;
  acquire(input: {
    taskId: unknown;
    scope: A2AExecutionScope;
  }): Promise<
    | { success: true; lease: A2AExecutionLease }
    | { success: false; code: string; reason: string; retryable: boolean }
  >;
  validate(lease: A2AExecutionLease): Promise<{ success: boolean; code: string; reason: string }>;
  renew(lease: A2AExecutionLease): Promise<{ success: boolean; code: string; reason: string }>;
  release(lease: A2AExecutionLease): Promise<{ success: boolean; code: string; reason?: string }>;
  revokeForTask(input: {
    taskId: unknown;
    scope: A2AExecutionScope;
    reason?: string;
  }): Promise<{ success: boolean; code: string; reason?: string }>;
  getHealth(): A2AExecutionLeaseStatus & {
    available: boolean;
    reason: string | null;
    activeLeases: number;
  };
  checkHealth(): Promise<ReturnType<A2AExecutionLeaseManager["getHealth"]>>;
  close(): Promise<void>;
};

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_LEASES = 10_000;
const DEFAULT_POOL_MAX = 4;
const DEFAULT_STATEMENT_TIMEOUT_MS = 5_000;
const MIN_TTL_MS = 5_000;
const MAX_TTL_MS = 60 * 60_000;

export function createA2AExecutionLeaseManager({
  env = process.env,
  postgresPool,
  instanceId = `a2a-instance-${randomUUID()}`,
  issueGuard,
}: {
  env?: RuntimeEnv;
  postgresPool?: WorkforceClaimPostgresPool;
  instanceId?: string;
  issueGuard?: TaskClaimIssueGuard;
} = {}): A2AExecutionLeaseManager {
  const mode = resolveMode(env);
  const taskStorePostgres = String(env.AI_GATEWAY_A2A_TASK_STORE_MODE ?? "")
    .trim()
    .toLowerCase() === "postgres";
  const explicitlyRequired = readBoolean(
    env.AI_GATEWAY_A2A_EXECUTION_LEASE_REQUIRED,
    false,
    "AI_GATEWAY_A2A_EXECUTION_LEASE_REQUIRED",
  );
  const required = taskStorePostgres || explicitlyRequired;
  if (required && mode !== "postgres") {
    throw configurationError(
      "A2A_EXECUTION_LEASE_REQUIRED",
      "Cross-host A2A task storage requires the PostgreSQL execution lease.",
    );
  }
  if (mode === "disabled") return createDisabledManager(required);

  const ttlMs = readBoundedInteger(
    env.AI_GATEWAY_A2A_EXECUTION_LEASE_TTL_MS,
    DEFAULT_TTL_MS,
    MIN_TTL_MS,
    MAX_TTL_MS,
    "AI_GATEWAY_A2A_EXECUTION_LEASE_TTL_MS",
  );
  const heartbeatMs = readBoundedInteger(
    env.AI_GATEWAY_A2A_EXECUTION_LEASE_HEARTBEAT_MS,
    Math.max(1_000, Math.floor(ttlMs / 3)),
    1_000,
    Math.max(1_000, Math.floor(ttlMs / 2)),
    "AI_GATEWAY_A2A_EXECUTION_LEASE_HEARTBEAT_MS",
  );
  const maxLeases = readBoundedInteger(
    env.AI_GATEWAY_A2A_EXECUTION_LEASE_MAX_ENTRIES,
    DEFAULT_MAX_LEASES,
    1,
    1_000_000,
    "AI_GATEWAY_A2A_EXECUTION_LEASE_MAX_ENTRIES",
  );
  const connectionString = String(
    env.AI_GATEWAY_A2A_EXECUTION_LEASE_POSTGRES_URL
      ?? env.AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL
      ?? "",
  ).trim();
  const taskStoreConnectionString = String(
    env.AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL ?? "",
  ).trim();
  if (!connectionString && !postgresPool) {
    throw configurationError(
      "A2A_EXECUTION_LEASE_POSTGRES_URL_REQUIRED",
      "PostgreSQL A2A execution leasing requires a PostgreSQL URL.",
    );
  }
  if (connectionString) assertSecurePostgresUrl(connectionString);
  if (
    taskStorePostgres
    && connectionString
    && taskStoreConnectionString
    && !samePostgresTarget(connectionString, taskStoreConnectionString)
  ) {
    throw configurationError(
      "A2A_EXECUTION_LEASE_DATABASE_MISMATCH",
      "A2A task state and execution fences must use the same PostgreSQL database.",
    );
  }
  const normalizedInstanceId = boundedText(instanceId, "instanceId", 256);
  const taskNamespace = portableIdentifier(
    env.AI_GATEWAY_A2A_TASK_STORE_NAMESPACE ?? "default",
    "AI_GATEWAY_A2A_TASK_STORE_NAMESPACE",
    128,
  );
  const manager = createPostgresTaskClaimLeaseManager({
    connectionString: connectionString || undefined,
    pool: postgresPool,
    namespace: deriveA2AExecutionLeaseNamespace(taskNamespace),
    ttlMs,
    maxClaims: maxLeases,
    poolMax: readBoundedInteger(
      env.AI_GATEWAY_A2A_EXECUTION_LEASE_POSTGRES_POOL_MAX
        ?? env.AI_GATEWAY_A2A_TASK_STORE_POSTGRES_POOL_MAX,
      DEFAULT_POOL_MAX,
      1,
      32,
      "AI_GATEWAY_A2A_EXECUTION_LEASE_POSTGRES_POOL_MAX",
    ),
    statementTimeoutMs: readBoundedInteger(
      env.AI_GATEWAY_A2A_EXECUTION_LEASE_POSTGRES_STATEMENT_TIMEOUT_MS
        ?? env.AI_GATEWAY_A2A_TASK_STORE_POSTGRES_STATEMENT_TIMEOUT_MS,
      DEFAULT_STATEMENT_TIMEOUT_MS,
      100,
      30_000,
      "AI_GATEWAY_A2A_EXECUTION_LEASE_POSTGRES_STATEMENT_TIMEOUT_MS",
    ),
    issueGuard,
  });
  const status = Object.freeze({
    mode: "postgres-fenced" as const,
    enabled: true,
    distributed: true,
    required,
    ttlMs,
    heartbeatMs,
    maxLeases,
    atomicTerminalFence: Boolean(issueGuard),
  });

  return {
    status,
    async acquire({ taskId: rawTaskId, scope }) {
      const taskId = boundedText(rawTaskId, "taskId", 256);
      const planId = createA2AExecutionScopeId(scope);
      const issued = await manager.issue({
        planId,
        taskId,
        agentId: normalizedInstanceId,
        ttlMs,
        guardContext: { scope },
      });
      if (!issued.success) {
        const terminal = issued.code === "A2A_TASK_TERMINAL";
        return {
          success: false,
          code: terminal
            ? "A2A_EXECUTION_TASK_TERMINAL"
            : issued.code === "TASK_ALREADY_CLAIMED"
              ? "A2A_EXECUTION_ALREADY_ACTIVE"
              : "A2A_EXECUTION_LEASE_UNAVAILABLE",
          reason: terminal
            ? "The A2A task is already terminal and cannot be executed again."
            : issued.code === "TASK_ALREADY_CLAIMED"
              ? "The A2A task is already executing under an active lease."
              : "The A2A execution lease store is unavailable.",
          retryable: !terminal,
        };
      }
      return {
        success: true,
        lease: Object.freeze({
          mode: "postgres-fenced" as const,
          token: issued.token,
          fencingToken: issued.fencingToken,
          expiresAt: issued.expiresAt,
          identity: Object.freeze({
            planId,
            taskId,
            agentId: normalizedInstanceId,
            fencingToken: issued.fencingToken,
          }),
        }),
      };
    },
    async validate(lease) {
      const result = await manager.validate(lease.token, lease.identity);
      return publicLeaseResult(result, "A2A_EXECUTION_LEASE_VALID");
    },
    async renew(lease) {
      const result = await manager.renew(lease.token, lease.identity, ttlMs);
      return publicLeaseResult(result, "A2A_EXECUTION_LEASE_RENEWED");
    },
    async release(lease) {
      const result = await manager.release(lease.token, lease.identity);
      return publicLeaseResult(result, "A2A_EXECUTION_LEASE_RELEASED");
    },
    async revokeForTask({ taskId: rawTaskId, scope, reason = "a2a cancellation" }) {
      const result = await manager.revokeTask({
        planId: createA2AExecutionScopeId(scope),
        taskId: boundedText(rawTaskId, "taskId", 256),
      }, boundedText(reason, "reason", 256));
      if (!result.success && result.code === "TASK_CLAIM_NOT_FOUND") {
        return {
          success: true,
          code: "A2A_EXECUTION_LEASE_NOT_ACTIVE",
          reason: "The A2A task has no active execution lease.",
        };
      }
      return publicLeaseResult(result, "A2A_EXECUTION_LEASE_REVOKED");
    },
    getHealth() {
      const info = manager.getInfo();
      return Object.freeze({
        ...status,
        available: info.available === true,
        reason: info.available === true ? null : "store_unavailable",
        activeLeases: Number(info.activeClaims ?? 0),
      });
    },
    async checkHealth() {
      await manager.checkHealth();
      return this.getHealth();
    },
    async close() {
      await manager.close();
    },
  };
}

function createDisabledManager(required: boolean): A2AExecutionLeaseManager {
  const status = Object.freeze({
    mode: "disabled" as const,
    enabled: false,
    distributed: false,
    required,
    ttlMs: 0,
    heartbeatMs: 0,
    maxLeases: 0,
    atomicTerminalFence: false,
  });
  const unavailable = async () => ({
    success: false as const,
    code: "A2A_EXECUTION_LEASE_DISABLED",
    reason: "A2A execution leasing is disabled.",
    retryable: false,
  });
  return {
    status,
    acquire: unavailable,
    async validate() {
      return { success: false, code: "A2A_EXECUTION_LEASE_DISABLED", reason: "A2A execution leasing is disabled." };
    },
    async renew() {
      return { success: false, code: "A2A_EXECUTION_LEASE_DISABLED", reason: "A2A execution leasing is disabled." };
    },
    async release() {
      return { success: true, code: "A2A_EXECUTION_LEASE_DISABLED" };
    },
    async revokeForTask() {
      return { success: true, code: "A2A_EXECUTION_LEASE_DISABLED" };
    },
    getHealth() {
      return Object.freeze({
        ...status,
        available: true,
        reason: null,
        activeLeases: 0,
      });
    },
    async checkHealth() {
      return this.getHealth();
    },
    async close() {},
  };
}

function publicLeaseResult(
  result: { success: boolean; code?: string; reason?: string },
  successCode: string,
) {
  return result.success
    ? { success: true, code: successCode, reason: "The A2A execution lease operation completed." }
    : {
        success: false,
        code: "A2A_EXECUTION_LEASE_LOST",
        reason: "The A2A execution lease is no longer active or bound to this executor.",
      };
}

export function createA2AExecutionScopeId(scope: A2AExecutionScope) {
  const tenant = boundedText(scope?.tenant ?? "default", "tenant", 256);
  const owner = boundedText(scope?.owner ?? "unknown", "owner", 256);
  return `a2a-scope-${createHash("sha256")
    .update(JSON.stringify([tenant, owner]))
    .digest("hex")}`;
}

export function deriveA2AExecutionLeaseNamespace(taskNamespace: string) {
  return `a2a-exec-${createHash("sha256").update(taskNamespace).digest("hex").slice(0, 40)}`;
}

function resolveMode(env: RuntimeEnv): LeaseMode {
  const configured = String(env.AI_GATEWAY_A2A_EXECUTION_LEASE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (!configured) {
    return String(env.AI_GATEWAY_A2A_TASK_STORE_MODE ?? "").trim().toLowerCase() === "postgres"
      ? "postgres"
      : "disabled";
  }
  if (configured === "disabled" || configured === "postgres") return configured;
  throw configurationError(
    "A2A_EXECUTION_LEASE_MODE_INVALID",
    "AI_GATEWAY_A2A_EXECUTION_LEASE_MODE must be disabled or postgres.",
  );
}

function assertSecurePostgresUrl(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw configurationError(
      "A2A_EXECUTION_LEASE_POSTGRES_URL_INVALID",
      "The A2A execution-lease PostgreSQL URL is invalid.",
    );
  }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) {
    throw configurationError(
      "A2A_EXECUTION_LEASE_POSTGRES_URL_INVALID",
      "The A2A execution-lease URL must use PostgreSQL.",
    );
  }
  if (!isLoopbackHostname(url.hostname) && url.searchParams.get("sslmode") !== "verify-full") {
    throw configurationError(
      "A2A_EXECUTION_LEASE_POSTGRES_TLS_REQUIRED",
      "A non-loopback A2A execution-lease store must use sslmode=verify-full.",
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

function isLoopbackHostname(value: string) {
  const hostname = value.replace(/^\[|\]$/gu, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function boundedText(value: unknown, label: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw configurationError(
      "A2A_EXECUTION_LEASE_INPUT_INVALID",
      `The A2A execution-lease ${label} is invalid.`,
    );
  }
  return normalized;
}

function portableIdentifier(value: unknown, label: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw configurationError(
      "A2A_EXECUTION_LEASE_INPUT_INVALID",
      `${label} must be a portable identifier of at most ${maxLength} characters.`,
    );
  }
  return normalized;
}

function readBoolean(value: string | undefined, fallback: boolean, name: string) {
  if (value === undefined || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw configurationError(
    "A2A_EXECUTION_LEASE_CONFIGURATION_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function readBoundedInteger(
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
      "A2A_EXECUTION_LEASE_CONFIGURATION_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function configurationError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    category: "configuration" as const,
  });
}

export const a2aExecutionLeaseInternals = Object.freeze({
  createScopeId: createA2AExecutionScopeId,
  deriveLeaseNamespace: deriveA2AExecutionLeaseNamespace,
  resolveMode,
});
