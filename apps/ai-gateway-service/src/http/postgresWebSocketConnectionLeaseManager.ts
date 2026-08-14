import { createHmac, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type {
  PostgresClientLike,
  PostgresPoolLike,
} from "./postgresIdempotencyCoordinator.ts";

const TABLE = "public.ai_gateway_websocket_connection_leases";
const FENCING_SEQUENCE = "public.ai_gateway_websocket_connection_lease_fencing_seq";
const LOCK_NAMESPACE = 1_431_193_303;
const ACQUIRE_LOCK_KEY = 1_768_841_021;
const INITIALIZE_LOCK_KEY = 1_768_841_022;
const DEFAULT_NAMESPACE = "default";
const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_MAX_ROWS = 100_000;

const INITIALIZE_SQL = `/* websocket-lease:init */
  CREATE SEQUENCE IF NOT EXISTS ${FENCING_SEQUENCE} AS bigint;
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    namespace TEXT NOT NULL,
    subject_hash CHAR(64) NOT NULL,
    lease_id UUID NOT NULL,
    fencing_token BIGINT NOT NULL DEFAULT nextval('${FENCING_SEQUENCE}'::regclass),
    lease_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (namespace, lease_id)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_websocket_lease_subject_expiry_idx
    ON ${TABLE} (namespace, subject_hash, lease_expires_at);
  CREATE INDEX IF NOT EXISTS ai_gateway_websocket_lease_expiry_idx
    ON ${TABLE} (lease_expires_at);
`;

export type WebSocketConnectionLeaseLimits = {
  maxConnections: number;
  maxConnectionsPerSubject: number;
};

export type WebSocketConnectionLease = {
  isValid(): boolean;
  renewNow(): Promise<boolean>;
  start(onLost: () => void): void;
  release(): Promise<void>;
};

export type WebSocketConnectionLeaseDecision =
  | { acquired: true; lease: WebSocketConnectionLease }
  | {
    acquired: false;
    scope: "global" | "subject";
    retryAfterSeconds: number;
  };

export type WebSocketConnectionLeaseManager = {
  acquire(subject: string, limits: WebSocketConnectionLeaseLimits): Promise<WebSocketConnectionLeaseDecision>;
  checkHealth(): Promise<{ available: boolean }>;
  getStats(): Record<string, unknown>;
  close(): Promise<void>;
};

type ManagerOptions = {
  connectionString?: string;
  pool?: PostgresPoolLike;
  secret: string | Buffer;
  namespace?: string;
  leaseMs?: number;
  maxRows?: number;
  poolMax?: number;
  statementTimeoutMs?: number;
  monotonicNow?: () => number;
};

type CountRow = {
  all_count: string | number;
  namespace_count: string | number;
  subject_count: string | number;
};

type LeaseController = {
  lease: WebSocketConnectionLease;
  lose(): void;
};

export class WebSocketConnectionLeaseUnavailableError extends Error {
  readonly code: string = "WEBSOCKET_CONNECTION_LEASE_STORE_UNAVAILABLE";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WebSocketConnectionLeaseUnavailableError";
  }
}

export class WebSocketConnectionLeaseCapacityError extends WebSocketConnectionLeaseUnavailableError {
  override readonly code = "WEBSOCKET_CONNECTION_LEASE_CAPACITY_REACHED";

  constructor() {
    super("The bounded WebSocket connection lease store is full.");
    this.name = "WebSocketConnectionLeaseCapacityError";
  }
}

export function createPostgresWebSocketConnectionLeaseManager(
  rawOptions: ManagerOptions,
): WebSocketConnectionLeaseManager {
  const options = normalizeOptions(rawOptions);
  const ownsPool = !rawOptions.pool;
  const poolPromise = rawOptions.pool
    ? Promise.resolve(rawOptions.pool)
    : loadPool(options);
  const activeLeases = new Set<LeaseController>();
  let closed = false;
  let readyPromise: Promise<PostgresPoolLike> | null = null;
  let available = false;
  let acquired = 0;
  let denied = 0;
  let lost = 0;
  let released = 0;

  void poolPromise.then((pool) => {
    pool.on?.("error", () => {
      available = false;
      for (const controller of activeLeases) controller.lose();
    });
  }).catch(() => {
    available = false;
  });

  async function getReadyPool(): Promise<PostgresPoolLike> {
    if (closed) throw unavailable("The WebSocket connection lease manager is closed.");
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        await initializePool(pool);
        available = true;
        return pool;
      });
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      available = false;
      throw unavailable("The WebSocket connection lease store is unavailable.", error);
    }
  }

  async function initializePool(pool: PostgresPoolLike): Promise<void> {
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query(
        "/* websocket-lease:init-lock */ SELECT pg_advisory_lock($1, $2)",
        [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
      );
      locked = true;
      await client.query(INITIALIZE_SQL);
    } finally {
      if (locked) {
        try {
          await client.query(
            "/* websocket-lease:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
            [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
          );
        } catch {
          // Session termination also releases an initialization lock.
        }
      }
      client.release();
    }
  }

  async function acquire(
    subject: string,
    rawLimits: WebSocketConnectionLeaseLimits,
  ): Promise<WebSocketConnectionLeaseDecision> {
    const normalizedSubject = normalizeSubject(subject);
    const limits = normalizeLimits(rawLimits);
    const subjectHash = hashSubject(options.secret, options.namespace, normalizedSubject);
    let pool: PostgresPoolLike;
    try {
      pool = await getReadyPool();
    } catch (error) {
      throw unavailable("The WebSocket connection lease store could not be initialized.", error);
    }

    const client = await pool.connect().catch((error) => {
      available = false;
      throw unavailable("The WebSocket connection lease store could not allocate a transaction.", error);
    });
    try {
      await client.query("BEGIN");
      await client.query(
        "/* websocket-lease:acquire-lock */ SELECT pg_advisory_xact_lock($1, $2)",
        [LOCK_NAMESPACE, ACQUIRE_LOCK_KEY],
      );
      await client.query(`/* websocket-lease:delete-expired */
        DELETE FROM ${TABLE}
        WHERE lease_expires_at <= clock_timestamp()
      `);
      const counts = await client.query<CountRow>(`/* websocket-lease:count */
        SELECT
          COUNT(*)::bigint AS all_count,
          COUNT(*) FILTER (WHERE namespace = $1)::bigint AS namespace_count,
          COUNT(*) FILTER (WHERE namespace = $1 AND subject_hash = $2)::bigint AS subject_count
        FROM ${TABLE}
        WHERE lease_expires_at > clock_timestamp()
      `, [options.namespace, subjectHash]);
      const row = counts.rows[0];
      if (!row) throw new Error("The WebSocket connection lease count query returned no row.");

      const allCount = toSafeCount(row.all_count);
      const namespaceCount = toSafeCount(row.namespace_count);
      const subjectCount = toSafeCount(row.subject_count);
      if (subjectCount >= limits.maxConnectionsPerSubject) {
        await client.query("COMMIT");
        denied += 1;
        return deniedDecision("subject", options.leaseMs);
      }
      if (namespaceCount >= limits.maxConnections) {
        await client.query("COMMIT");
        denied += 1;
        return deniedDecision("global", options.leaseMs);
      }
      if (allCount >= options.maxRows) throw new WebSocketConnectionLeaseCapacityError();

      const leaseId = randomUUID();
      const confirmationStartedAt = options.monotonicNow();
      const inserted = await client.query<{ fencing_token: string | number }>(`/* websocket-lease:insert */
        INSERT INTO ${TABLE} (
          namespace, subject_hash, lease_id, lease_expires_at, updated_at
        ) VALUES (
          $1, $2, $3::uuid,
          clock_timestamp() + ($4 * interval '1 millisecond'),
          clock_timestamp()
        )
        RETURNING fencing_token
      `, [options.namespace, subjectHash, leaseId, options.leaseMs]);
      const fencingToken = inserted.rows[0]?.fencing_token;
      if (fencingToken === undefined || fencingToken === null) {
        throw new Error("The atomic WebSocket connection lease insert returned no fencing token.");
      }
      await client.query("COMMIT");
      available = true;
      acquired += 1;

      const controller = createLeaseController(pool, {
        namespace: options.namespace,
        subjectHash,
        leaseId,
        fencingToken: String(fencingToken),
      }, confirmationStartedAt);
      if (!controller.lease.isValid()) {
        await controller.lease.release();
        throw unavailable("The WebSocket connection lease confirmation arrived after its local safety deadline.");
      }
      activeLeases.add(controller);
      return { acquired: true, lease: controller.lease };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original database failure.
      }
      available = false;
      if (error instanceof WebSocketConnectionLeaseUnavailableError) throw error;
      throw unavailable("The WebSocket connection lease could not be acquired atomically.", error);
    } finally {
      client.release();
    }
  }

  function createLeaseController(
    pool: PostgresPoolLike,
    identity: { namespace: string; subjectHash: string; leaseId: string; fencingToken: string },
    confirmationStartedAt: number,
  ): LeaseController {
    let state: "active" | "lost" | "releasing" | "released" = "active";
    let confirmedUntil = createLocalConfirmationDeadline(confirmationStartedAt, options.leaseMs);
    let timer: ReturnType<typeof setInterval> | null = null;
    let onLost: (() => void) | null = null;
    let renewalTail = Promise.resolve(true);
    let releasePromise: Promise<void> | null = null;

    const controller: LeaseController = {
      lose,
      lease: {
        isValid,
        renewNow,
        start(callback) {
          if (typeof callback !== "function") throw new TypeError("A WebSocket lease loss callback is required.");
          if (onLost) throw new Error("The WebSocket connection lease was already started.");
          onLost = callback;
          if (!isValid()) return;
          timer = setInterval(() => {
            void renewNow();
          }, Math.max(1_000, Math.floor(options.leaseMs / 3)));
          timer.unref();
        },
        release,
      },
    };

    function isValid(): boolean {
      if (state !== "active") return false;
      if (options.monotonicNow() >= confirmedUntil) {
        lose();
        return false;
      }
      return true;
    }

    function notifyLost(): void {
      if (!onLost) return;
      const callback = onLost;
      onLost = null;
      queueMicrotask(() => {
        try {
          callback();
        } catch {
          // A transport callback cannot restore a lost database lease.
        }
      });
    }

    function lose(): void {
      if (state !== "active") return;
      state = "lost";
      if (timer) clearInterval(timer);
      timer = null;
      lost += 1;
      notifyLost();
    }

    function renewNow(): Promise<boolean> {
      renewalTail = renewalTail.then(async () => {
        if (!isValid() || closed) {
          lose();
          return false;
        }
        const renewalStartedAt = options.monotonicNow();
        try {
          const result = await pool.query(`/* websocket-lease:renew */
            UPDATE ${TABLE}
            SET lease_expires_at = clock_timestamp() + ($1 * interval '1 millisecond'),
                updated_at = clock_timestamp()
            WHERE namespace = $2 AND subject_hash = $3 AND lease_id = $4::uuid
              AND fencing_token = $5::bigint
              AND lease_expires_at > clock_timestamp()
          `, [options.leaseMs, identity.namespace, identity.subjectHash, identity.leaseId, identity.fencingToken]);
          const renewed = Number(result.rowCount ?? 0) === 1;
          if (!renewed || state !== "active") {
            if (state === "active") lose();
            return false;
          }
          const nextConfirmedUntil = createLocalConfirmationDeadline(renewalStartedAt, options.leaseMs);
          if (options.monotonicNow() >= nextConfirmedUntil) {
            lose();
            return false;
          }
          confirmedUntil = nextConfirmedUntil;
          available = true;
          return true;
        } catch {
          available = false;
          lose();
          return false;
        }
      });
      return renewalTail;
    }

    function release(): Promise<void> {
      if (releasePromise) return releasePromise;
      releasePromise = (async () => {
        if (timer) clearInterval(timer);
        timer = null;
        const previousState = state;
        state = "releasing";
        await renewalTail.catch(() => false);
        try {
          await pool.query(`/* websocket-lease:release */
            DELETE FROM ${TABLE}
            WHERE namespace = $1 AND subject_hash = $2 AND lease_id = $3::uuid
              AND fencing_token = $4::bigint
          `, [identity.namespace, identity.subjectHash, identity.leaseId, identity.fencingToken]);
          available = true;
        } catch {
          // The TTL is the crash-safe fallback when an exact release cannot be confirmed.
          available = false;
        } finally {
          state = "released";
          activeLeases.delete(controller);
          if (previousState !== "released") released += 1;
        }
      })();
      return releasePromise;
    }

    return controller;
  }

  return {
    acquire,
    async checkHealth() {
      try {
        const pool = await getReadyPool();
        await pool.query("/* websocket-lease:health */ SELECT 1 AS healthy");
        available = true;
      } catch {
        available = false;
      }
      return { available };
    },
    getStats() {
      return {
        mode: "postgres",
        namespace: options.namespace,
        available,
        activeLocalLeases: activeLeases.size,
        leaseMs: options.leaseMs,
        localSafetyMs: localLeaseSafetyMs(options.leaseMs),
        maxRows: options.maxRows,
        acquired,
        denied,
        lost,
        released,
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      const leases = [...activeLeases];
      for (const lease of leases) lease.lose();
      await Promise.allSettled(leases.map((lease) => lease.lease.release()));
      if (ownsPool) {
        try {
          const pool = await poolPromise;
          await pool.end();
        } catch {
          // Initialization failure leaves no owned pool that can be closed reliably.
        }
      }
      available = false;
    },
  };
}

export function createPostgresWebSocketConnectionLeaseManagerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WebSocketConnectionLeaseManager | null {
  const mode = String(env.AI_GATEWAY_RATE_LIMIT_STORE ?? "memory").trim().toLowerCase();
  if (mode !== "postgres") return null;
  const connectionString = env.AI_GATEWAY_RATE_LIMIT_POSTGRES_URL?.trim();
  if (!connectionString) {
    throw new Error("AI_GATEWAY_RATE_LIMIT_POSTGRES_URL is required for distributed WebSocket connection leases.");
  }
  const secret = env.AI_GATEWAY_RATE_LIMIT_HMAC_SECRET ?? "";
  return createPostgresWebSocketConnectionLeaseManager({
    connectionString,
    secret,
    namespace:
      env.AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_NAMESPACE?.trim()
      || env.AI_GATEWAY_RATE_LIMIT_NAMESPACE?.trim()
      || DEFAULT_NAMESPACE,
    leaseMs: readBoundedInteger(
      env.AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_MS,
      DEFAULT_LEASE_MS,
      5_000,
      300_000,
    ),
    maxRows: readBoundedInteger(
      env.AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_MAX_ROWS,
      DEFAULT_MAX_ROWS,
      1,
      1_000_000,
    ),
    poolMax: readBoundedInteger(
      env.AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_POOL_MAX,
      2,
      1,
      8,
    ),
    statementTimeoutMs: readBoundedInteger(
      env.AI_GATEWAY_RATE_LIMIT_POSTGRES_STATEMENT_TIMEOUT_MS,
      5_000,
      100,
      60_000,
    ),
  });
}

function normalizeOptions(raw: ManagerOptions): Required<Omit<ManagerOptions, "pool" | "connectionString">> & {
  connectionString?: string;
} {
  const secret = raw.secret;
  const secretLength = Buffer.isBuffer(secret) ? secret.length : Buffer.byteLength(String(secret));
  if (secretLength < 32) throw new Error("A WebSocket connection lease HMAC secret of at least 32 bytes is required.");
  const namespace = String(raw.namespace ?? DEFAULT_NAMESPACE).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(namespace)) {
    throw new Error("The WebSocket connection lease namespace must be 1-128 lowercase ASCII characters.");
  }
  if (!raw.pool && !raw.connectionString?.trim()) {
    throw new Error("A PostgreSQL connection string or injected pool is required for WebSocket connection leases.");
  }
  return {
    connectionString: raw.connectionString?.trim(),
    secret,
    namespace,
    leaseMs: boundedInteger(raw.leaseMs ?? DEFAULT_LEASE_MS, 5_000, 300_000, "leaseMs"),
    maxRows: boundedInteger(raw.maxRows ?? DEFAULT_MAX_ROWS, 1, 1_000_000, "maxRows"),
    poolMax: boundedInteger(raw.poolMax ?? 2, 1, 8, "poolMax"),
    statementTimeoutMs: boundedInteger(raw.statementTimeoutMs ?? 5_000, 100, 60_000, "statementTimeoutMs"),
    monotonicNow: raw.monotonicNow ?? (() => performance.now()),
  };
}

function createLocalConfirmationDeadline(confirmationStartedAt: number, leaseMs: number): number {
  return confirmationStartedAt + leaseMs - localLeaseSafetyMs(leaseMs);
}

function localLeaseSafetyMs(leaseMs: number): number {
  return Math.min(1_000, Math.max(250, Math.floor(leaseMs / 10)));
}

function normalizeSubject(subject: string): string {
  if (typeof subject !== "string" || subject.length === 0 || subject.length > 4_096) {
    throw new TypeError("A bounded WebSocket connection lease subject is required.");
  }
  return subject;
}

function normalizeLimits(limits: WebSocketConnectionLeaseLimits): WebSocketConnectionLeaseLimits {
  return {
    maxConnections: boundedInteger(limits?.maxConnections, 1, 1_000_000, "maxConnections"),
    maxConnectionsPerSubject: boundedInteger(
      limits?.maxConnectionsPerSubject,
      1,
      1_000_000,
      "maxConnectionsPerSubject",
    ),
  };
}

function boundedInteger(value: unknown, minimum: number, maximum: number, name: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new TypeError(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value.trim() === "") return fallback;
  return boundedInteger(value, minimum, maximum, "environment value");
}

function toSafeCount(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("The WebSocket connection lease store returned an invalid count.");
  }
  return parsed;
}

function hashSubject(secret: string | Buffer, namespace: string, subject: string): string {
  return createHmac("sha256", secret)
    .update("websocket-connection-lease")
    .update("\0")
    .update(namespace)
    .update("\0")
    .update(subject)
    .digest("hex");
}

function deniedDecision(
  scope: "global" | "subject",
  leaseMs: number,
): WebSocketConnectionLeaseDecision {
  return {
    acquired: false,
    scope,
    retryAfterSeconds: Math.max(1, Math.ceil(leaseMs / 1_000)),
  };
}

function unavailable(message: string, cause?: unknown): WebSocketConnectionLeaseUnavailableError {
  if (cause instanceof WebSocketConnectionLeaseUnavailableError) return cause;
  return new WebSocketConnectionLeaseUnavailableError(message, cause === undefined ? undefined : { cause });
}

async function loadPool(options: ReturnType<typeof normalizeOptions>): Promise<PostgresPoolLike> {
  const { Pool } = await import("pg");
  return new Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    statement_timeout: options.statementTimeoutMs,
    application_name: "unified-ai-gateway-websocket-leases",
    allowExitOnIdle: true,
  }) as unknown as PostgresPoolLike;
}
