/**
 * Durable, one-shot Agent tool approvals with argument locking.
 *
 * Approved arguments are AES-256-GCM sealed and may be consumed exactly once.
 * Every mutation is serialized and persisted before success is returned;
 * corrupt durable state fails closed instead of becoming an empty store.
 */

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import type {
  AgentToolApprovalRecord,
  AgentToolApprovalReview,
  ApprovalStatus,
} from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { containsSensitivePublicationText, redactSecretsInText } from "../security/secretSafety.js";
import { createGovernanceStateFileBinding } from "./governanceStateAnchor.ts";

const APPROVAL_KEY_INFO = "agent-governance-approval-args/v1";
const DEFAULT_APPROVAL_TTL_SECONDS = 24 * 60 * 60;
const APPROVAL_STATUSES = new Set<ApprovalStatus>(["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CONSUMED"]);
const GOVERNED_GIT_ENVELOPE_KEY = "__governanceApprovalEnvelope";

export interface CreateApprovalInput {
  agentId: string;
  toolName: string;
  arguments: unknown;
  tenantId: string;
  ttlSeconds?: number;
  reason?: string;
  review: AgentToolApprovalReview;
}

export interface AgentApprovalStore {
  create(
    input: CreateApprovalInput,
    beforeCommit?: (record: AgentToolApprovalRecord) => Promise<void>,
  ): Promise<AgentToolApprovalRecord>;
  decide(
    id: string,
    decision: "approve" | "reject",
    decidedBy: string,
    beforeCommit?: (record: AgentToolApprovalRecord) => Promise<void>,
  ): Promise<AgentToolApprovalRecord>;
  get(id: string): Promise<AgentToolApprovalRecord | null>;
  listPending(agentId?: string): Promise<AgentToolApprovalRecord[]>;
  recoverArguments(id: string): Promise<{ argumentsHash: string; args: unknown } | null>;
  findApproved(input: {
    agentId: string;
    tenantId: string;
    toolName: string;
    argumentsHash: string;
    policyHash: string;
  }): Promise<{ id: string } | null>;
  consumeApproved(input: {
    approvalId?: string;
    agentId: string;
    tenantId: string;
    toolName: string;
    argumentsHash: string;
    policyHash: string;
    executionId: string;
  }, beforeCommit?: (record: AgentToolApprovalRecord, args: unknown) => Promise<void>): Promise<{
    id: string;
    args: unknown;
    review: AgentToolApprovalReview;
  } | null>;
  expireStale(now: string): Promise<number>;
}

interface SealedArguments {
  aadVersion: 1;
  iv: string;
  tag: string;
  data: string;
}

interface StoredApprovalRecord extends AgentToolApprovalRecord {
  tenantId: string;
  reason?: string;
  sealedArguments: SealedArguments;
}

interface ApprovalsFile {
  version: 1;
  updatedAt: string;
  approvals: Record<string, StoredApprovalRecord>;
}

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "unified-ai-system", APPROVAL_KEY_INFO, 32));
}

function sealArguments(args: unknown, key: Buffer, aad: string): SealedArguments {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = Buffer.concat([
    cipher.update(stableStringify(args === undefined ? null : args), "utf8"),
    cipher.final(),
  ]);
  return {
    aadVersion: 1,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: data.toString("hex"),
  };
}

function openArguments(record: StoredApprovalRecord, key: Buffer): unknown {
  if (record.sealedArguments.aadVersion !== 1) {
    throw corrupt("Legacy approval ciphertext is not bound to its record identity.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.sealedArguments.iv, "hex"));
  decipher.setAAD(Buffer.from(approvalAad(record), "utf8"));
  decipher.setAuthTag(Buffer.from(record.sealedArguments.tag, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(record.sealedArguments.data, "hex")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plain);
}

function argumentsHashOf(args: unknown): string {
  return `sha256:${createHash("sha256").update(stableStringify(args === undefined ? null : args), "utf8").digest("hex")}`;
}

export function createAgentApprovalStore(options: {
  storePath?: string;
  secret: string;
  now?: () => string;
  maxPendingPerAgent?: number;
  maxPendingPerTenant?: number;
  maxRecords?: number;
  terminalRetentionMs?: number;
}): AgentApprovalStore {
  const storePath = options.storePath ?? ".data/agent-governance/approvals.json";
  const now = options.now ?? (() => new Date().toISOString());
  const key = deriveKey(options.secret);
  const maxPendingPerAgent = boundedInteger(options.maxPendingPerAgent, 32, 1, 1_000);
  const maxPendingPerTenant = boundedInteger(options.maxPendingPerTenant, 256, 1, 10_000);
  const maxRecords = boundedInteger(options.maxRecords, 10_000, 10, 100_000);
  const terminalRetentionMs = boundedInteger(
    options.terminalRetentionMs,
    7 * 24 * 60 * 60 * 1_000,
    60_000,
    365 * 24 * 60 * 60 * 1_000,
  );
  const state = createGovernanceStateFileBinding({
    filePath: storePath,
    secret: options.secret,
    kind: "json",
    validateLegacy: (content) => { parseApprovalsFile(content.toString("utf8"), key); },
  });
  const records = new Map<string, StoredApprovalRecord>();
  let loadPromise: Promise<void> | null = null;
  let mutationTail: Promise<void> = Promise.resolve();

  function load(): Promise<void> {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      await state.verify();
      try {
        const raw = await readFile(storePath, "utf8");
        const data = parseApprovalsFile(raw, key);
        for (const [id, record] of Object.entries(data.approvals)) {
          records.set(id, record);
        }
      } catch (error) {
        if (isMissingFile(error)) return;
        if ((error as Error)?.name === "GovernanceApprovalStoreCorrupt") throw error;
        throw corrupt("Approval store could not be parsed or read.", error);
      }
    })();
    return loadPromise;
  }

  async function persist(): Promise<void> {
    const file: ApprovalsFile = {
      version: 1,
      updatedAt: now(),
      approvals: Object.fromEntries(records),
    };
    await state.commit(JSON.stringify(file, null, 2));
  }

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }

  function publicView(record: StoredApprovalRecord): AgentToolApprovalRecord {
    const { tenantId: _tenant, reason: _reason, sealedArguments: _sealed, ...view } = record;
    return { ...view, review: normalizeApprovalReview(record.review) };
  }

  return {
    async create(input, beforeCommit) {
      await load();
      return exclusive(async () => {
        await state.verify();
        validateIdentity(input.agentId, input.tenantId, input.toolName);
        const id = `appr_${randomUUID()}`;
        const ttl = input.ttlSeconds && Number.isInteger(input.ttlSeconds) && input.ttlSeconds > 0
          ? input.ttlSeconds
          : DEFAULT_APPROVAL_TTL_SECONDS;
        const requestedAt = now();
        const argumentsHash = argumentsHashOf(input.arguments);
        const review = normalizeApprovalReview(input.review);
        verifyReviewMatchesArguments(review, input.arguments);
        const matchingPending = [...records.values()].find((candidate) => (
          candidate.status === "PENDING" && candidate.expiresAt > requestedAt
          && candidate.agentId === input.agentId && candidate.tenantId === input.tenantId
          && candidate.toolName === input.toolName && candidate.argumentsHash === argumentsHash
          && candidate.review.policyHash === review.policyHash
          && approvalReviewHash(candidate.review) === approvalReviewHash(review)
        ));
        if (matchingPending) {
          verifyRecoveredArguments(matchingPending, key);
          return publicView(matchingPending);
        }
        const newlyExpired: Array<[string, StoredApprovalRecord]> = [];
        for (const [approvalId, candidate] of records) {
          if ((candidate.status === "PENDING" || candidate.status === "APPROVED")
            && candidate.expiresAt <= requestedAt) {
            newlyExpired.push([approvalId, { ...candidate }]);
            candidate.status = "EXPIRED";
          }
        }
        const agentPending = [...records.values()].filter((candidate) => (
          candidate.status === "PENDING" && candidate.expiresAt > requestedAt
          && candidate.agentId === input.agentId && candidate.tenantId === input.tenantId
        )).length;
        const tenantPending = [...records.values()].filter((candidate) => (
          candidate.status === "PENDING" && candidate.expiresAt > requestedAt
          && candidate.tenantId === input.tenantId
        )).length;
        if (agentPending >= maxPendingPerAgent || tenantPending >= maxPendingPerTenant) {
          restoreChangedApprovals(records, newlyExpired);
          throw named("ApprovalPendingLimitReached", "Pending approval capacity is exhausted for this Agent or tenant.");
        }
        const pruned = pruneTerminalApprovals(records, requestedAt, terminalRetentionMs, maxRecords - 1);
        if (records.size >= maxRecords) {
          restorePrunedApprovals(records, pruned);
          restoreChangedApprovals(records, newlyExpired);
          throw named("ApprovalStoreCapacityExceeded", "Approval store capacity is exhausted by live records.");
        }
        const record: StoredApprovalRecord = {
          id,
          agentId: input.agentId,
          toolName: input.toolName,
          argumentsHash,
          status: "PENDING",
          requestedAt,
          expiresAt: new Date(new Date(requestedAt).getTime() + ttl * 1000).toISOString(),
          tenantId: input.tenantId,
          reason: input.reason,
          review,
          sealedArguments: null as unknown as SealedArguments,
        };
        record.sealedArguments = sealArguments(input.arguments, key, approvalAad(record));
        if (beforeCommit) {
          try { await beforeCommit(publicView(record)); }
          catch (error) {
            restorePrunedApprovals(records, pruned);
            restoreChangedApprovals(records, newlyExpired);
            throw error;
          }
        }
        records.set(id, record);
        try {
          await persist();
        } catch (error) {
          records.delete(id);
          restorePrunedApprovals(records, pruned);
          restoreChangedApprovals(records, newlyExpired);
          throw error;
        }
        return publicView(record);
      });
    },
    async decide(id, decision, decidedBy, beforeCommit) {
      await load();
      return exclusive(async () => {
        await state.verify();
        const record = records.get(id);
        if (!record) throw named("ApprovalNotFound", "Approval record not found.");
        if (record.status !== "PENDING") {
          throw named("ApprovalAlreadyDecided", `Approval already ${record.status}.`);
        }
        if (decision === "approve" && record.review.reviewable !== true) {
          throw named("ApprovalNotReviewable", "Approval cannot be granted without a safe operator review.");
        }
        if (decision === "approve") verifyRecoveredArguments(record, key);
        const previous = { ...record };
        const nowIso = now();
        if (record.expiresAt <= nowIso) {
          record.status = "EXPIRED";
          await persist();
          throw named("ApprovalExpired", "Approval has expired.");
        }
        record.status = decision === "approve" ? "APPROVED" : "REJECTED";
        record.decidedAt = nowIso;
        record.decidedBy = decidedBy;
        if (beforeCommit) {
          try {
            await beforeCommit(publicView(record));
          } catch (error) {
            records.set(id, previous);
            throw error;
          }
        }
        try {
          await persist();
        } catch (error) {
          records.set(id, previous);
          throw error;
        }
        return publicView(record);
      });
    },
    async get(id) {
      await load();
      await mutationTail;
      await state.verify();
      const record = records.get(id);
      if (!record) return null;
      if (record.status === "PENDING" || record.status === "APPROVED") verifyRecoveredArguments(record, key);
      return publicView(record);
    },
    async listPending(agentId) {
      await load();
      await mutationTail;
      await state.verify();
      return Array.from(records.values())
        .filter((record) => record.status === "PENDING"
          && (agentId ? record.agentId === agentId : true)
          && record.expiresAt > now())
        .map((record) => {
          verifyRecoveredArguments(record, key);
          return publicView(record);
        });
    },
    async recoverArguments(id) {
      await load();
      await mutationTail;
      await state.verify();
      const record = records.get(id);
      if (!record || record.status !== "APPROVED" || record.review.reviewable !== true
        || record.expiresAt <= now()) return null;
      try {
        return { argumentsHash: record.argumentsHash, args: verifyRecoveredArguments(record, key) };
      } catch (error) {
        throw corrupt("Approval arguments failed authenticated decryption.", error);
      }
    },
    async findApproved(input) {
      await load();
      await mutationTail;
      await state.verify();
      const nowIso = now();
      for (const record of records.values()) {
        if (record.status !== "APPROVED" || record.expiresAt <= nowIso) continue;
        if (record.agentId !== input.agentId || record.tenantId !== input.tenantId
          || record.toolName !== input.toolName || record.review.policyHash !== input.policyHash) continue;
        if (argumentsHashMatches(record.argumentsHash, input.argumentsHash)) return { id: record.id };
      }
      return null;
    },
    async consumeApproved(input, beforeCommit) {
      await load();
      return exclusive(async () => {
        await state.verify();
        for (const record of records.values()) {
          if (input.approvalId && record.id !== input.approvalId) continue;
          if (record.status !== "APPROVED" || record.review.reviewable !== true) continue;
          if (record.agentId !== input.agentId || record.tenantId !== input.tenantId
            || record.toolName !== input.toolName || record.review.policyHash !== input.policyHash
            || record.expiresAt <= now()) continue;
          if (!argumentsHashMatches(record.argumentsHash, input.argumentsHash)) continue;
          let args: unknown;
          try {
            args = verifyRecoveredArguments(record, key);
          } catch (error) {
            throw corrupt("Approval arguments failed authenticated decryption.", error);
          }
          const previous = { ...record };
          record.status = "CONSUMED";
          record.consumedAt = now();
          record.consumedByExecutionId = input.executionId;
          if (beforeCommit) {
            try {
              await beforeCommit(publicView(record), args);
            } catch (error) {
              records.set(record.id, previous);
              throw error;
            }
          }
          try {
            await persist();
          } catch (error) {
            records.set(record.id, previous);
            throw error;
          }
          return { id: record.id, args, review: normalizeApprovalReview(record.review) };
        }
        return null;
      });
    },
    async expireStale(nowIso) {
      await load();
      return exclusive(async () => {
        await state.verify();
        const changed: Array<[string, StoredApprovalRecord]> = [];
        for (const [id, record] of records) {
          if ((record.status === "PENDING" || record.status === "APPROVED") && record.expiresAt <= nowIso) {
            changed.push([id, { ...record }]);
            record.status = "EXPIRED";
          }
        }
        if (changed.length === 0) return 0;
        try {
          await persist();
        } catch (error) {
          for (const [id, previous] of changed) records.set(id, previous);
          throw error;
        }
        return changed.length;
      });
    },
  };
}

function approvalReviewHash(review: AgentToolApprovalReview): string {
  return createHash("sha256").update(stableStringify(normalizeApprovalReview(review)), "utf8").digest("hex");
}

function pruneTerminalApprovals(
  records: Map<string, StoredApprovalRecord>,
  nowIso: string,
  retentionMs: number,
  targetMaximum: number,
): Array<[string, StoredApprovalRecord]> {
  const nowMs = Date.parse(nowIso);
  const terminal = [...records.entries()]
    .filter(([, record]) => record.status !== "PENDING" && record.status !== "APPROVED")
    .sort((left, right) => terminalTimestamp(left[1]) - terminalTimestamp(right[1]));
  const removed: Array<[string, StoredApprovalRecord]> = [];
  for (const [id, record] of terminal) {
    const expiredByRetention = Number.isFinite(nowMs)
      && nowMs - terminalTimestamp(record) >= retentionMs;
    if (!expiredByRetention && records.size <= targetMaximum) continue;
    records.delete(id);
    removed.push([id, record]);
  }
  return removed;
}

function restorePrunedApprovals(
  records: Map<string, StoredApprovalRecord>,
  removed: Array<[string, StoredApprovalRecord]>,
): void {
  for (const [id, record] of removed) records.set(id, record);
}

function restoreChangedApprovals(
  records: Map<string, StoredApprovalRecord>,
  changed: Array<[string, StoredApprovalRecord]>,
): void {
  for (const [id, record] of changed) records.set(id, record);
}

function terminalTimestamp(record: StoredApprovalRecord): number {
  for (const candidate of [record.consumedAt, record.decidedAt, record.expiresAt, record.requestedAt]) {
    const parsed = Date.parse(candidate ?? "");
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function parseApprovalsFile(raw: string, key: Buffer): ApprovalsFile {
  let data: ApprovalsFile;
  try { data = JSON.parse(raw) as ApprovalsFile; }
  catch (error) { throw corrupt("Approval store could not be parsed.", error); }
  if (data?.version !== 1 || !data.approvals || typeof data.approvals !== "object"
    || Array.isArray(data.approvals)) {
    throw corrupt("Approval store has an unsupported or malformed schema.");
  }
  const approvals: Record<string, StoredApprovalRecord> = {};
  for (const [id, candidate] of Object.entries(data.approvals)) {
    const record = validateStoredRecord(id, candidate);
    let args: unknown;
    try { args = openArguments(record, key); }
    catch (error) { throw corrupt(`Approval ${id} failed authenticated decryption.`, error); }
    if (!argumentsHashMatches(record.argumentsHash, argumentsHashOf(args))) {
      throw corrupt(`Approval ${id} arguments hash does not match its authenticated payload.`);
    }
    verifyReviewMatchesArguments(record.review, args);
    approvals[id] = record;
  }
  return { ...data, approvals };
}

function validateStoredRecord(id: string, input: unknown): StoredApprovalRecord {
  if (!/^appr_[A-Za-z0-9_-]{1,128}$/u.test(id) || !input || typeof input !== "object" || Array.isArray(input)) {
    throw corrupt("Approval record identity is malformed.");
  }
  const record = input as StoredApprovalRecord;
  validateIdentity(record.agentId, record.tenantId, record.toolName);
  if (record.id !== id || !APPROVAL_STATUSES.has(record.status)
    || !/^sha256:[a-f0-9]{64}$/u.test(record.argumentsHash)
    || !isIsoDate(record.requestedAt) || !isIsoDate(record.expiresAt)
    || !record.sealedArguments || (record.sealedArguments.aadVersion !== undefined
      && record.sealedArguments.aadVersion !== 1)
    || !isHex(record.sealedArguments.iv, 24)
    || !isHex(record.sealedArguments.tag, 32) || !isHex(record.sealedArguments.data)) {
    throw corrupt(`Approval ${id} is malformed.`);
  }
  const review = record.review === undefined
    ? legacyUnreviewableApproval()
    : normalizeApprovalReview(record.review);
  return { ...record, review, sealedArguments: { ...record.sealedArguments } };
}

function approvalAad(record: Pick<StoredApprovalRecord,
  "id" | "agentId" | "tenantId" | "toolName" | "argumentsHash" | "requestedAt" | "expiresAt" | "review"
>): string {
  return stableStringify({
    schema: "agent-governance-approval-aad/v1",
    id: record.id,
    agentId: record.agentId,
    tenantId: record.tenantId,
    toolName: record.toolName,
    argumentsHash: record.argumentsHash,
    requestedAt: record.requestedAt,
    expiresAt: record.expiresAt,
    review: normalizeApprovalReview(record.review),
  });
}

function verifyRecoveredArguments(record: StoredApprovalRecord, key: Buffer): unknown {
  const args = openArguments(record, key);
  if (!argumentsHashMatches(record.argumentsHash, argumentsHashOf(args))) {
    throw corrupt("Approval arguments do not match their authenticated hash.");
  }
  verifyReviewMatchesArguments(record.review, args);
  return args;
}

const KNOWN_REVIEWABLE_EFFECTS = new Set([
  "git:push",
  "github:pull-request-create",
  "mcp:upstream-tool-call",
  "forge:orchestrate",
  "workforce:execute",
]);

function normalizeApprovalReview(input: unknown): AgentToolApprovalReview {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw corrupt("Approval review metadata is malformed.");
  }
  const source = input as AgentToolApprovalReview;
  if (source.schemaVersion !== 1 || typeof source.reviewable !== "boolean"
    || !boundedSafeText(source.effectType, 128)
    || !/^sha256:[a-f0-9]{64}$/u.test(source.policyHash)) {
    throw corrupt("Approval review metadata has an unsupported or malformed schema.");
  }
  if (source.reviewable !== true) {
    return {
      schemaVersion: 1,
      reviewable: false,
      effectType: source.effectType,
      policyHash: source.policyHash,
      unavailableReason: "No safe operator review is available for this tool request.",
    };
  }
  if (!KNOWN_REVIEWABLE_EFFECTS.has(source.effectType)) {
    throw corrupt("Approval review attempts to mark an unsupported external effect as reviewable.");
  }
  if (source.effectType === "mcp:upstream-tool-call") return normalizeMcpApprovalReview(source);
  if (source.effectType === "forge:orchestrate") return normalizeForgeApprovalReview(source);
  if (source.effectType === "workforce:execute") return normalizeWorkforceApprovalReview(source);
  assertGitReviewKeys(source as unknown as Record<string, unknown>, source.effectType, true);
  const repository = normalizeRepository(source.repository);
  const remote = normalizeRemote(source.remote);
  const branchSource = normalizeSource(source.source);
  const destination = normalizeDestination(source.destination);
  if (source.effectType === "git:push") {
    if (!source.options || source.options.setUpstream !== false || source.options.forceMode !== "none") {
      throw corrupt("Git push approval options are malformed or unsafe.");
    }
    return {
      schemaVersion: 1,
      reviewable: true,
      effectType: source.effectType,
      policyHash: source.policyHash,
      repository,
      remote,
      source: branchSource,
      destination,
      options: { setUpstream: false, forceMode: "none" },
    };
  }
  const pullRequest = source.pullRequest;
  if (!branchSource.remoteCommit || branchSource.remoteCommit !== branchSource.commit
    || !pullRequest || !portableTarget(pullRequest.repository) || !safeBranch(pullRequest.headBranch)
    || !safeBranch(pullRequest.baseBranch)
    || !safePrTitle(pullRequest.title) || !safePrBody(pullRequest.body)
    || !/^sha256:[a-f0-9]{64}$/u.test(pullRequest.bodyHash)
    || !Number.isSafeInteger(pullRequest.bodyBytes) || pullRequest.bodyBytes < 0 || pullRequest.bodyBytes > 20_000
    || pullRequest.bodyHash !== digestText(pullRequest.body)
    || pullRequest.bodyBytes !== Buffer.byteLength(pullRequest.body, "utf8")
    || typeof pullRequest.draft !== "boolean") {
    throw corrupt("Pull-request approval review is malformed.");
  }
  return {
    schemaVersion: 1,
    reviewable: true,
    effectType: source.effectType,
    policyHash: source.policyHash,
    repository,
    remote,
    source: branchSource,
    destination,
    pullRequest: {
      repository: pullRequest.repository,
      headBranch: pullRequest.headBranch,
      baseBranch: pullRequest.baseBranch,
      title: pullRequest.title,
      body: pullRequest.body,
      bodyHash: pullRequest.bodyHash,
      bodyBytes: pullRequest.bodyBytes,
      draft: pullRequest.draft,
    },
  };
}

function normalizeRepository(value: AgentToolApprovalReview["repository"]) {
  if (!value || !boundedSafeText(value.displayName, 128)
    || !/^sha256:[a-f0-9]{64}$/u.test(value.fingerprint)) {
    throw corrupt("Approval repository review is malformed.");
  }
  return { displayName: redactPublicText(value.displayName, 128), fingerprint: value.fingerprint };
}

function normalizeRemote(value: AgentToolApprovalReview["remote"]) {
  if (!value || !boundedSafeText(value.name, 128) || !portableTarget(value.target)
    || !/^sha256:[a-f0-9]{64}$/u.test(value.urlFingerprint)) {
    throw corrupt("Approval remote review is malformed.");
  }
  return { name: value.name, target: value.target, urlFingerprint: value.urlFingerprint };
}

function normalizeSource(value: AgentToolApprovalReview["source"]) {
  if (!value || !safeBranch(value.branch) || !/^[a-f0-9]{40,64}$/u.test(value.commit)) {
    throw corrupt("Approval source review is malformed.");
  }
  if (value.remoteCommit !== undefined && !/^[a-f0-9]{40,64}$/u.test(value.remoteCommit)) {
    throw corrupt("Approval remote source review is malformed.");
  }
  return {
    branch: value.branch,
    commit: value.commit,
    ...(value.remoteCommit ? { remoteCommit: value.remoteCommit } : {}),
  };
}

function normalizeDestination(value: AgentToolApprovalReview["destination"]) {
  if (!value || !safeBranch(value.branch)) throw corrupt("Approval destination review is malformed.");
  return { branch: value.branch };
}

const SAFE_MCP_REVIEW_FIELD = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const FORBIDDEN_MCP_REVIEW_FIELD = /secret|token|password|authorization|credential|key|cookie|session|bearer/iu;
const FORBIDDEN_MCP_ARGUMENT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function normalizeMcpApprovalReview(source: AgentToolApprovalReview): AgentToolApprovalReview {
  const mcp = source.mcp;
  if (!mcp || !/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/u.test(mcp.serverId)
    || !boundedSafeText(mcp.toolName, 256)
    || mcp.target !== `mcp://${mcp.serverId}/${encodeURIComponent(mcp.toolName)}`
    || !/^sha256:[a-f0-9]{64}$/u.test(mcp.targetFingerprint)
    || !/^sha256:[a-f0-9]{64}$/u.test(mcp.argumentsHash)
    || !Number.isSafeInteger(mcp.argumentsBytes) || mcp.argumentsBytes < 0 || mcp.argumentsBytes > 100_000
    || typeof mcp.externalEffectRequired !== "boolean"
    || !mcp.reviewedArguments || typeof mcp.reviewedArguments !== "object"
    || Array.isArray(mcp.reviewedArguments)
    || !Array.isArray(mcp.omittedArgumentKeys) || mcp.omittedArgumentKeys.length !== 0) {
    throw corrupt("MCP approval review is malformed or incomplete.");
  }
  const entries = Object.entries(mcp.reviewedArguments);
  if (entries.length > 32) throw corrupt("MCP approval review contains too many arguments.");
  const reviewedArguments: Record<string, string | number | boolean | null> = Object.create(null);
  for (const [key, value] of entries) {
    if (!SAFE_MCP_REVIEW_FIELD.test(key) || FORBIDDEN_MCP_REVIEW_FIELD.test(key)
      || FORBIDDEN_MCP_ARGUMENT_KEYS.has(key)
      || !isSafeMcpReviewScalar(value)) {
      throw corrupt("MCP approval review contains an unsafe argument field or value.");
    }
    reviewedArguments[key] = value;
  }
  return {
    schemaVersion: 1,
    reviewable: true,
    effectType: source.effectType,
    policyHash: source.policyHash,
    mcp: {
      serverId: mcp.serverId,
      toolName: mcp.toolName,
      target: mcp.target,
      targetFingerprint: mcp.targetFingerprint,
      argumentsHash: mcp.argumentsHash,
      argumentsBytes: mcp.argumentsBytes,
      externalEffectRequired: mcp.externalEffectRequired,
      reviewedArguments,
      omittedArgumentKeys: [],
    },
  };
}

function isSafeMcpReviewScalar(value: unknown): value is string | number | boolean | null {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || value.length > 256 || /[\u0000-\u001f\u007f]/u.test(value)) return false;
  const redacted = redactSecretsInText(value)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]{8,}/giu, "$1 ***REDACTED***")
    .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu, "$1=***REDACTED***");
  return redacted === value;
}

function normalizeForgeApprovalReview(source: AgentToolApprovalReview): AgentToolApprovalReview {
  const forge = source.forge;
  if (!forge || typeof forge.goal !== "string" || !forge.goal.trim() || forge.goal.length > 16_000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(forge.goal)
    || !isSafePublishedText(forge.goal)
    || !/^sha256:[a-f0-9]{64}$/u.test(forge.goalDigest)
    || forge.goalDigest !== digestText(forge.goal)
    || !Number.isSafeInteger(forge.goalBytes) || forge.goalBytes !== Buffer.byteLength(forge.goal, "utf8")
    || !/^sha256:[a-f0-9]{64}$/u.test(forge.optionsHash)) {
    throw corrupt("Forge approval review is malformed or unsafe.");
  }
  const options = normalizeForgeOptions(forge.options);
  if (forge.optionsHash !== digestText(stableStringify(options))) {
    throw corrupt("Forge approval options do not match their authenticated review hash.");
  }
  return {
    schemaVersion: 1,
    reviewable: true,
    effectType: source.effectType,
    policyHash: source.policyHash,
    forge: {
      goal: forge.goal,
      goalDigest: forge.goalDigest,
      goalBytes: forge.goalBytes,
      optionsHash: forge.optionsHash,
      options,
    },
  };
}

function normalizeForgeOptions(value: AgentToolApprovalReview["forge"] extends infer T
  ? T extends { options: infer O } ? O : never
  : never) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("Forge approval options are malformed.");
  }
  const source = value as Record<string, unknown>;
  const allowedKeys = new Set(["enableCodeIntel", "useRefiner", "maxConcurrent", "budget", "checkpointAfter"]);
  if (Object.keys(source).some((key) => !allowedKeys.has(key)) || source.enableCodeIntel !== false) {
    throw corrupt("Forge approval options contain an unsupported or unsafe field.");
  }
  const options: NonNullable<AgentToolApprovalReview["forge"]>["options"] = { enableCodeIntel: false };
  if (source.useRefiner !== undefined) {
    if (typeof source.useRefiner !== "boolean") throw corrupt("Forge useRefiner approval option is malformed.");
    options.useRefiner = source.useRefiner;
  }
  if (source.maxConcurrent !== undefined) {
    if (!Number.isSafeInteger(source.maxConcurrent) || Number(source.maxConcurrent) < 1 || Number(source.maxConcurrent) > 8) {
      throw corrupt("Forge maxConcurrent approval option is out of bounds.");
    }
    options.maxConcurrent = Number(source.maxConcurrent);
  }
  if (source.budget !== undefined) {
    if (!source.budget || typeof source.budget !== "object" || Array.isArray(source.budget)) {
      throw corrupt("Forge budget approval option is malformed.");
    }
    const budgetSource = source.budget as Record<string, unknown>;
    if (Object.keys(budgetSource).some((key) => !new Set(["maxTokens", "maxCost", "maxMinutes"]).has(key))) {
      throw corrupt("Forge budget approval option contains an unsupported field.");
    }
    const budget: NonNullable<NonNullable<AgentToolApprovalReview["forge"]>["options"]["budget"]> = {};
    if (budgetSource.maxTokens !== undefined) {
      if (!Number.isSafeInteger(budgetSource.maxTokens) || Number(budgetSource.maxTokens) < 1
        || Number(budgetSource.maxTokens) > 1_000_000) throw corrupt("Forge maxTokens approval option is out of bounds.");
      budget.maxTokens = Number(budgetSource.maxTokens);
    }
    if (budgetSource.maxCost !== undefined) {
      if (typeof budgetSource.maxCost !== "number" || !Number.isFinite(budgetSource.maxCost)
        || budgetSource.maxCost < 0 || budgetSource.maxCost > 100) throw corrupt("Forge maxCost approval option is out of bounds.");
      budget.maxCost = budgetSource.maxCost;
    }
    if (budgetSource.maxMinutes !== undefined) {
      if (!Number.isSafeInteger(budgetSource.maxMinutes) || Number(budgetSource.maxMinutes) < 1
        || Number(budgetSource.maxMinutes) > 120) throw corrupt("Forge maxMinutes approval option is out of bounds.");
      budget.maxMinutes = Number(budgetSource.maxMinutes);
    }
    options.budget = budget;
  }
  if (source.checkpointAfter !== undefined) {
    if (!Array.isArray(source.checkpointAfter) || source.checkpointAfter.length > 64
      || source.checkpointAfter.some((item) => typeof item !== "string" || !/^[A-Za-z0-9._-]{1,128}$/u.test(item))) {
      throw corrupt("Forge checkpointAfter approval option is malformed.");
    }
    options.checkpointAfter = [...source.checkpointAfter] as string[];
  }
  return options;
}

function normalizeWorkforceApprovalReview(source: AgentToolApprovalReview): AgentToolApprovalReview {
  const workforce = source.workforce;
  if (!workforce || typeof workforce.goal !== "string" || !workforce.goal.trim()
    || workforce.goal.length > 4_000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(workforce.goal)
    || !isSafePublishedText(workforce.goal)
    || !/^sha256:[a-f0-9]{64}$/u.test(workforce.goalDigest)
    || workforce.goalDigest !== digestText(workforce.goal)
    || !Number.isSafeInteger(workforce.goalBytes)
    || workforce.goalBytes !== Buffer.byteLength(workforce.goal, "utf8")
    || typeof workforce.planId !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(workforce.planId)
    || !/^sha256:[a-f0-9]{64}$/u.test(workforce.planDigest)
    || !boundedSafeText(workforce.autonomyMode, 64)
    || !Array.isArray(workforce.requiredScopes) || workforce.requiredScopes.length > 8
    || workforce.requiredScopes.some((scope) => !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/u.test(scope))
    || new Set(workforce.requiredScopes).size !== workforce.requiredScopes.length
    || !/^sha256:[a-f0-9]{64}$/u.test(workforce.optionsHash)) {
    throw corrupt("Workforce approval review is malformed or unsafe.");
  }
  const options = normalizeWorkforceOptions(workforce.options);
  if (workforce.optionsHash !== digestText(stableStringify(options))) {
    throw corrupt("Workforce approval options do not match their authenticated review hash.");
  }
  return {
    schemaVersion: 1,
    reviewable: true,
    effectType: source.effectType,
    policyHash: source.policyHash,
    workforce: {
      goal: workforce.goal,
      goalDigest: workforce.goalDigest,
      goalBytes: workforce.goalBytes,
      planId: workforce.planId,
      planDigest: workforce.planDigest,
      autonomyMode: workforce.autonomyMode,
      requiredScopes: [...workforce.requiredScopes],
      optionsHash: workforce.optionsHash,
      options,
    },
  };
}

function normalizeWorkforceOptions(value: unknown): NonNullable<AgentToolApprovalReview["workforce"]>["options"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("Workforce approval options are malformed.");
  }
  const source = value as Record<string, unknown>;
  if (Object.keys(source).sort().join("\0") !== ["selectedRoleCount", "templateSelected"].sort().join("\0")
    || (source.selectedRoleCount !== null
      && (!Number.isSafeInteger(source.selectedRoleCount)
        || Number(source.selectedRoleCount) < 0 || Number(source.selectedRoleCount) > 128))
    || typeof source.templateSelected !== "boolean") {
    throw corrupt("Workforce approval options are malformed or out of bounds.");
  }
  return {
    selectedRoleCount: source.selectedRoleCount === null ? null : Number(source.selectedRoleCount),
    templateSelected: source.templateSelected,
  };
}

function verifyReviewMatchesArguments(review: AgentToolApprovalReview, value: unknown): void {
  if (review.effectType === "mcp:upstream-tool-call") {
    verifyMcpReviewMatchesArguments(review, value);
    return;
  }
  if (review.effectType === "forge:orchestrate") {
    verifyForgeReviewMatchesArguments(review, value);
    return;
  }
  if (review.effectType === "workforce:execute") {
    verifyWorkforceReviewMatchesArguments(review, value);
    return;
  }
  if (review.effectType === "github:pull-request-create") {
    verifyGitPrReviewMatchesArguments(review, value);
    return;
  }
  if (review.effectType === "git:push") {
    verifyGitPushReviewMatchesArguments(review, value);
  }
}

function verifyGitPushReviewMatchesArguments(review: AgentToolApprovalReview, value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !review.remote || !review.source || !review.destination || !review.options) {
    throw corrupt("Git push approval arguments do not match their review envelope.");
  }
  const args = value as Record<string, unknown>;
  if ((Object.hasOwn(args, "remote") && args.remote !== review.remote.name)
    || (Object.hasOwn(args, "branch") && (args.branch !== review.source.branch
      || args.branch !== review.destination.branch))
    || (Object.hasOwn(args, "force") && args.force !== false)
    || (Object.hasOwn(args, "setUpstream") && args.setUpstream !== false)) {
    throw corrupt("Git push approval arguments do not match the complete operator review.");
  }
  verifyGovernedGitEnvelope(review, args, "git_push");
}

function verifyWorkforceReviewMatchesArguments(review: AgentToolApprovalReview, value: unknown): void {
  const workforce = review.workforce;
  if (!workforce || !value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("Workforce approval arguments do not match their review envelope.");
  }
  const args = value as Record<string, unknown>;
  const keys = Object.keys(args).sort();
  const options = normalizeWorkforceArgumentOptions(args.options);
  if (keys.join("\0") !== ["goal", "goalBytes", "goalDigest", "options", "planDigest", "planId"].sort().join("\0")
    || args.goal !== workforce.goal
    || args.planId !== workforce.planId
    || args.planDigest !== workforce.planDigest.slice("sha256:".length)
    || args.goalDigest !== workforce.goalDigest.slice("sha256:".length)
    || args.goalBytes !== workforce.goalBytes
    || options.autonomyMode !== workforce.autonomyMode
    || stableStringify(options.requiredScopes) !== stableStringify(workforce.requiredScopes)
    || workforce.optionsHash !== digestText(stableStringify({
      selectedRoleCount: options.selectedRoleCount,
      templateSelected: options.templateSelected,
    }))) {
    throw corrupt("Workforce approval arguments do not match the complete operator review.");
  }
}

function normalizeWorkforceArgumentOptions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("Workforce approval argument options are malformed.");
  }
  const source = value as Record<string, unknown>;
  if (Object.keys(source).sort().join("\0")
      !== ["autonomyMode", "requiredScopes", "selectedRoleCount", "templateSelected"].sort().join("\0")
    || !boundedSafeText(source.autonomyMode, 64)
    || !Array.isArray(source.requiredScopes) || source.requiredScopes.length > 8
    || source.requiredScopes.some((scope) => typeof scope !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/u.test(scope))
    || new Set(source.requiredScopes).size !== source.requiredScopes.length
    || (source.selectedRoleCount !== null
      && (!Number.isSafeInteger(source.selectedRoleCount)
        || Number(source.selectedRoleCount) < 0 || Number(source.selectedRoleCount) > 128))
    || typeof source.templateSelected !== "boolean") {
    throw corrupt("Workforce approval argument options are malformed.");
  }
  return {
    autonomyMode: source.autonomyMode as string,
    requiredScopes: [...source.requiredScopes] as string[],
    selectedRoleCount: source.selectedRoleCount === null ? null : Number(source.selectedRoleCount),
    templateSelected: source.templateSelected,
  };
}

function verifyForgeReviewMatchesArguments(review: AgentToolApprovalReview, value: unknown): void {
  const forge = review.forge;
  if (!forge || !value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("Forge approval arguments do not match their review envelope.");
  }
  const args = value as Record<string, unknown>;
  const keys = Object.keys(args).sort();
  const options = normalizeForgeOptions(args.options as NonNullable<AgentToolApprovalReview["forge"]>["options"]);
  if (keys.join("\0") !== ["goalBytes", "goalDigest", "options"].join("\0")
    || args.goalDigest !== forge.goalDigest.slice("sha256:".length)
    || args.goalBytes !== forge.goalBytes
    || forge.goalDigest !== digestText(forge.goal)
    || forge.goalBytes !== Buffer.byteLength(forge.goal, "utf8")
    || forge.optionsHash !== digestText(stableStringify(options))
    || stableStringify(options) !== stableStringify(forge.options)) {
    throw corrupt("Forge approval arguments do not match the complete operator review.");
  }
}

function verifyGitPrReviewMatchesArguments(review: AgentToolApprovalReview, value: unknown): void {
  const pullRequest = review.pullRequest;
  if (!pullRequest || !value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("Pull-request approval arguments do not match their review envelope.");
  }
  const args = value as Record<string, unknown>;
  const body = args.body === undefined || args.body === null ? "" : args.body;
  if (args.title !== pullRequest.title || body !== pullRequest.body
    || args.base !== pullRequest.baseBranch || args.draft !== pullRequest.draft
    || pullRequest.bodyHash !== digestText(pullRequest.body)
    || pullRequest.bodyBytes !== Buffer.byteLength(pullRequest.body, "utf8")) {
    throw corrupt("Pull-request approval arguments do not match the complete operator review.");
  }
  verifyGovernedGitEnvelope(review, args, "git_create_pr");
}

function verifyGovernedGitEnvelope(
  review: AgentToolApprovalReview,
  args: Record<string, unknown>,
  expectedToolName: "git_push" | "git_create_pr",
): void {
  if (!Object.hasOwn(args, GOVERNED_GIT_ENVELOPE_KEY)) return;
  assertExactKeys(args, expectedToolName === "git_push"
    ? ["remote", "branch", "force", "setUpstream", GOVERNED_GIT_ENVELOPE_KEY]
    : ["title", "body", "base", "draft", "directory", GOVERNED_GIT_ENVELOPE_KEY], false,
  "Governed Git arguments contain an unsupported field.");
  const rawEnvelope = args[GOVERNED_GIT_ENVELOPE_KEY];
  if (!rawEnvelope || typeof rawEnvelope !== "object" || Array.isArray(rawEnvelope)) {
    throw corrupt("Governed Git approval envelope is malformed.");
  }
  const envelope = rawEnvelope as Record<string, unknown>;
  assertExactKeys(envelope, ["schemaVersion", "toolName", "review", "privateExecution"], true,
    "Governed Git approval envelope contains an unsupported field.");
  if (envelope.schemaVersion !== 1 || envelope.toolName !== expectedToolName
    || !envelope.review || typeof envelope.review !== "object" || Array.isArray(envelope.review)) {
    throw corrupt("Governed Git approval envelope identity is malformed.");
  }
  assertGitReviewKeys(envelope.review as Record<string, unknown>, review.effectType);
  const normalizedEnvelopeReview = normalizeApprovalReview({
    ...(envelope.review as Record<string, unknown>),
    policyHash: review.policyHash,
  });
  if (stableStringify(normalizedEnvelopeReview) !== stableStringify(normalizeApprovalReview(review))) {
    throw corrupt("Governed Git private execution envelope does not match the operator-visible review.");
  }
  verifyGitPrivateExecution(envelope.privateExecution, review, expectedToolName);
}

function assertGitReviewKeys(
  source: Record<string, unknown>,
  effectType: string,
  includePolicyHash = false,
): void {
  const common = [
    "schemaVersion", "reviewable", "effectType", "repository", "remote", "source", "destination",
    ...(includePolicyHash ? ["policyHash"] : []),
  ];
  assertExactKeys(source, effectType === "git:push"
    ? [...common, "options"]
    : [...common, "pullRequest"], false, "Governed Git review contains an unsupported field.");
  assertExactKeys(asPlainRecord(source.repository, "Git repository review"), ["displayName", "fingerprint"], false,
    "Git repository review contains an unsupported field.");
  assertExactKeys(asPlainRecord(source.remote, "Git remote review"), ["name", "target", "urlFingerprint"], false,
    "Git remote review contains an unsupported field.");
  assertExactKeys(asPlainRecord(source.source, "Git source review"), ["branch", "commit", "remoteCommit"], true,
    "Git source review contains an unsupported field.");
  assertExactKeys(asPlainRecord(source.destination, "Git destination review"), ["branch"], false,
    "Git destination review contains an unsupported field.");
  if (effectType === "git:push") {
    assertExactKeys(asPlainRecord(source.options, "Git push options review"), ["setUpstream", "forceMode"], false,
      "Git push options review contains an unsupported field.");
    return;
  }
  assertExactKeys(asPlainRecord(source.pullRequest, "Pull-request review"), [
    "repository", "headBranch", "baseBranch", "title", "body", "bodyHash", "bodyBytes", "draft",
  ], false, "Pull-request review contains an unsupported field.");
}

function verifyGitPrivateExecution(
  value: unknown,
  review: AgentToolApprovalReview,
  toolName: "git_push" | "git_create_pr",
): void {
  const execution = asPlainRecord(value, "Governed Git private execution metadata");
  assertExactKeys(execution, [
    "remoteTarget", "prHeadBranch", "credentialHelpers", "credentialUseHttpPath",
  ], true, "Governed Git private execution metadata contains an unsupported field.");
  if (!boundedSafeText(execution.remoteTarget, 2_048)
    || (execution.prHeadBranch !== undefined && !safeBranch(execution.prHeadBranch))
    || (toolName === "git_create_pr" && execution.prHeadBranch !== review.pullRequest?.headBranch)
    || (toolName === "git_push" && execution.prHeadBranch !== undefined)
    || (execution.credentialUseHttpPath !== undefined && typeof execution.credentialUseHttpPath !== "boolean")
    || (execution.credentialHelpers !== undefined && (!Array.isArray(execution.credentialHelpers)
      || execution.credentialHelpers.length > 16
      || execution.credentialHelpers.some((item) => !boundedSafeText(item, 256))))) {
    throw corrupt("Governed Git private execution metadata is malformed or inconsistent.");
  }
}

function asPlainRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt(`${label} is malformed.`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: string[],
  optionalAllowed: boolean,
  message: string,
): void {
  const keys = Object.keys(value);
  const allowedSet = new Set(allowed);
  if (keys.some((key) => !allowedSet.has(key) || FORBIDDEN_MCP_ARGUMENT_KEYS.has(key))
    || (!optionalAllowed && keys.length !== allowed.length)
    || (!optionalAllowed && allowed.some((key) => !Object.hasOwn(value, key)))) {
    throw corrupt(message);
  }
}

function verifyMcpReviewMatchesArguments(review: AgentToolApprovalReview, value: unknown): void {
  const mcp = review.mcp;
  if (!mcp || !value || typeof value !== "object" || Array.isArray(value)) {
    throw corrupt("MCP approval arguments do not match their review envelope.");
  }
  const envelope = value as Record<string, unknown>;
  const rawArgs = envelope.args;
  const envelopeKeys = Object.keys(envelope).sort();
  const rawArgumentKeys = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
    ? Object.keys(rawArgs as Record<string, unknown>).sort()
    : [];
  const reviewedKeys = Object.keys(mcp.reviewedArguments).sort();
  if (envelopeKeys.join("\0") !== ["args", "serverName", "toolName"].join("\0")
    || !Object.hasOwn(envelope, "serverName") || !Object.hasOwn(envelope, "toolName") || !Object.hasOwn(envelope, "args")
    || envelope.serverName !== mcp.serverId || envelope.toolName !== mcp.toolName
    || !rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)
    || rawArgumentKeys.some((key) => FORBIDDEN_MCP_ARGUMENT_KEYS.has(key))
    || rawArgumentKeys.join("\0") !== reviewedKeys.join("\0")
    || !argumentsHashMatches(mcp.argumentsHash, argumentsHashOf(rawArgs))
    || Buffer.byteLength(JSON.stringify(rawArgs), "utf8") !== mcp.argumentsBytes
    || stableStringify(rawArgs) !== stableStringify(mcp.reviewedArguments)
    || Object.keys(rawArgs as Record<string, unknown>).length !== Object.keys(mcp.reviewedArguments).length) {
    throw corrupt("MCP approval arguments do not match their safe operator review.");
  }
}

function safeBranch(value: unknown): value is string {
  return boundedSafeText(value, 255) && !String(value).startsWith("-")
    && !/[\s~^:?*\[\\\]|;&$`<>()\{\}!#"']/u.test(String(value));
}

function portableTarget(value: unknown): value is string {
  return typeof value === "string" && value.length <= 384
    && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){1,2}$/u.test(value);
}

function boundedSafeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function safePrTitle(value: unknown): value is string {
  return boundedSafeText(value, 200) && isSafePublishedText(value);
}

function safePrBody(value: unknown): value is string {
  return typeof value === "string" && value.length <= 5_000
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    && isSafePublishedText(value);
}

function isSafePublishedText(value: string): boolean {
  return !containsSensitivePublicationText(value);
}

function digestText(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function redactPublicText(value: string, maximum: number): string {
  return redactSecretsInText(value)
    .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu, "$1=***REDACTED***")
    .slice(0, maximum);
}

function legacyUnreviewableApproval(): AgentToolApprovalReview {
  return {
    schemaVersion: 1,
    reviewable: false,
    effectType: "legacy:unreviewable",
    policyHash: `sha256:${"0".repeat(64)}`,
    unavailableReason: "No safe operator review is available for this legacy approval.",
  };
}

function validateIdentity(agentId: string, tenantId: string, toolName: string): void {
  if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)
    || typeof tenantId !== "string" || tenantId.trim() === ""
    || typeof toolName !== "string" || toolName.trim() === "") {
    throw corrupt("Approval identity fields are malformed.");
  }
}

function isHex(value: unknown, exactLength?: number): value is string {
  return typeof value === "string" && (exactLength === undefined || value.length === exactLength)
    && value.length % 2 === 0 && /^[a-f0-9]*$/u.test(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function named(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function corrupt(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "GovernanceApprovalStoreCorrupt";
  return error;
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

/** Constant-time comparison of two argument hashes. */
export function argumentsHashMatches(left: string, right: string): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
