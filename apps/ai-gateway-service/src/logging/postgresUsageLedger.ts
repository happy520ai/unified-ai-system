import { createHash, randomUUID } from "node:crypto";
import {
  sanitizeLogText,
  sanitizeLogValue,
} from "../security/logSanitizationPolicy.ts";
import type {
  RequestLogEntry,
  RequestLogQuery,
  RequestLogRecord,
  RequestLogStats,
} from "./requestLogger.ts";

type QueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};

export type UsageLedgerPostgresClient = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
};

export type UsageLedgerPostgresPool = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  connect(): Promise<UsageLedgerPostgresClient>;
  end(): Promise<void>;
  on?(event: "error", listener: (error: Error) => void): unknown;
};

export type PostgresUsageLedgerOptions = {
  connectionString?: string;
  pool?: UsageLedgerPostgresPool;
  namespace: string;
  maxRows: number;
  retentionDays: number;
  poolMax: number;
  statementTimeoutMs: number;
  now?: () => number;
};

type UsageRow = {
  id: string;
  event_timestamp_ms: string | number;
  usage_attempt_id: string | null;
  usage_event_type: string | null;
  tenant_id: string;
  agent_id: string | null;
  agent_run_id: string | null;
  agent_policy_hash: string | null;
  method: string | null;
  path: string | null;
  status_code: string | number | null;
  latency_ms: string | number | null;
  provider: string | null;
  model: string | null;
  input_tokens: string | number;
  output_tokens: string | number;
  total_tokens: string | number;
  estimated_cost_usd: string | number;
  cost_source: string | null;
  cost_estimate_available: boolean;
  cache_hit: boolean;
  fallback_used: boolean;
  fallback_from: string | null;
  shadow: boolean;
  provider_call_attempted: boolean;
  billable: boolean;
  error_text: string | null;
  trace_id: string | null;
};

type NormalizedRecord = RequestLogRecord & {
  recordKey: string;
  recordFingerprint: string;
};

const TABLE = "public.ai_gateway_usage_ledger";
const COUNT_TABLE = "public.ai_gateway_usage_ledger_namespaces";
const LOCK_NAMESPACE = 1_431_193_303;
const CAPACITY_LOCK_KEY = 1_768_841_301;
const INITIALIZE_LOCK_KEY = 1_768_841_302;
const MAX_QUERY_RECORDS = 10_000;
const MAX_STATS_SCAN_RECORDS = MAX_QUERY_RECORDS + 1;

const INITIALIZE_SQL = `/* usage-ledger:init */
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    namespace TEXT NOT NULL,
    id UUID NOT NULL,
    record_key CHAR(64) NOT NULL,
    record_fingerprint CHAR(64) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    usage_attempt_id TEXT,
    usage_event_type TEXT CHECK (
      usage_event_type IS NULL OR
      usage_event_type IN ('attempt-started', 'attempt-completed', 'attempt-failed')
    ),
    tenant_id TEXT NOT NULL,
    agent_id TEXT,
    agent_run_id TEXT,
    agent_policy_hash VARCHAR(71),
    method TEXT,
    path TEXT,
    status_code INTEGER,
    latency_ms DOUBLE PRECISION,
    provider TEXT,
    model TEXT,
    input_tokens BIGINT NOT NULL,
    output_tokens BIGINT NOT NULL,
    total_tokens BIGINT NOT NULL,
    estimated_cost_usd NUMERIC(20, 10) NOT NULL,
    cost_source TEXT,
    cost_estimate_available BOOLEAN NOT NULL,
    cache_hit BOOLEAN NOT NULL,
    fallback_used BOOLEAN NOT NULL,
    fallback_from TEXT,
    shadow BOOLEAN NOT NULL,
    provider_call_attempted BOOLEAN NOT NULL,
    billable BOOLEAN NOT NULL,
    error_text TEXT,
    trace_id TEXT,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (namespace, id),
    UNIQUE (namespace, record_key)
  );
  ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS agent_id TEXT;
  ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS agent_run_id TEXT;
  ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS agent_policy_hash VARCHAR(71);
  ALTER TABLE ${TABLE} ALTER COLUMN agent_policy_hash TYPE VARCHAR(71);
  CREATE INDEX IF NOT EXISTS ai_gateway_usage_tenant_time_idx
    ON ${TABLE} (namespace, tenant_id, event_timestamp DESC, id DESC);
  CREATE INDEX IF NOT EXISTS ai_gateway_usage_attempt_idx
    ON ${TABLE} (namespace, usage_attempt_id)
    WHERE usage_attempt_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS ai_gateway_usage_agent_time_idx
    ON ${TABLE} (namespace, tenant_id, agent_id, event_timestamp DESC, id DESC)
    WHERE agent_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS ai_gateway_usage_retention_idx
    ON ${TABLE} (ingested_at);
  CREATE TABLE IF NOT EXISTS ${COUNT_TABLE} (
    namespace TEXT PRIMARY KEY,
    row_count BIGINT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );
  INSERT INTO ${COUNT_TABLE} (namespace, row_count, updated_at)
  SELECT namespace, COUNT(*)::bigint, clock_timestamp()
  FROM ${TABLE}
  GROUP BY namespace
  ON CONFLICT (namespace) DO NOTHING;
`;

const SELECT_FIELDS = `
  id,
  floor(EXTRACT(EPOCH FROM event_timestamp) * 1000)::bigint AS event_timestamp_ms,
  usage_attempt_id, usage_event_type, tenant_id, agent_id, agent_run_id,
  agent_policy_hash, method, path, status_code,
  latency_ms, provider, model, input_tokens, output_tokens, total_tokens,
  estimated_cost_usd, cost_source, cost_estimate_available, cache_hit,
  fallback_used, fallback_from, shadow, provider_call_attempted, billable,
  error_text, trace_id
`;

export function createPostgresUsageLedger(rawOptions: PostgresUsageLedgerOptions) {
  const options = normalizeOptions(rawOptions);
  const ownsPool = !rawOptions.pool;
  const poolPromise = rawOptions.pool
    ? Promise.resolve(rawOptions.pool)
    : loadPool(options);
  let readyPromise: Promise<UsageLedgerPostgresPool> | null = null;
  let closed = false;
  let available = false;
  let rowCount = 0;
  let totalWriteFailures = 0;
  let consecutiveWriteFailures = 0;
  let lastWriteSuccessAt: string | null = null;
  let lastWriteFailureAt: string | null = null;
  let lastWriteErrorCode: string | null = null;
  let statsUpdatedAt: number | null = null;

  void poolPromise.then((pool) => {
    pool.on?.("error", () => {
      available = false;
    });
  }).catch(() => {
    available = false;
  });
  void getReadyPool().catch(() => undefined);

  return {
    async log(entry: RequestLogEntry = {}) {
      const record = normalizeRecord(entry, options.namespace, options.now());
      let client: UsageLedgerPostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(
          "/* usage-ledger:capacity-lock */ SELECT pg_advisory_xact_lock($1, $2)",
          [LOCK_NAMESPACE, CAPACITY_LOCK_KEY],
        );
        const retained = await client.query(`/* usage-ledger:retention */
          DELETE FROM ${TABLE}
          WHERE namespace = $1
            AND ingested_at < clock_timestamp() - ($2 * interval '1 day')
        `, [options.namespace, options.retentionDays]);
        await client.query(`/* usage-ledger:counter-init */
          INSERT INTO ${COUNT_TABLE} (namespace, row_count, updated_at)
          VALUES ($1, 0, clock_timestamp())
          ON CONFLICT (namespace) DO NOTHING
        `, [options.namespace]);
        if (Number(retained.rowCount ?? 0) > 0) {
          await client.query(`/* usage-ledger:counter-retention */
            UPDATE ${COUNT_TABLE}
            SET row_count = GREATEST(0, row_count - $2::bigint),
                updated_at = clock_timestamp()
            WHERE namespace = $1
          `, [options.namespace, Number(retained.rowCount)]);
        }

        const existing = await client.query<{
          record_fingerprint: string;
          usage_event_type: string | null;
        }>(`/* usage-ledger:existing */
          SELECT record_fingerprint, usage_event_type
          FROM ${TABLE}
          WHERE namespace = $1 AND record_key = $2
          FOR UPDATE
        `, [options.namespace, record.recordKey]);
        if (existing.rows[0]) {
          if (
            existing.rows[0].record_fingerprint !== record.recordFingerprint
            || existing.rows[0].usage_event_type !== (record.usageEventType ?? null)
          ) {
            throw usageLedgerError(
              "USAGE_LEDGER_CONFLICT",
              "A usage attempt already has a different terminal or reservation record.",
            );
          }
          await client.query("COMMIT");
          markWriteSuccess();
          return true;
        }

        const count = await client.query<{ row_count: string | number }>(`
          /* usage-ledger:count */
          SELECT row_count FROM ${COUNT_TABLE}
          WHERE namespace = $1
          FOR UPDATE
        `, [options.namespace]);
        const currentRowCount = Number(count.rows[0]?.row_count ?? 0);
        if (currentRowCount >= options.maxRows) {
          throw usageLedgerError(
            "USAGE_LEDGER_CAPACITY_REACHED",
            "The bounded central usage ledger is at capacity.",
          );
        }

        await client.query(`/* usage-ledger:insert */
          INSERT INTO ${TABLE} (
            namespace, id, record_key, record_fingerprint, event_timestamp,
            usage_attempt_id, usage_event_type, tenant_id, agent_id,
            agent_run_id, agent_policy_hash, method, path, status_code,
            latency_ms, provider, model, input_tokens,
            output_tokens, total_tokens, estimated_cost_usd, cost_source,
            cost_estimate_available, cache_hit, fallback_used, fallback_from,
            shadow, provider_call_attempted, billable, error_text, trace_id
          ) VALUES (
            $1, $2::uuid, $3, $4, to_timestamp($5::double precision / 1000),
            $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18::bigint, $19::bigint, $20::bigint, $21::numeric, $22, $23,
            $24, $25, $26, $27, $28, $29, $30, $31
          )
        `, recordToValues(options.namespace, record));
        await client.query(`/* usage-ledger:counter-increment */
          UPDATE ${COUNT_TABLE}
          SET row_count = row_count + 1, updated_at = clock_timestamp()
          WHERE namespace = $1
        `, [options.namespace]);
        await client.query("COMMIT");
        rowCount = currentRowCount + 1;
        statsUpdatedAt = options.now();
        markWriteSuccess();
        return true;
      } catch (error) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Preserve the normalized billing error.
          }
        }
        markWriteFailure(error);
        if (isUsageLedgerError(error)) throw error;
        throw usageLedgerError(
          "USAGE_LEDGER_WRITE_FAILED",
          "The central usage ledger could not commit the record.",
        );
      } finally {
        client?.release();
      }
    },

    async flush() {
      await assertDurable();
      return true;
    },

    assertDurable,

    async query(filter: RequestLogQuery = {}): Promise<RequestLogRecord[]> {
      try {
        const pool = await getReadyPool();
        const clauses = ["namespace = $1"];
        const values: unknown[] = [options.namespace];
        const add = (clause: string, value: unknown) => {
          values.push(value);
          clauses.push(clause.replace("?", `$${values.length}`));
        };
        if (filter.tenantId) add("tenant_id = ?", boundedText(filter.tenantId, 256));
        if (filter.agentId) add("agent_id = ?", boundedAgentId(filter.agentId));
        if (filter.agentRunId) add("agent_run_id = ?", boundedAgentRunId(filter.agentRunId));
        if (filter.since) add("event_timestamp >= to_timestamp(?::double precision / 1000)", filter.since);
        if (filter.until) add("event_timestamp <= to_timestamp(?::double precision / 1000)", filter.until);
        if (filter.provider) add("provider = ?", boundedText(filter.provider, 256));
        if (filter.model) add("model = ?", boundedText(filter.model, 256));
        if (filter.statusCode) add("status_code = ?", filter.statusCode);
        if (filter.minLatency) add("latency_ms >= ?", filter.minLatency);
        if (filter.maxLatency) add("latency_ms <= ?", filter.maxLatency);
        if (filter.cacheHit !== undefined) add("cache_hit = ?", filter.cacheHit);
        const limit = clampInteger(filter.limit, 100, 1, MAX_STATS_SCAN_RECORDS);
        const offset = clampInteger(filter.offset, 0, 0, MAX_QUERY_RECORDS);
        values.push(limit, offset);
        const result = await pool.query<UsageRow>(`/* usage-ledger:query */
          SELECT ${SELECT_FIELDS}
          FROM ${TABLE}
          WHERE ${clauses.join(" AND ")}
          ORDER BY event_timestamp DESC, id DESC
          LIMIT $${values.length - 1} OFFSET $${values.length}
        `, values);
        available = true;
        return result.rows.map(rowToRecord);
      } catch (error) {
        available = false;
        if (isUsageLedgerError(error)) throw error;
        throw usageLedgerError(
          "USAGE_LEDGER_UNAVAILABLE",
          "The central usage ledger query is unavailable.",
        );
      }
    },

    async getStats(filter: RequestLogQuery = {}): Promise<RequestLogStats> {
      const scanned = await this.query({ ...filter, limit: MAX_STATS_SCAN_RECORDS, offset: 0 });
      const truncated = scanned.length > MAX_QUERY_RECORDS;
      const records = scanned.slice(0, MAX_QUERY_RECORDS);
      return calculateStats(records, {
        partial: truncated,
        truncated,
        recordsConsidered: records.length,
        recordLimit: MAX_QUERY_RECORDS,
        scope: "retained-postgres-window",
      });
    },

    getHealth() {
      return {
        status: available && consecutiveWriteFailures === 0 ? "ready" : "degraded",
        persistence: "postgres-central",
        storeMode: "postgres",
        distributed: true,
        available,
        durableWritesRequired: true,
        rowCount,
        maxRows: options.maxRows,
        retentionDays: options.retentionDays,
        bufferSize: 0,
        bodyLoggingEnabled: false,
        identityLoggingEnabled: false,
        totalWriteFailures,
        consecutiveWriteFailures,
        lastWriteSuccessAt,
        lastWriteFailureAt,
        lastWriteErrorCode,
        statsUpdatedAt,
      };
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

  async function assertDurable() {
    try {
      const pool = await getReadyPool();
      await pool.query("/* usage-ledger:health */ SELECT 1 AS healthy");
      available = true;
      return true;
    } catch {
      available = false;
      throw usageLedgerError(
        "USAGE_LEDGER_UNAVAILABLE",
        "The central usage ledger is unavailable.",
      );
    }
  }

  async function getReadyPool(): Promise<UsageLedgerPostgresPool> {
    if (closed) throw new Error("The central usage ledger is closed.");
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        const client = await pool.connect();
        let locked = false;
        try {
          await client.query(
            "/* usage-ledger:init-lock */ SELECT pg_advisory_lock($1, $2)",
            [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
          );
          locked = true;
          await client.query(INITIALIZE_SQL);
        } finally {
          if (locked) {
            try {
              await client.query(
                "/* usage-ledger:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
                [LOCK_NAMESPACE, INITIALIZE_LOCK_KEY],
              );
            } catch {
              // Session termination releases the initialization lock.
            }
          }
          client.release();
        }
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

  async function refreshStats(pool: UsageLedgerPostgresPool) {
    const result = await pool.query<{ row_count: string | number }>(`
      /* usage-ledger:stats */
      SELECT row_count FROM ${COUNT_TABLE} WHERE namespace = $1
    `, [options.namespace]);
    rowCount = Number(result.rows[0]?.row_count ?? 0);
    statsUpdatedAt = options.now();
    available = true;
  }

  function markWriteSuccess() {
    available = true;
    consecutiveWriteFailures = 0;
    lastWriteSuccessAt = new Date(options.now()).toISOString();
    lastWriteErrorCode = null;
  }

  function markWriteFailure(error: unknown) {
    available = false;
    totalWriteFailures += 1;
    consecutiveWriteFailures += 1;
    lastWriteFailureAt = new Date(options.now()).toISOString();
    lastWriteErrorCode = isUsageLedgerError(error)
      ? error.code
      : "USAGE_LEDGER_WRITE_FAILED";
  }
}

function normalizeRecord(
  entry: RequestLogEntry,
  namespace: string,
  timestamp: number,
): NormalizedRecord {
  const usageAttemptId = optionalText(entry.usageAttemptId, 256);
  const usageEventType = normalizeEventType(entry.usageEventType);
  const lifecyclePhase = usageEventType === "attempt-started"
    ? "start"
    : usageEventType
      ? "terminal"
      : `standalone:${randomUUID()}`;
  const semantic = sanitizeLogValue({
    usageAttemptId,
    usageEventType,
    tenantId: sanitizeLogText(entry.tenantId ?? "default", 256),
    agentId: optionalAgentId(entry.agentId),
    agentRunId: optionalAgentRunId(entry.agentRunId),
    agentPolicyHash: optionalDigest(entry.agentPolicyHash),
    method: optionalText(entry.method, 16),
    path: optionalText(entry.path, 2048),
    statusCode: finiteNumber(entry.statusCode),
    latencyMs: finiteNumber(entry.latencyMs),
    provider: optionalText(entry.provider, 256),
    model: optionalText(entry.model, 256),
    inputTokens: nonNegativeInteger(entry.inputTokens),
    outputTokens: nonNegativeInteger(entry.outputTokens),
    totalTokens: nonNegativeInteger(entry.totalTokens),
    estimatedCostUsd: nonNegativeNumber(entry.estimatedCostUsd),
    costSource: optionalText(entry.costSource, 64),
    costEstimateAvailable: entry.costEstimateAvailable !== false,
    cacheHit: entry.cacheHit === true,
    fallbackUsed: entry.fallbackUsed === true,
    fallbackFrom: optionalText(entry.fallbackFrom, 256),
    shadow: entry.shadow === true,
    providerCallAttempted: entry.providerCallAttempted === true,
    billable: entry.billable === true,
    error: entry.error ? sanitizeLogText(entry.error, 2_048) : undefined,
    traceId: optionalText(entry.traceId, 256),
  }) as Omit<RequestLogRecord, "id" | "timestamp">;
  if (usageEventType && !usageAttemptId) {
    throw usageLedgerError(
      "USAGE_LEDGER_ATTEMPT_ID_REQUIRED",
      "Usage lifecycle records require a bounded attempt ID.",
    );
  }
  const recordKey = createHash("sha256")
    .update(`${namespace}:${usageAttemptId ?? lifecyclePhase}:${lifecyclePhase}`)
    .digest("hex");
  const recordFingerprint = createHash("sha256")
    .update(JSON.stringify(semantic))
    .digest("hex");
  return {
    id: randomUUID(),
    timestamp,
    ...semantic,
    recordKey,
    recordFingerprint,
  } as NormalizedRecord;
}

function recordToValues(namespace: string, record: NormalizedRecord): unknown[] {
  return [
    namespace,
    record.id,
    record.recordKey,
    record.recordFingerprint,
    record.timestamp,
    record.usageAttemptId ?? null,
    record.usageEventType ?? null,
    record.tenantId,
    record.agentId ?? null,
    record.agentRunId ?? null,
    record.agentPolicyHash ?? null,
    record.method ?? null,
    record.path ?? null,
    record.statusCode ?? null,
    record.latencyMs ?? null,
    record.provider ?? null,
    record.model ?? null,
    record.inputTokens,
    record.outputTokens,
    record.totalTokens,
    record.estimatedCostUsd,
    record.costSource ?? null,
    record.costEstimateAvailable,
    record.cacheHit,
    record.fallbackUsed,
    record.fallbackFrom ?? null,
    record.shadow,
    record.providerCallAttempted,
    record.billable,
    record.error ?? null,
    record.traceId ?? null,
  ];
}

function rowToRecord(row: UsageRow): RequestLogRecord {
  return {
    id: row.id,
    timestamp: Number(row.event_timestamp_ms),
    usageAttemptId: row.usage_attempt_id ?? undefined,
    usageEventType: normalizeEventType(row.usage_event_type),
    tenantId: row.tenant_id,
    agentId: row.agent_id ?? undefined,
    agentRunId: row.agent_run_id ?? undefined,
    agentPolicyHash: row.agent_policy_hash ?? undefined,
    method: row.method ?? undefined,
    path: row.path ?? undefined,
    statusCode: nullableNumber(row.status_code),
    latencyMs: nullableNumber(row.latency_ms),
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
    totalTokens: Number(row.total_tokens),
    estimatedCostUsd: Number(row.estimated_cost_usd),
    costSource: row.cost_source ?? undefined,
    costEstimateAvailable: row.cost_estimate_available,
    cacheHit: row.cache_hit,
    fallbackUsed: row.fallback_used,
    fallbackFrom: row.fallback_from ?? undefined,
    shadow: row.shadow,
    providerCallAttempted: row.provider_call_attempted,
    billable: row.billable,
    error: row.error_text ?? undefined,
    traceId: row.trace_id ?? undefined,
  };
}

function calculateStats(
  records: RequestLogRecord[],
  completeness: Pick<RequestLogStats, "partial" | "truncated" | "recordsConsidered" | "recordLimit" | "scope">,
): RequestLogStats {
  const terminalRecords = records.filter((record) => record.usageEventType !== "attempt-started");
  const terminalAttemptIds = new Set(
    terminalRecords.map((record) => record.usageAttemptId).filter(Boolean),
  );
  const unresolvedBillableAttempts = records.filter((record) => (
    record.usageEventType === "attempt-started"
    && record.usageAttemptId
    && !terminalAttemptIds.has(record.usageAttemptId)
  )).length;
  if (terminalRecords.length === 0) {
    return {
      totalRequests: 0,
      avgLatencyMs: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      unknownCostRecords: unresolvedBillableAttempts,
      unresolvedBillableAttempts,
      errorRate: 0,
      cacheHitRate: 0,
      fallbackRate: 0,
      byProvider: {},
      byModel: {},
      byAgent: {},
      ...completeness,
    };
  }
  const totalRequests = terminalRecords.length;
  const totalLatency = terminalRecords.reduce((sum, record) => sum + (record.latencyMs ?? 0), 0);
  const totalTokens = terminalRecords.reduce((sum, record) => sum + record.totalTokens, 0);
  const totalCost = terminalRecords.reduce((sum, record) => sum + record.estimatedCostUsd, 0);
  const unknownCostRecords = terminalRecords.filter(
    (record) => record.costEstimateAvailable === false,
  ).length + unresolvedBillableAttempts;
  const errorCount = terminalRecords.filter((record) => (record.statusCode ?? 0) >= 400).length;
  const cacheHits = terminalRecords.filter((record) => record.cacheHit).length;
  const fallbacks = terminalRecords.filter((record) => record.fallbackUsed).length;
  const byProvider: RequestLogStats["byProvider"] = {};
  const byModel: RequestLogStats["byModel"] = {};
  const byAgent: NonNullable<RequestLogStats["byAgent"]> = {};
  for (const record of terminalRecords) {
    const provider = record.provider || "unknown";
    byProvider[provider] ??= { count: 0, tokens: 0, cost: 0, errors: 0 };
    byProvider[provider].count += 1;
    byProvider[provider].tokens += record.totalTokens;
    byProvider[provider].cost += record.estimatedCostUsd;
    if ((record.statusCode ?? 0) >= 400) byProvider[provider].errors += 1;
    const model = record.model || "unknown";
    byModel[model] ??= { count: 0, tokens: 0, cost: 0 };
    byModel[model].count += 1;
    byModel[model].tokens += record.totalTokens;
    byModel[model].cost += record.estimatedCostUsd;
    if (record.agentId) {
      byAgent[record.agentId] ??= { count: 0, tokens: 0, cost: 0, errors: 0 };
      byAgent[record.agentId].count += 1;
      byAgent[record.agentId].tokens += record.totalTokens;
      byAgent[record.agentId].cost += record.estimatedCostUsd;
      if ((record.statusCode ?? 0) >= 400) byAgent[record.agentId].errors += 1;
    }
  }
  return {
    totalRequests,
    avgLatencyMs: Math.round(totalLatency / totalRequests),
    totalTokens,
    totalCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
    unknownCostRecords,
    unresolvedBillableAttempts,
    errorRate: errorCount / totalRequests,
    cacheHitRate: cacheHits / totalRequests,
    fallbackRate: fallbacks / totalRequests,
    byProvider,
    byModel,
    byAgent,
    ...completeness,
  };
}

function normalizeEventType(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value);
  if (!new Set(["attempt-started", "attempt-completed", "attempt-failed"]).has(normalized)) {
    throw usageLedgerError(
      "USAGE_LEDGER_EVENT_TYPE_INVALID",
      "The usage lifecycle event type is invalid.",
    );
  }
  return normalized as RequestLogRecord["usageEventType"];
}

function normalizeOptions(raw: PostgresUsageLedgerOptions) {
  if (!raw.connectionString && !raw.pool) {
    throw usageLedgerError(
      "USAGE_LEDGER_POSTGRES_URL_REQUIRED",
      "The central usage ledger needs a PostgreSQL URL or injected pool.",
    );
  }
  return {
    ...raw,
    namespace: boundedIdentifier(raw.namespace, 128),
    maxRows: clampInteger(raw.maxRows, 1_000_000, 1, 100_000_000),
    retentionDays: clampInteger(raw.retentionDays, 90, 1, 3_650),
    poolMax: clampInteger(raw.poolMax, 4, 1, 32),
    statementTimeoutMs: clampInteger(raw.statementTimeoutMs, 5_000, 100, 30_000),
    now: raw.now ?? Date.now,
  };
}

async function loadPool(
  options: ReturnType<typeof normalizeOptions>,
): Promise<UsageLedgerPostgresPool> {
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => UsageLedgerPostgresPool;
  };
  return new module.Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    connectionTimeoutMillis: Math.min(10_000, options.statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: options.statementTimeoutMs,
    application_name: "unified-ai-system-usage-ledger",
    allowExitOnIdle: true,
  });
}

function boundedIdentifier(value: unknown, maxLength: number): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw usageLedgerError(
      "USAGE_LEDGER_NAMESPACE_INVALID",
      "The usage ledger namespace is invalid.",
    );
  }
  return normalized;
}

function boundedText(value: unknown, maxLength: number): string {
  return sanitizeLogText(value, maxLength);
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return boundedText(value, maxLength);
}

function boundedAgentId(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(normalized)) {
    throw usageLedgerError("USAGE_LEDGER_AGENT_FILTER_INVALID", "The Agent usage filter is invalid.");
  }
  return normalized;
}

function boundedAgentRunId(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!/^agr_[A-Za-z0-9_-]{1,128}$/u.test(normalized)) {
    throw usageLedgerError("USAGE_LEDGER_AGENT_FILTER_INVALID", "The Agent run usage filter is invalid.");
  }
  return normalized;
}

function optionalAgentId(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return /^agt_[A-Za-z0-9_-]{1,128}$/u.test(normalized) ? normalized : undefined;
}

function optionalAgentRunId(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim();
  return /^agr_[A-Za-z0-9_-]{1,128}$/u.test(normalized) ? normalized : undefined;
}

function optionalDigest(value: unknown): string | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();
  return /^sha256:[a-f0-9]{64}$/u.test(normalized) ? normalized : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function nullableNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function nonNegativeInteger(value: unknown): number {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) return 0;
  return number;
}

function nonNegativeNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function clampInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
}

function usageLedgerError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    category: "billing" as const,
    retryable: true,
  });
}

function isUsageLedgerError(
  error: unknown,
): error is Error & { code: string; category: "billing" } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "billing"
    && typeof candidate.code === "string"
    && candidate.code.startsWith("USAGE_LEDGER_");
}
