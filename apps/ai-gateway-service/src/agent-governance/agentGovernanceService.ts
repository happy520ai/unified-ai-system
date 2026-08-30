/**
 * Agent governance service — the Factory and lifecycle authority.
 *
 * Full generation pipeline (spec 九): receive task → deterministic or
 * model-proposed classification → tool-risk backfill → validator →
 * compiler → signed manifest → independent agent files → central
 * registry → ACTIVE. Any failure leaves no ACTIVE agent behind, only a
 * POLICY_REJECTED audit event.
 *
 * Also owns: cascade revocation, expiry sweeps, approval decisions,
 * policy version activation with no-expansion recompilation of every
 * affected agent, and verified effective-policy loading for the Tool
 * Proxy.
 */

import { createHash, randomUUID } from "node:crypto";
import type {
  AgentClassification,
  AgentCreatorEntitlements,
  AgentGovernanceAuditEvent,
  AgentPolicyManifest,
  AgentRegistryRecord,
  AgentToolApprovalRecord,
  AgentToolApprovalReview,
  EffectiveAgentPolicy,
  PolicyLayerContent,
  PolicyRecord,
  RiskLevel,
  ToolGovernanceDescriptor,
} from "@unified-ai-system/shared-contracts";
import {
  buildManifest,
  compileEffectivePolicy,
  computeAgentHash,
  computePolicyContentHash,
  isPolicyExpired,
  recompileWithoutExpansion,
  recomputeClassification,
  type RecompileClamp,
  validateAgentDraft,
  verifyEffectivePolicyIntegrity,
} from "@unified-ai-system/policy-engine";
import type {
  AgentFileStore,
  AgentPolicyDelta,
} from "./agentFileStore.ts";
import { createAgentFileStore } from "./agentFileStore.ts";
import type {
  AgentRegistryStore,
} from "./agentRegistryStore.ts";
import { createAgentRegistryStore } from "./agentRegistryStore.ts";
import type {
  AgentApprovalStore,
} from "./agentApprovalStore.ts";
import { createAgentApprovalStore } from "./agentApprovalStore.ts";
import type {
  GovernanceAuditLog,
} from "./governanceAuditLog.ts";
import { createGovernanceAuditLog } from "./governanceAuditLog.ts";
import type {
  PolicyCatalogStore,
  PolicyCatalogActivationState,
} from "./policyCatalogStore.ts";
import {
  BUILT_IN_EXECUTION_FAMILY_V2,
  BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH,
  createPolicyCatalogStore,
  isAutoMigratableExecutionFamilyV1,
} from "./policyCatalogStore.ts";
import type {
  ToolRiskCatalog,
} from "./toolRiskCatalog.ts";
import { createToolRiskCatalog } from "./toolRiskCatalog.ts";
import type {
  UsageStore,
} from "./usageStore.ts";
import { createUsageStore } from "./usageStore.ts";
import { resolveGovernanceSecret } from "./governanceSecret.ts";
import type {
  PolicyActivationAgentPlan,
  PolicyActivationJournal,
  PolicyActivationRecoveryPlan,
} from "./policyActivationJournal.ts";
import { createPolicyActivationJournal } from "./policyActivationJournal.ts";

export interface GovernanceContext {
  tenantId: string;
  userId: string;
  role?: string;
  permissions?: string[];
  requestId?: string;
  /** When set, an agent identity is attempting the call (self-modification guard). */
  actorAgentId?: string | null;
}

export interface GenerateAgentInput {
  name: string;
  task: string;
  requestedTools: string[];
  ttlSeconds: number;
  parentAgentId?: string | null;
  classification?: AgentClassification;
  proposedTraits?: string[];
  proposedRiskLevel?: RiskLevel;
  instanceRules?: PolicyLayerContent;
}

export interface GenerateAgentResult {
  agentId: string;
  status: AgentRegistryRecord["status"];
  classification: AgentClassification;
  traits: string[];
  riskLevel: RiskLevel;
  addedTraits: string[];
  riskEscalated: boolean;
  grantedTools: string[];
  policyHash: string;
  expiresAt: string;
}

export interface CreatePolicyVersionInput {
  policyKey: string;
  version: number;
  policyType: PolicyRecord["policyType"];
  scopeKey: string;
  content: PolicyLayerContent;
}

export interface ActivatePolicyResult {
  policy: PolicyRecord;
  affected: Array<{
    agentId: string;
    previousPolicyHash: string;
    policyHash: string;
    clamped: number;
  }>;
}

export interface AgentGovernanceService {
  generateAgent(input: GenerateAgentInput, ctx: GovernanceContext): Promise<GenerateAgentResult>;
  authorizeAgentExecution(
    agentId: string,
    ctx: GovernanceContext,
  ): Promise<{
    record: AgentRegistryRecord;
    policy: EffectiveAgentPolicy;
    executionLease: {
      signal: AbortSignal;
      fingerprint: string;
      assertActive(phase?: "reserve" | "commit"): Promise<true>;
      release(): void;
    };
  }>;
  getAgent(agentId: string, tenantId: string): Promise<AgentRegistryRecord | null>;
  listAgents(tenantId: string): Promise<AgentRegistryRecord[]>;
  getEffectivePolicy(agentId: string, tenantId: string): Promise<EffectiveAgentPolicy | null>;
  getEffectivePolicyView(agentId: string, tenantId: string): Promise<Record<string, unknown> | null>;
  revokeAgent(agentId: string, input: { reason?: string; cascade?: boolean }, ctx: GovernanceContext): Promise<{ revoked: string[] }>;
  decideApproval(approvalId: string, decision: "approve" | "reject", ctx: GovernanceContext): Promise<AgentToolApprovalRecord>;
  listApprovals(agentId: string | null, tenantId: string): Promise<AgentToolApprovalRecord[]>;
  createPolicyVersion(input: CreatePolicyVersionInput, ctx: GovernanceContext): Promise<PolicyRecord>;
  activatePolicyVersion(policyKey: string, version: number, ctx: GovernanceContext): Promise<ActivatePolicyResult>;
  listPolicies(): Promise<PolicyRecord[]>;
  expireAgents(): Promise<number>;
  readAudit(agentId: string, tenantId: string, limit?: number): Promise<AgentGovernanceAuditEvent[]>;
  /** Emits a governance audit event to the central stream and the agent's trail. */
  emitAudit(event: Omit<AgentGovernanceAuditEvent, "timestamp">): Promise<void>;
  /** Verified load used by the Tool Proxy — integrity checked or null. */
  loadVerifiedPolicy(agentId: string): Promise<{ policy: EffectiveAgentPolicy; manifest: AgentPolicyManifest } | null>;
  getUsage(agentId: string): Promise<{ toolCalls: number; steps: number; records: number }>;
  incrementUsage(agentId: string, field: "toolCalls" | "steps" | "records"): Promise<void>;
  reserveUsage(
    agentId: string,
    limits: EffectiveAgentPolicy["limits"],
    delta: Partial<{ toolCalls: number; steps: number; records: number }>,
  ): Promise<{ allowed: boolean; reason?: string }>;
  releaseUsage(
    agentId: string,
    delta: Partial<{ toolCalls: number; steps: number; records: number }>,
  ): Promise<void>;
  acquireToolExecutionLease(input: {
    agentId: string;
    tenantId: string;
    policyHash: string;
  }): Promise<{ release(): void } | null>;
  findApprovedArguments(input: {
    agentId: string;
    tenantId: string;
    toolName: string;
    args: unknown;
    policyHash: string;
  }): Promise<{ approvalId: string } | null>;
  consumeApprovedArguments(input: {
    approvalId: string;
    agentId: string;
    tenantId: string;
    toolName: string;
    args: unknown;
    policyHash: string;
    executionId: string;
  }): Promise<{ approvalId: string; args: unknown; review: AgentToolApprovalReview } | null>;
  createApproval(
    agentId: string,
    toolName: string,
    args: unknown,
    tenantId: string,
    review: AgentToolApprovalReview,
    reason?: string,
  ): Promise<AgentToolApprovalRecord>;
  stats(): Promise<Record<string, unknown>>;
}

export interface ModelProposer {
  /** Proposes classification only; risk backfill stays deterministic. */
  proposeClassification(task: string): Promise<{
    classification: AgentClassification;
    proposedTraits: string[];
    proposedRiskLevel: RiskLevel;
  } | null>;
}

export interface AgentGovernanceServiceOptions {
  env?: Record<string, string | undefined>;
  dataDir?: string;
  now?: () => string;
  modelProposer?: ModelProposer | null;
  toolRiskCatalog?: ToolRiskCatalog;
  activationJournal?: PolicyActivationJournal;
  /** Maximum time revoke waits for already-aborted executions to drain. */
  executionDrainTimeoutMs?: number;
  /** Explicit migration-only seam for a semantically validated pre-anchor
   * policy catalog. Runtime callers must leave this false. */
  allowLegacyStateMigration?: boolean;
  /** Crash-simulation seam. Throw an error with code
   * POLICY_ACTIVATION_CRASH_SIMULATION to leave the WAL for restart recovery. */
  activationFaultInjector?: (
    stage: PolicyActivationCommitStage,
    detail: { operationId: string; agentId?: string },
  ) => void | Promise<void>;
  /** Store injection keeps persistence failures deterministic in tests and
   * permits alternate durable adapters without changing governance semantics. */
  stores?: Partial<{
    catalog: PolicyCatalogStore;
    registry: AgentRegistryStore;
    files: AgentFileStore;
    auditLog: GovernanceAuditLog;
  }>;
}

export type PolicyActivationCommitStage =
  | "after-migration-install"
  | "after-journal"
  | "after-fence"
  | "after-agent-bundle"
  | "after-agent-registry"
  | "after-catalog"
  | "after-audit";

export function createAgentGovernanceService(options: AgentGovernanceServiceOptions = {}): AgentGovernanceService {
  const env = options.env ?? process.env;
  const dataDir = options.dataDir ?? ".data/agent-governance";
  const now = options.now ?? (() => new Date().toISOString());
  const secret = resolveGovernanceSecret({ env, dataDir });
  const catalog: PolicyCatalogStore = options.stores?.catalog
    ?? createPolicyCatalogStore({
      storePath: `${dataDir}/policies.json`,
      now,
      secret,
      allowLegacyStateMigration: options.allowLegacyStateMigration === true,
    });
  const registry: AgentRegistryStore = options.stores?.registry
    ?? createAgentRegistryStore({ storePath: `${dataDir}/agents.json`, now, secret });
  const files: AgentFileStore = options.stores?.files ?? createAgentFileStore({ dataDir });
  const approvals: AgentApprovalStore = createAgentApprovalStore({
    storePath: `${dataDir}/approvals.json`,
    secret,
    now,
    maxPendingPerAgent: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_APPROVAL_MAX_PENDING_PER_AGENT),
    maxPendingPerTenant: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_APPROVAL_MAX_PENDING_PER_TENANT),
    maxRecords: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_APPROVAL_MAX_RECORDS),
    terminalRetentionMs: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_APPROVAL_TERMINAL_RETENTION_MS),
  });
  const auditLog: GovernanceAuditLog = options.stores?.auditLog ?? createGovernanceAuditLog({
    logPath: `${dataDir}/audit-events.jsonl`,
    secret,
    now,
    maxRecords: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_AUDIT_MAX_RECORDS),
    maxArchiveSegments: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_AUDIT_ARCHIVE_MAX_SEGMENTS),
    maxArchiveBytes: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_AUDIT_ARCHIVE_MAX_BYTES),
    archiveRetentionMs: configuredNumber(env.AI_GATEWAY_AGENT_GOVERNANCE_AUDIT_ARCHIVE_RETENTION_MS),
  });
  const usage: UsageStore = createUsageStore({ dataDir, now, secret });
  const toolCatalog: ToolRiskCatalog = options.toolRiskCatalog ?? createToolRiskCatalog();
  const modelProposer = options.modelProposer ?? null;
  const activationJournal = options.activationJournal
    ?? createPolicyActivationJournal({ dataDir, secret, now });
  const activationFaultInjector = options.activationFaultInjector;
  const executionDrainTimeoutMs = boundedInteger(
    options.executionDrainTimeoutMs
      ?? env.AI_GATEWAY_AGENT_GOVERNANCE_EXECUTION_DRAIN_TIMEOUT_MS,
    30_000,
    10,
    5 * 60_000,
  );
  const generationLocks = new Map<string, Promise<void>>();
  let controlPlaneMutationTail: Promise<void> = Promise.resolve();
  let startupMaintenanceReady = false;
  let startupMaintenancePromise: Promise<void> | null = null;
  let controlPlaneEpoch = 0;
  let warnedMigrationBinding: string | null = null;
  const executionStates = new Map<string, {
    blocked: boolean;
    active: number;
    idleWaiters: Array<() => void>;
    abortControllers: Set<AbortController>;
  }>();
  const platformTenantId = String(
    env.PME_ENTERPRISE_PLATFORM_TENANT_ID ?? env.PME_AUTH_TENANT_ID ?? "default",
  ).trim() || "default";

  type AuditEventInput = Omit<AgentGovernanceAuditEvent, "timestamp">;

  async function audit(event: AuditEventInput): Promise<void> {
    const stamped: AgentGovernanceAuditEvent = { ...event, timestamp: now() };
    await auditLog.record(stamped);
    // Lifecycle events carrying an agentId also land in that agent's
    // append-only audit.ndjson.
    if (stamped.agentId) {
      try {
        await files.appendAudit(stamped.agentId, stamped);
      } catch {
        // Per-agent audit failures must not block governance decisions;
        // the central stream already carries the event.
      }
    }
  }

  async function auditOnce(event: AuditEventInput): Promise<void> {
    const existing = await auditLog.read(2_000);
    const duplicate = existing.some((item) => item.eventType === event.eventType
      && item.agentId === event.agentId && item.tenantId === event.tenantId
      && item.policyHash === event.policyHash && item.previousPolicyHash === event.previousPolicyHash
      && item.reason === event.reason);
    if (!duplicate) await audit(event);
  }

  function descriptorMap(): Map<string, ToolGovernanceDescriptor> {
    return toolCatalog.asMap();
  }

  /** Deterministic fallback classifier: read-only tool sets are analysis.
   *  Caller-proposed traits and risk merge in — never dropped. */
  function deterministicProposal(input: GenerateAgentInput): {
    classification: AgentClassification;
    proposedTraits: string[];
    proposedRiskLevel: RiskLevel;
  } {
    const descriptors = input.requestedTools.map((tool) => toolCatalog.lookup(tool));
    const anyWrite = descriptors.some((descriptor) => descriptor?.actionType === "write");
    const heuristicTraits = anyWrite ? ["write_capable"] : ["read_only"];
    const proposedTraits = Array.from(new Set([
      ...heuristicTraits,
      ...(input.proposedTraits ?? []),
    ]));
    const heuristicRisk = anyWrite ? "medium" : "low";
    const providedRisk = input.proposedRiskLevel;
    const riskOrder: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const proposedRiskLevel = providedRisk && riskOrder[providedRisk] > riskOrder[heuristicRisk]
      ? providedRisk
      : heuristicRisk;
    return {
      classification: {
        family: anyWrite ? "execution" : "analysis",
        domain: "general",
        subclass: input.name ? input.name.slice(0, 64) : "general",
      },
      proposedTraits,
      proposedRiskLevel,
    };
  }

  async function assembleLayerStack(input: {
    tenantId: string;
    classification: AgentClassification;
    traits: string[];
    instanceRules?: PolicyLayerContent;
    activeOverrides?: ReadonlyMap<string, PolicyRecord | null>;
  }): Promise<PolicyRecord[]> {
    const stack: PolicyRecord[] = [];
    const push = async (policyKey: string) => {
      const record = input.activeOverrides?.has(policyKey)
        ? input.activeOverrides.get(policyKey) ?? null
        : await catalog.getActive(policyKey);
      if (record) stack.push(record);
    };
    await push("emergency-policy");
    await push("root-policy");
    await push(`tenant:${input.tenantId}`);
    await push(`${input.classification.domain}-domain`);
    await push(`${input.classification.family}-family`);
    await push(`${input.classification.subclass}-subclass`);
    for (const trait of input.traits) {
      await push(`${trait}-trait`);
    }
    if (input.instanceRules && Object.keys(input.instanceRules).length > 0) {
      stack.push({
        policyKey: "instance-delta",
        version: 1,
        policyType: "instance",
        scopeKey: "instance",
        content: input.instanceRules,
        contentHash: computePolicyContentHash(input.instanceRules),
        status: "active",
        createdAt: now(),
      });
    }
    return stack;
  }

  async function loadParent(parentAgentId: string, tenantId: string): Promise<{
    record: AgentRegistryRecord;
    effective: EffectiveAgentPolicy;
  } | null> {
    const record = await registry.get(parentAgentId, tenantId);
    if (!record) return null;
    const verified = await loadVerifiedPolicyInternal(parentAgentId, record);
    if (!verified) return null;
    return { record, effective: verified.policy };
  }

  async function assertActiveAncestorChain(
    record: AgentRegistryRecord,
    checkedAt = now(),
  ): Promise<void> {
    const seen = new Set<string>([record.agentId]);
    let parentAgentId = record.parentAgentId;
    while (parentAgentId) {
      if (seen.has(parentAgentId)) {
        throw forbidden("AGENT_ANCESTOR_NOT_ACTIVE", "Agent ancestry is cyclic or invalid.");
      }
      seen.add(parentAgentId);
      const parent = await registry.get(parentAgentId, record.tenantId);
      if (!parent || parent.status !== "ACTIVE" || parent.expiresAt <= checkedAt) {
        throw forbidden(
          "AGENT_ANCESTOR_NOT_ACTIVE",
          "Every ancestor Agent must remain ACTIVE before a descendant may execute.",
        );
      }
      // Lifecycle metadata is not enough: a parent whose signed bundle was
      // deleted, corrupted or transplanted must fence every descendant even
      // while its registry row still says ACTIVE.
      const verifiedParent = await loadVerifiedPolicyInternal(parentAgentId, parent);
      if (!verifiedParent
        || verifiedParent.policy.agentId !== parent.agentId
        || verifiedParent.policy.policyHash !== parent.policyHash
        || verifiedParent.policy.expiresAt !== parent.expiresAt
        || verifiedParent.policy.expiresAt <= checkedAt) {
        throw forbidden(
          "AGENT_ANCESTOR_INTEGRITY_REQUIRED",
          "Every ancestor Agent must retain a valid, unexpired signed policy before a descendant may execute.",
        );
      }
      parentAgentId = parent.parentAgentId;
    }
  }

  /**
   * Authoritative lifecycle assertion shared by initial authorization, every
   * run-fence assertion and Tool Proxy lease acquisition. Registry status,
   * the verified policy binding, TTL and the complete ancestor chain are one
   * execution invariant; checking only the child would let a non-cascade
   * parent revocation leave an otherwise ACTIVE descendant executable.
   */
  async function assertExecutionStillActive(input: {
    agentId: string;
    tenantId: string;
    policyHash: string;
    policyExpiresAt: string;
    signal?: AbortSignal;
  }): Promise<AgentRegistryRecord> {
    const state = executionState(input.agentId);
    if (input.signal?.aborted || state.blocked) {
      throw forbidden("AGENT_EXECUTION_FENCED", "Agent execution is no longer active.");
    }

    const checkedAt = now();
    const latest = await registry.get(input.agentId, input.tenantId);
    if (!latest) {
      throw forbidden("AGENT_EXECUTION_FENCED", "Agent execution identity is no longer active.");
    }
    if (latest.status !== "ACTIVE" || latest.policyHash !== input.policyHash
      || latest.expiresAt !== input.policyExpiresAt) {
      fenceExecutions(latest.agentId);
      throw forbidden("AGENT_EXECUTION_FENCED", "Agent execution policy or lifecycle state changed.");
    }
    if (input.policyExpiresAt <= checkedAt || latest.expiresAt <= checkedAt) {
      fenceExecutions(latest.agentId);
      try { await expireAgentsInternal(); } catch { /* The in-memory fence remains fail-closed. */ }
      throw forbidden("AGENT_EXPIRED", "Agent execution policy expired before the external-effect fence.");
    }
    try {
      await assertActiveAncestorChain(latest, checkedAt);
    } catch (error) {
      // A descendant whose ancestry is no longer valid must not keep an
      // already-issued run signal alive in this process.
      fenceExecutions(latest.agentId);
      throw error;
    }
    if (input.signal?.aborted || state.blocked) {
      throw forbidden("AGENT_EXECUTION_FENCED", "Agent execution is no longer active.");
    }
    return latest;
  }

  function creatorEntitlements(ctx: GovernanceContext): AgentCreatorEntitlements {
    const permissions = new Set(Array.isArray(ctx.permissions) ? ctx.permissions : []);
    const unrestricted = permissions.has("*");
    const canWrite = unrestricted || permissions.has("agent:write");
    const canSendExternalMessage = unrestricted || permissions.has("agent:external");
    const canExecuteCode = unrestricted || permissions.has("agent:execute-code");
    const canCreateChildren = unrestricted || permissions.has("agent:create-children");
    const explicitlyAllowed = new Set(Array.from(permissions)
      .filter((permission) => permission.startsWith("agent-tool:"))
      .map((permission) => permission.slice("agent-tool:".length))
      .filter(Boolean));
    const allowedTools = toolCatalog.list()
      .filter((descriptor) => unrestricted
        || explicitlyAllowed.has(descriptor.name)
        || (permissions.has("workflow:run") && descriptor.actionType === "read")
        || (canWrite && descriptor.actionType === "write"))
      .map((descriptor) => descriptor.name);
    return {
      allowedTools,
      permissions: { canWrite, canSendExternalMessage, canExecuteCode, canCreateChildren },
    };
  }

  async function loadVerifiedPolicyInternal(
    agentId: string,
    currentRecord?: AgentRegistryRecord | null,
  ): Promise<{ policy: EffectiveAgentPolicy; manifest: AgentPolicyManifest } | null> {
    const record = currentRecord ?? await registry.getUnscoped(agentId);
    const policy = await files.loadPolicy(agentId);
    const manifest = await files.loadManifest(agentId);
    if (!record || !policy || !manifest) return null;
    const integrity = verifyEffectivePolicyIntegrity(policy, manifest, secret, record);
    if (!integrity.ok) {
      if (record.status === "ACTIVE") {
        fenceExecutions(record.agentId);
        await registry.upsert({ ...record, status: "FAILED" });
      }
      await audit({
        eventType: "POLICY_SIGNATURE_FAILED",
        agentId,
        tenantId: record.tenantId,
        reason: integrity.reason,
        policyHash: policy.policyHash,
      });
      return null;
    }
    return { policy, manifest };
  }

  async function acquireGenerationLock(key: string): Promise<() => void> {
    const previous = generationLocks.get(key) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
    const queued = previous.then(() => current);
    generationLocks.set(key, queued);
    await previous;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseCurrent();
      void queued.finally(() => {
        if (generationLocks.get(key) === queued) generationLocks.delete(key);
      });
    };
  }

  async function acquireControlPlaneMutationLock(): Promise<() => void> {
    const previous = controlPlaneMutationTail;
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => { releaseCurrent = resolve; });
    controlPlaneMutationTail = previous.then(() => current, () => current);
    await previous.catch(() => undefined);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseCurrent();
    };
  }

  function executionState(agentId: string) {
    let state = executionStates.get(agentId);
    if (!state) {
      state = { blocked: false, active: 0, idleWaiters: [], abortControllers: new Set() };
      executionStates.set(agentId, state);
    }
    return state;
  }

  function tryAcquireExecution(agentId: string, abortable = false): {
    release(): void;
    signal?: AbortSignal;
  } | null {
    const state = executionState(agentId);
    if (state.blocked) return null;
    state.active += 1;
    const controller = abortable ? new AbortController() : null;
    if (controller) state.abortControllers.add(controller);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      if (controller) state.abortControllers.delete(controller);
      state.active = Math.max(0, state.active - 1);
      if (state.active === 0) {
        const waiters = state.idleWaiters.splice(0);
        for (const resolve of waiters) resolve();
      }
    };
    return { release, ...(controller ? { signal: controller.signal } : {}) };
  }

  function fenceExecutions(agentId: string): void {
    const state = executionState(agentId);
    state.blocked = true;
    const reason = forbidden("AGENT_EXECUTION_FENCED", "Agent execution was revoked or reconfigured.");
    for (const controller of state.abortControllers) controller.abort(reason);
  }

  async function waitForExecutionsIdle(agentId: string, timeoutMs?: number): Promise<boolean> {
    const state = executionState(agentId);
    if (state.active === 0) return true;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (idle: boolean) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        const index = state.idleWaiters.indexOf(onIdle);
        if (index >= 0) state.idleWaiters.splice(index, 1);
        resolve(idle);
      };
      const onIdle = () => finish(true);
      state.idleWaiters.push(onIdle);
      if (typeof timeoutMs === "number") {
        timer = setTimeout(() => finish(false), timeoutMs);
        timer.unref?.();
      }
      // A release can race between the initial check and waiter insertion.
      if (state.active === 0) onIdle();
    });
  }

  function unblockExecutions(agentId: string): void {
    const state = executionState(agentId);
    if (state.active !== 0) {
      throw new Error(`Cannot unblock Agent ${agentId} while executions remain active.`);
    }
    state.blocked = false;
  }

  interface ActivationTarget {
    record: AgentRegistryRecord;
    oldPolicy: EffectiveAgentPolicy;
    oldManifest: AgentPolicyManifest;
    delta: AgentPolicyDelta;
  }

  interface ActivationPlan extends ActivationTarget {
    nextRecord: AgentRegistryRecord;
    nextPolicy: EffectiveAgentPolicy;
    nextManifest: AgentPolicyManifest;
    clamped: RecompileClamp[];
  }

  async function planActivation(
    target: ActivationTarget,
    activeOverrides: ReadonlyMap<string, PolicyRecord | null>,
  ): Promise<ActivationPlan> {
    let parentEffective: EffectiveAgentPolicy | null = null;
    if (target.record.parentAgentId) {
      const verifiedParent = await loadVerifiedPolicyInternal(target.record.parentAgentId);
      if (!verifiedParent) {
        throw new Error(`Cannot recompile Agent ${target.record.agentId}: parent policy integrity failed.`);
      }
      parentEffective = verifiedParent.policy;
    }
    const stack = await assembleLayerStack({
      tenantId: target.record.tenantId,
      classification: target.record.classification,
      traits: target.record.traits,
      instanceRules: target.delta.instanceRules,
      activeOverrides,
    });
    const nextRaw = compileEffectivePolicy({
      agentId: target.record.agentId,
      classification: target.record.classification,
      traits: target.record.traits,
      riskLevel: target.record.riskLevel,
      requestedTools: target.record.requestedTools,
      // Recompiles never extend lifetime: recompileWithoutExpansion restores
      // the exact earlier expiry after compilation.
      ttlSeconds: Math.max(1, Math.floor(
        (new Date(target.oldPolicy.expiresAt).getTime() - new Date(now()).getTime()) / 1000,
      )),
      layerStack: stack,
      toolDescriptors: descriptorMap(),
      parentEffective,
      creatorEntitlements: {
        allowedTools: [...target.oldPolicy.grantedTools],
        permissions: { ...target.oldPolicy.permissions },
      },
      now: now(),
    });
    const { policyHash: _nextPolicyHash, ...nextPolicyContent } = nextRaw;
    const { policy: nextPolicy, clamped } = recompileWithoutExpansion(nextPolicyContent, target.oldPolicy);
    const nextRecord: AgentRegistryRecord = {
      ...target.record,
      grantedTools: nextPolicy.grantedTools,
      policyHash: nextPolicy.policyHash,
    };
    const nextManifest = buildManifest({
      agentId: target.record.agentId,
      agentHash: computeAgentHash(nextRecord),
      policyHash: nextPolicy.policyHash,
      compiledAt: nextPolicy.compiledAt,
      secret,
    });
    return { ...target, nextRecord, nextPolicy, nextManifest, clamped };
  }

  function journalAgentPlan(plan: ActivationPlan): PolicyActivationAgentPlan {
    return {
      agentId: plan.record.agentId,
      tenantId: plan.record.tenantId,
      oldPolicyHash: plan.oldPolicy.policyHash,
      nextPolicyHash: plan.nextPolicy.policyHash,
      clamped: plan.clamped.length,
      oldRecord: plan.record,
      nextRecord: plan.nextRecord,
      oldPolicy: plan.oldPolicy,
      nextPolicy: plan.nextPolicy,
      oldManifest: plan.oldManifest,
      nextManifest: plan.nextManifest,
      delta: plan.delta,
    };
  }

  async function saveActivationPhase(
    plan: PolicyActivationRecoveryPlan,
    phase: PolicyActivationRecoveryPlan["phase"],
  ): Promise<void> {
    plan.phase = phase;
    await activationJournal.save(plan);
  }

  async function assertNoPendingActivation(): Promise<void> {
    const pending = await activationJournal.load();
    if (pending) {
      throw conflict(
        "POLICY_ACTIVATION_IN_PROGRESS",
        `Policy activation ${pending.operationId} must complete or recover before another lifecycle mutation.`,
      );
    }
  }

  async function acquireGenerationMutationLock(): Promise<() => void> {
    const deadline = Date.now() + Math.max(1_000, executionDrainTimeoutMs * 2);
    while (true) {
      const release = await acquireControlPlaneMutationLock();
      const pending = await activationJournal.load();
      if (!pending) return release;
      release();
      if (Date.now() >= deadline) {
        throw conflict(
          "POLICY_ACTIVATION_IN_PROGRESS",
          `Policy activation ${pending.operationId} did not finish before the generation wait deadline.`,
        );
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
  }

  async function rollForwardActivation(plan: PolicyActivationRecoveryPlan): Promise<void> {
    for (const agent of plan.agents) fenceExecutions(agent.agentId);
    const drained = await Promise.all(plan.agents.map((agent) => (
      waitForExecutionsIdle(agent.agentId, executionDrainTimeoutMs)
    )));
    if (drained.some((value) => value !== true)) {
      throw policyActivationRecoveryError("Fenced Agent executions did not drain before roll-forward recovery deadline.");
    }
    await saveActivationPhase(plan, "applying-agents");
    for (const agent of plan.agents) {
      const current = await registry.getUnscoped(agent.agentId);
      const currentIsOld = current?.status === "ACTIVE" && current.policyHash === agent.oldPolicyHash;
      const currentIsNext = current?.status === "ACTIVE" && current.policyHash === agent.nextPolicyHash;
      if (!currentIsOld && !currentIsNext) {
        throw policyActivationRecoveryError(
          `Agent ${agent.agentId} lifecycle or policy diverged from the activation journal.`,
        );
      }
      await files.writeAgentBundle({
        record: agent.nextRecord,
        delta: agent.delta,
        policy: agent.nextPolicy,
        manifest: agent.nextManifest,
      });
      if (!plan.bundleWrittenAgentIds.includes(agent.agentId)) {
        plan.bundleWrittenAgentIds.push(agent.agentId);
        await activationJournal.save(plan);
      }
      await registry.upsert(agent.nextRecord);
      if (!plan.registryWrittenAgentIds.includes(agent.agentId)) {
        plan.registryWrittenAgentIds.push(agent.agentId);
        await activationJournal.save(plan);
      }
    }
    await saveActivationPhase(plan, "agents-applied");

    const active = await catalog.getActive(plan.policyKey);
    const activeIsOld = activeBindingMatches(active, plan.oldPolicyBinding);
    const activeIsNext = activeBindingMatches(active, plan.nextPolicyBinding);
    if (!activeIsOld && !activeIsNext) {
      throw policyActivationRecoveryError("Catalog binding diverged from both journal bindings.");
    }
    if (!activeIsNext) {
      await catalog.activate(plan.policyKey, plan.nextPolicyBinding.version, plan.actor);
      controlPlaneEpoch += 1;
    }
    await saveActivationPhase(plan, "catalog-activated");
    await saveActivationPhase(plan, "auditing");
    for (const agent of plan.agents) {
      if (plan.auditedAgentIds.includes(agent.agentId)) continue;
      await audit({
        eventType: "POLICY_RECOMPILED",
        agentId: agent.agentId,
        tenantId: agent.tenantId,
        policyHash: agent.nextPolicyHash,
        previousPolicyHash: agent.oldPolicyHash,
        requestId: plan.requestId,
        reason: `${plan.policyKey}@${plan.nextPolicyBinding.version} activated${agent.clamped > 0 ? `; ${agent.clamped} expansion clamped` : ""}`,
      });
      plan.auditedAgentIds.push(agent.agentId);
      await activationJournal.save(plan);
    }
    await catalog.completeActivationOperation(plan.operationId, "committed", plan.baseActivationState);
    await activationJournal.clear(plan.operationId);
    for (const agent of plan.agents) unblockExecutions(agent.agentId);
  }

  async function rollBackActivation(plan: PolicyActivationRecoveryPlan): Promise<void> {
    for (const agent of plan.agents) fenceExecutions(agent.agentId);
    const drained = await Promise.all(plan.agents.map((agent) => (
      waitForExecutionsIdle(agent.agentId, executionDrainTimeoutMs)
    )));
    if (drained.some((value) => value !== true)) {
      throw policyActivationRecoveryError("Fenced Agent executions did not drain before rollback recovery deadline.");
    }
    await catalog.restoreActivation(plan.catalogSnapshot, plan.actor);
    controlPlaneEpoch += 1;
    for (const agent of [...plan.agents].reverse()) {
      await files.writeAgentBundle({
        record: agent.oldRecord,
        delta: agent.delta,
        policy: agent.oldPolicy,
        manifest: agent.oldManifest,
      });
      await registry.upsert(agent.oldRecord);
    }
    for (const agent of plan.agents) {
      await audit({
        eventType: "POLICY_REJECTED",
        agentId: agent.agentId,
        tenantId: agent.tenantId,
        policyHash: agent.oldPolicyHash,
        previousPolicyHash: agent.nextPolicyHash,
        requestId: plan.requestId,
        reason: `${plan.policyKey}@${plan.nextPolicyBinding.version} activation rolled back after commit failure`,
      });
    }
    await catalog.completeActivationOperation(plan.operationId, "rolled_back", plan.baseActivationState);
    await activationJournal.clear(plan.operationId);
    for (const agent of plan.agents) unblockExecutions(agent.agentId);
  }

  async function recoverActivationPlan(plan: PolicyActivationRecoveryPlan): Promise<void> {
    const activationState = await catalog.getActivationState();
    if (activationState.lastOperationId === plan.operationId) {
      if (activationState.sequence !== plan.baseActivationState.sequence + 1
        || (activationState.lastOutcome !== "committed" && activationState.lastOutcome !== "rolled_back")) {
        throw policyActivationRecoveryError("Activation completion replay fence is malformed or divergent.");
      }
      // A crash may occur after the anchored completion stamp but before the
      // unanchored WAL is removed. Clearing that exact completed operation is
      // idempotent; no catalog or Agent rollback is replayed.
      await verifyCompletedActivationState(plan, activationState.lastOutcome);
      await activationJournal.clear(plan.operationId);
      return;
    }
    if (!activationStateEqual(activationState, plan.baseActivationState)) {
      throw policyActivationRecoveryError(
        "Activation journal base sequence no longer matches the anchored catalog replay fence.",
      );
    }
    if (plan.phase === "rolling-back") await rollBackActivation(plan);
    else await rollForwardActivation(plan);
  }

  async function verifyCompletedActivationState(
    plan: PolicyActivationRecoveryPlan,
    outcome: "committed" | "rolled_back",
  ): Promise<void> {
    const expectedBinding = outcome === "committed" ? plan.nextPolicyBinding : plan.oldPolicyBinding;
    const active = await catalog.getActive(plan.policyKey);
    if (!activeBindingMatches(active, expectedBinding)) {
      throw policyActivationRecoveryError(
        `Completed activation ${plan.operationId} catalog binding does not match its ${outcome} stamp.`,
      );
    }
    for (const agent of plan.agents) {
      const expectedRecord = outcome === "committed" ? agent.nextRecord : agent.oldRecord;
      const expectedPolicy = outcome === "committed" ? agent.nextPolicy : agent.oldPolicy;
      const expectedManifest = outcome === "committed" ? agent.nextManifest : agent.oldManifest;
      const current = await registry.getUnscoped(agent.agentId);
      const storedPolicy = await files.loadPolicy(agent.agentId);
      const storedManifest = await files.loadManifest(agent.agentId);
      if (!current || current.status !== "ACTIVE" || current.policyHash !== expectedRecord.policyHash
        || !storedPolicy || storedPolicy.policyHash !== expectedPolicy.policyHash
        || !storedManifest || storedManifest.signature !== expectedManifest.signature
        || !verifyEffectivePolicyIntegrity(storedPolicy, storedManifest, secret, current).ok) {
        throw policyActivationRecoveryError(
          `Completed activation ${plan.operationId} Agent ${agent.agentId} does not match its ${outcome} stamp.`,
        );
      }
    }
  }

  async function persistActivationFailClosed(plan: PolicyActivationRecoveryPlan): Promise<string[]> {
    const errors: string[] = [];
    for (const agent of plan.agents) {
      const failedRecord: AgentRegistryRecord = { ...agent.oldRecord, status: "FAILED" };
      const failedManifest = buildManifest({
        agentId: failedRecord.agentId,
        agentHash: computeAgentHash(failedRecord),
        policyHash: agent.oldPolicyHash,
        compiledAt: agent.oldPolicy.compiledAt,
        secret,
      });
      try {
        await files.writeAgentBundle({
          record: failedRecord,
          delta: agent.delta,
          policy: agent.oldPolicy,
          manifest: failedManifest,
        });
      } catch (error) {
        errors.push(`fail-closed bundle ${agent.agentId}: ${errorMessage(error)}`);
      }
      try { await registry.upsert(failedRecord); }
      catch (error) { errors.push(`fail-closed registry ${agent.agentId}: ${errorMessage(error)}`); }
    }
    return errors;
  }

  async function ensureActivationRecovered(): Promise<void> {
    if (startupMaintenanceReady) return;
    if (!startupMaintenancePromise) {
      startupMaintenancePromise = (async () => {
      let migrate = false;
      const release = await acquireControlPlaneMutationLock();
      try {
        const pending = await activationJournal.load();
        if (pending) await recoverActivationPlan(pending);

        let v2 = await catalog.get("execution-family", 2);
        let installed = false;
        if (!v2) {
          v2 = await catalog.create(
            structuredClone(BUILT_IN_EXECUTION_FAMILY_V2) as CreatePolicyVersionInput,
            "system:built-in-policy-migration",
          );
          installed = true;
          await auditOnce({
            eventType: "POLICY_VALIDATED",
            tenantId: platformTenantId,
            policyHash: v2.contentHash,
            reason: "installed immutable built-in execution-family@2 migration candidate",
          });
          await activationFaultInjector?.("after-migration-install", { operationId: "built-in-execution-family-v2" });
        }
        if (v2.contentHash !== BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH) {
          throw builtInPolicyMigrationError(
            "execution-family@2 already exists with content that does not match the immutable built-in migration.",
          );
        }

        const active = await catalog.getActive("execution-family");
        if (active?.version === 2 && active.contentHash === BUILT_IN_EXECUTION_FAMILY_V2_CONTENT_HASH) return;
        const binding = active ? `${active.version}:${active.contentHash}` : "none";
        if (active?.version === 1 && isAutoMigratableExecutionFamilyV1(active.contentHash)) {
          await auditOnce({
            eventType: "POLICY_VALIDATED",
            tenantId: platformTenantId,
            policyHash: v2.contentHash,
            previousPolicyHash: active.contentHash,
            reason: "authorized built-in execution-family v1 to v2 migration by immutable content-hash allowlist",
          });
          migrate = true;
        } else if (warnedMigrationBinding !== binding || installed) {
          await auditOnce({
            eventType: "POLICY_REJECTED",
            tenantId: platformTenantId,
            policyHash: v2.contentHash,
            previousPolicyHash: active?.contentHash,
            reason: `built-in execution-family@2 remains draft; active binding ${binding} is not auto-migratable`,
          });
          warnedMigrationBinding = binding;
        }
      } finally {
        release();
      }
      if (migrate) {
        await service.activatePolicyVersion("execution-family", 2, {
          tenantId: platformTenantId,
          userId: "system:built-in-policy-migration",
          role: "system",
          permissions: ["*"],
          requestId: "built-in-execution-family-v2-migration",
        });
      }
      })().then(
        () => { startupMaintenanceReady = true; },
        (error) => {
          startupMaintenancePromise = null;
          throw error;
        },
      );
    }
    await startupMaintenancePromise;
  }

  const service: AgentGovernanceService = {
    async generateAgent(input, ctx) {
      requireContext(ctx);
      const releaseControlPlaneMutation = await acquireGenerationMutationLock();
      const generationEpoch = controlPlaneEpoch;
      const releaseGenerationLock = await acquireGenerationLock(
        input.parentAgentId ? `${ctx.tenantId}:parent:${input.parentAgentId}` : `${ctx.tenantId}:root`,
      );
      try {
      // The agent id exists from the first audit event so the complete
      // lifecycle (including rejections) lands in the agent's audit trail.
      const agentId = `agt_${randomUUID()}`;
      const unregistered = input.requestedTools.filter((tool) => !toolCatalog.lookup(tool));
      if (unregistered.length > 0) {
        await audit({
          eventType: "POLICY_REJECTED",
          agentId,
          tenantId: ctx.tenantId,
          reason: `Unregistered tools requested: ${unregistered.join(", ")}`,
          requestId: ctx.requestId,
        });
        const error = new Error(`Unregistered tools requested: ${unregistered.join(", ")}`);
        error.name = "ToolUnregistered";
        throw error;
      }

      await audit({
        eventType: "AGENT_DRAFT_CREATED",
        agentId,
        tenantId: ctx.tenantId,
        requestId: ctx.requestId,
        reason: input.task?.slice(0, 200),
      });

      // 1. Classification proposal — model (optional) then deterministic
      //    fallback. Risk backfill always recomputes from tool labels.
      let proposal = input.classification
        ? {
          classification: input.classification,
          proposedTraits: input.proposedTraits ?? [],
          proposedRiskLevel: input.proposedRiskLevel ?? "low",
        }
        : null;
      if (!proposal && modelProposer) {
        try {
          proposal = await modelProposer.proposeClassification(input.task);
        } catch {
          proposal = null;
        }
      }
      if (!proposal) proposal = deterministicProposal(input);

      const recomputed = recomputeClassification({
        classification: proposal.classification,
        proposedTraits: proposal.proposedTraits,
        proposedRiskLevel: proposal.proposedRiskLevel,
        toolDescriptors: input.requestedTools.map((tool) => toolCatalog.lookup(tool) ?? undefined),
      });
      await audit({
        eventType: "AGENT_CLASSIFIED",
        agentId,
        tenantId: ctx.tenantId,
        requestId: ctx.requestId,
        reason: `${recomputed.classification.family}/${recomputed.classification.domain} risk=${recomputed.riskLevel}`,
      });

      const draft = {
        name: input.name,
        task: input.task,
        requestedTools: input.requestedTools,
        ttlSeconds: input.ttlSeconds,
        parentAgentId: input.parentAgentId ?? null,
        classification: recomputed.classification,
        proposedTraits: recomputed.traits,
        proposedRiskLevel: recomputed.riskLevel,
      };

      // 2. Parent, stack, validation.
      const parent = draft.parentAgentId ? await loadParent(draft.parentAgentId, ctx.tenantId) : null;
      if (parent && parent.record.ownerUserId !== ctx.userId) {
        const permissions = new Set(Array.isArray(ctx.permissions) ? ctx.permissions : []);
        if (!permissions.has("*") && !permissions.has("agent:create-child:any")) {
          throw forbidden(
            "AGENT_CHILD_CREATION_OWNER_REQUIRED",
            "Only the parent Agent owner or an explicitly delegated operator may create its child Agent.",
          );
        }
      }
      const rootPolicy = await catalog.getActive("root-policy");
      const familyPolicy = await catalog.getActive(`${recomputed.classification.family}-family`);
      const trustedCreatorEntitlements = creatorEntitlements(ctx);
      const validation = validateAgentDraft({
        draft,
        toolDescriptors: descriptorMap(),
        parent: parent ? {
          record: parent.record,
          effective: parent.effective,
          currentChildrenCount: await registry.countChildren(parent.record.agentId),
        } : null,
        familyPermissions: familyPolicy?.content.permissions ?? null,
        creatorEntitlements: trustedCreatorEntitlements,
        rootLimits: rootPolicy?.content.limits ?? null,
        now: now(),
      });
      if (!validation.valid) {
        await audit({
          eventType: "POLICY_REJECTED",
          agentId,
          tenantId: ctx.tenantId,
          requestId: ctx.requestId,
          reason: validation.errors.map((error) => error.code).join(", "),
        });
        const error = new Error(validation.errors.map((item) => `${item.code}: ${item.message}`).join(" | "));
        error.name = "AgentDraftRejected";
        (error as Error & { errors?: unknown[] }).errors = validation.errors;
        throw error;
      }
      await audit({ eventType: "POLICY_VALIDATED", agentId, tenantId: ctx.tenantId, requestId: ctx.requestId });

      // 3. Compile with the full stack + parent ceiling.
      const stack = await assembleLayerStack({
        tenantId: ctx.tenantId,
        classification: recomputed.classification,
        traits: recomputed.traits,
        instanceRules: input.instanceRules,
      });
      const policy = compileEffectivePolicy({
        agentId,
        classification: recomputed.classification,
        traits: recomputed.traits,
        riskLevel: recomputed.riskLevel,
        requestedTools: draft.requestedTools,
        ttlSeconds: draft.ttlSeconds,
        layerStack: stack,
        toolDescriptors: descriptorMap(),
        parentEffective: parent?.effective ?? null,
        creatorEntitlements: trustedCreatorEntitlements,
        now: now(),
      });

      // 4. Persist: record → manifest → files → registry → ACTIVE.
      const record: AgentRegistryRecord = {
        agentId,
        name: input.name,
        purpose: input.task.slice(0, 500),
        tenantId: ctx.tenantId,
        ownerUserId: ctx.userId,
        createdBy: ctx.userId,
        parentAgentId: draft.parentAgentId,
        generationDepth: validation.computed.generationDepth,
        classification: recomputed.classification,
        traits: recomputed.traits,
        riskLevel: recomputed.riskLevel,
        requestedTools: draft.requestedTools,
        grantedTools: policy.grantedTools,
        policyHash: policy.policyHash,
        status: "ACTIVE",
        createdAt: now(),
        expiresAt: policy.expiresAt,
      };
      const agentHash = computeAgentHash(record);
      const manifest = buildManifest({
        agentId,
        agentHash,
        policyHash: policy.policyHash,
        compiledAt: policy.compiledAt,
        secret,
      });
      if (generationEpoch !== controlPlaneEpoch) {
        throw policyEpochChanged(generationEpoch, controlPlaneEpoch);
      }
      await usage.reset(agentId);
      await files.writeAgentBundle({
        record,
        delta: {
          agentId,
          inherits: stack
            .filter((layer) => layer.policyKey !== "instance-delta")
            .map((layer) => ({ policyKey: layer.policyKey, version: layer.version })),
          instanceRules: input.instanceRules ?? {},
        },
        policy,
        manifest,
      });
      await registry.upsert(record);
      try {
        await audit({
          eventType: "AGENT_ACTIVATED",
          agentId,
          tenantId: ctx.tenantId,
          requestId: ctx.requestId,
          policyHash: policy.policyHash,
        });
      } catch (error) {
        fenceExecutions(agentId);
        await registry.upsert({ ...record, status: "FAILED" });
        throw error;
      }

      return {
        agentId,
        status: record.status,
        classification: recomputed.classification,
        traits: recomputed.traits,
        riskLevel: recomputed.riskLevel,
        addedTraits: recomputed.addedTraits,
        riskEscalated: recomputed.riskEscalated,
        grantedTools: policy.grantedTools,
        policyHash: policy.policyHash,
        expiresAt: policy.expiresAt,
      };
      } finally {
        releaseGenerationLock();
        releaseControlPlaneMutation();
      }
    },

    async authorizeAgentExecution(agentId, ctx) {
      requireContext(ctx);
      await expireAgentsInternal();
      const record = await registry.get(agentId, ctx.tenantId);
      if (!record) throw notFound(`Agent ${agentId} not found for tenant.`);
      const permissions = new Set(Array.isArray(ctx.permissions) ? ctx.permissions : []);
      if (record.ownerUserId !== ctx.userId
        && !permissions.has("*")
        && !permissions.has("agent:run:any")) {
        throw forbidden("AGENT_EXECUTION_OWNER_REQUIRED", "Only the Agent owner or an explicitly delegated operator may run this Agent.");
      }
      if (record.status !== "ACTIVE") {
        throw forbidden("AGENT_NOT_ACTIVE", `Agent status is ${record.status}; execution requires ACTIVE.`);
      }
      const verified = await loadVerifiedPolicyInternal(agentId, record);
      if (!verified || isPolicyExpired(verified.policy, now())) {
        throw forbidden("AGENT_POLICY_INTEGRITY_REQUIRED", "Agent policy integrity or lifetime validation failed.");
      }
      await assertExecutionStillActive({
        agentId,
        tenantId: ctx.tenantId,
        policyHash: verified.policy.policyHash,
        policyExpiresAt: verified.policy.expiresAt,
      });
      const executionLease = tryAcquireExecution(agentId, true);
      if (!executionLease?.signal) {
        throw forbidden("AGENT_EXECUTION_FENCED", "Agent execution is being revoked or reconfigured.");
      }
      let current: AgentRegistryRecord;
      try {
        current = await assertExecutionStillActive({
          agentId,
          tenantId: ctx.tenantId,
          policyHash: verified.policy.policyHash,
          policyExpiresAt: verified.policy.expiresAt,
          signal: executionLease.signal,
        });
      } catch (error) {
        executionLease.release();
        throw error;
      }
      try {
        await audit({
          eventType: "AGENT_RUN_STARTED",
          agentId,
          tenantId: ctx.tenantId,
          requestId: ctx.requestId,
          policyHash: verified.policy.policyHash,
        });
      } catch (error) {
        executionLease.release();
        throw error;
      }
      const leaseNonce = randomUUID();
      const fingerprint = createHash("sha256")
        .update([agentId, verified.policy.policyHash, leaseNonce].join("\0"))
        .digest("hex");
      const assertActive = async (): Promise<true> => {
        await assertExecutionStillActive({
          agentId,
          tenantId: ctx.tenantId,
          policyHash: verified.policy.policyHash,
          policyExpiresAt: verified.policy.expiresAt,
          signal: executionLease.signal,
        });
        return true;
      };
      return {
        record: current,
        policy: verified.policy,
        executionLease: {
          signal: executionLease.signal,
          fingerprint,
          assertActive,
          release: executionLease.release,
        },
      };
    },

    async getAgent(agentId, tenantId) {
      await expireAgentsInternal();
      return registry.get(agentId, tenantId);
    },

    async listAgents(tenantId) {
      await expireAgentsInternal();
      return registry.listByTenant(tenantId);
    },

    async getEffectivePolicy(agentId, tenantId) {
      const record = await registry.get(agentId, tenantId);
      if (!record) return null;
      return files.loadPolicy(agentId);
    },

    async getEffectivePolicyView(agentId, tenantId) {
      // Agent-facing views hide lineage, scope internals and manifest
      // material — sensitive governance internals stay server-side.
      const policy = await this.getEffectivePolicy(agentId, tenantId);
      if (!policy) return null;
      return {
        agentId: policy.agentId,
        classification: policy.classification,
        traits: policy.traits,
        riskLevel: policy.riskLevel,
        toolDecisions: policy.toolDecisions,
        grantedTools: policy.grantedTools,
        limits: policy.limits,
        expiresAt: policy.expiresAt,
      };
    },

    async revokeAgent(agentId, input, ctx) {
      requireContext(ctx);
      const releaseControlPlaneMutation = await acquireControlPlaneMutationLock();
      const fencedAgentIds: string[] = [];
      try {
        await assertNoPendingActivation();
        const record = await registry.get(agentId, ctx.tenantId);
        if (!record) throw notFound(`Agent ${agentId} not found for tenant.`);
        const targets: AgentRegistryRecord[] = [record];
        const descendants: AgentRegistryRecord[] = [];
        const seen = new Set<string>([record.agentId]);
        const queue = [record.agentId];
        while (queue.length > 0) {
          const current = queue.shift() as string;
          for (const child of await registry.listByParent(current)) {
            if (!seen.has(child.agentId)
              && child.status !== "REVOKED" && child.status !== "ARCHIVED") {
              seen.add(child.agentId);
              descendants.push(child);
              queue.push(child.agentId);
            }
          }
        }
        if (input.cascade !== false) targets.push(...descendants);
        const revokedAt = now();
        const updates = targets
          .filter((target) => target.status !== "REVOKED")
          .map((target) => ({ ...target, status: "REVOKED" as const, revokedAt }));
        // Even a non-cascade revocation invalidates every descendant's active
        // ancestry. Fence their in-flight leases immediately while preserving
        // their durable lifecycle records for operator inspection.
        const executionFenceTargets = input.cascade === false
          ? [record, ...descendants]
          : updates;
        for (const target of executionFenceTargets) {
          fenceExecutions(target.agentId);
          fencedAgentIds.push(target.agentId);
        }
        await registry.upsertMany(updates);
        for (const target of updates) {
          await audit({
            eventType: "AGENT_REVOKED",
            agentId: target.agentId,
            parentAgentId: target.parentAgentId,
            tenantId: target.tenantId,
            reason: input.reason ?? "revoked",
            policyHash: target.policyHash,
            requestId: ctx.requestId,
          });
        }
        return { revoked: updates.map((target) => target.agentId) };
      } finally {
        releaseControlPlaneMutation();
        await Promise.all(fencedAgentIds.map((id) => waitForExecutionsIdle(id, executionDrainTimeoutMs)));
      }
    },

    async decideApproval(approvalId, decision, ctx) {
      requireContext(ctx);
      const approval = await approvals.get(approvalId);
      if (!approval) throw notFound("Approval not found.");
      const record = await registry.getUnscoped(approval.agentId);
      if (!record || record.tenantId !== ctx.tenantId) {
        throw notFound("Approval not found.");
      }
      if (decision === "approve"
        && (record.status !== "ACTIVE" || record.policyHash !== approval.review.policyHash)) {
        throw conflict(
          "APPROVAL_STALE",
          "Approval no longer matches an ACTIVE Agent and its current effective policy.",
        );
      }
      const decided = await approvals.decide(approvalId, decision, ctx.userId, async () => {
        await audit({
          eventType: decision === "approve" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
          agentId: approval.agentId,
          tenantId: ctx.tenantId,
          toolName: approval.toolName,
          requestId: ctx.requestId,
        });
      });
      return decided;
    },

    async listApprovals(agentId, tenantId) {
      const pending = await approvals.listPending(agentId ?? undefined);
      // Tenant filter via the owning agent; unknown agents are dropped.
      const scoped: AgentToolApprovalRecord[] = [];
      for (const item of pending) {
        const record = await registry.getUnscoped(item.agentId);
        if (record && record.tenantId === tenantId) scoped.push(item);
      }
      return scoped;
    },

    async createPolicyVersion(input, ctx) {
      requireContext(ctx);
      requirePlatformTenant(ctx, platformTenantId);
      assertCanonicalPolicyBinding(input);
      const releaseControlPlaneMutation = await acquireControlPlaneMutationLock();
      try {
        await assertNoPendingActivation();
        const record = await catalog.create(input, ctx.userId);
        await audit({
          eventType: "POLICY_VALIDATED",
          tenantId: ctx.tenantId,
          requestId: ctx.requestId,
          policyHash: record.contentHash,
          reason: `created ${record.policyKey}@${record.version}`,
        });
        return record;
      } finally {
        releaseControlPlaneMutation();
      }
    },

    async activatePolicyVersion(policyKey, version, ctx) {
      requireContext(ctx);
      requirePlatformTenant(ctx, platformTenantId);
      let releaseControlPlaneMutation: (() => void) | null = await acquireControlPlaneMutationLock();
      try {
        await assertNoPendingActivation();
        const candidate = await catalog.get(policyKey, version);
        if (!candidate) throw notFound(`Policy ${policyKey}@${version} not found.`);
        const catalogSnapshot = await catalog.snapshotActivation(policyKey);
        const targets: ActivationTarget[] = [];
        for (const record of await registry.listAll()) {
          if (record.status !== "ACTIVE") continue;
          const verifiedOld = await loadVerifiedPolicyInternal(record.agentId, record);
          if (!verifiedOld) {
            throw new Error(`Cannot recompile Agent ${record.agentId}: current policy integrity failed.`);
          }
          if (policyAppliesToAgent(candidate, record, verifiedOld.policy)) {
            const delta = await files.loadDelta(record.agentId);
            if (!delta) {
              throw new Error(`Cannot recompile Agent ${record.agentId}: policy delta is unavailable.`);
            }
            targets.push({
              record,
              oldPolicy: verifiedOld.policy,
              oldManifest: verifiedOld.manifest,
              delta,
            });
          }
        }

        const activatedCandidate: PolicyRecord = {
          ...candidate,
          status: "active",
          activatedAt: now(),
        };
        const activeOverrides = new Map<string, PolicyRecord | null>([[policyKey, activatedCandidate]]);
        const plans: ActivationPlan[] = [];
        // Precompile before the recovery WAL and before fencing. No durable
        // state has changed if validation/compilation fails here.
        for (const target of targets) plans.push(await planActivation(target, activeOverrides));
        const oldActive = catalogSnapshot.activeVersion === null
          ? null
          : catalogSnapshot.records.find((record) => record.version === catalogSnapshot.activeVersion) ?? null;
        const journalPlan = await activationJournal.create({
          actor: ctx.userId,
          ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
          policyKey,
          oldPolicyBinding: {
            version: catalogSnapshot.activeVersion,
            contentHash: oldActive?.contentHash ?? null,
          },
          nextPolicyBinding: { version, contentHash: candidate.contentHash },
          catalogSnapshot,
          baseActivationState: await catalog.getActivationState(),
          phase: "prepared",
          bundleWrittenAgentIds: [],
          registryWrittenAgentIds: [],
          auditedAgentIds: [],
          agents: plans.map(journalAgentPlan),
        });
        try {
          await activationFaultInjector?.("after-journal", { operationId: journalPlan.operationId });
          for (const { record } of targets) fenceExecutions(record.agentId);
          await saveActivationPhase(journalPlan, "fenced");
          await activationFaultInjector?.("after-fence", { operationId: journalPlan.operationId });
          // A durable intent and in-memory fence now prevent new runs. Release
          // the control-plane mutex while aborted executions finish so their
          // audit/quota/finally paths can never lock behind the mutation that
          // is waiting for their lease.
          releaseControlPlaneMutation();
          releaseControlPlaneMutation = null;
          const drained = await Promise.all(targets.map(({ record }) => (
            waitForExecutionsIdle(record.agentId, executionDrainTimeoutMs)
          )));
          releaseControlPlaneMutation = await acquireControlPlaneMutationLock();
          const retained = await activationJournal.load();
          if (!retained || retained.operationId !== journalPlan.operationId) {
            throw conflict(
              "POLICY_ACTIVATION_JOURNAL_CHANGED",
              "Policy activation ownership changed while executions drained.",
            );
          }
          if (drained.some((value) => value !== true)) {
            throw conflict(
              "POLICY_ACTIVATION_DRAIN_TIMEOUT",
              "Policy activation could not drain every fenced Agent execution within the configured deadline.",
            );
          }
          await saveActivationPhase(journalPlan, "applying-agents");
          for (const agent of journalPlan.agents) {
            await files.writeAgentBundle({
              record: agent.nextRecord,
              delta: agent.delta,
              policy: agent.nextPolicy,
              manifest: agent.nextManifest,
            });
            await activationFaultInjector?.("after-agent-bundle", {
              operationId: journalPlan.operationId,
              agentId: agent.agentId,
            });
            journalPlan.bundleWrittenAgentIds.push(agent.agentId);
            await activationJournal.save(journalPlan);
            const latest = await registry.getUnscoped(agent.agentId);
            if (!latest || latest.status !== "ACTIVE" || latest.policyHash !== agent.oldPolicyHash) {
              throw conflict(
                "POLICY_ACTIVATION_AGENT_STATE_CHANGED",
                `Agent ${agent.agentId} is no longer the expected ACTIVE activation target.`,
              );
            }
            await registry.upsert(agent.nextRecord);
            await activationFaultInjector?.("after-agent-registry", {
              operationId: journalPlan.operationId,
              agentId: agent.agentId,
            });
            journalPlan.registryWrittenAgentIds.push(agent.agentId);
            await activationJournal.save(journalPlan);
          }
          await saveActivationPhase(journalPlan, "agents-applied");

          const activated = await catalog.activate(policyKey, version, ctx.userId);
          controlPlaneEpoch += 1;
          await activationFaultInjector?.("after-catalog", { operationId: journalPlan.operationId });
          await saveActivationPhase(journalPlan, "catalog-activated");
          await saveActivationPhase(journalPlan, "auditing");
          for (const agent of journalPlan.agents) {
            await audit({
              eventType: "POLICY_RECOMPILED",
              agentId: agent.agentId,
              tenantId: agent.tenantId,
              policyHash: agent.nextPolicyHash,
              previousPolicyHash: agent.oldPolicyHash,
              requestId: ctx.requestId,
              reason: `${policyKey}@${version} activated${agent.clamped > 0 ? `; ${agent.clamped} expansion clamped` : ""}`,
            });
            await activationFaultInjector?.("after-audit", {
              operationId: journalPlan.operationId,
              agentId: agent.agentId,
            });
            journalPlan.auditedAgentIds.push(agent.agentId);
            await activationJournal.save(journalPlan);
          }
          await catalog.completeActivationOperation(
            journalPlan.operationId,
            "committed",
            journalPlan.baseActivationState,
          );
          try {
            await activationJournal.clear(journalPlan.operationId);
          } catch {
            // The anchored terminal stamp is authoritative. Never compensate a
            // committed effect merely because unanchored WAL cleanup failed;
            // force the next service call through verified recovery instead.
            startupMaintenanceReady = false;
            startupMaintenancePromise = null;
          }
          for (const { record } of targets) unblockExecutions(record.agentId);
          return {
            policy: activated,
            affected: plans.map((plan) => ({
              agentId: plan.record.agentId,
              previousPolicyHash: plan.oldPolicy.policyHash,
              policyHash: plan.nextPolicy.policyHash,
              clamped: plan.clamped.length,
            })),
          };
        } catch (error) {
          if (isPolicyActivationCrashSimulation(error)) {
            startupMaintenanceReady = false;
            startupMaintenancePromise = null;
            throw error;
          }
          try {
            await saveActivationPhase(journalPlan, "rolling-back");
            await rollBackActivation(journalPlan);
          } catch (rollbackError) {
            const rollbackErrors = [errorMessage(rollbackError), ...await persistActivationFailClosed(journalPlan)];
            startupMaintenanceReady = false;
            startupMaintenancePromise = null;
            throw policyActivationTransactionError(
              error,
              false,
              rollbackErrors,
              [],
              journalPlan.agents.map((agent) => agent.agentId),
            );
          }
          throw policyActivationTransactionError(error, true, [], []);
        }
      } finally {
        releaseControlPlaneMutation?.();
      }
    },

    async listPolicies() {
      return catalog.list();
    },

    async expireAgents() {
      return expireAgentsInternal();
    },

    async readAudit(agentId, tenantId, limit) {
      const record = await registry.get(agentId, tenantId);
      if (!record) return [];
      return auditLog.readForAgent(agentId, limit);
    },

    async emitAudit(event) {
      await audit(event);
    },

    async loadVerifiedPolicy(agentId) {
      return loadVerifiedPolicyInternal(agentId);
    },

    async getUsage(agentId) {
      return usage.get(agentId);
    },

    async incrementUsage(agentId, field) {
      await usage.increment(agentId, field);
    },

    async reserveUsage(agentId, limits, delta) {
      const reservation = await usage.reserve(agentId, limits, delta);
      return { allowed: reservation.allowed, reason: reservation.reason };
    },

    async releaseUsage(agentId, delta) {
      await usage.release(agentId, delta);
    },

    async acquireToolExecutionLease(input) {
      const record = await registry.get(input.agentId, input.tenantId);
      if (!record || record.status !== "ACTIVE" || record.policyHash !== input.policyHash) return null;
      const verified = await loadVerifiedPolicyInternal(input.agentId, record);
      if (!verified || verified.policy.policyHash !== input.policyHash) return null;
      const lease = tryAcquireExecution(input.agentId);
      if (!lease) return null;
      try {
        await assertExecutionStillActive({
          agentId: input.agentId,
          tenantId: input.tenantId,
          policyHash: input.policyHash,
          policyExpiresAt: verified.policy.expiresAt,
        });
      } catch {
        lease.release();
        return null;
      }
      return { release: lease.release };
    },

    async consumeApprovedArguments(input) {
      const { computeArgumentsHash } = await import("@unified-ai-system/policy-engine");
      const matched = await approvals.consumeApproved({
        approvalId: input.approvalId,
        agentId: input.agentId,
        tenantId: input.tenantId,
        toolName: input.toolName,
        argumentsHash: computeArgumentsHash(input.args),
        policyHash: input.policyHash,
        executionId: input.executionId,
      }, async () => {
        await audit({
          eventType: "APPROVAL_CONSUMED",
          agentId: input.agentId,
          tenantId: input.tenantId,
          toolName: input.toolName,
          reason: `approval ${input.approvalId} consumed by ${input.executionId}`,
        });
        await audit({
          eventType: "TOOL_ALLOWED",
          agentId: input.agentId,
          tenantId: input.tenantId,
          toolName: input.toolName,
          decision: "require_approval",
          reason: `approved execution ${input.approvalId}`,
        });
      });
      if (!matched) return null;
      return { approvalId: matched.id, args: matched.args, review: matched.review };
    },

    async findApprovedArguments(input) {
      const { computeArgumentsHash } = await import("@unified-ai-system/policy-engine");
      const matched = await approvals.findApproved({
        agentId: input.agentId,
        tenantId: input.tenantId,
        toolName: input.toolName,
        argumentsHash: computeArgumentsHash(input.args),
        policyHash: input.policyHash,
      });
      return matched ? { approvalId: matched.id } : null;
    },

    async createApproval(agentId, toolName, args, tenantId, review, reason) {
      const approval = await approvals.create(
        { agentId, toolName, arguments: args, tenantId, review, reason },
        async (pending) => {
          await audit({
            eventType: "APPROVAL_REQUESTED",
            agentId,
            tenantId,
            toolName,
            reason: `${reason ?? "approval requested"}; approvalId=${pending.id}`,
          });
        },
      );
      return approval;
    },

    async stats() {
      const agents = await registry.listAll();
      return {
        agents: agents.length,
        byStatus: agents.reduce<Record<string, number>>((acc, record) => {
          acc[record.status] = (acc[record.status] ?? 0) + 1;
          return acc;
        }, {}),
        policies: (await catalog.list()).length,
        storage: { configured: true, pathExposed: false },
      };
    },
  };

  return new Proxy(service, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await ensureActivationRecovered();
        return Reflect.apply(value, target, args);
      };
    },
  });

  async function expireAgentsInternal(): Promise<number> {
    const nowIso = now();
    const isExpired = (record: AgentRegistryRecord) => (
      record.status === "ACTIVE" && Boolean(record.expiresAt) && record.expiresAt <= nowIso
    );
    let expired = (await registry.listAll()).filter(isExpired);
    if (expired.length > 0) {
      const releaseControlPlaneMutation = await acquireControlPlaneMutationLock();
      try {
        if (await activationJournal.load()) return 0;
        // Re-read under the lifecycle mutation boundary so activation and
        // revoke cannot resurrect or partially overwrite an expiry batch.
        expired = (await registry.listAll()).filter(isExpired);
        const updates = expired.map((record) => ({ ...record, status: "EXPIRED" as const }));
        for (const record of updates) fenceExecutions(record.agentId);
        await registry.upsertMany(updates);
      } finally {
        releaseControlPlaneMutation();
      }
      for (const record of expired) {
        await audit({
          eventType: "AGENT_EXPIRED",
          agentId: record.agentId,
          tenantId: record.tenantId,
          policyHash: record.policyHash,
        });
      }
    }
    await approvals.expireStale(nowIso);
    return expired.length;
  }
}

function requireContext(ctx: GovernanceContext): void {
  if (!ctx || typeof ctx.tenantId !== "string" || ctx.tenantId.trim() === ""
    || typeof ctx.userId !== "string" || ctx.userId.trim() === "") {
    const error = new Error("Governance context requires tenantId and userId.");
    error.name = "GovernanceContextRequired";
    throw error;
  }
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

function configuredNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function notFound(message: string): Error {
  const error = new Error(message);
  error.name = "NotFound";
  return error;
}

function forbidden(code: string, message: string): Error & { code: string; statusCode: number } {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.name = code;
  error.code = code;
  error.statusCode = 403;
  return error;
}

function conflict(code: string, message: string): Error & { code: string; statusCode: number } {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.name = code;
  error.code = code;
  error.statusCode = 409;
  return error;
}

function requirePlatformTenant(ctx: GovernanceContext, platformTenantId: string): void {
  if (ctx.tenantId !== platformTenantId) {
    throw forbidden(
      "PLATFORM_TENANT_REQUIRED",
      "Global Agent Governance policy changes require the configured platform tenant.",
    );
  }
}

function assertCanonicalPolicyBinding(input: CreatePolicyVersionInput): void {
  const expected = (() => {
    switch (input.policyType) {
      case "emergency": return "emergency-policy";
      case "root": return "root-policy";
      case "tenant": return `tenant:${input.scopeKey}`;
      case "family": return `${input.scopeKey}-family`;
      case "domain": return `${input.scopeKey}-domain`;
      case "subclass": return `${input.scopeKey}-subclass`;
      case "trait": return `${input.scopeKey}-trait`;
      case "instance": return `agent:${input.scopeKey}`;
      case "task": return `task:${input.scopeKey}`;
      default: return null;
    }
  })();
  if (!expected || input.policyKey !== expected) {
    throw forbidden(
      "POLICY_BINDING_INVALID",
      `Policy key must be ${expected ?? "a canonical binding"} for its type and scope.`,
    );
  }
}

function policyAppliesToAgent(
  policy: PolicyRecord,
  record: AgentRegistryRecord,
  current: EffectiveAgentPolicy,
): boolean {
  if (current.lineage.some((binding) => binding.policyKey === policy.policyKey)) return true;
  switch (policy.policyType) {
    case "emergency":
    case "root":
      return true;
    case "tenant":
      return policy.scopeKey === record.tenantId;
    case "family":
      return policy.scopeKey === record.classification.family;
    case "domain":
      return policy.scopeKey === record.classification.domain;
    case "subclass":
      return policy.scopeKey === record.classification.subclass;
    case "trait":
      return record.traits.some((trait) => trait === policy.scopeKey);
    case "instance":
      return policy.scopeKey === record.agentId;
    case "task":
    default:
      return false;
  }
}

function activeBindingMatches(
  active: PolicyRecord | null,
  binding: { version: number | null; contentHash: string | null },
): boolean {
  if (binding.version === null) return active === null && binding.contentHash === null;
  return active?.version === binding.version && active.contentHash === binding.contentHash;
}

function isPolicyActivationCrashSimulation(error: unknown): boolean {
  return Boolean(error && typeof error === "object"
    && (error as { code?: unknown }).code === "POLICY_ACTIVATION_CRASH_SIMULATION");
}

function activationStateEqual(
  left: PolicyCatalogActivationState,
  right: PolicyCatalogActivationState,
): boolean {
  return left.sequence === right.sequence
    && left.lastOperationId === right.lastOperationId
    && left.lastOutcome === right.lastOutcome;
}

function policyActivationRecoveryError(message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "PolicyActivationRecoveryError", code: "POLICY_ACTIVATION_RECOVERY_REQUIRED" },
  );
}

function builtInPolicyMigrationError(message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "BuiltInPolicyMigrationError", code: "BUILT_IN_POLICY_MIGRATION_REQUIRED" },
  );
}

function policyEpochChanged(expected: number, actual: number): Error {
  const error = new Error(
    `Agent generation observed policy epoch ${expected}, but control-plane epoch is now ${actual}.`,
  );
  error.name = "PolicyEpochChanged";
  return error;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function policyActivationTransactionError(
  cause: unknown,
  rolledBack: boolean,
  rollbackErrors: string[],
  compensationAuditErrors: string[],
  failClosedAgentIds: string[] = [],
): Error {
  const state = rolledBack
    ? "all durable policy and Agent state was rolled back"
    : `rollback was incomplete; ${failClosedAgentIds.length} Agent(s) remain fenced in FAILED recovery state`;
  const error = new Error(
    `Policy activation transaction failed: ${errorMessage(cause)}; ${state}.`,
    cause === undefined ? undefined : { cause },
  ) as Error & {
    code: string;
    rolledBack: boolean;
    rollbackErrors: string[];
    compensationAuditErrors: string[];
    failClosedAgentIds: string[];
  };
  error.name = "PolicyActivationTransactionFailed";
  error.code = "POLICY_ACTIVATION_TRANSACTION_FAILED";
  error.rolledBack = rolledBack;
  error.rollbackErrors = rollbackErrors;
  error.compensationAuditErrors = compensationAuditErrors;
  error.failClosedAgentIds = failClosedAgentIds;
  return error;
}

export function agentPolicyIsExpired(policy: EffectiveAgentPolicy, nowIso: string): boolean {
  return isPolicyExpired(policy, nowIso);
}
