import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import type {
  IdempotencyAcceptedOutcome,
  IdempotencyCoordinator,
  IdempotencyExecution,
  IdempotencyOutcome,
  IdempotencyRejectedOutcome,
} from "./idempotencyCoordinator.ts";

export type PostgresQueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};

export type PostgresClientLike = {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<PostgresQueryResult<Row>>;
  release(): void;
};

export type PostgresPoolLike = {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<PostgresQueryResult<Row>>;
  connect(): Promise<PostgresClientLike>;
  end(): Promise<void>;
  on?(event: "error", listener: (error: Error) => void): unknown;
};

type PostgresCoordinatorOptions = {
  connectionString?: string;
  pool?: PostgresPoolLike;
  secret: string | Buffer;
  now: () => number;
  ttlMs: number;
  maxEntries: number;
  maxResultBytes: number;
  leaseMs: number;
  inFlightWaitMs: number;
  pollIntervalMs: number;
  poolMax: number;
  statementTimeoutMs: number;
  storageNamespace: "idempotency" | "provider-dispatch" | "external-effect";
  normalizeKey: (value: unknown) => { ok: true; value: string } | { ok: false; message: string };
  createIdentity: (input: { request?: IdempotencyExecution<unknown>["request"]; route: string; key: string; secret: string | Buffer }) => string;
  createFingerprint: (payload: unknown) => string;
};

type EntryState = "in_flight" | "completed" | "oversized" | "failed" | "unknown";

type EntryRow = {
  identity: string;
  fingerprint: string;
  state: EntryState;
  lease_owner: string | null;
  fencing_token: string | number;
  lease_remaining_ms: string | number | null;
  result_json: unknown;
};

type ClaimDecision<T> =
  | { kind: "owner"; leaseOwner: string; fencingToken: string }
  | { kind: "in_flight"; leaseRemainingMs: number }
  | { kind: "accepted"; outcome: IdempotencyAcceptedOutcome<T> }
  | { kind: "rejected"; outcome: IdempotencyRejectedOutcome };

type ReadDecision<T> = Exclude<ClaimDecision<T>, { kind: "owner" }>;

type StatsSnapshot = {
  entries: number;
  inFlight: number;
  replayable: number;
  tombstones: number;
  available: boolean;
  statsUpdatedAt: number | null;
};

const CLAIM_LOCK_NAMESPACE = 1_431_193_303;

type PostgresStorage = {
  table: string;
  sequence: string;
  expiryIndex: string;
  leaseIndex: string;
  claimLockKey: number;
  initializeLockKey: number;
  applicationName: string;
};

const POSTGRES_STORAGE: Record<PostgresCoordinatorOptions["storageNamespace"], PostgresStorage> = {
  idempotency: {
    table: "public.ai_gateway_idempotency_entries",
    sequence: "public.ai_gateway_idempotency_fencing_seq",
    expiryIndex: "ai_gateway_idempotency_expiry_idx",
    leaseIndex: "ai_gateway_idempotency_lease_idx",
    claimLockKey: 1_768_841_005,
    initializeLockKey: 1_768_841_006,
    applicationName: "unified-ai-system-idempotency",
  },
  "provider-dispatch": {
    table: "public.ai_gateway_provider_dispatch_entries",
    sequence: "public.ai_gateway_provider_dispatch_fencing_seq",
    expiryIndex: "ai_gateway_provider_dispatch_expiry_idx",
    leaseIndex: "ai_gateway_provider_dispatch_lease_idx",
    claimLockKey: 1_768_841_007,
    initializeLockKey: 1_768_841_008,
    applicationName: "unified-ai-system-provider-dispatch",
  },
  "external-effect": {
    table: "public.ai_gateway_external_effect_entries",
    sequence: "public.ai_gateway_external_effect_fencing_seq",
    expiryIndex: "ai_gateway_external_effect_expiry_idx",
    leaseIndex: "ai_gateway_external_effect_lease_idx",
    claimLockKey: 1_768_841_009,
    initializeLockKey: 1_768_841_010,
    applicationName: "unified-ai-system-external-effect",
  },
};

export function createPostgresIdempotencyCoordinator(options: PostgresCoordinatorOptions): IdempotencyCoordinator {
  const storage = POSTGRES_STORAGE[options.storageNamespace];
  const table = storage.table;
  const initializeSql = createInitializeSql(storage);
  const readEntrySql = createReadEntrySql(table);
  let closed = false;
  let readyPromise: Promise<PostgresPoolLike> | null = null;
  let statsRefreshPromise: Promise<void> | null = null;
  let lastStatsRefreshStartedAt = 0;
  const ownsPool = !options.pool;
  const poolPromise = options.pool
    ? Promise.resolve(options.pool)
    : loadPool(options);
  let stats: StatsSnapshot = {
    entries: 0,
    inFlight: 0,
    replayable: 0,
    tombstones: 0,
    available: false,
    statsUpdatedAt: null,
  };

  void poolPromise.then((pool) => {
    pool.on?.("error", () => {
      stats = { ...stats, available: false };
    });
  }).catch(() => {
    stats = { ...stats, available: false };
  });
  void getReadyPool().catch(() => undefined);

  return {
    async execute<T>({ request, route, payload, operation }: IdempotencyExecution<T>): Promise<IdempotencyOutcome<T>> {
      const rawKey = request?.headers?.["idempotency-key"];
      if (rawKey === undefined) return accepted("bypassed", false, false, await operation());

      const keyResult = options.normalizeKey(rawKey);
      if (!keyResult.ok) return rejected(400, "IDEMPOTENCY_KEY_INVALID", keyResult.message, false);

      const identity = options.createIdentity({ request, route, key: keyResult.value, secret: options.secret });
      const fingerprint = options.createFingerprint(payload);
      let pool: PostgresPoolLike;
      let decision: ClaimDecision<T>;
      try {
        pool = await getReadyPool();
        decision = await claimOrRead<T>(pool, identity, fingerprint);
      } catch {
        return storeUnavailable();
      }

      if (decision.kind === "owner") {
        return executeOwned(pool, identity, decision.leaseOwner, decision.fencingToken, operation);
      }
      if (decision.kind === "in_flight") {
        return waitForOwner<T>(pool, identity, fingerprint, decision.leaseRemainingMs);
      }
      return decision.outcome;
    },

    getStats() {
      return statsSnapshot();
    },

    async checkHealth() {
      try {
        const pool = await getReadyPool();
        await pool.query("/* idempotency:health */ SELECT 1 AS healthy");
        stats = { ...stats, available: true };
        scheduleStatsRefresh(pool);
      } catch {
        stats = { ...stats, available: false };
      }
      return statsSnapshot();
    },

    async close() {
      if (closed) return;
      closed = true;
      if (!ownsPool) return;
      try {
        if (readyPromise) await readyPromise;
        const pool = await poolPromise;
        await pool.end();
      } catch {
        // Shutdown remains best-effort when initialization itself failed.
      }
    },
  };

  function statsSnapshot() {
    return {
      entries: stats.entries,
      inFlight: stats.inFlight,
      replayable: stats.replayable,
      tombstones: stats.tombstones,
      ttlMs: options.ttlMs,
      maxEntries: options.maxEntries,
      maxResultBytes: options.maxResultBytes,
      storeMode: "postgres" as const,
      available: stats.available,
      distributed: true,
      statsUpdatedAt: stats.statsUpdatedAt,
    };
  }

  async function getReadyPool(): Promise<PostgresPoolLike> {
    if (closed) throw new Error("The PostgreSQL idempotency coordinator is closed.");
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        await initializePool(pool);
        stats = { ...stats, available: true };
        scheduleStatsRefresh(pool, true);
        return pool;
      });
      void readyPromise.catch(() => undefined);
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      stats = { ...stats, available: false };
      throw error;
    }
  }

  async function initializePool(pool: PostgresPoolLike): Promise<void> {
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query(
        "/* idempotency:init-lock */ SELECT pg_advisory_lock($1, $2)",
        [CLAIM_LOCK_NAMESPACE, storage.initializeLockKey],
      );
      locked = true;
      await client.query(initializeSql);
    } finally {
      if (locked) {
        try {
          await client.query(
            "/* idempotency:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
            [CLAIM_LOCK_NAMESPACE, storage.initializeLockKey],
          );
        } catch {
          // Session termination releases the lock if an explicit unlock cannot complete.
        }
      }
      client.release();
    }
  }

  async function claimOrRead<T>(pool: PostgresPoolLike, identity: string, fingerprint: string): Promise<ClaimDecision<T>> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "/* idempotency:claim-lock */ SELECT pg_advisory_xact_lock($1, $2)",
        [CLAIM_LOCK_NAMESPACE, storage.claimLockKey],
      );
      await client.query(`/* idempotency:expire-leases */
        UPDATE ${table}
        SET state = 'unknown', lease_owner = NULL, lease_expires_at = NULL,
            expires_at = GREATEST(expires_at, clock_timestamp() + ($1 * interval '1 millisecond')),
            updated_at = clock_timestamp()
        WHERE state = 'in_flight' AND lease_expires_at <= clock_timestamp()
      `, [options.ttlMs]);
      await client.query(`/* idempotency:delete-expired */
        DELETE FROM ${table}
        WHERE state <> 'in_flight' AND expires_at <= clock_timestamp()
      `);

      const existing = await client.query<EntryRow>(`${readEntrySql} FOR UPDATE`, [identity]);
      if (existing.rows[0]) {
        const decision = decodeRow<T>(existing.rows[0], fingerprint);
        await client.query("COMMIT");
        scheduleStatsRefresh(pool);
        return decision;
      }

      const count = await client.query<{ count: string | number }>(
        `/* idempotency:count */ SELECT COUNT(*)::bigint AS count FROM ${table}`,
      );
      if (Number(count.rows[0]?.count ?? 0) >= options.maxEntries) {
        await client.query("COMMIT");
        return {
          kind: "rejected",
          outcome: rejected(503, "IDEMPOTENCY_CAPACITY_REACHED", "The bounded idempotency store is full. Retry after prior entries expire.", true, 1),
        };
      }

      const leaseOwner = randomUUID();
      const inserted = await client.query<{ fencing_token: string | number }>(`/* idempotency:insert */
        INSERT INTO ${table} (
          identity, fingerprint, state, lease_owner, lease_expires_at, expires_at, result_json, updated_at
        ) VALUES (
          $1, $2, 'in_flight', $3::uuid,
          clock_timestamp() + ($4 * interval '1 millisecond'),
          clock_timestamp() + ($5 * interval '1 millisecond'),
          NULL, clock_timestamp()
        )
        ON CONFLICT (identity) DO NOTHING
        RETURNING fencing_token
      `, [identity, fingerprint, leaseOwner, options.leaseMs, options.ttlMs]);
      if (!inserted.rows[0]) {
        throw new Error("The atomic idempotency claim did not return an owner token.");
      }
      await client.query("COMMIT");
      scheduleStatsRefresh(pool);
      return { kind: "owner", leaseOwner, fencingToken: String(inserted.rows[0].fencing_token) };
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the original database error. */ }
      throw error;
    } finally {
      client.release();
    }
  }

  function decodeRow<T>(row: EntryRow, fingerprint: string): ReadDecision<T> {
    if (row.fingerprint !== fingerprint) {
      return {
        kind: "rejected",
        outcome: rejected(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used with a different request payload.", false),
      };
    }
    if (row.state === "in_flight") {
      return { kind: "in_flight", leaseRemainingMs: Math.max(0, Number(row.lease_remaining_ms ?? 0)) };
    }
    if (row.state === "completed") {
      return { kind: "accepted", outcome: accepted("replayed", true, true, row.result_json as T) };
    }
    if (row.state === "oversized") {
      return { kind: "rejected", outcome: rejected(409, "IDEMPOTENCY_RESULT_NOT_REPLAYABLE", "The original request completed, but its result exceeded the replay cache limit.", false) };
    }
    if (row.state === "failed") {
      return { kind: "rejected", outcome: rejected(409, "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED", "The original request failed after execution started and will not be run again with this key.", false) };
    }
    return { kind: "rejected", outcome: previousAttemptUnknown() };
  }

  async function waitForOwner<T>(
    pool: PostgresPoolLike,
    identity: string,
    fingerprint: string,
    initialLeaseRemainingMs: number,
  ): Promise<IdempotencyOutcome<T>> {
    const waitDeadline = performance.now() + options.inFlightWaitMs;
    let leaseRemainingMs = initialLeaseRemainingMs;
    while (performance.now() < waitDeadline) {
      await delay(options.pollIntervalMs);
      try {
        const result = await pool.query<EntryRow>(readEntrySql, [identity]);
        const row = result.rows[0];
        if (!row) return previousAttemptUnknown();
        const decision = decodeRow<T>(row, fingerprint);
        if (decision.kind === "accepted" || decision.kind === "rejected") return decision.outcome;
        leaseRemainingMs = decision.leaseRemainingMs;
        if (leaseRemainingMs <= 0) {
          await pool.query(`/* idempotency:mark-unknown */
            UPDATE ${table}
            SET state = 'unknown', lease_owner = NULL, lease_expires_at = NULL,
                expires_at = GREATEST(expires_at, clock_timestamp() + ($1 * interval '1 millisecond')),
                updated_at = clock_timestamp()
            WHERE identity = $2 AND state = 'in_flight' AND lease_expires_at <= clock_timestamp()
          `, [options.ttlMs, identity]);
          const latest = await pool.query<EntryRow>(readEntrySql, [identity]);
          return latest.rows[0] ? decodeTerminal<T>(latest.rows[0], fingerprint) : previousAttemptUnknown();
        }
      } catch {
        stats = { ...stats, available: false };
        return storeUnavailable();
      }
    }
    return rejected(
      409,
      "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      "The original request is still in progress.",
      true,
      Math.max(1, Math.ceil(leaseRemainingMs / 1000)),
    );
  }

  function decodeTerminal<T>(row: EntryRow, fingerprint: string): IdempotencyOutcome<T> {
    const decision = decodeRow<T>(row, fingerprint);
    if (decision.kind === "accepted" || decision.kind === "rejected") return decision.outcome;
    return previousAttemptUnknown();
  }

  async function executeOwned<T>(
    pool: PostgresPoolLike,
    identity: string,
    leaseOwner: string,
    fencingToken: string,
    operation: () => T | Promise<T>,
  ): Promise<IdempotencyOutcome<T>> {
    let leaseLost = false;
    let renewal = Promise.resolve();
    const renew = () => {
      renewal = renewal.then(async () => {
        if (leaseLost || closed) {
          leaseLost = true;
          return;
        }
        try {
          const update = await pool.query(`/* idempotency:renew */
            UPDATE ${table}
            SET lease_expires_at = clock_timestamp() + ($1 * interval '1 millisecond'),
                updated_at = clock_timestamp()
            WHERE identity = $2 AND state = 'in_flight' AND lease_owner = $3::uuid
              AND fencing_token = $4::bigint AND lease_expires_at > clock_timestamp()
          `, [options.leaseMs, identity, leaseOwner, fencingToken]);
          if (Number(update.rowCount ?? 0) !== 1) leaseLost = true;
        } catch {
          leaseLost = true;
          stats = { ...stats, available: false };
        }
      });
    };
    const heartbeat = setInterval(renew, Math.max(250, Math.floor(options.leaseMs / 3)));
    heartbeat.unref();

    try {
      const value = await operation();
      clearInterval(heartbeat);
      renew();
      await renewal;
      if (leaseLost) return accepted("created-unconfirmed", false, false, value);

      const encoded = encodeResult(value, options.maxResultBytes);
      try {
        const update = await pool.query(`/* idempotency:complete */
          UPDATE ${table}
          SET state = $1, lease_owner = NULL, lease_expires_at = NULL,
              expires_at = clock_timestamp() + ($2 * interval '1 millisecond'),
              result_json = CASE WHEN $1 = 'completed' THEN $3::jsonb ELSE NULL END,
              updated_at = clock_timestamp()
          WHERE identity = $4 AND state = 'in_flight' AND lease_owner = $5::uuid
            AND fencing_token = $6::bigint AND lease_expires_at > clock_timestamp()
        `, [encoded.replayable ? "completed" : "oversized", options.ttlMs, encoded.json, identity, leaseOwner, fencingToken]);
        const durable = Number(update.rowCount ?? 0) === 1;
        scheduleStatsRefresh(pool);
        return accepted(durable ? "created" : "created-unconfirmed", false, durable && encoded.replayable, value);
      } catch {
        stats = { ...stats, available: false };
        return accepted("created-unconfirmed", false, false, value);
      }
    } catch (error) {
      clearInterval(heartbeat);
      await renewal;
      if (!leaseLost) {
        try {
          await pool.query(`/* idempotency:fail */
            UPDATE ${table}
            SET state = 'failed', lease_owner = NULL, lease_expires_at = NULL,
                expires_at = clock_timestamp() + ($1 * interval '1 millisecond'),
                result_json = NULL, updated_at = clock_timestamp()
            WHERE identity = $2 AND state = 'in_flight' AND lease_owner = $3::uuid
              AND fencing_token = $4::bigint AND lease_expires_at > clock_timestamp()
          `, [options.ttlMs, identity, leaseOwner, fencingToken]);
          scheduleStatsRefresh(pool);
        } catch {
          stats = { ...stats, available: false };
        }
      }
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  function scheduleStatsRefresh(pool: PostgresPoolLike, immediate = false): void {
    const timestamp = options.now();
    if (statsRefreshPromise || (!immediate && timestamp - lastStatsRefreshStartedAt < 1_000)) return;
    lastStatsRefreshStartedAt = timestamp;
    statsRefreshPromise = refreshStats(pool).finally(() => {
      statsRefreshPromise = null;
    });
    void statsRefreshPromise.catch(() => undefined);
  }

  async function refreshStats(pool: PostgresPoolLike): Promise<void> {
    try {
      const result = await pool.query<{ state: EntryState; count: string | number }>(`/* idempotency:stats */
        SELECT state, COUNT(*)::bigint AS count FROM ${table} GROUP BY state
      `);
      const counts = new Map<EntryState, number>();
      for (const row of result.rows) counts.set(row.state, Number(row.count));
      stats = {
        entries: [...counts.values()].reduce((sum, count) => sum + count, 0),
        inFlight: counts.get("in_flight") ?? 0,
        replayable: counts.get("completed") ?? 0,
        tombstones: (counts.get("oversized") ?? 0) + (counts.get("failed") ?? 0) + (counts.get("unknown") ?? 0),
        available: true,
        statsUpdatedAt: options.now(),
      };
    } catch {
      stats = { ...stats, available: false };
    }
  }
}

function createInitializeSql(storage: PostgresStorage): string {
  return `/* idempotency:init */
    CREATE SEQUENCE IF NOT EXISTS ${storage.sequence} AS bigint;
    CREATE TABLE IF NOT EXISTS ${storage.table} (
      identity TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('in_flight', 'completed', 'oversized', 'failed', 'unknown')),
      lease_owner UUID,
      fencing_token BIGINT NOT NULL DEFAULT nextval('${storage.sequence}'::regclass),
      lease_expires_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      result_json JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
    );
    CREATE INDEX IF NOT EXISTS ${storage.expiryIndex}
      ON ${storage.table} (expires_at);
    CREATE INDEX IF NOT EXISTS ${storage.leaseIndex}
      ON ${storage.table} (lease_expires_at)
      WHERE state = 'in_flight';
  `;
}

function createReadEntrySql(table: string): string {
  return `/* idempotency:read-entry */
    SELECT identity, fingerprint, state, lease_owner, fencing_token, result_json,
           CASE WHEN lease_expires_at IS NULL THEN NULL
                ELSE GREATEST(0, EXTRACT(EPOCH FROM (lease_expires_at - clock_timestamp())) * 1000)::bigint
            END AS lease_remaining_ms
    FROM ${table}
    WHERE identity = $1
  `;
}

async function loadPool(options: PostgresCoordinatorOptions): Promise<PostgresPoolLike> {
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => PostgresPoolLike;
  };
  return new module.Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    connectionTimeoutMillis: Math.min(10_000, options.statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: options.statementTimeoutMs,
    application_name: POSTGRES_STORAGE[options.storageNamespace].applicationName,
    allowExitOnIdle: true,
  });
}

function accepted<T>(
  status: IdempotencyAcceptedOutcome<T>["status"],
  replayed: boolean,
  replayable: boolean,
  value: T,
): IdempotencyAcceptedOutcome<T> {
  return { accepted: true, status, replayed, replayable, value };
}

function rejected(
  statusCode: number,
  code: string,
  message: string,
  retryable: boolean,
  retryAfterSeconds?: number,
): IdempotencyRejectedOutcome {
  return {
    accepted: false,
    status: "rejected",
    replayed: false,
    replayable: false,
    statusCode,
    code,
    message,
    retryable,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

function previousAttemptUnknown(): IdempotencyRejectedOutcome {
  return rejected(
    409,
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
    "A previous owner lost its lease before recording a result. Reconciliation is required before using a new key.",
    false,
  );
}

function storeUnavailable(): IdempotencyRejectedOutcome {
  return rejected(503, "IDEMPOTENCY_STORE_UNAVAILABLE", "The shared idempotency store is unavailable.", true, 1);
}

function encodeResult(value: unknown, maxResultBytes: number): { replayable: boolean; json: string | null } {
  try {
    const json = JSON.stringify(value);
    if (json === undefined || Buffer.byteLength(json) > maxResultBytes) return { replayable: false, json: null };
    return { replayable: true, json };
  } catch {
    return { replayable: false, json: null };
  }
}
