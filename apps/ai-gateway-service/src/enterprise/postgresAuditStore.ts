import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { sanitizeLogValue } from "../security/logSanitizationPolicy.ts";

type QueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};

export type AuditPostgresClient = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
};

export type AuditPostgresPool = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  connect(): Promise<AuditPostgresClient>;
  end(): Promise<void>;
  on?(event: "error", listener: (error: Error) => void): unknown;
};

export type PostgresAuditStoreOptions = {
  connectionString?: string;
  pool?: AuditPostgresPool;
  namespace: string;
  hmacKey: Buffer;
  maxRows: number;
  poolMax: number;
  statementTimeoutMs: number;
  minimumSequence?: number;
  trustedHash?: string;
  now?: () => number;
};

type AuditStateRow = {
  last_sequence: string | number;
  last_hash: string;
  state_hmac: string;
};

type AuditEntryRow = {
  sequence: string | number;
  event_id: string;
  previous_hash: string;
  entry_hash: string;
  entry_hmac: string;
  event_json: unknown;
};

type NormalizedAuditEvent = {
  id: string;
  timestamp: string;
  outcome: string;
  method?: string;
  path?: string;
  permission?: string;
  statusCode?: number;
  code?: string;
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  details: unknown;
};

const ENTRY_TABLE = "public.ai_gateway_enterprise_audit_entries";
const STATE_TABLE = "public.ai_gateway_enterprise_audit_state";
const LOCK_NAMESPACE = 1_431_193_303;
const INITIALIZE_LOCK_KEY = 1_768_841_401;
const GENESIS_HASH = "GENESIS";
const MAX_EVENT_BYTES = 256 * 1024;
const VERIFY_BATCH_SIZE = 1_000;

const INITIALIZE_SQL = `/* enterprise-audit:init */
  CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
    namespace TEXT PRIMARY KEY,
    last_sequence BIGINT NOT NULL CHECK (last_sequence >= 0),
    last_hash TEXT NOT NULL,
    state_hmac CHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );
  CREATE TABLE IF NOT EXISTS ${ENTRY_TABLE} (
    namespace TEXT NOT NULL,
    sequence BIGINT NOT NULL CHECK (sequence > 0),
    event_id TEXT NOT NULL,
    previous_hash TEXT NOT NULL,
    entry_hash CHAR(64) NOT NULL,
    entry_hmac CHAR(64) NOT NULL,
    event_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (namespace, sequence),
    UNIQUE (namespace, event_id)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_enterprise_audit_tenant_sequence_idx
    ON ${ENTRY_TABLE} (namespace, ((event_json ->> 'tenantId')), sequence DESC);
`;

export function createPostgresAuditStore(rawOptions: PostgresAuditStoreOptions) {
  const options = normalizeOptions(rawOptions);
  const ownsPool = !rawOptions.pool;
  const poolPromise = rawOptions.pool
    ? Promise.resolve(rawOptions.pool)
    : loadPool(options);
  const keyId = createHash("sha256").update(options.hmacKey).digest("hex").slice(0, 16);
  let readyPromise: Promise<AuditPostgresPool> | null = null;
  let closed = false;
  let available = false;
  let lastSequence = 0;
  let lastHash = GENESIS_HASH;
  let totalFailures = 0;
  let consecutiveFailures = 0;
  let lastSuccessAt: string | null = null;
  let lastFailureAt: string | null = null;
  let lastErrorCode: string | null = null;

  void poolPromise.then((pool) => {
    pool.on?.("error", () => {
      available = false;
    });
  }).catch(() => {
    available = false;
  });
  void getReadyPool().catch(() => undefined);

  return {
    async append(eventInput: Record<string, unknown>) {
      const event = normalizeAuditEvent(eventInput);
      const encodedEvent = canonicalJson(event);
      if (Buffer.byteLength(encodedEvent, "utf8") > MAX_EVENT_BYTES) {
        throw auditStoreError(
          "AUDIT_POSTGRES_EVENT_TOO_LARGE",
          "The enterprise audit event exceeds the central store limit.",
        );
      }
      let client: AuditPostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        const stateResult = await client.query<AuditStateRow>(`
          /* enterprise-audit:state-lock */
          SELECT last_sequence, last_hash, state_hmac
          FROM ${STATE_TABLE}
          WHERE namespace = $1
          FOR UPDATE
        `, [options.namespace]);
        const state = stateResult.rows[0];
        if (!state) throw auditStoreError("AUDIT_POSTGRES_STATE_MISSING", "The central audit state is missing.");
        verifyState(state);
        await verifyTrustedFloor(client, state);

        const existing = await client.query<AuditEntryRow>(`
          /* enterprise-audit:existing */
          SELECT sequence, event_id, previous_hash, entry_hash, entry_hmac, event_json
          FROM ${ENTRY_TABLE}
          WHERE namespace = $1 AND event_id = $2
        `, [options.namespace, event.id]);
        if (existing.rows[0]) {
          const existingEvent = parseStoredEvent(existing.rows[0].event_json);
          if (canonicalJson(existingEvent) !== encodedEvent) {
            throw auditStoreError(
              "AUDIT_POSTGRES_EVENT_ID_CONFLICT",
              "An enterprise audit event ID already contains different evidence.",
            );
          }
          verifyStoredEntry(existing.rows[0]);
          await client.query("COMMIT");
          markSuccess();
          return attachIntegrity(existingEvent, existing.rows[0]);
        }

        const currentSequence = toSequence(state.last_sequence);
        if (currentSequence >= options.maxRows) {
          throw auditStoreError(
            "AUDIT_POSTGRES_CAPACITY_REACHED",
            "The append-only central audit namespace reached its configured capacity.",
          );
        }
        const sequence = currentSequence + 1;
        const previousHash = state.last_hash;
        const entryHash = hashEntry(sequence, previousHash, event);
        const entryHmac = signEntry(entryHash);
        const nextStateHmac = signState(sequence, entryHash);
        const inserted = await client.query<AuditEntryRow>(`
          /* enterprise-audit:insert */
          INSERT INTO ${ENTRY_TABLE} (
            namespace, sequence, event_id, previous_hash,
            entry_hash, entry_hmac, event_json
          ) VALUES ($1, $2::bigint, $3, $4, $5, $6, $7::jsonb)
          RETURNING sequence, event_id, previous_hash, entry_hash, entry_hmac, event_json
        `, [
          options.namespace,
          sequence,
          event.id,
          previousHash,
          entryHash,
          entryHmac,
          encodedEvent,
        ]);
        await client.query(`/* enterprise-audit:update-state */
          UPDATE ${STATE_TABLE}
          SET last_sequence = $2::bigint,
              last_hash = $3,
              state_hmac = $4,
              updated_at = clock_timestamp()
          WHERE namespace = $1
        `, [options.namespace, sequence, entryHash, nextStateHmac]);
        await client.query("COMMIT");
        const row = inserted.rows[0];
        if (!row) throw auditStoreError("AUDIT_POSTGRES_INSERT_FAILED", "The central audit insert returned no row.");
        lastSequence = sequence;
        lastHash = entryHash;
        markSuccess();
        return attachIntegrity(event, row);
      } catch (error) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Preserve the normalized audit failure.
          }
        }
        markFailure(error);
        if (isPostgresAuditStoreError(error)) throw error;
        throw auditStoreError(
          "AUDIT_POSTGRES_WRITE_FAILED",
          "The central enterprise audit event could not be committed.",
        );
      } finally {
        client?.release();
      }
    },

    async readEntries({
      limit = 200,
      tenantId,
    }: {
      limit?: number;
      tenantId?: string;
    } = {}) {
      const boundedLimit = Math.min(10_000, Math.max(1, Math.floor(Number(limit) || 200)));
      try {
        const pool = await getReadyPool();
        const values: unknown[] = [options.namespace];
        let tenantClause = "";
        if (tenantId) {
          values.push(normalizeText(tenantId, "tenantId", 256));
          tenantClause = `AND event_json ->> 'tenantId' = $${values.length}`;
        }
        values.push(boundedLimit);
        const result = await pool.query<AuditEntryRow>(`
          /* enterprise-audit:read */
          SELECT sequence, event_id, previous_hash, entry_hash, entry_hmac, event_json
          FROM ${ENTRY_TABLE}
          WHERE namespace = $1 ${tenantClause}
          ORDER BY sequence DESC
          LIMIT $${values.length}
        `, values);
        const rows = [...result.rows].reverse();
        verifyWindow(
          rows,
          tenantId ? null : await readState(pool),
          !tenantId,
        );
        available = true;
        return rows.map((row) => attachIntegrity(parseStoredEvent(row.event_json), row));
      } catch (error) {
        available = false;
        if (isPostgresAuditStoreError(error)) throw error;
        throw auditStoreError(
          "AUDIT_POSTGRES_READ_FAILED",
          "The central enterprise audit entries could not be read safely.",
        );
      }
    },

    async verify() {
      try {
        const pool = await getReadyPool();
        const state = await readState(pool);
        let expectedSequence = 1;
        let expectedPreviousHash = GENESIS_HASH;
        let verifiedEntries = 0;
        while (expectedSequence <= toSequence(state.last_sequence)) {
          const result = await pool.query<AuditEntryRow>(`
            /* enterprise-audit:verify-batch */
            SELECT sequence, event_id, previous_hash, entry_hash, entry_hmac, event_json
            FROM ${ENTRY_TABLE}
            WHERE namespace = $1 AND sequence >= $2::bigint
            ORDER BY sequence ASC
            LIMIT $3
          `, [options.namespace, expectedSequence, VERIFY_BATCH_SIZE]);
          if (result.rows.length === 0) {
            throw auditStoreError(
              "AUDIT_POSTGRES_CHAIN_GAP",
              "The central enterprise audit chain contains a sequence gap.",
            );
          }
          for (const row of result.rows) {
            const sequence = toSequence(row.sequence);
            if (sequence !== expectedSequence || row.previous_hash !== expectedPreviousHash) {
              throw auditStoreError(
                "AUDIT_POSTGRES_CHAIN_INVALID",
                "The central enterprise audit sequence or linkage is invalid.",
              );
            }
            verifyStoredEntry(row);
            expectedPreviousHash = row.entry_hash;
            expectedSequence += 1;
            verifiedEntries += 1;
          }
        }
        if (
          verifiedEntries !== toSequence(state.last_sequence)
          || expectedPreviousHash !== state.last_hash
        ) {
          throw auditStoreError(
            "AUDIT_POSTGRES_STATE_MISMATCH",
            "The central enterprise audit state does not match the verified chain.",
          );
        }
        available = true;
        return {
          valid: true,
          mode: "postgres-hmac-chain",
          distributed: true,
          verifiedEntries,
          sequence: toSequence(state.last_sequence),
          hash: state.last_hash,
          keyId,
          externalRetentionVerified: false,
        };
      } catch (error) {
        available = false;
        return {
          valid: false,
          mode: "postgres-hmac-chain",
          distributed: true,
          code: isPostgresAuditStoreError(error)
            ? error.code
            : "AUDIT_POSTGRES_VERIFY_FAILED",
          verifiedEntries: 0,
          sequence: lastSequence,
          hash: lastHash,
          keyId,
          externalRetentionVerified: false,
        };
      }
    },

    async checkHealth() {
      try {
        const pool = await getReadyPool();
        const state = await readState(pool);
        available = true;
        lastSequence = toSequence(state.last_sequence);
        lastHash = state.last_hash;
      } catch {
        available = false;
      }
      return healthSnapshot();
    },

    getHealth() {
      return healthSnapshot();
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

  function healthSnapshot() {
    return {
      status: available && consecutiveFailures === 0 ? "ready" : "degraded",
      mode: "postgres-hmac-chain",
      distributed: true,
      available,
      sequence: lastSequence,
      hash: lastHash,
      keyId,
      maxRows: options.maxRows,
      minimumSequence: options.minimumSequence,
      trustedHashConfigured: Boolean(options.trustedHash),
      externalRetentionVerified: false,
      totalFailures,
      consecutiveFailures,
      lastSuccessAt,
      lastFailureAt,
      lastErrorCode,
    };
  }

  async function getReadyPool(): Promise<AuditPostgresPool> {
    if (closed) throw auditStoreError("AUDIT_POSTGRES_CLOSED", "The central audit store is closed.");
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        const client = await pool.connect();
        let locked = false;
        try {
          await client.query(
            "/* enterprise-audit:init-lock */ SELECT pg_advisory_lock($1, $2)",
            [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
          );
          locked = true;
          await client.query(INITIALIZE_SQL);
          const existing = await client.query<{ count: string | number }>(`
            /* enterprise-audit:init-count */
            SELECT COUNT(*)::bigint AS count
            FROM ${ENTRY_TABLE}
            WHERE namespace = $1
          `, [options.namespace]);
          const eventCount = Number(existing.rows[0]?.count ?? 0);
          if (eventCount === 0) {
            await client.query(`/* enterprise-audit:init-state */
              INSERT INTO ${STATE_TABLE} (
                namespace, last_sequence, last_hash, state_hmac, updated_at
              ) VALUES ($1, 0, $2, $3, clock_timestamp())
              ON CONFLICT (namespace) DO NOTHING
            `, [options.namespace, GENESIS_HASH, signState(0, GENESIS_HASH)]);
          }
        } finally {
          if (locked) {
            try {
              await client.query(
                "/* enterprise-audit:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
                [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
              );
            } catch {
              // Session termination releases the initialization lock.
            }
          }
          client.release();
        }
        const state = await readState(pool);
        lastSequence = toSequence(state.last_sequence);
        lastHash = state.last_hash;
        available = true;
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

  async function readState(pool: AuditPostgresPool): Promise<AuditStateRow> {
    const result = await pool.query<AuditStateRow>(`
      /* enterprise-audit:state */
      SELECT last_sequence, last_hash, state_hmac
      FROM ${STATE_TABLE}
      WHERE namespace = $1
    `, [options.namespace]);
    const state = result.rows[0];
    if (!state) {
      throw auditStoreError(
        "AUDIT_POSTGRES_STATE_MISSING",
        "The central audit state is missing for this namespace.",
      );
    }
    verifyState(state);
    await verifyTrustedFloor(pool, state);
    return state;
  }

  async function verifyTrustedFloor(
    queryable: Pick<AuditPostgresPool, "query">,
    state: AuditStateRow,
  ) {
    if (!options.trustedHash || options.minimumSequence <= 0) return;
    if (toSequence(state.last_sequence) < options.minimumSequence) return;
    const result = await queryable.query<{ entry_hash: string }>(`
      /* enterprise-audit:trusted-floor */
      SELECT entry_hash
      FROM ${ENTRY_TABLE}
      WHERE namespace = $1 AND sequence = $2::bigint
    `, [options.namespace, options.minimumSequence]);
    if (result.rows[0]?.entry_hash !== options.trustedHash) {
      throw auditStoreError(
        "AUDIT_POSTGRES_TRUSTED_HASH_MISMATCH",
        "The central audit chain does not contain the externally trusted floor.",
      );
    }
  }

  function verifyState(state: AuditStateRow) {
    const sequence = toSequence(state.last_sequence);
    if (!isHashOrGenesis(state.last_hash)) {
      throw auditStoreError("AUDIT_POSTGRES_STATE_INVALID", "The central audit state hash is invalid.");
    }
    const expected = signState(sequence, state.last_hash);
    if (!safeHexEqual(expected, state.state_hmac)) {
      throw auditStoreError("AUDIT_POSTGRES_STATE_HMAC_INVALID", "The central audit state HMAC is invalid.");
    }
    if (sequence < options.minimumSequence) {
      throw auditStoreError(
        "AUDIT_POSTGRES_ROLLBACK_DETECTED",
        "The central audit sequence is below the externally trusted floor.",
      );
    }
    if (
      options.trustedHash
      && sequence === options.minimumSequence
      && state.last_hash !== options.trustedHash
    ) {
      throw auditStoreError(
        "AUDIT_POSTGRES_TRUSTED_HASH_MISMATCH",
        "The central audit hash does not match the externally trusted floor.",
      );
    }
  }

  function verifyWindow(
    rows: AuditEntryRow[],
    state: AuditStateRow | null,
    requireContiguous: boolean,
  ) {
    let previous: AuditEntryRow | null = null;
    for (const row of rows) {
      verifyStoredEntry(row);
      if (
        requireContiguous
        && previous
        && (
          toSequence(row.sequence) !== toSequence(previous.sequence) + 1
          || row.previous_hash !== previous.entry_hash
        )
      ) {
        throw auditStoreError(
          "AUDIT_POSTGRES_CHAIN_INVALID",
          "The selected central audit window is not contiguous.",
        );
      }
      previous = row;
    }
    if (state && previous) {
      if (
        toSequence(previous.sequence) !== toSequence(state.last_sequence)
        || previous.entry_hash !== state.last_hash
      ) {
        throw auditStoreError(
          "AUDIT_POSTGRES_TAIL_MISMATCH",
          "The selected central audit tail does not match signed state.",
        );
      }
    }
  }

  function verifyStoredEntry(row: AuditEntryRow) {
    const sequence = toSequence(row.sequence);
    const event = parseStoredEvent(row.event_json);
    if (event.id !== row.event_id || !isHashOrGenesis(row.previous_hash)) {
      throw auditStoreError("AUDIT_POSTGRES_ENTRY_INVALID", "A central audit row is malformed.");
    }
    const expectedHash = hashEntry(sequence, row.previous_hash, event);
    if (expectedHash !== row.entry_hash || !safeHexEqual(signEntry(expectedHash), row.entry_hmac)) {
      throw auditStoreError(
        "AUDIT_POSTGRES_ENTRY_HMAC_INVALID",
        "A central audit row failed hash or HMAC verification.",
      );
    }
  }

  function hashEntry(sequence: number, previousHash: string, event: NormalizedAuditEvent) {
    return createHash("sha256")
      .update(canonicalJson({
        domain: "unified-ai-enterprise-audit:v1",
        namespace: options.namespace,
        sequence,
        previousHash,
        event,
      }))
      .digest("hex");
  }

  function signEntry(entryHash: string) {
    return createHmac("sha256", options.hmacKey)
      .update(`enterprise-audit-entry:v1:${options.namespace}:${entryHash}`)
      .digest("hex");
  }

  function signState(sequence: number, hash: string) {
    return createHmac("sha256", options.hmacKey)
      .update(`enterprise-audit-state:v1:${options.namespace}:${sequence}:${hash}`)
      .digest("hex");
  }

  function markSuccess() {
    available = true;
    consecutiveFailures = 0;
    lastSuccessAt = new Date(options.now()).toISOString();
    lastErrorCode = null;
  }

  function markFailure(error: unknown) {
    available = false;
    totalFailures += 1;
    consecutiveFailures += 1;
    lastFailureAt = new Date(options.now()).toISOString();
    lastErrorCode = isPostgresAuditStoreError(error)
      ? error.code
      : "AUDIT_POSTGRES_WRITE_FAILED";
  }
}

function normalizeOptions(raw: PostgresAuditStoreOptions) {
  if (!raw.connectionString && !raw.pool) {
    throw auditStoreError(
      "AUDIT_POSTGRES_URL_REQUIRED",
      "The central audit store requires a PostgreSQL URL or injected pool.",
    );
  }
  if (!Buffer.isBuffer(raw.hmacKey) || raw.hmacKey.length !== 32) {
    throw auditStoreError(
      "AUDIT_POSTGRES_HMAC_KEY_INVALID",
      "The central audit HMAC key must be exactly 32 bytes.",
    );
  }
  const minimumSequence = normalizeSequence(raw.minimumSequence ?? 0);
  const trustedHash = raw.trustedHash
    ? String(raw.trustedHash).trim().toLowerCase()
    : undefined;
  if (trustedHash && !/^[a-f0-9]{64}$/u.test(trustedHash)) {
    throw auditStoreError(
      "AUDIT_POSTGRES_TRUSTED_HASH_INVALID",
      "The central audit trusted hash must be 64 lowercase hexadecimal characters.",
    );
  }
  if (trustedHash && minimumSequence === 0) {
    throw auditStoreError(
      "AUDIT_POSTGRES_TRUSTED_HASH_WITHOUT_FLOOR",
      "A central audit trusted hash requires a positive minimum sequence.",
    );
  }
  return {
    ...raw,
    namespace: normalizeIdentifier(raw.namespace, "namespace", 128),
    hmacKey: Buffer.from(raw.hmacKey),
    maxRows: boundedInteger(raw.maxRows, 10_000_000, 1, 1_000_000_000),
    poolMax: boundedInteger(raw.poolMax, 4, 1, 32),
    statementTimeoutMs: boundedInteger(raw.statementTimeoutMs, 5_000, 100, 30_000),
    minimumSequence,
    trustedHash,
    now: raw.now ?? Date.now,
  };
}

async function loadPool(
  options: ReturnType<typeof normalizeOptions>,
): Promise<AuditPostgresPool> {
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => AuditPostgresPool;
  };
  return new module.Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    connectionTimeoutMillis: Math.min(10_000, options.statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: options.statementTimeoutMs,
    application_name: "unified-ai-system-enterprise-audit",
    allowExitOnIdle: true,
  });
}

function normalizeAuditEvent(input: Record<string, unknown>): NormalizedAuditEvent {
  let timestamp: string;
  try {
    timestamp = new Date(String(input.timestamp ?? "")).toISOString();
  } catch {
    throw auditStoreError(
      "AUDIT_POSTGRES_TIMESTAMP_INVALID",
      "The central audit event timestamp is invalid.",
    );
  }
  return {
    id: normalizeText(input.id, "event id", 256),
    timestamp,
    outcome: normalizeText(input.outcome ?? "unknown", "outcome", 64),
    ...(input.method ? { method: normalizeText(input.method, "method", 32) } : {}),
    ...(input.path ? { path: normalizeText(input.path, "path", 2_048) } : {}),
    ...(input.permission
      ? { permission: normalizeText(input.permission, "permission", 128) }
      : {}),
    ...(input.statusCode === undefined
      ? {}
      : { statusCode: normalizeStatusCode(input.statusCode) }),
    ...(input.code ? { code: normalizeText(input.code, "code", 256) } : {}),
    userId: nullableText(input.userId, 256),
    tenantId: nullableText(input.tenantId, 256),
    role: nullableText(input.role, 128),
    details: sanitizeLogValue(input.details ?? {}),
  };
}

function parseStoredEvent(value: unknown): NormalizedAuditEvent {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw auditStoreError("AUDIT_POSTGRES_EVENT_INVALID", "A stored central audit event is invalid.");
  }
  return normalizeAuditEvent(parsed as Record<string, unknown>);
}

function attachIntegrity(event: NormalizedAuditEvent, row: AuditEntryRow) {
  return {
    ...event,
    distributedIntegrity: {
      mode: "postgres-hmac-chain",
      sequence: toSequence(row.sequence),
      hash: row.entry_hash,
      previousHash: row.previous_hash,
      hmac: row.entry_hmac,
      externalRetentionVerified: false,
    },
  };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw auditStoreError("AUDIT_POSTGRES_EVENT_INVALID", "Audit numbers must be finite.");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return String(value ?? "");
}

function safeHexEqual(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(expected) || !/^[a-f0-9]{64}$/u.test(String(actual))) return false;
  const expectedBytes = Buffer.from(expected, "hex");
  const actualBytes = Buffer.from(actual, "hex");
  return timingSafeEqual(expectedBytes, actualBytes);
}

function isHashOrGenesis(value: unknown): value is string {
  return value === GENESIS_HASH || /^[a-f0-9]{64}$/u.test(String(value));
}

function toSequence(value: string | number): number {
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw auditStoreError("AUDIT_POSTGRES_SEQUENCE_INVALID", "The central audit sequence is invalid.");
  }
  return sequence;
}

function normalizeSequence(value: unknown): number {
  const sequence = Number(value);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw auditStoreError("AUDIT_POSTGRES_FLOOR_INVALID", "The central audit minimum sequence is invalid.");
  }
  return sequence;
}

function normalizeIdentifier(value: unknown, field: string, maxLength: number): string {
  const normalized = normalizeText(value, field, maxLength);
  if (!/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw auditStoreError("AUDIT_POSTGRES_IDENTIFIER_INVALID", `The central audit ${field} is invalid.`);
  }
  return normalized;
}

function normalizeText(value: unknown, field: string, maxLength: number): string {
  const normalized = String(value ?? "").trim();
  if (
    !normalized
    || normalized.length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw auditStoreError("AUDIT_POSTGRES_TEXT_INVALID", `The central audit ${field} is invalid.`);
  }
  return normalized;
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return normalizeText(value, "identity field", maxLength);
}

function normalizeStatusCode(value: unknown): number {
  const statusCode = Number(value);
  if (!Number.isSafeInteger(statusCode) || statusCode < 100 || statusCode > 599) {
    throw auditStoreError("AUDIT_POSTGRES_STATUS_INVALID", "The central audit status code is invalid.");
  }
  return statusCode;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function auditStoreError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    category: "audit" as const,
    retryable: true,
  });
}

function isPostgresAuditStoreError(
  error: unknown,
): error is Error & { code: string; category: "audit" } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "audit"
    && typeof candidate.code === "string"
    && candidate.code.startsWith("AUDIT_POSTGRES_");
}
