/**
 * Crash-recovery WAL for one Agent Governance policy activation.
 *
 * The lower-level Governance state anchor makes each catalog/registry/audit
 * file commit replayable. This journal supplies the missing cross-file intent:
 * every stricter Agent bundle is durable before the catalog binding changes.
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
import type {
  PolicyCatalogActivationSnapshot,
  PolicyCatalogActivationState,
} from "./policyCatalogStore.ts";

export const POLICY_ACTIVATION_JOURNAL_FILE = "policy-activation.journal.json";
const VERSION = "agent-governance-policy-activation-v1" as const;
const DOMAIN = "unified-ai/agent-governance-policy-activation/v1";

export type PolicyActivationJournalPhase =
  | "prepared"
  | "fenced"
  | "applying-agents"
  | "agents-applied"
  | "catalog-activated"
  | "auditing"
  | "rolling-back";

export interface PolicyActivationAgentPlan {
  agentId: string;
  tenantId: string;
  oldPolicyHash: string;
  nextPolicyHash: string;
  clamped: number;
  oldRecord: AgentRegistryRecord;
  nextRecord: AgentRegistryRecord;
  oldPolicy: EffectiveAgentPolicy;
  nextPolicy: EffectiveAgentPolicy;
  oldManifest: AgentPolicyManifest;
  nextManifest: AgentPolicyManifest;
  delta: AgentPolicyDelta;
}

export interface PolicyActivationRecoveryPlan {
  operationId: string;
  createdAt: string;
  actor: string;
  requestId?: string;
  policyKey: string;
  oldPolicyBinding: { version: number | null; contentHash: string | null };
  nextPolicyBinding: { version: number; contentHash: string };
  catalogSnapshot: PolicyCatalogActivationSnapshot;
  /** Anchored monotonic replay fence captured before this operation. */
  baseActivationState: PolicyCatalogActivationState;
  phase: PolicyActivationJournalPhase;
  bundleWrittenAgentIds: string[];
  registryWrittenAgentIds: string[];
  auditedAgentIds: string[];
  agents: PolicyActivationAgentPlan[];
}

interface SignedPolicyActivationRecoveryPlan extends PolicyActivationRecoveryPlan {
  version: typeof VERSION;
  hmacSha256: string;
}

export interface PolicyActivationJournal {
  readonly path: string;
  create(input: Omit<PolicyActivationRecoveryPlan, "operationId" | "createdAt">): Promise<PolicyActivationRecoveryPlan>;
  save(plan: PolicyActivationRecoveryPlan): Promise<void>;
  load(): Promise<PolicyActivationRecoveryPlan | null>;
  clear(operationId: string): Promise<void>;
}

export function createPolicyActivationJournal(options: {
  dataDir: string;
  secret: string;
  now?: () => string;
}): PolicyActivationJournal {
  if (typeof options.secret !== "string" || options.secret.length < 32) {
    throw journalError("Policy activation journal HMAC secret must contain at least 32 characters.");
  }
  const path = join(options.dataDir, POLICY_ACTIVATION_JOURNAL_FILE);
  const now = options.now ?? (() => new Date().toISOString());
  let tail: Promise<void> = Promise.resolve();

  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function loadInternal(): Promise<PolicyActivationRecoveryPlan | null> {
    let raw: string;
    try { raw = await readFile(path, "utf8"); }
    catch (error) { if (isMissing(error)) return null; throw journalError("Policy activation journal could not be read.", error); }
    let parsed: SignedPolicyActivationRecoveryPlan;
    try { parsed = JSON.parse(raw) as SignedPolicyActivationRecoveryPlan; }
    catch (error) { throw journalError("Policy activation journal is malformed.", error); }
    return verifySignedPlan(parsed, options.secret);
  }

  return {
    path,
    create(input) {
      return exclusive(async () => {
        if (await exists(path)) {
          throw journalError("A policy activation journal already exists and must be recovered first.");
        }
        const plan: PolicyActivationRecoveryPlan = {
          ...structuredClone(input),
          operationId: randomUUID(),
          createdAt: now(),
        };
        validatePlan(plan, options.secret);
        await atomicWrite(path, serialize(signPlan(plan, options.secret)));
        return structuredClone(plan);
      });
    },
    save(plan) {
      return exclusive(async () => {
        const current = await loadInternal();
        if (!current || current.operationId !== plan.operationId) {
          throw journalError("Policy activation journal ownership changed during update.");
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
          throw journalError("Policy activation journal ownership changed before completion.");
        }
        try { await unlink(path); }
        catch (error) { if (!isMissing(error)) throw journalError("Policy activation journal could not be cleared.", error); }
        await syncDirectory(dirname(path));
      });
    },
  };
}

function signPlan(plan: PolicyActivationRecoveryPlan, secret: string): SignedPolicyActivationRecoveryPlan {
  const content = { version: VERSION, ...plan };
  return {
    ...content,
    hmacSha256: createHmac("sha256", secret)
      .update(`${DOMAIN}\n${stableStringify(content)}`, "utf8")
      .digest("hex"),
  };
}

function verifySignedPlan(raw: SignedPolicyActivationRecoveryPlan, secret: string): PolicyActivationRecoveryPlan {
  const { hmacSha256, version, ...plan } = raw ?? {} as SignedPolicyActivationRecoveryPlan;
  const expected = signPlan(plan as PolicyActivationRecoveryPlan, secret).hmacSha256;
  if (version !== VERSION || !safeEqual(hmacSha256, expected)) {
    throw journalError("Policy activation journal authentication failed.");
  }
  validatePlan(plan as PolicyActivationRecoveryPlan, secret);
  return structuredClone(plan as PolicyActivationRecoveryPlan);
}

function validatePlan(plan: PolicyActivationRecoveryPlan, secret: string): void {
  if (!plan || !isUuid(plan.operationId) || !Number.isFinite(Date.parse(plan.createdAt))
    || !isSafeKey(plan.policyKey) || typeof plan.actor !== "string" || plan.actor.trim() === ""
    || !PHASES.has(plan.phase) || !Number.isSafeInteger(plan.nextPolicyBinding?.version)
    || plan.nextPolicyBinding.version < 1 || !isHash(plan.nextPolicyBinding.contentHash)
    || (plan.oldPolicyBinding.version !== null
      && (!Number.isSafeInteger(plan.oldPolicyBinding.version) || plan.oldPolicyBinding.version < 1))
    || (plan.oldPolicyBinding.contentHash !== null && !isHash(plan.oldPolicyBinding.contentHash))
    || plan.catalogSnapshot?.policyKey !== plan.policyKey || !validActivationState(plan.baseActivationState)
    || !Array.isArray(plan.agents)) {
    throw journalError("Policy activation journal content is invalid.");
  }
  const oldActive = plan.catalogSnapshot.activeVersion === null
    ? null
    : plan.catalogSnapshot.records.find((record) => record.version === plan.catalogSnapshot.activeVersion) ?? null;
  if (plan.oldPolicyBinding.version !== plan.catalogSnapshot.activeVersion
    || plan.oldPolicyBinding.contentHash !== (oldActive?.contentHash ?? null)) {
    throw journalError("Policy activation journal old binding does not match its catalog snapshot.");
  }
  const ids = new Set<string>();
  for (const agent of plan.agents) {
    if (!agent || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agent.agentId) || ids.has(agent.agentId)
      || agent.oldRecord.agentId !== agent.agentId || agent.nextRecord.agentId !== agent.agentId
      || agent.delta.agentId !== agent.agentId || agent.tenantId !== agent.oldRecord.tenantId
      || agent.tenantId !== agent.nextRecord.tenantId || agent.oldPolicy.agentId !== agent.agentId
      || agent.nextPolicy.agentId !== agent.agentId || agent.oldPolicyHash !== agent.oldPolicy.policyHash
      || agent.nextPolicyHash !== agent.nextPolicy.policyHash || agent.oldRecord.policyHash !== agent.oldPolicyHash
      || agent.nextRecord.policyHash !== agent.nextPolicyHash || !Number.isSafeInteger(agent.clamped)
      || agent.clamped < 0
      || !verifyEffectivePolicyIntegrity(agent.oldPolicy, agent.oldManifest, secret, agent.oldRecord).ok
      || !verifyEffectivePolicyIntegrity(agent.nextPolicy, agent.nextManifest, secret, agent.nextRecord).ok) {
      throw journalError("Policy activation journal contains an invalid Agent recovery plan.");
    }
    ids.add(agent.agentId);
  }
  for (const progress of [plan.bundleWrittenAgentIds, plan.registryWrittenAgentIds, plan.auditedAgentIds]) {
    if (!Array.isArray(progress) || new Set(progress).size !== progress.length
      || progress.some((agentId) => !ids.has(agentId))) {
      throw journalError("Policy activation journal progress is invalid.");
    }
  }
}

function validActivationState(value: unknown): value is PolicyCatalogActivationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as PolicyCatalogActivationState;
  return Number.isSafeInteger(state.sequence) && state.sequence >= 0
    && (state.lastOperationId === null || isUuid(state.lastOperationId))
    && (state.lastOutcome === null || state.lastOutcome === "committed" || state.lastOutcome === "rolled_back")
    && ((state.lastOperationId === null) === (state.lastOutcome === null));
}

const PHASES = new Set<PolicyActivationJournalPhase>([
  "prepared", "fenced", "applying-agents", "agents-applied", "catalog-activated", "auditing", "rolling-back",
]);

function isSafeKey(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/u.test(value);
}
function isHash(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
}
function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
function safeEqual(left: unknown, right: string): boolean {
  return typeof left === "string" && left.length === right.length
    && timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}
async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  const handle = await open(tmpPath, "wx", 0o600);
  try { await handle.writeFile(content, "utf8"); await handle.sync(); }
  finally { await handle.close(); }
  await rename(tmpPath, path);
  await syncDirectory(dirname(path));
}
async function syncDirectory(path: string): Promise<void> {
  try {
    const handle = await open(path, "r");
    try { await handle.sync(); } finally { await handle.close(); }
  } catch (error) { if (process.platform !== "win32") throw error; }
}
async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; }
  catch (error) { if (isMissing(error)) return false; throw error; }
}
function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}
function serialize(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
function journalError(message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "PolicyActivationJournalError", code: "POLICY_ACTIVATION_JOURNAL_INVALID" },
  );
}
