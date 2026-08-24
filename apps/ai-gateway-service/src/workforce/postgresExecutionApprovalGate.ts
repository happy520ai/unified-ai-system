import { createHash, randomUUID } from "node:crypto";

import type {
  WorkforceClaimPostgresClient as PostgresClient,
  WorkforceClaimPostgresPool as PostgresPool,
} from "./postgresTaskClaimLease.ts";
import { createLogRedactor } from "./logRedactor.js";

type ApprovalContext = {
  planId: string;
  tenantId: string;
  userId: string;
  planDigest: string;
  requiredScopes: string[];
};

type ApprovalRow = {
  approval_id: string;
  tenant_digest: string;
  plan_key: string;
  user_digest: string;
  plan_digest: string;
  scopes_json: string;
  scopes_sha256: string;
  note: string;
  status: "approved" | "consumed" | "revoked";
  approved_at: string | Date;
  expires_at: string | Date;
  consumed_at: string | Date | null;
  revoked_at: string | Date | null;
  revoke_reason: string | null;
  database_now?: string | Date;
};

export type PostgresExecutionApprovalGateOptions = {
  pool: PostgresPool;
  namespace: string;
  ttlMs: number;
  retentionMs: number;
  maxApprovals: number;
  now?: () => number;
};

const TABLE = "public.ai_gateway_workforce_execution_approvals";
const INIT_LOCK_NAMESPACE = 1_431_193_306;
const INIT_LOCK_KEY = 1_768_841_206;
const CAPACITY_LOCK_NAMESPACE = 1_431_193_307;
const MAX_ID_LENGTH = 512;
const MAX_SCOPE_COUNT = 64;
const MAX_SCOPE_LENGTH = 128;
const redactor = createLogRedactor() as {
  redactString(value: string): string;
};

const INITIALIZE_SQL = `/* workforce-control-approval:init */
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    namespace TEXT NOT NULL,
    tenant_digest CHAR(64) NOT NULL,
    plan_key CHAR(64) NOT NULL,
    approval_id TEXT NOT NULL,
    user_digest CHAR(64) NOT NULL,
    plan_digest CHAR(64) NOT NULL,
    scopes_json TEXT NOT NULL,
    scopes_sha256 CHAR(64) NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('approved', 'consumed', 'revoked')),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    consumed_by_digest CHAR(64),
    revoked_at TIMESTAMPTZ,
    revoked_by_digest CHAR(64),
    revoke_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (namespace, tenant_digest, plan_key),
    UNIQUE (namespace, approval_id)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_approval_expiry_idx
    ON ${TABLE} (namespace, expires_at);
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_approval_status_idx
    ON ${TABLE} (namespace, status, updated_at);
`;

const SELECT_FIELDS = `
  approval_id, tenant_digest, plan_key, user_digest, plan_digest,
  scopes_json, scopes_sha256, note, status, approved_at, expires_at,
  consumed_at, revoked_at, revoke_reason
`;

export function createPostgresExecutionApprovalGate(
  rawOptions: PostgresExecutionApprovalGateOptions,
) {
  const options = normalizeOptions(rawOptions);
  let readyPromise: Promise<PostgresPool> | null = null;
  let available = false;
  let reason: string | null = "initializing";
  let activeApprovals = 0;
  let statsUpdatedAt: number | null = null;
  let totalFailures = 0;
  let lastFailureCode: string | null = null;

  void getReadyPool().catch(() => undefined);

  return {
    getInfo() {
      return {
        module: "postgresExecutionApprovalGate",
        version: "1.0.0",
        mode: "postgres-central",
        durable: true,
        distributed: true,
        ttlMs: options.ttlMs,
        retentionMs: options.retentionMs,
        maxApprovals: options.maxApprovals,
        activeApprovals,
        available,
        rawIdentifiersStored: false,
      };
    },

    getHealth() {
      return healthSnapshot();
    },

    async checkHealth() {
      try {
        const pool = await getReadyPool();
        await refreshStats(pool);
      } catch (error) {
        markFailure(error);
      }
      return healthSnapshot();
    },

    async approve(input: Record<string, unknown>) {
      const context = normalizeApproveInput(input);
      const approvalId = `appr_${randomUUID().replaceAll("-", "")}`;
      const scopeEncoding = encodeScopes(context.approvedScopes);
      const note = redactor.redactString(String(input.note ?? "").trim()).slice(0, 2_000);
      let client: PostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(
          "/* workforce-control-approval:capacity-lock */ SELECT pg_advisory_xact_lock($1, hashtext($2))",
          [CAPACITY_LOCK_NAMESPACE, options.namespace],
        );
        await purgeExpired(client);
        const existing = await client.query(`/* workforce-control-approval:existing */
          SELECT 1 FROM ${TABLE}
          WHERE namespace = $1 AND tenant_digest = $2 AND plan_key = $3
          FOR UPDATE
        `, [options.namespace, context.tenantDigest, context.planKey]);
        if (!existing.rows[0]) {
          const count = await client.query<{ count: string | number }>(`
            /* workforce-control-approval:capacity */
            SELECT COUNT(*)::bigint AS count FROM ${TABLE}
            WHERE namespace = $1
          `, [options.namespace]);
          if (Number(count.rows[0]?.count ?? 0) >= options.maxApprovals) {
            throw approvalError(
              "WORKFORCE_APPROVAL_CAPACITY_REACHED",
              "The bounded central approval store has reached capacity.",
              503,
            );
          }
        }
        const result = await client.query<ApprovalRow>(`/* workforce-control-approval:upsert */
          INSERT INTO ${TABLE} (
            namespace, tenant_digest, plan_key, approval_id, user_digest,
            plan_digest, scopes_json, scopes_sha256, note, status,
            approved_at, expires_at, consumed_at, consumed_by_digest,
            revoked_at, revoked_by_digest, revoke_reason, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved',
            clock_timestamp(),
            clock_timestamp() + ($10::bigint * interval '1 millisecond'),
            NULL, NULL, NULL, NULL, NULL, clock_timestamp()
          )
          ON CONFLICT (namespace, tenant_digest, plan_key) DO UPDATE SET
            approval_id = EXCLUDED.approval_id,
            user_digest = EXCLUDED.user_digest,
            plan_digest = EXCLUDED.plan_digest,
            scopes_json = EXCLUDED.scopes_json,
            scopes_sha256 = EXCLUDED.scopes_sha256,
            note = EXCLUDED.note,
            status = 'approved',
            approved_at = clock_timestamp(),
            expires_at = clock_timestamp() + ($10::bigint * interval '1 millisecond'),
            consumed_at = NULL,
            consumed_by_digest = NULL,
            revoked_at = NULL,
            revoked_by_digest = NULL,
            revoke_reason = NULL,
            updated_at = clock_timestamp()
          RETURNING ${SELECT_FIELDS}, clock_timestamp() AS database_now
        `, [
          options.namespace,
          context.tenantDigest,
          context.planKey,
          approvalId,
          context.userDigest,
          context.planDigest,
          scopeEncoding.json,
          scopeEncoding.sha256,
          note,
          options.ttlMs,
        ]);
        await client.query("COMMIT");
        markReady();
        const approval = publicApproval(result.rows[0], context);
        return { success: true, status: "approved", approval };
      } catch (error) {
        await rollback(client);
        throw normalizeStoreError(error, "The central approval could not be committed.");
      } finally {
        client?.release();
      }
    },

    async check(input: Record<string, unknown>) {
      const normalized = normalizeApprovalContext(input);
      if (!normalized.valid) return normalized.failure;
      try {
        const pool = await getReadyPool();
        const result = await pool.query<ApprovalRow>(`/* workforce-control-approval:check */
          SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
          FROM ${TABLE}
          WHERE namespace = $1 AND tenant_digest = $2 AND plan_key = $3
        `, [options.namespace, normalized.context.tenantDigest, normalized.context.planKey]);
        markReady();
        return evaluateRow(result.rows[0], normalized.context);
      } catch (error) {
        throw normalizeStoreError(error, "The central approval could not be read.");
      }
    },

    async consume(input: Record<string, unknown>) {
      const normalized = normalizeApprovalContext(input);
      if (!normalized.valid) return normalized.failure;
      let client: PostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        const selected = await client.query<ApprovalRow>(`/* workforce-control-approval:consume-select */
          SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
          FROM ${TABLE}
          WHERE namespace = $1 AND tenant_digest = $2 AND plan_key = $3
          FOR UPDATE
        `, [options.namespace, normalized.context.tenantDigest, normalized.context.planKey]);
        const validation = evaluateRow(selected.rows[0], normalized.context);
        if (validation.approved !== true) {
          await client.query("COMMIT");
          markReady();
          return validation;
        }
        const updated = await client.query<ApprovalRow>(`/* workforce-control-approval:consume */
          UPDATE ${TABLE}
          SET status = 'consumed', consumed_at = clock_timestamp(),
              consumed_by_digest = $4, updated_at = clock_timestamp()
          WHERE namespace = $1 AND tenant_digest = $2 AND plan_key = $3
            AND approval_id = $5 AND status = 'approved'
            AND expires_at > clock_timestamp()
          RETURNING ${SELECT_FIELDS}, clock_timestamp() AS database_now
        `, [
          options.namespace,
          normalized.context.tenantDigest,
          normalized.context.planKey,
          normalized.context.userDigest,
          selected.rows[0].approval_id,
        ]);
        if (!updated.rows[0]) {
          throw approvalError(
            "APPROVAL_CONCURRENTLY_CHANGED",
            "The approval changed before it could be consumed.",
            409,
          );
        }
        await client.query("COMMIT");
        markReady();
        return {
          ...validation,
          consumed: true,
          approval: publicApproval(updated.rows[0], normalized.context),
        };
      } catch (error) {
        await rollback(client);
        throw normalizeStoreError(error, "The central approval could not be consumed.");
      } finally {
        client?.release();
      }
    },

    async revoke(
      planIdInput: unknown,
      revokedByInput: unknown,
      reasonInput: unknown = "",
      tenantIdInput: unknown = "default",
    ) {
      const planId = normalizeId(planIdInput, "planId");
      const tenantId = normalizeId(tenantIdInput, "tenantId");
      const revokedBy = normalizeId(revokedByInput || "system", "revokedBy");
      const reasonText = redactor.redactString(String(reasonInput ?? "").trim()).slice(0, 1_000);
      try {
        const pool = await getReadyPool();
        const updated = await pool.query<{ revoked_at: string | Date }>(`
          /* workforce-control-approval:revoke */
          UPDATE ${TABLE}
          SET status = 'revoked', revoked_at = clock_timestamp(),
              revoked_by_digest = $4, revoke_reason = $5,
              updated_at = clock_timestamp()
          WHERE namespace = $1 AND tenant_digest = $2 AND plan_key = $3
            AND status = 'approved'
          RETURNING revoked_at
        `, [
          options.namespace,
          digestIdentifier(tenantId),
          digestIdentifier(planId),
          digestIdentifier(revokedBy),
          reasonText,
        ]);
        markReady();
        if (!updated.rows[0]) {
          return { success: false, reason: "未找到可吊销的有效审批记录", planId };
        }
        return {
          success: true,
          status: "revoked",
          planId,
          revokedAt: toIso(updated.rows[0].revoked_at),
        };
      } catch (error) {
        throw normalizeStoreError(error, "The central approval could not be revoked.");
      }
    },

    async list(filter: Record<string, unknown> = {}) {
      const tenantId = normalizeId(filter.tenantId, "tenantId");
      const values: unknown[] = [options.namespace, digestIdentifier(tenantId)];
      const clauses = ["namespace = $1", "tenant_digest = $2"];
      if (filter.planId !== undefined) {
        values.push(digestIdentifier(normalizeId(filter.planId, "planId")));
        clauses.push(`plan_key = $${values.length}`);
      }
      if (filter.status !== undefined) {
        const status = normalizeStatus(filter.status);
        values.push(status);
        clauses.push(`status = $${values.length}`);
      }
      values.push(Math.min(options.maxApprovals, 1_000));
      try {
        const pool = await getReadyPool();
        const rows = await pool.query<ApprovalRow>(`/* workforce-control-approval:list */
          SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
          FROM ${TABLE}
          WHERE ${clauses.join(" AND ")}
          ORDER BY approved_at DESC
          LIMIT $${values.length}
        `, values);
        markReady();
        return {
          success: true,
          count: rows.rows.length,
          approvals: rows.rows.map((row) => opaqueApproval(row)),
        };
      } catch (error) {
        throw normalizeStoreError(error, "The central approvals could not be listed.");
      }
    },

    async cleanup() {
      try {
        const pool = await getReadyPool();
        const deleted = await pool.query(`/* workforce-control-approval:cleanup */
          DELETE FROM ${TABLE}
          WHERE namespace = $1 AND (
            expires_at <= clock_timestamp()
            OR (
              status IN ('consumed', 'revoked')
              AND updated_at <= clock_timestamp() - ($2::bigint * interval '1 millisecond')
            )
          )
        `, [options.namespace, options.retentionMs]);
        await refreshStats(pool);
        return {
          success: true,
          removedCount: Number(deleted.rowCount ?? 0),
          remainingCount: activeApprovals,
        };
      } catch (error) {
        throw normalizeStoreError(error, "The central approvals could not be cleaned.");
      }
    },
  };

  async function getReadyPool() {
    if (!readyPromise) {
      readyPromise = initializePool(options.pool).then(() => options.pool);
      void readyPromise.catch(() => undefined);
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      markFailure(error);
      throw error;
    }
  }

  async function initializePool(pool: PostgresPool) {
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query(
        "/* workforce-control-approval:init-lock */ SELECT pg_advisory_lock($1, $2)",
        [INIT_LOCK_NAMESPACE, INIT_LOCK_KEY],
      );
      locked = true;
      await client.query(INITIALIZE_SQL);
      markReady();
    } finally {
      if (locked) {
        await client.query(
          "/* workforce-control-approval:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
          [INIT_LOCK_NAMESPACE, INIT_LOCK_KEY],
        ).catch(() => undefined);
      }
      client.release();
    }
  }

  async function purgeExpired(client: PostgresClient) {
    await client.query(`/* workforce-control-approval:purge-expired */
      DELETE FROM ${TABLE}
      WHERE namespace = $1 AND expires_at <= clock_timestamp()
    `, [options.namespace]);
  }

  async function refreshStats(pool: PostgresPool) {
    const result = await pool.query<{ count: string | number }>(`
      /* workforce-control-approval:stats */
      SELECT COUNT(*)::bigint AS count FROM ${TABLE}
      WHERE namespace = $1 AND status = 'approved'
        AND expires_at > clock_timestamp()
    `, [options.namespace]);
    activeApprovals = Number(result.rows[0]?.count ?? 0);
    statsUpdatedAt = options.now();
    markReady();
  }

  function healthSnapshot() {
    return {
      mode: "postgres-central",
      durable: true,
      distributed: true,
      available,
      reason,
      activeApprovals,
      maxApprovals: options.maxApprovals,
      statsUpdatedAt,
      totalFailures,
      lastFailureCode,
      rawIdentifiersStored: false,
    };
  }

  function markReady() {
    available = true;
    reason = null;
  }

  function markFailure(error: unknown) {
    available = false;
    reason = "store_unavailable";
    totalFailures += 1;
    lastFailureCode = typeof (error as any)?.code === "string"
      ? (error as any).code
      : "WORKFORCE_APPROVAL_STORE_UNAVAILABLE";
  }

  function normalizeStoreError(error: unknown, message: string): Error {
    if (isApprovalError(error)) {
      if ((error as any).code === "WORKFORCE_APPROVAL_STATE_CORRUPT") markFailure(error);
      return error as Error;
    }
    markFailure(error);
    return approvalError("WORKFORCE_APPROVAL_STORE_UNAVAILABLE", message, 503);
  }
}

function normalizeOptions(options: PostgresExecutionApprovalGateOptions) {
  return {
    ...options,
    namespace: normalizePortableIdentifier(options.namespace, "namespace"),
    ttlMs: boundedInteger(options.ttlMs, 24 * 60 * 60_000, 1_000, 30 * 24 * 60 * 60_000),
    retentionMs: boundedInteger(options.retentionMs, 30 * 24 * 60 * 60_000, 60_000, 365 * 24 * 60 * 60_000),
    maxApprovals: boundedInteger(options.maxApprovals, 10_000, 1, 1_000_000),
    now: options.now ?? Date.now,
  };
}

function normalizeApproveInput(input: Record<string, unknown>) {
  const planId = normalizeId(input.planId, "planId");
  const tenantId = normalizeId(input.tenantId ?? "default", "tenantId");
  const userId = normalizeId(input.userId, "userId");
  const planDigest = normalizeDigest(input.planDigest, "planDigest");
  const approvedScopes = normalizeScopes(input.approvedScopes, true);
  return {
    planId,
    tenantId,
    userId,
    planDigest,
    approvedScopes,
    tenantDigest: digestIdentifier(tenantId),
    planKey: digestIdentifier(planId),
    userDigest: digestIdentifier(userId),
    requiredScopes: approvedScopes,
  };
}

function normalizeApprovalContext(input: Record<string, unknown>):
  | { valid: true; context: ApprovalContext & { tenantDigest: string; planKey: string; userDigest: string } }
  | { valid: false; failure: Record<string, unknown> } {
  try {
    const planId = normalizeId(input?.planId, "planId");
    const tenantId = normalizeId(input?.tenantId ?? "default", "tenantId");
    const userId = normalizeId(input?.userId, "userId");
    const planDigest = normalizeDigest(input?.planDigest, "planDigest");
    const requiredScopes = normalizeScopes(input?.requiredScopes, true);
    return {
      valid: true,
      context: {
        planId,
        tenantId,
        userId,
        planDigest,
        requiredScopes,
        tenantDigest: digestIdentifier(tenantId),
        planKey: digestIdentifier(planId),
        userDigest: digestIdentifier(userId),
      },
    };
  } catch (error) {
    return {
      valid: false,
      failure: {
        success: false,
        approved: false,
        code: (error as any)?.code ?? "APPROVAL_CONTEXT_INVALID",
        reason: "审批校验必须绑定 planId、tenantId、userId、planDigest 和 requiredScopes",
      },
    };
  }
}

function evaluateRow(
  row: ApprovalRow | undefined,
  context: ApprovalContext & { tenantDigest: string; planKey: string; userDigest: string },
) {
  if (!row || row.status !== "approved") {
    return {
      success: true,
      approved: false,
      code: "APPROVAL_NOT_FOUND",
      reason: "未找到该计划的有效审批记录",
      planId: context.planId,
    };
  }
  const scopes = decodeVerifiedScopes(row);
  const now = new Date(row.database_now ?? Date.now());
  if (now >= new Date(row.expires_at)) {
    return {
      success: true,
      approved: false,
      code: "APPROVAL_EXPIRED",
      reason: "审批已过期",
      planId: context.planId,
    };
  }
  if (row.user_digest !== context.userDigest) {
    return {
      success: true,
      approved: false,
      code: "APPROVAL_SUBJECT_MISMATCH",
      reason: "审批主体与执行主体不匹配",
      planId: context.planId,
    };
  }
  if (row.plan_digest !== context.planDigest) {
    return {
      success: true,
      approved: false,
      code: "APPROVAL_PLAN_MISMATCH",
      reason: "计划内容已改变，原审批不可复用",
      planId: context.planId,
    };
  }
  const approvedScopes = new Set(scopes);
  const missingScopes = context.requiredScopes.filter((scope) => !approvedScopes.has(scope));
  if (missingScopes.length > 0) {
    return {
      success: true,
      approved: false,
      code: "APPROVAL_SCOPE_MISMATCH",
      reason: "审批范围不足",
      missingScopes,
      planId: context.planId,
    };
  }
  return {
    success: true,
    approved: true,
    code: "APPROVAL_VALID",
    reason: "审批有效",
    approval: publicApproval(row, context),
    planId: context.planId,
  };
}

function publicApproval(row: ApprovalRow | undefined, context: ApprovalContext) {
  if (!row) throw approvalError("WORKFORCE_APPROVAL_STATE_INVALID", "The approval row is missing.", 503);
  const scopes = decodeVerifiedScopes(row);
  return {
    schemaVersion: 4,
    approvalId: row.approval_id,
    planId: context.planId,
    tenantId: context.tenantId,
    userId: context.userId,
    planDigest: row.plan_digest,
    approvedScopes: scopes,
    note: row.note,
    status: row.status,
    approvedAt: toIso(row.approved_at),
    expiresAt: toIso(row.expires_at),
    revoked: row.status === "revoked",
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
    consumedAt: row.consumed_at ? toIso(row.consumed_at) : null,
  };
}

function opaqueApproval(row: ApprovalRow) {
  const now = new Date(row.database_now ?? Date.now());
  return {
    approvalId: row.approval_id,
    tenantFingerprint: row.tenant_digest.slice(0, 16),
    planFingerprint: row.plan_key.slice(0, 16),
    subjectFingerprint: row.user_digest.slice(0, 16),
    planDigest: row.plan_digest,
    approvedScopes: decodeVerifiedScopes(row),
    status: row.status,
    approvedAt: toIso(row.approved_at),
    expiresAt: toIso(row.expires_at),
    isExpired: now >= new Date(row.expires_at),
  };
}

function encodeScopes(scopes: string[]) {
  const json = JSON.stringify(scopes);
  return { json, sha256: digestText(json) };
}

function decodeVerifiedScopes(row: ApprovalRow): string[] {
  if (digestText(row.scopes_json) !== row.scopes_sha256) {
    throw approvalError(
      "WORKFORCE_APPROVAL_STATE_CORRUPT",
      "The persisted approval scope digest does not match.",
      503,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.scopes_json);
  } catch {
    throw approvalError("WORKFORCE_APPROVAL_STATE_CORRUPT", "The persisted approval scopes are invalid.", 503);
  }
  try {
    return normalizeScopes(parsed, true);
  } catch {
    throw approvalError("WORKFORCE_APPROVAL_STATE_CORRUPT", "The persisted approval scopes are invalid.", 503);
  }
}

function normalizeScopes(value: unknown, required: boolean): string[] {
  if (!Array.isArray(value)) {
    if (!required) return [];
    throw approvalError("APPROVAL_SCOPES_REQUIRED", "At least one approved scope is required.", 400);
  }
  const scopes = [...new Set(value.map((scope) => String(scope).trim()).filter(Boolean))].sort();
  if ((required && scopes.length === 0) || scopes.length > MAX_SCOPE_COUNT) {
    throw approvalError("APPROVAL_SCOPES_REQUIRED", "Approval scopes are missing or exceed the bounded count.", 400);
  }
  if (scopes.some((scope) => scope.length > MAX_SCOPE_LENGTH || /[\u0000-\u001f\u007f]/u.test(scope))) {
    throw approvalError("APPROVAL_SCOPE_INVALID", "An approval scope is invalid.", 400);
  }
  return scopes;
}

function normalizeId(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw approvalError(`APPROVAL_${field.toUpperCase()}_INVALID`, `${field} must be a string.`, 400);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ID_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw approvalError(`APPROVAL_${field.toUpperCase()}_INVALID`, `${field} is invalid.`, 400);
  }
  return normalized;
}

function normalizePortableIdentifier(value: unknown, field: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw approvalError("WORKFORCE_CONTROL_NAMESPACE_INVALID", `${field} is invalid.`, 400);
  }
  return normalized;
}

function normalizeDigest(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value.trim())) {
    throw approvalError("APPROVAL_PLAN_DIGEST_REQUIRED", `${field} must be a SHA-256 digest.`, 400);
  }
  return value.trim();
}

function normalizeStatus(value: unknown) {
  const status = String(value ?? "").trim();
  if (!new Set(["approved", "consumed", "revoked"]).has(status)) {
    throw approvalError("APPROVAL_STATUS_INVALID", "The approval status filter is invalid.", 400);
  }
  return status;
}

function digestIdentifier(value: string) {
  return digestText(`workforce-control/v1\u0000${value}`);
}

function digestText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function toIso(value: string | Date) {
  return new Date(value).toISOString();
}

async function rollback(client: PostgresClient | null) {
  if (!client) return;
  await client.query("ROLLBACK").catch(() => undefined);
}

function approvalError(code: string, message: string, statusCode = 409) {
  return Object.assign(new Error(message), { code, category: "approval" as const, statusCode });
}

function isApprovalError(error: unknown) {
  return error instanceof Error
    && typeof (error as any).code === "string"
    && Number.isInteger((error as any).statusCode);
}
