/**
 * Agent tool approval store with argument locking.
 *
 * When a tool decision is require_approval, execution halts and an
 * approval record is created. The exact arguments are hashed (locking)
 * and encrypted (AES-256-GCM under an HKDF-derived key) server-side —
 * agents never re-supply arguments after approval. Only the identical
 * argument hash may execute once an approval is granted.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentToolApprovalRecord } from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";

const APPROVAL_KEY_INFO = "agent-governance-approval-args/v1";
const DEFAULT_APPROVAL_TTL_SECONDS = 24 * 60 * 60;

export interface CreateApprovalInput {
  agentId: string;
  toolName: string;
  arguments: unknown;
  tenantId: string;
  ttlSeconds?: number;
  reason?: string;
}

export interface AgentApprovalStore {
  create(input: CreateApprovalInput): Promise<AgentToolApprovalRecord>;
  decide(id: string, decision: "approve" | "reject", decidedBy: string): Promise<AgentToolApprovalRecord>;
  get(id: string): Promise<AgentToolApprovalRecord | null>;
  listPending(agentId?: string): Promise<AgentToolApprovalRecord[]>;
  /** Recovers the locked arguments for an approved call. */
  recoverArguments(id: string): Promise<{ argumentsHash: string; args: unknown } | null>;
  /** Finds an unexpired APPROVED record matching tool + arguments hash. */
  matchApproved(agentId: string, toolName: string, argumentsHash: string): Promise<{ id: string; args: unknown } | null>;
  expireStale(now: string): Promise<number>;
}

interface SealedArguments {
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

function sealArguments(args: unknown, key: Buffer): SealedArguments {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([
    cipher.update(stableStringify(args === undefined ? null : args), "utf8"),
    cipher.final(),
  ]);
  return { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") };
}

function openArguments(sealed: SealedArguments, key: Buffer): unknown {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "hex"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(sealed.data, "hex")),
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
} ): AgentApprovalStore {
  const storePath = options.storePath ?? ".data/agent-governance/approvals.json";
  const now = options.now ?? (() => new Date().toISOString());
  const key = deriveKey(options.secret);
  const records = new Map<string, StoredApprovalRecord>();
  let loaded = false;
  let dirty = false;

  async function flush(): Promise<void> {
    if (!dirty) return;
    const file: ApprovalsFile = {
      version: 1,
      updatedAt: now(),
      approvals: Object.fromEntries(records),
    };
    await mkdir(dirname(storePath), { recursive: true });
    const tmpPath = `${storePath}.${randomUUID()}.tmp`;
    await writeFile(tmpPath, JSON.stringify(file, null, 2), "utf8");
    await rename(tmpPath, storePath);
    dirty = false;
  }

  async function load(): Promise<void> {
    if (loaded) return;
    await mkdir(dirname(storePath), { recursive: true });
    try {
      const raw = await readFile(storePath, "utf8");
      const data = JSON.parse(raw) as ApprovalsFile;
      if (data && typeof data === "object" && data.approvals) {
        for (const [id, record] of Object.entries(data.approvals)) {
          records.set(id, record);
        }
      }
    } catch {
      // Fresh store.
    }
    loaded = true;
  }

  function publicView(record: StoredApprovalRecord): AgentToolApprovalRecord {
    const { tenantId: _t, reason: _r, sealedArguments: _s, ...view } = record;
    return view;
  }

  return {
    async create(input) {
      await load();
      const id = `appr_${randomUUID()}`;
      const ttl = input.ttlSeconds && Number.isInteger(input.ttlSeconds) && input.ttlSeconds > 0
        ? input.ttlSeconds
        : DEFAULT_APPROVAL_TTL_SECONDS;
      const requestedAt = now();
      const record: StoredApprovalRecord = {
        id,
        agentId: input.agentId,
        toolName: input.toolName,
        argumentsHash: argumentsHashOf(input.arguments),
        status: "PENDING",
        requestedAt,
        expiresAt: new Date(new Date(requestedAt).getTime() + ttl * 1000).toISOString(),
        tenantId: input.tenantId,
        reason: input.reason,
        sealedArguments: sealArguments(input.arguments, key),
      };
      records.set(id, record);
      dirty = true;
      await flush();
      return publicView(record);
    },
    async decide(id, decision, decidedBy) {
      await load();
      const record = records.get(id);
      if (!record) {
        const error = new Error("Approval record not found.");
        error.name = "ApprovalNotFound";
        throw error;
      }
      const nowIso = now();
      if (record.status !== "PENDING") {
        const error = new Error(`Approval already ${record.status}.`);
        error.name = "ApprovalAlreadyDecided";
        throw error;
      }
      if (record.expiresAt <= nowIso) {
        record.status = "EXPIRED";
        dirty = true;
        await flush();
        const error = new Error("Approval has expired.");
        error.name = "ApprovalExpired";
        throw error;
      }
      record.status = decision === "approve" ? "APPROVED" : "REJECTED";
      record.decidedAt = nowIso;
      record.decidedBy = decidedBy;
      dirty = true;
      await flush();
      return publicView(record);
    },
    async get(id) {
      await load();
      const record = records.get(id);
      return record ? publicView(record) : null;
    },
    async listPending(agentId) {
      await load();
      return Array.from(records.values())
        .filter((record) => record.status === "PENDING"
          && (agentId ? record.agentId === agentId : true)
          && record.expiresAt > now())
        .map(publicView);
    },
    async recoverArguments(id) {
      await load();
      const record = records.get(id);
      if (!record || record.status !== "APPROVED") return null;
      if (record.expiresAt <= now()) return null;
      try {
        return { argumentsHash: record.argumentsHash, args: openArguments(record.sealedArguments, key) };
      } catch {
        return null;
      }
    },
    async matchApproved(agentId, toolName, argumentsHash) {
      await load();
      const nowIso = now();
      for (const record of records.values()) {
        if (record.status !== "APPROVED") continue;
        if (record.agentId !== agentId || record.toolName !== toolName) continue;
        if (record.expiresAt <= nowIso) continue;
        if (!argumentsHashMatches(record.argumentsHash, argumentsHash)) continue;
        try {
          return { id: record.id, args: openArguments(record.sealedArguments, key) };
        } catch {
          return null;
        }
      }
      return null;
    },
    async expireStale(nowIso) {
      await load();
      let count = 0;
      for (const record of records.values()) {
        if (record.status === "PENDING" && record.expiresAt <= nowIso) {
          record.status = "EXPIRED";
          count += 1;
          dirty = true;
        }
      }
      if (dirty) await flush();
      return count;
    },
  };
}

/** Constant-time comparison of two arguments hashes (locking check). */
export function argumentsHashMatches(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
