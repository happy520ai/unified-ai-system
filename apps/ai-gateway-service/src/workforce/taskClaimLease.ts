import { createHash, randomBytes } from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_CLAIMS = 2_000;
const MIN_TTL_MS = 10;
const MAX_TTL_MS = 24 * 60 * 60_000;
const MAX_ID_LENGTH = 256;
const MAX_TOKEN_LENGTH = 512;

export interface TaskClaimLeaseManagerOptions {
  ttlMs?: number;
  maxClaims?: number;
  clock?: () => number;
}

export interface TaskClaimIdentity {
  planId: string;
  taskId: string;
  agentId: string;
  fencingToken?: string;
}

interface ClaimRecord {
  tokenDigest: string;
  tokenFingerprint: string;
  planId: string;
  taskId: string;
  agentId: string;
  fencingToken: string;
  issuedAtMs: number;
  expiresAtMs: number;
  renewalCount: number;
}

interface PublicClaimRecord {
  tokenFingerprint: string;
  planId: string;
  taskId: string;
  agentId: string;
  fencingToken: string;
  status: "active";
  issuedAt: string;
  expiresAt: string;
  renewalCount: number;
}

interface FailedClaimResolution {
  success: false;
  valid: false;
  code: string;
  reason: string;
  record?: PublicClaimRecord;
}

interface SuccessfulClaimResolution {
  success: true;
  valid: true;
  code: "TASK_CLAIM_VALID";
  record: ClaimRecord;
}

interface IssuedClaimResult {
  success: true;
  code: "TASK_CLAIM_ISSUED";
  token: string;
  fencingToken: string;
  expiresAt: string;
  record: PublicClaimRecord;
}

type ClaimResolution = FailedClaimResolution | SuccessfulClaimResolution;

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function normalizeId(value: unknown, field: string): string {
  if (typeof value !== "string") {
    const error = new TypeError(`${field} must be a string.`);
    Object.assign(error, { code: "TASK_CLAIM_IDENTITY_INVALID" });
    throw error;
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ID_LENGTH || normalized.includes("\0")) {
    const error = new TypeError(`${field} must be non-empty and at most ${MAX_ID_LENGTH} characters.`);
    Object.assign(error, { code: "TASK_CLAIM_IDENTITY_INVALID" });
    throw error;
  }
  return normalized;
}

function createTaskKey(planId: string, taskId: string): string {
  return `${planId.length}:${planId}:${taskId.length}:${taskId}`;
}

function digestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function toPublicRecord(record: ClaimRecord): PublicClaimRecord {
  return {
    tokenFingerprint: record.tokenFingerprint,
    planId: record.planId,
    taskId: record.taskId,
    agentId: record.agentId,
    fencingToken: record.fencingToken,
    status: "active",
    issuedAt: new Date(record.issuedAtMs).toISOString(),
    expiresAt: new Date(record.expiresAtMs).toISOString(),
    renewalCount: record.renewalCount,
  };
}

function failed(code: string, reason: string, record?: ClaimRecord): FailedClaimResolution {
  return {
    success: false,
    valid: false,
    code,
    reason,
    ...(record ? { record: toPublicRecord(record) } : {}),
  };
}

/** In-process fenced ownership with no raw-token retention or per-claim timers. */
export function createTaskClaimLeaseManager(options: TaskClaimLeaseManagerOptions = {}) {
  const defaultTtlMs = boundedInteger(options.ttlMs, DEFAULT_TTL_MS, MIN_TTL_MS, MAX_TTL_MS);
  const maxClaims = boundedInteger(options.maxClaims, DEFAULT_MAX_CLAIMS, 1, 100_000);
  const clock = typeof options.clock === "function" ? options.clock : Date.now;
  const recordsByDigest = new Map<string, ClaimRecord>();
  const activeDigestByTask = new Map<string, string>();
  let nextFencingToken = 0n;
  const stats = { issued: 0, renewed: 0, released: 0, revoked: 0, expired: 0, rejected: 0 };

  function nowMs(): number {
    const value = Number(clock());
    if (!Number.isFinite(value)) throw new Error("Task claim clock returned a non-finite value.");
    return Math.floor(value);
  }

  function removeRecord(record: ClaimRecord, outcome: "released" | "revoked" | "expired"): void {
    recordsByDigest.delete(record.tokenDigest);
    const key = createTaskKey(record.planId, record.taskId);
    if (activeDigestByTask.get(key) === record.tokenDigest) activeDigestByTask.delete(key);
    stats[outcome] += 1;
  }

  function resolveClaim(token: unknown, context: Partial<TaskClaimIdentity> = {}): ClaimResolution {
    if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) {
      return failed("TASK_CLAIM_TOKEN_INVALID", "A bounded task claim token is required.");
    }
    const record = recordsByDigest.get(digestToken(token));
    if (!record) return failed("TASK_CLAIM_NOT_FOUND", "The task claim does not exist or is no longer active.");
    if (record.expiresAtMs <= nowMs()) {
      const publicRecord = toPublicRecord(record);
      removeRecord(record, "expired");
      return { ...failed("TASK_CLAIM_EXPIRED", "The task claim expired and cannot be renewed."), record: publicRecord };
    }
    if (context.planId !== undefined && record.planId !== normalizeId(context.planId, "planId")) {
      return failed("TASK_CLAIM_PLAN_MISMATCH", "The task claim is bound to a different plan.", record);
    }
    if (context.taskId !== undefined && record.taskId !== normalizeId(context.taskId, "taskId")) {
      return failed("TASK_CLAIM_TASK_MISMATCH", "The task claim is bound to a different task.", record);
    }
    if (context.agentId !== undefined && record.agentId !== normalizeId(context.agentId, "agentId")) {
      return failed("TASK_CLAIM_AGENT_MISMATCH", "The task claim is bound to a different agent.", record);
    }
    if (context.fencingToken !== undefined && record.fencingToken !== String(context.fencingToken)) {
      return failed("TASK_CLAIM_FENCE_MISMATCH", "The task claim fencing token is stale.", record);
    }
    return { success: true, valid: true, code: "TASK_CLAIM_VALID", record };
  }

  function cleanupExpired(): number {
    const currentTime = nowMs();
    let removed = 0;
    for (const record of recordsByDigest.values()) {
      if (record.expiresAtMs <= currentTime) {
        removeRecord(record, "expired");
        removed += 1;
      }
    }
    return removed;
  }

  return {
    getInfo() {
      return {
        module: "taskClaimLease",
        version: "2.0.0",
        mode: "memory-fenced",
        distributed: false,
        ttlMs: defaultTtlMs,
        maxClaims,
        activeClaims: activeDigestByTask.size,
        rawTokenRetained: false,
        timerCount: 0,
        stats: { ...stats },
      };
    },
    issue(input: TaskClaimIdentity & { ttlMs?: number }): FailedClaimResolution | IssuedClaimResult {
      const planId = normalizeId(input?.planId, "planId");
      const taskId = normalizeId(input?.taskId, "taskId");
      const agentId = normalizeId(input?.agentId, "agentId");
      const taskKey = createTaskKey(planId, taskId);
      const existingDigest = activeDigestByTask.get(taskKey);
      if (existingDigest) {
        const existing = recordsByDigest.get(existingDigest);
        if (existing && existing.expiresAtMs > nowMs()) {
          stats.rejected += 1;
          return failed("TASK_ALREADY_CLAIMED", "The task already has an active fenced claim.", existing);
        }
        if (existing) removeRecord(existing, "expired");
        else activeDigestByTask.delete(taskKey);
      }
      if (activeDigestByTask.size >= maxClaims) cleanupExpired();
      if (activeDigestByTask.size >= maxClaims) {
        stats.rejected += 1;
        return failed("TASK_CLAIM_CAPACITY", "The bounded task claim capacity is exhausted.");
      }
      const issuedAtMs = nowMs();
      const ttlMs = boundedInteger(input?.ttlMs, defaultTtlMs, MIN_TTL_MS, MAX_TTL_MS);
      const token = randomBytes(32).toString("base64url");
      const tokenDigest = digestToken(token);
      nextFencingToken += 1n;
      const record: ClaimRecord = {
        tokenDigest,
        tokenFingerprint: tokenDigest.slice(0, 16),
        planId,
        taskId,
        agentId,
        fencingToken: nextFencingToken.toString(),
        issuedAtMs,
        expiresAtMs: issuedAtMs + ttlMs,
        renewalCount: 0,
      };
      recordsByDigest.set(tokenDigest, record);
      activeDigestByTask.set(taskKey, tokenDigest);
      stats.issued += 1;
      return {
        success: true,
        code: "TASK_CLAIM_ISSUED",
        token,
        fencingToken: record.fencingToken,
        expiresAt: new Date(record.expiresAtMs).toISOString(),
        record: toPublicRecord(record),
      };
    },
    validate(token: unknown, context: Partial<TaskClaimIdentity> = {}) {
      const resolved = resolveClaim(token, context);
      if (!resolved.success) return resolved;
      return {
        success: true,
        valid: true,
        code: "TASK_CLAIM_VALID",
        reason: "The task claim is active and bound to this execution.",
        record: toPublicRecord(resolved.record),
      };
    },
    renew(token: unknown, context: Partial<TaskClaimIdentity> = {}, extendMs?: number) {
      const resolved = resolveClaim(token, context);
      if (!resolved.success) return resolved;
      const extension = boundedInteger(extendMs, defaultTtlMs, MIN_TTL_MS, MAX_TTL_MS);
      const previousExpiresAt = new Date(resolved.record.expiresAtMs).toISOString();
      resolved.record.expiresAtMs = nowMs() + extension;
      resolved.record.renewalCount += 1;
      stats.renewed += 1;
      return {
        success: true,
        code: "TASK_CLAIM_RENEWED",
        previousExpiresAt,
        expiresAt: new Date(resolved.record.expiresAtMs).toISOString(),
        renewalCount: resolved.record.renewalCount,
        record: toPublicRecord(resolved.record),
      };
    },
    release(token: unknown, context: Partial<TaskClaimIdentity> = {}) {
      const resolved = resolveClaim(token, context);
      if (!resolved.success) return resolved;
      const record = toPublicRecord(resolved.record);
      removeRecord(resolved.record, "released");
      return { success: true, code: "TASK_CLAIM_RELEASED", record };
    },
    revoke(token: unknown, reason = "revoked") {
      const resolved = resolveClaim(token);
      if (!resolved.success) return resolved;
      const record = toPublicRecord(resolved.record);
      removeRecord(resolved.record, "revoked");
      return { success: true, code: "TASK_CLAIM_REVOKED", reason: String(reason).trim().slice(0, 256), record };
    },
    revokeTask(identity: Pick<TaskClaimIdentity, "planId" | "taskId">, reason = "revoked") {
      const planId = normalizeId(identity?.planId, "planId");
      const taskId = normalizeId(identity?.taskId, "taskId");
      const digest = activeDigestByTask.get(createTaskKey(planId, taskId));
      const record = digest ? recordsByDigest.get(digest) : undefined;
      if (!record) return failed("TASK_CLAIM_NOT_FOUND", "The task has no active claim.");
      const publicRecord = toPublicRecord(record);
      removeRecord(record, "revoked");
      return {
        success: true,
        code: "TASK_CLAIM_REVOKED",
        reason: String(reason).trim().slice(0, 256),
        record: publicRecord,
      };
    },
    revokeByPlanId(planIdInput: unknown, reason = "plan revoked") {
      const planId = normalizeId(planIdInput, "planId");
      const revoked: string[] = [];
      for (const record of [...recordsByDigest.values()]) {
        if (record.planId !== planId) continue;
        revoked.push(record.tokenFingerprint);
        removeRecord(record, "revoked");
      }
      return {
        success: true,
        code: "TASK_CLAIMS_REVOKED",
        reason: String(reason).trim().slice(0, 256),
        planId,
        revokedCount: revoked.length,
        tokenFingerprints: revoked,
      };
    },
    listByPlan(planIdInput: unknown) {
      const planId = normalizeId(planIdInput, "planId");
      const records = [...recordsByDigest.values()]
        .filter((record) => record.planId === planId && record.expiresAtMs > nowMs())
        .map(toPublicRecord);
      return { success: true, planId, count: records.length, records };
    },
    cleanup() {
      const removedCount = cleanupExpired();
      return { success: true, removedCount, remainingCount: activeDigestByTask.size };
    },
    close() {
      recordsByDigest.clear();
      activeDigestByTask.clear();
    },
  };
}

export const createTaskClaimTokenManager = createTaskClaimLeaseManager;
