import { createHmac } from "node:crypto";
import type {
  PostgresClientLike,
  PostgresPoolLike,
  PostgresQueryResult,
} from "./postgresIdempotencyCoordinator.ts";

export type PostgresRateLimitIncrement = {
  count: number;
  resetAfterMs: number;
};

export type PostgresRateLimitStoreStats = {
  activeBuckets: number;
  available: boolean;
  distributed: true;
  maxBuckets: number;
  statsUpdatedAt: number | null;
  storeMode: "postgres";
};

type PostgresRateLimitStoreOptions = {
  connectionString?: string;
  maxBuckets: number;
  now?: () => number;
  pool?: PostgresPoolLike;
  poolMax: number;
  secret: string | Buffer;
  statementTimeoutMs: number;
};

type IncrementRow = {
  count: string | number;
  reset_after_ms: string | number;
};

type StatsRow = {
  count: string | number;
  namespace: string;
};

const TABLE = "public.ai_gateway_rate_limit_buckets";
const LOCK_NAMESPACE = 1_431_193_303;
const INITIALIZE_LOCK_KEY = 1_768_841_101;
const CAPACITY_LOCK_KEY = 1_768_841_102;

const INITIALIZE_SQL = `/* rate-limit:init */
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    namespace TEXT NOT NULL,
    subject_hash TEXT NOT NULL,
    window_index BIGINT NOT NULL,
    count BIGINT NOT NULL CHECK (count > 0),
    window_ends_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (namespace, subject_hash, window_index)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_rate_limit_expiry_idx
    ON ${TABLE} (window_ends_at);
`;

const INCREMENT_EXISTING_SQL = `/* rate-limit:increment-existing */
  WITH current_window AS (
    SELECT floor((EXTRACT(EPOCH FROM clock_timestamp()) * 1000) / $3::bigint)::bigint AS window_index
  )
  UPDATE ${TABLE} AS bucket
  SET count = bucket.count + 1, updated_at = clock_timestamp()
  FROM current_window
  WHERE bucket.namespace = $1
    AND bucket.subject_hash = $2
    AND bucket.window_index = current_window.window_index
  RETURNING bucket.count,
    GREATEST(
      0,
      ceil(EXTRACT(EPOCH FROM (bucket.window_ends_at - clock_timestamp())) * 1000)
    )::bigint AS reset_after_ms
`;

export class PostgresRateLimitStoreError extends Error {
  readonly code: "RATE_LIMIT_STORE_CAPACITY" | "RATE_LIMIT_STORE_UNAVAILABLE";

  constructor(code: PostgresRateLimitStoreError["code"], message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "PostgresRateLimitStoreError";
    this.code = code;
  }
}

export function createPostgresRateLimitStore(options: PostgresRateLimitStoreOptions) {
  if (!options.connectionString && !options.pool) {
    throw new Error("AI_GATEWAY_RATE_LIMIT_POSTGRES_URL is required when the rate-limit store mode is postgres.");
  }
  if (!options.secret || Buffer.byteLength(options.secret) < 32) {
    throw new Error("AI_GATEWAY_RATE_LIMIT_HMAC_SECRET must contain at least 32 bytes in postgres mode.");
  }
  const now = options.now ?? Date.now;
  const ownsPool = !options.pool;
  const poolPromise = options.pool ? Promise.resolve(options.pool) : loadPool(options);
  let closed = false;
  let readyPromise: Promise<PostgresPoolLike> | null = null;
  let statsRefreshPromise: Promise<void> | null = null;
  let lastStatsRefreshStartedAt = 0;
  let available = false;
  let statsUpdatedAt: number | null = null;
  const activeBuckets = new Map<string, number>();

  const statsSnapshot = (namespace: string): PostgresRateLimitStoreStats => ({
    activeBuckets: activeBuckets.get(namespace) ?? 0,
    available,
    distributed: true,
    maxBuckets: options.maxBuckets,
    statsUpdatedAt,
    storeMode: "postgres",
  });

  void poolPromise.then((pool) => {
    pool.on?.("error", () => { available = false; });
  }).catch(() => { available = false; });
  void getReadyPool().catch(() => undefined);

  return {
    async increment(namespace: string, subject: string, windowMs: number): Promise<PostgresRateLimitIncrement> {
      const pool = await getReadyPool();
      const subjectHash = createSubjectHash(options.secret, namespace, subject);
      try {
        const existing = await pool.query<IncrementRow>(INCREMENT_EXISTING_SQL, [namespace, subjectHash, windowMs]);
        if (existing.rows[0]) {
          available = true;
          scheduleStatsRefresh(pool);
          return decodeIncrement(existing.rows[0]);
        }
        return await createBucket(pool, namespace, subjectHash, windowMs);
      } catch (error) {
        if (error instanceof PostgresRateLimitStoreError) throw error;
        available = false;
        throw unavailable(error);
      }
    },

    async cleanup(): Promise<void> {
      try {
        const pool = await getReadyPool();
        await pool.query(`/* rate-limit:cleanup */ DELETE FROM ${TABLE} WHERE window_ends_at <= clock_timestamp()`);
        await refreshStats(pool);
      } catch {
        available = false;
      }
    },

    getStats(namespace: string): PostgresRateLimitStoreStats {
      return statsSnapshot(namespace);
    },

    async checkHealth(namespace: string): Promise<PostgresRateLimitStoreStats> {
      try {
        const pool = await getReadyPool();
        await pool.query("/* rate-limit:health */ SELECT 1 AS healthy");
        available = true;
        scheduleStatsRefresh(pool, true);
      } catch {
        available = false;
      }
      return statsSnapshot(namespace);
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      if (!ownsPool) return;
      try {
        if (readyPromise) await readyPromise;
        const pool = await poolPromise;
        await pool.end();
      } catch {
        // Initialization failure leaves no required shutdown work.
      }
    },
  };

  async function getReadyPool(): Promise<PostgresPoolLike> {
    if (closed) throw unavailable(new Error("The PostgreSQL rate-limit store is closed."));
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        await initializePool(pool);
        available = true;
        scheduleStatsRefresh(pool, true);
        return pool;
      });
      void readyPromise.catch(() => undefined);
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      available = false;
      throw unavailable(error);
    }
  }

  async function initializePool(pool: PostgresPoolLike): Promise<void> {
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query("/* rate-limit:init-lock */ SELECT pg_advisory_lock($1, $2)", [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY]);
      locked = true;
      await client.query(INITIALIZE_SQL);
    } finally {
      if (locked) {
        try {
          await client.query("/* rate-limit:init-unlock */ SELECT pg_advisory_unlock($1, $2)", [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY]);
        } catch {
          // A disconnected session releases its advisory lock automatically.
        }
      }
      client.release();
    }
  }

  async function createBucket(
    pool: PostgresPoolLike,
    namespace: string,
    subjectHash: string,
    windowMs: number,
  ): Promise<PostgresRateLimitIncrement> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("/* rate-limit:capacity-lock */ SELECT pg_advisory_xact_lock($1, $2)", [LOCK_NAMESPACE, CAPACITY_LOCK_KEY]);
      await client.query(`/* rate-limit:cleanup */ DELETE FROM ${TABLE} WHERE window_ends_at <= clock_timestamp()`);

      const raced = await client.query<IncrementRow>(INCREMENT_EXISTING_SQL, [namespace, subjectHash, windowMs]);
      if (raced.rows[0]) {
        await client.query("COMMIT");
        scheduleStatsRefresh(pool);
        return decodeIncrement(raced.rows[0]);
      }

      const countResult = await client.query<{ count: string | number }>(
        `/* rate-limit:count */ SELECT COUNT(*)::bigint AS count FROM ${TABLE} WHERE window_ends_at > clock_timestamp()`,
      );
      if (Number(countResult.rows[0]?.count ?? 0) >= options.maxBuckets) {
        await client.query("ROLLBACK");
        throw new PostgresRateLimitStoreError(
          "RATE_LIMIT_STORE_CAPACITY",
          "The bounded distributed rate-limit store is at capacity.",
        );
      }

      const inserted = await client.query<IncrementRow>(`/* rate-limit:insert */
        WITH current_window AS (
          SELECT floor((EXTRACT(EPOCH FROM clock_timestamp()) * 1000) / $3::bigint)::bigint AS window_index
        )
        INSERT INTO ${TABLE} AS bucket (
          namespace, subject_hash, window_index, count, window_ends_at, updated_at
        )
        SELECT $1, $2, current_window.window_index, 1,
          to_timestamp((((current_window.window_index + 1) * $3::bigint)::numeric) / 1000),
          clock_timestamp()
        FROM current_window
        ON CONFLICT (namespace, subject_hash, window_index) DO UPDATE
          SET count = bucket.count + 1, updated_at = clock_timestamp()
        RETURNING count,
          GREATEST(
            0,
            ceil(EXTRACT(EPOCH FROM (window_ends_at - clock_timestamp())) * 1000)
          )::bigint AS reset_after_ms
      `, [namespace, subjectHash, windowMs]);
      await client.query("COMMIT");
      available = true;
      scheduleStatsRefresh(pool);
      return decodeIncrement(inserted.rows[0]);
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* Preserve the original error. */ }
      throw error;
    } finally {
      client.release();
    }
  }

  function scheduleStatsRefresh(pool: PostgresPoolLike, immediate = false): void {
    const timestamp = now();
    if (statsRefreshPromise || (!immediate && timestamp - lastStatsRefreshStartedAt < 1_000)) return;
    lastStatsRefreshStartedAt = timestamp;
    statsRefreshPromise = refreshStats(pool).finally(() => { statsRefreshPromise = null; });
    void statsRefreshPromise.catch(() => undefined);
  }

  async function refreshStats(pool: PostgresPoolLike): Promise<void> {
    try {
      const result = await pool.query<StatsRow>(`/* rate-limit:stats */
        SELECT namespace, COUNT(*)::bigint AS count
        FROM ${TABLE}
        WHERE window_ends_at > clock_timestamp()
        GROUP BY namespace
      `);
      activeBuckets.clear();
      for (const row of result.rows) activeBuckets.set(row.namespace, Number(row.count));
      available = true;
      statsUpdatedAt = now();
    } catch {
      available = false;
    }
  }
}

async function loadPool(options: PostgresRateLimitStoreOptions): Promise<PostgresPoolLike> {
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => PostgresPoolLike;
  };
  return new module.Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    connectionTimeoutMillis: Math.min(10_000, options.statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: options.statementTimeoutMs,
    application_name: "unified-ai-system-rate-limit",
    allowExitOnIdle: true,
  });
}

function createSubjectHash(secret: string | Buffer, namespace: string, subject: string): string {
  return createHmac("sha256", secret).update(namespace).update("\0").update(subject).digest("hex");
}

function decodeIncrement(row: IncrementRow | undefined): PostgresRateLimitIncrement {
  if (!row) throw unavailable(new Error("The atomic rate-limit increment returned no result."));
  return {
    count: Number(row.count),
    resetAfterMs: Math.max(0, Number(row.reset_after_ms)),
  };
}

function unavailable(cause: unknown): PostgresRateLimitStoreError {
  return new PostgresRateLimitStoreError(
    "RATE_LIMIT_STORE_UNAVAILABLE",
    "The distributed rate-limit store is unavailable.",
    { cause },
  );
}
