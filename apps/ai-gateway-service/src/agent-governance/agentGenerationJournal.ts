/**
 * Authenticated cross-store WAL for one Agent generation operation.
 *
 * The Agent bundle, central registry, usage counters and audit chain each have
 * their own durability boundary. This journal preserves the complete validated
 * generation intent so restart recovery can idempotently finish those writes
 * and never expose an ACTIVE registry record without its activation audit.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AgentPolicyManifest,
  AgentRegistryRecord,
  EffectiveAgentPolicy,
} from "@unified-ai-system/shared-contracts";
import { stableStringify, verifyEffectivePolicyIntegrity } from "@unified-ai-system/policy-engine";
import type { AgentPolicyDelta } from "./agentFileStore.ts";

export const AGENT_GENERATION_JOURNAL_FILE = "agent-generation.journal.json";
const VERSION = "agent-governance-generation-v2" as const;
const DOMAIN = "unified-ai/agent-governance-generation/v2";
const MAX_JOURNAL_BYTES = 4 * 1024 * 1024;

export type AgentGenerationJournalPhase =
  | "prepared"
  | "usage-reset"
  | "bundle-written"
  | "registry-validated"
  | "audited"
  | "active";

export interface AgentGenerationRecoveryPlan {
  operationId: string;
  createdAt: string;
  actor: string;
  requestId?: string;
  /** Signed identity of the one Registry authority allowed to replay this WAL. */
  registryAuthority: string;
  phase: AgentGenerationJournalPhase;
  record: AgentRegistryRecord;
  delta: AgentPolicyDelta;
  policy: EffectiveAgentPolicy;
  manifest: AgentPolicyManifest;
}

interface SignedAgentGenerationRecoveryPlan extends AgentGenerationRecoveryPlan {
  version: typeof VERSION;
  hmacSha256: string;
}

export interface AgentGenerationJournal {
  readonly path: string;
  create(input: Omit<AgentGenerationRecoveryPlan, "operationId" | "createdAt">): Promise<AgentGenerationRecoveryPlan>;
  save(plan: AgentGenerationRecoveryPlan): Promise<void>;
  load(): Promise<AgentGenerationRecoveryPlan | null>;
  clear(operationId: string): Promise<void>;
}

export function createAgentGenerationJournal(options: {
  dataDir: string;
  secret: string;
  now?: () => string;
}): AgentGenerationJournal {
  if (typeof options.secret !== "string" || options.secret.length < 32) {
    throw journalError("Agent generation journal HMAC secret must contain at least 32 characters.");
  }
  const path = join(options.dataDir, AGENT_GENERATION_JOURNAL_FILE);
  const now = options.now ?? (() => new Date().toISOString());
  let tail: Promise<void> = Promise.resolve();

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function loadInternal(): Promise<AgentGenerationRecoveryPlan | null> {
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch (error) {
      if (isMissing(error)) return null;
      throw journalError("Agent generation journal metadata could not be inspected.", error);
    }
    if (!Number.isSafeInteger(size) || size < 2 || size > MAX_JOURNAL_BYTES) {
      throw journalError("Agent generation journal size is invalid.");
    }
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (error) {
      throw journalError("Agent generation journal could not be read.", error);
    }
    let parsed: SignedAgentGenerationRecoveryPlan;
    try {
      parsed = JSON.parse(raw) as SignedAgentGenerationRecoveryPlan;
    } catch (error) {
      throw journalError("Agent generation journal is malformed.", error);
    }
    return verifySignedPlan(parsed, options.secret);
  }

  return {
    path,
    create(input) {
      return exclusive(async () => {
        if (await exists(path)) {
          throw journalError("An Agent generation journal already exists and must be recovered first.");
        }
        const plan: AgentGenerationRecoveryPlan = {
          ...structuredClone(input),
          operationId: randomUUID(),
          createdAt: now(),
        };
        if (plan.phase !== "prepared") {
          throw journalError("A new Agent generation journal must start in prepared phase.");
        }
        validatePlan(plan, options.secret);
        await atomicWrite(path, serialize(signPlan(plan, options.secret)));
        return structuredClone(plan);
      });
    },
    save(plan) {
      return exclusive(async () => {
        const current = await loadInternal();
        if (!current || current.operationId !== plan.operationId) {
          throw journalError("Agent generation journal ownership changed during update.");
        }
        if (phaseRank(plan.phase) < phaseRank(current.phase)) {
          throw journalError("Agent generation journal phase cannot move backwards.");
        }
        validatePlan(plan, options.secret);
        await atomicWrite(path, serialize(signPlan(plan, options.secret)));
      });
    },
    load() {
      return exclusive(async () => structuredClone(await loadInternal()));
    },
    clear(operationId) {
      return exclusive(async () => {
        const current = await loadInternal();
        if (!current) return;
        if (current.operationId !== operationId) {
          throw journalError("Agent generation journal ownership changed before completion.");
        }
        try {
          await unlink(path);
        } catch (error) {
          if (!isMissing(error)) throw journalError("Agent generation journal could not be cleared.", error);
        }
        await syncDirectory(dirname(path));
      });
    },
  };
}

function signPlan(plan: AgentGenerationRecoveryPlan, secret: string): SignedAgentGenerationRecoveryPlan {
  const content = { version: VERSION, ...plan };
  return {
    ...content,
    hmacSha256: createHmac("sha256", secret)
      .update(`${DOMAIN}\n${stableStringify(content)}`, "utf8")
      .digest("hex"),
  };
}

function verifySignedPlan(
  raw: SignedAgentGenerationRecoveryPlan,
  secret: string,
): AgentGenerationRecoveryPlan {
  const { hmacSha256, version, ...plan } = raw ?? {} as SignedAgentGenerationRecoveryPlan;
  const expected = signPlan(plan as AgentGenerationRecoveryPlan, secret).hmacSha256;
  if (version !== VERSION || !safeEqual(hmacSha256, expected)) {
    throw journalError("Agent generation journal authentication failed.");
  }
  validatePlan(plan as AgentGenerationRecoveryPlan, secret);
  return structuredClone(plan as AgentGenerationRecoveryPlan);
}

function validatePlan(plan: AgentGenerationRecoveryPlan, secret: string): void {
  if (!plan || !isUuid(plan.operationId) || !Number.isFinite(Date.parse(plan.createdAt))
    || typeof plan.actor !== "string" || plan.actor.trim() === "" || plan.actor.length > 256
    || (plan.requestId !== undefined && (typeof plan.requestId !== "string" || plan.requestId.length > 256))
    || typeof plan.registryAuthority !== "string"
    || !/^[A-Za-z0-9_.:-]{1,256}$/u.test(plan.registryAuthority)
    || !PHASES.has(plan.phase) || !plan.record || !plan.delta || !plan.policy || !plan.manifest) {
    throw journalError("Agent generation journal content is invalid.");
  }
  const record = plan.record;
  if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(record.agentId)
    || record.status !== "ACTIVE" || record.createdBy !== plan.actor
    || plan.delta.agentId !== record.agentId || plan.policy.agentId !== record.agentId
    || plan.manifest.agentId !== record.agentId || record.policyHash !== plan.policy.policyHash
    || !Array.isArray(plan.delta.inherits)
    || plan.delta.inherits.some((binding) => !binding
      || typeof binding.policyKey !== "string" || binding.policyKey.trim() === ""
      || !Number.isSafeInteger(binding.version) || binding.version < 1)
    || (plan.delta.taskPolicyKeys !== undefined
      && (!Array.isArray(plan.delta.taskPolicyKeys)
        || plan.delta.taskPolicyKeys.length > 32
        || plan.delta.taskPolicyKeys.some((key) => typeof key !== "string"
          || !/^[a-z][a-z0-9._-]{0,63}$/u.test(key))
        || new Set(plan.delta.taskPolicyKeys).size !== plan.delta.taskPolicyKeys.length))
    || !verifyEffectivePolicyIntegrity(plan.policy, plan.manifest, secret, record, plan.delta).ok) {
    throw journalError("Agent generation journal contains an invalid recovery plan.");
  }
}

const PHASES = new Set<AgentGenerationJournalPhase>([
  "prepared",
  "usage-reset",
  "bundle-written",
  "registry-validated",
  "audited",
  "active",
]);

function phaseRank(phase: AgentGenerationJournalPhase): number {
  return ["prepared", "usage-reset", "bundle-written", "registry-validated", "audited", "active"].indexOf(phase);
}

function safeEqual(left: unknown, right: string): boolean {
  return typeof left === "string" && left.length === right.length
    && timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(tmpPath, "wx", 0o600);
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(tmpPath, path);
    await syncDirectory(dirname(path));
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(tmpPath).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }
}

async function syncDirectory(path: string): Promise<void> {
  try {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function journalError(message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "AgentGenerationJournalError", code: "AGENT_GENERATION_JOURNAL_INVALID" },
  );
}
