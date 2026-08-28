import { createHash, randomBytes } from "node:crypto";

type PostgresQueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};

export type WorkforceClaimPostgresClient = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<PostgresQueryResult<Row>>;
  release(): void;
};

export type WorkforceClaimPostgresPool = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<PostgresQueryResult<Row>>;
  connect(): Promise<WorkforceClaimPostgresClient>;
  end(): Promise<void>;
  on?(event: "error", listener: (error: Error) => void): unknown;
};

export type PostgresTaskClaimLeaseOptions = {
  connectionString?: string;
  pool?: WorkforceClaimPostgresPool;
  namespace: string;
  ttlMs: number;
  maxClaims: number;
  poolMax: number;
  statementTimeoutMs: number;
  now?: () => number;
  issueGuard?: TaskClaimIssueGuard;
};

export type TaskClaimIssueGuardDecision =
  | { allowed: true }
  | { allowed: false; code: string; reason: string };

export type TaskClaimIssueGuard = (
  client: WorkforceClaimPostgresClient,
  input: {
    planId: string;
    taskId: string;
    agentId: string;
    guardContext: unknown;
  },
) => Promise<TaskClaimIssueGuardDecision>;

type ClaimIdentity = {
  planId: string;
  taskId: string;
  agentId: string;
  fencingToken?: string;
};

type ClaimRow = {
  token_digest: string;
  token_fingerprint: string;
  plan_id: string;
  task_id: string;
  agent_id: string;
  fencing_token: string | number;
  issued_at: string | Date;
  expires_at: string | Date;
  renewal_count: string | number;
  lease_remaining_ms: string | number;
};

type PublicClaimRecord = {
  tokenFingerprint: string;
  planId: string;
  taskId: string;
  agentId: string;
  fencingToken: string;
  status: "active";
  issuedAt: string;
  expiresAt: string;
  renewalCount: number;
};

type FailedClaimResolution = {
  success: false;
  valid: false;
  code: string;
  reason: string;
  record?: PublicClaimRecord;
};

type SuccessfulResolution = {
  success: true;
  row: ClaimRow;
};

export const POSTGRES_TASK_CLAIM_TABLE = "public.ai_gateway_workforce_task_claims";
export const POSTGRES_TASK_CLAIM_LOCK_NAMESPACE = 1_431_193_303;
export const POSTGRES_TASK_CLAIM_CAPACITY_LOCK_KEY = 1_768_841_201;

const TABLE = POSTGRES_TASK_CLAIM_TABLE;
const FENCING_SEQUENCE = "public.ai_gateway_workforce_task_claim_fencing_seq";
const LOCK_NAMESPACE = POSTGRES_TASK_CLAIM_LOCK_NAMESPACE;
const CAPACITY_LOCK_KEY = POSTGRES_TASK_CLAIM_CAPACITY_LOCK_KEY;
const INITIALIZE_LOCK_KEY = 1_768_841_202;
const MIN_TTL_MS = 10;
const MAX_TTL_MS = 24 * 60 * 60_000;
const MAX_ID_LENGTH = 256;
const MAX_TOKEN_LENGTH = 512;

const INITIALIZE_SQL = `/* workforce-claim:init */
  CREATE SEQUENCE IF NOT EXISTS ${FENCING_SEQUENCE} AS bigint;
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    namespace TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    token_digest CHAR(64) NOT NULL,
    token_fingerprint CHAR(16) NOT NULL,
    fencing_token BIGINT NOT NULL DEFAULT nextval('${FENCING_SEQUENCE}'::regclass),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    renewal_count INTEGER NOT NULL DEFAULT 0 CHECK (renewal_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (namespace, plan_id, task_id),
    UNIQUE (namespace, token_digest)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_claim_expiry_idx
    ON ${TABLE} (expires_at);
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_claim_plan_idx
    ON ${TABLE} (namespace, plan_id, expires_at);
`;

const SELECT_FIELDS = `
  token_digest, token_fingerprint, plan_id, task_id, agent_id,
  fencing_token, issued_at, expires_at, renewal_count,
  GREATEST(0, EXTRACT(EPOCH FROM (expires_at - clock_timestamp())) * 1000)::bigint
    AS lease_remaining_ms
`;

export function createPostgresTaskClaimLeaseManager(
  rawOptions: PostgresTaskClaimLeaseOptions,
) {
  const options = normalizeOptions(rawOptions);
  const ownsPool = !rawOptions.pool;
  const poolPromise = rawOptions.pool
    ? Promise.resolve(rawOptions.pool)
    : loadPool(options);
  let readyPromise: Promise<WorkforceClaimPostgresPool> | null = null;
  let closed = false;
  let available = false;
  let activeClaims = 0;
  let statsUpdatedAt: number | null = null;
  const stats = {
    issued: 0,
    renewed: 0,
    released: 0,
    revoked: 0,
    expired: 0,
    rejected: 0,
  };

  void poolPromise.then((pool) => {
    pool.on?.("error", () => {
      available = false;
    });
  }).catch(() => {
    available = false;
  });
  void getReadyPool().catch(() => undefined);

  return {
    getInfo() {
      return {
        module: "postgresTaskClaimLease",
        version: "1.0.0",
        mode: "postgres-fenced",
        distributed: true,
        namespace: options.namespace,
        ttlMs: options.ttlMs,
        maxClaims: options.maxClaims,
        activeClaims,
        available,
        statsUpdatedAt,
        rawTokenRetained: false,
        timerCount: 0,
        stats: { ...stats },
      };
    },

    async checkHealth() {
      try {
        const pool = await getReadyPool();
        await refreshStats(pool);
      } catch {
        available = false;
      }
      return {
        mode: "postgres-fenced",
        distributed: true,
        available,
        activeClaims,
        maxClaims: options.maxClaims,
        statsUpdatedAt,
      };
    },

    async issue(input: ClaimIdentity & { ttlMs?: number; guardContext?: unknown }) {
      const planId = normalizeId(input?.planId, "planId");
      const taskId = normalizeId(input?.taskId, "taskId");
      const agentId = normalizeId(input?.agentId, "agentId");
      const ttlMs = boundedInteger(input?.ttlMs, options.ttlMs, MIN_TTL_MS, MAX_TTL_MS);
      const token = randomBytes(32).toString("base64url");
      const tokenDigest = digestToken(token);
      const tokenFingerprint = tokenDigest.slice(0, 16);
      let client: WorkforceClaimPostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(
          "/* workforce-claim:capacity-lock */ SELECT pg_advisory_xact_lock($1, $2)",
          [LOCK_NAMESPACE, CAPACITY_LOCK_KEY],
        );
        const expired = await client.query(`/* workforce-claim:delete-expired */
          DELETE FROM ${TABLE}
          WHERE namespace = $1 AND expires_at <= clock_timestamp()
        `, [options.namespace]);
        stats.expired += Number(expired.rowCount ?? 0);

        const existing = await client.query<ClaimRow>(`/* workforce-claim:existing */
          SELECT ${SELECT_FIELDS}
          FROM ${TABLE}
          WHERE namespace = $1 AND plan_id = $2 AND task_id = $3
          FOR UPDATE
        `, [options.namespace, planId, taskId]);
        if (existing.rows[0]) {
          await client.query("COMMIT");
          stats.rejected += 1;
          available = true;
          return failed(
            "TASK_ALREADY_CLAIMED",
            "The task already has an active fenced claim.",
            toPublicRecord(existing.rows[0]),
          );
        }

        if (options.issueGuard) {
          const guard = await options.issueGuard(client, {
            planId,
            taskId,
            agentId,
            guardContext: input.guardContext,
          });
          if (!guard.allowed) {
            await client.query("COMMIT");
            stats.rejected += 1;
            available = true;
            return failed(guard.code, guard.reason);
          }
        }

        const count = await client.query<{ count: string | number }>(`
          /* workforce-claim:count */
          SELECT COUNT(*)::bigint AS count
          FROM ${TABLE}
          WHERE namespace = $1 AND expires_at > clock_timestamp()
        `, [options.namespace]);
        if (Number(count.rows[0]?.count ?? 0) >= options.maxClaims) {
          await client.query("COMMIT");
          stats.rejected += 1;
          available = true;
          return failed(
            "TASK_CLAIM_CAPACITY",
            "The bounded distributed task claim capacity is exhausted.",
          );
        }

        const inserted = await client.query<ClaimRow>(`/* workforce-claim:insert */
          INSERT INTO ${TABLE} (
            namespace, plan_id, task_id, agent_id,
            token_digest, token_fingerprint, expires_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            clock_timestamp() + ($7 * interval '1 millisecond'),
            clock_timestamp()
          )
          RETURNING ${SELECT_FIELDS}
        `, [
          options.namespace,
          planId,
          taskId,
          agentId,
          tokenDigest,
          tokenFingerprint,
          ttlMs,
        ]);
        const row = inserted.rows[0];
        if (!row) throw new Error("The distributed claim insert returned no row.");
        await client.query("COMMIT");
        available = true;
        activeClaims = Math.min(options.maxClaims, Number(count.rows[0]?.count ?? 0) + 1);
        statsUpdatedAt = options.now();
        stats.issued += 1;
        const record = toPublicRecord(row);
        return {
          success: true as const,
          code: "TASK_CLAIM_ISSUED" as const,
          token,
          fencingToken: record.fencingToken,
          expiresAt: record.expiresAt,
          record,
        };
      } catch {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Preserve the fail-closed store-unavailable outcome.
          }
        }
        available = false;
        stats.rejected += 1;
        return storeUnavailable();
      } finally {
        client?.release();
      }
    },

    async validate(token: unknown, context: Partial<ClaimIdentity> = {}) {
      const resolved = await resolveClaim(token, context);
      if (!resolved.success) return resolved;
      return {
        success: true as const,
        valid: true as const,
        code: "TASK_CLAIM_VALID" as const,
        reason: "The distributed task claim is active and bound to this execution.",
        record: toPublicRecord(resolved.row),
      };
    },

    async renew(token: unknown, context: Partial<ClaimIdentity> = {}, extendMs?: number) {
      const resolved = await resolveClaim(token, context);
      if (!resolved.success) return resolved;
      const extension = boundedInteger(extendMs, options.ttlMs, MIN_TTL_MS, MAX_TTL_MS);
      const previousExpiresAt = toIso(resolved.row.expires_at);
      try {
        const pool = await getReadyPool();
        const updated = await pool.query<ClaimRow>(`/* workforce-claim:renew */
          UPDATE ${TABLE}
          SET expires_at = clock_timestamp() + ($1 * interval '1 millisecond'),
              renewal_count = renewal_count + 1,
              updated_at = clock_timestamp()
          WHERE namespace = $2 AND token_digest = $3
            AND fencing_token = $4::bigint
            AND expires_at > clock_timestamp()
          RETURNING ${SELECT_FIELDS}
        `, [
          extension,
          options.namespace,
          resolved.row.token_digest,
          String(resolved.row.fencing_token),
        ]);
        const row = updated.rows[0];
        if (!row) return failed("TASK_CLAIM_NOT_FOUND", "The task claim is no longer active.");
        available = true;
        stats.renewed += 1;
        const record = toPublicRecord(row);
        return {
          success: true as const,
          code: "TASK_CLAIM_RENEWED" as const,
          previousExpiresAt,
          expiresAt: record.expiresAt,
          renewalCount: record.renewalCount,
          record,
        };
      } catch {
        available = false;
        return storeUnavailable();
      }
    },

    async release(token: unknown, context: Partial<ClaimIdentity> = {}) {
      const resolved = await resolveClaim(token, context);
      if (!resolved.success) return resolved;
      const deleted = await deleteResolvedClaim(resolved.row);
      if (!deleted.success) return deleted;
      stats.released += 1;
      return {
        success: true as const,
        code: "TASK_CLAIM_RELEASED" as const,
        record: toPublicRecord(resolved.row),
      };
    },

    async revoke(token: unknown, reason = "revoked") {
      const resolved = await resolveClaim(token);
      if (!resolved.success) return resolved;
      const deleted = await deleteResolvedClaim(resolved.row);
      if (!deleted.success) return deleted;
      stats.revoked += 1;
      return {
        success: true as const,
        code: "TASK_CLAIM_REVOKED" as const,
        reason: normalizeReason(reason),
        record: toPublicRecord(resolved.row),
      };
    },

    async revokeTask(identity: Pick<ClaimIdentity, "planId" | "taskId">, reason = "revoked") {
      const planId = normalizeId(identity?.planId, "planId");
      const taskId = normalizeId(identity?.taskId, "taskId");
      try {
        const pool = await getReadyPool();
        const deleted = await pool.query<ClaimRow>(`/* workforce-claim:revoke-task */
          DELETE FROM ${TABLE}
          WHERE namespace = $1 AND plan_id = $2 AND task_id = $3
          RETURNING ${SELECT_FIELDS}
        `, [options.namespace, planId, taskId]);
        const row = deleted.rows[0];
        if (!row) return failed("TASK_CLAIM_NOT_FOUND", "The task has no active claim.");
        available = true;
        activeClaims = Math.max(0, activeClaims - 1);
        stats.revoked += 1;
        return {
          success: true as const,
          code: "TASK_CLAIM_REVOKED" as const,
          reason: normalizeReason(reason),
          record: toPublicRecord(row),
        };
      } catch {
        available = false;
        return storeUnavailable();
      }
    },

    async revokeByPlanId(planIdInput: unknown, reason = "plan revoked") {
      const planId = normalizeId(planIdInput, "planId");
      try {
        const pool = await getReadyPool();
        const deleted = await pool.query<{ token_fingerprint: string }>(`
          /* workforce-claim:revoke-plan */
          DELETE FROM ${TABLE}
          WHERE namespace = $1 AND plan_id = $2
          RETURNING token_fingerprint
        `, [options.namespace, planId]);
        const tokenFingerprints = deleted.rows.map((row) => row.token_fingerprint);
        available = true;
        activeClaims = Math.max(0, activeClaims - tokenFingerprints.length);
        stats.revoked += tokenFingerprints.length;
        return {
          success: true as const,
          code: "TASK_CLAIMS_REVOKED" as const,
          reason: normalizeReason(reason),
          planId,
          revokedCount: tokenFingerprints.length,
          tokenFingerprints,
        };
      } catch {
        available = false;
        return {
          ...storeUnavailable(),
          planId,
          revokedCount: 0,
          tokenFingerprints: [] as string[],
        };
      }
    },

    async listByPlan(planIdInput: unknown) {
      const planId = normalizeId(planIdInput, "planId");
      try {
        const pool = await getReadyPool();
        const result = await pool.query<ClaimRow>(`/* workforce-claim:list-plan */
          SELECT ${SELECT_FIELDS}
          FROM ${TABLE}
          WHERE namespace = $1 AND plan_id = $2
            AND expires_at > clock_timestamp()
          ORDER BY fencing_token ASC
          LIMIT $3
        `, [options.namespace, planId, options.maxClaims]);
        available = true;
        return {
          success: true as const,
          planId,
          count: result.rows.length,
          records: result.rows.map(toPublicRecord),
        };
      } catch {
        available = false;
        return {
          success: false as const,
          code: "TASK_CLAIM_STORE_UNAVAILABLE",
          reason: "The distributed task claim store is unavailable.",
          planId,
          count: 0,
          records: [] as PublicClaimRecord[],
        };
      }
    },

    async cleanup() {
      try {
        const pool = await getReadyPool();
        const deleted = await pool.query(`/* workforce-claim:cleanup */
          DELETE FROM ${TABLE}
          WHERE namespace = $1 AND expires_at <= clock_timestamp()
        `, [options.namespace]);
        const removedCount = Number(deleted.rowCount ?? 0);
        stats.expired += removedCount;
        await refreshStats(pool);
        return { success: true as const, removedCount, remainingCount: activeClaims };
      } catch {
        available = false;
        return {
          success: false as const,
          code: "TASK_CLAIM_STORE_UNAVAILABLE",
          removedCount: 0,
          remainingCount: activeClaims,
        };
      }
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
        // Initialization failure leaves no required shutdown work.
      }
    },
  };

  async function getReadyPool(): Promise<WorkforceClaimPostgresPool> {
    if (closed) throw new Error("The distributed task claim manager is closed.");
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        await initializePool(pool);
        available = true;
        await refreshStats(pool);
        return pool;
      });
      void readyPromise.catch(() => undefined);
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      available = false;
      throw error;
    }
  }

  async function initializePool(pool: WorkforceClaimPostgresPool) {
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query(
        "/* workforce-claim:init-lock */ SELECT pg_advisory_lock($1, $2)",
        [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
      );
      locked = true;
      await client.query(INITIALIZE_SQL);
    } finally {
      if (locked) {
        try {
          await client.query(
            "/* workforce-claim:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
            [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
          );
        } catch {
          // Session termination also releases an initialization lock.
        }
      }
      client.release();
    }
  }

  async function resolveClaim(
    token: unknown,
    context: Partial<ClaimIdentity> = {},
  ): Promise<FailedClaimResolution | SuccessfulResolution> {
    if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) {
      return failed("TASK_CLAIM_TOKEN_INVALID", "A bounded task claim token is required.");
    }
    const normalizedContext = normalizeClaimContext(context);
    try {
      const pool = await getReadyPool();
      const result = await pool.query<ClaimRow>(`/* workforce-claim:resolve */
        SELECT ${SELECT_FIELDS}
        FROM ${TABLE}
        WHERE namespace = $1 AND token_digest = $2
      `, [options.namespace, digestToken(token)]);
      const row = result.rows[0];
      if (!row) return failed("TASK_CLAIM_NOT_FOUND", "The task claim does not exist or is no longer active.");
      if (Number(row.lease_remaining_ms) <= 0) {
        await pool.query(`/* workforce-claim:expire-one */
          DELETE FROM ${TABLE}
          WHERE namespace = $1 AND token_digest = $2
            AND expires_at <= clock_timestamp()
        `, [options.namespace, row.token_digest]);
        stats.expired += 1;
        activeClaims = Math.max(0, activeClaims - 1);
        return failed(
          "TASK_CLAIM_EXPIRED",
          "The task claim expired and cannot be renewed.",
          toPublicRecord(row),
        );
      }
      const mismatch = compareContext(row, normalizedContext);
      if (mismatch) return mismatch;
      available = true;
      return { success: true, row };
    } catch {
      available = false;
      return storeUnavailable();
    }
  }

  async function deleteResolvedClaim(
    row: ClaimRow,
  ): Promise<{ success: true } | FailedClaimResolution> {
    try {
      const pool = await getReadyPool();
      const deleted = await pool.query(`/* workforce-claim:delete-resolved */
        DELETE FROM ${TABLE}
        WHERE namespace = $1 AND token_digest = $2
          AND fencing_token = $3::bigint
      `, [options.namespace, row.token_digest, String(row.fencing_token)]);
      if (Number(deleted.rowCount ?? 0) !== 1) {
        return failed("TASK_CLAIM_NOT_FOUND", "The task claim is no longer active.");
      }
      available = true;
      activeClaims = Math.max(0, activeClaims - 1);
      return { success: true };
    } catch {
      available = false;
      return storeUnavailable();
    }
  }

  async function refreshStats(pool: WorkforceClaimPostgresPool) {
    const result = await pool.query<{ count: string | number }>(`
      /* workforce-claim:stats */
      SELECT COUNT(*)::bigint AS count
      FROM ${TABLE}
      WHERE namespace = $1 AND expires_at > clock_timestamp()
    `, [options.namespace]);
    activeClaims = Number(result.rows[0]?.count ?? 0);
    available = true;
    statsUpdatedAt = options.now();
  }
}

function compareContext(
  row: ClaimRow,
  context: Partial<ClaimIdentity>,
): FailedClaimResolution | null {
  if (context.planId !== undefined && row.plan_id !== context.planId) {
    return failed("TASK_CLAIM_PLAN_MISMATCH", "The task claim is bound to a different plan.", toPublicRecord(row));
  }
  if (context.taskId !== undefined && row.task_id !== context.taskId) {
    return failed("TASK_CLAIM_TASK_MISMATCH", "The task claim is bound to a different task.", toPublicRecord(row));
  }
  if (context.agentId !== undefined && row.agent_id !== context.agentId) {
    return failed("TASK_CLAIM_AGENT_MISMATCH", "The task claim is bound to a different agent.", toPublicRecord(row));
  }
  if (context.fencingToken !== undefined && String(row.fencing_token) !== String(context.fencingToken)) {
    return failed("TASK_CLAIM_FENCE_MISMATCH", "The task claim fencing token is stale.", toPublicRecord(row));
  }
  return null;
}

function normalizeClaimContext(context: Partial<ClaimIdentity>): Partial<ClaimIdentity> {
  return {
    ...(context.planId === undefined ? {} : { planId: normalizeId(context.planId, "planId") }),
    ...(context.taskId === undefined ? {} : { taskId: normalizeId(context.taskId, "taskId") }),
    ...(context.agentId === undefined ? {} : { agentId: normalizeId(context.agentId, "agentId") }),
    ...(context.fencingToken === undefined
      ? {}
      : { fencingToken: String(context.fencingToken) }),
  };
}

function normalizeOptions(raw: PostgresTaskClaimLeaseOptions) {
  if (!raw.connectionString && !raw.pool) {
    throw new Error("AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL is required in postgres mode.");
  }
  return {
    ...raw,
    namespace: normalizeId(raw.namespace, "namespace"),
    ttlMs: boundedInteger(raw.ttlMs, 5 * 60_000, MIN_TTL_MS, MAX_TTL_MS),
    maxClaims: boundedInteger(raw.maxClaims, 2_000, 1, 1_000_000),
    poolMax: boundedInteger(raw.poolMax, 4, 1, 32),
    statementTimeoutMs: boundedInteger(raw.statementTimeoutMs, 5_000, 100, 30_000),
    now: raw.now ?? Date.now,
  };
}

async function loadPool(
  options: ReturnType<typeof normalizeOptions>,
): Promise<WorkforceClaimPostgresPool> {
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => WorkforceClaimPostgresPool;
  };
  return new module.Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    connectionTimeoutMillis: Math.min(10_000, options.statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: options.statementTimeoutMs,
    application_name: "unified-ai-system-workforce-claims",
    allowExitOnIdle: true,
  });
}

function toPublicRecord(row: ClaimRow): PublicClaimRecord {
  return {
    tokenFingerprint: row.token_fingerprint,
    planId: row.plan_id,
    taskId: row.task_id,
    agentId: row.agent_id,
    fencingToken: String(row.fencing_token),
    status: "active",
    issuedAt: toIso(row.issued_at),
    expiresAt: toIso(row.expires_at),
    renewalCount: Number(row.renewal_count),
  };
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function normalizeId(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw claimIdentityError(`${field} must be a string.`);
  }
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > MAX_ID_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw claimIdentityError(
      `${field} must be non-empty, bounded, and free of control characters.`,
    );
  }
  return normalized;
}

function claimIdentityError(message: string) {
  return Object.assign(new TypeError(message), {
    code: "TASK_CLAIM_IDENTITY_INVALID",
  });
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function digestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeReason(value: unknown): string {
  return String(value ?? "revoked").trim().slice(0, 256);
}

function failed(
  code: string,
  reason: string,
  record?: PublicClaimRecord,
): FailedClaimResolution {
  return {
    success: false,
    valid: false,
    code,
    reason,
    ...(record ? { record } : {}),
  };
}

function storeUnavailable(): FailedClaimResolution {
  return failed(
    "TASK_CLAIM_STORE_UNAVAILABLE",
    "The distributed task claim store is unavailable.",
  );
}
