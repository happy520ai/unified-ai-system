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
  computePolicyDeltaHash,
  isPolicyExpired,
  recompileWithoutExpansion,
  recomputeClassification,
  stableStringify,
  type RecompileClamp,
  validateAgentDraft,
  validateNoSelfModification,
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
import type {
  AgentGenerationJournal,
  AgentGenerationRecoveryPlan,
} from "./agentGenerationJournal.ts";
import { createAgentGenerationJournal } from "./agentGenerationJournal.ts";
import { getGovernanceStateAuthority } from "./governanceStateAnchor.ts";
import { normalizeModelPolicyDraft } from "./modelPolicyDraft.ts";

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
  taskPolicyKeys?: string[];
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

export interface AgentGovernanceServiceHealth {
  ready: boolean;
  startupRecovery: "ready";
  stateIntegrity: "verified" | "failed";
  auditIntegrity: "verified" | "failed";
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
  /** Non-secret readiness probe. The service Proxy completes startup
   * reconciliation before this method verifies signed state and audit data. */
  checkHealth(): Promise<AgentGovernanceServiceHealth>;
  /** Strict read-only verification of every Registry Agent's complete signed bundle. */
  verifyAllAgentBundles(): Promise<{ verifiedAgentCount: number }>;
  stats(): Promise<Record<string, unknown>>;
}

export interface ModelProposer {
  /** Proposes classification and an optional instance PolicyDraft only.
   * Deterministic validation/compilation remains the sole authority. */
  proposeClassification(task: string, context?: {
    name: string;
    requestedTools: string[];
    tenantId: string;
    userId: string;
    requestId?: string;
  }): Promise<{
    classification: AgentClassification;
    proposedTraits: string[];
    proposedRiskLevel: RiskLevel;
    policyDraft?: PolicyLayerContent;
  } | null>;
}

export interface AgentGovernanceServiceOptions {
  env?: Record<string, string | undefined>;
  dataDir?: string;
  now?: () => string;
  modelProposer?: ModelProposer | null;
  toolRiskCatalog?: ToolRiskCatalog;
  activationJournal?: PolicyActivationJournal;
  generationJournal?: AgentGenerationJournal;
  /** Stable, non-secret identity of the configured Registry authority. */
  registryAuthority?: string;
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
  /** Crash-simulation seam. Throw an error with code
   * AGENT_GENERATION_CRASH_SIMULATION to retain the generation WAL. */
  generationFaultInjector?: (
    stage: AgentGenerationCommitStage,
    detail: { operationId: string; agentId: string },
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

export type AgentGenerationCommitStage =
  | "after-generation-journal"
  | "after-generation-usage"
  | "after-generation-bundle"
  | "after-generation-registry"
  | "after-generation-audit"
  | "after-generation-active";

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
  const files: AgentFileStore = options.stores?.files ?? createAgentFileStore({ dataDir, secret });
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
  const generationJournal = options.generationJournal
    ?? createAgentGenerationJournal({ dataDir, secret, now });
  const generationFaultInjector = options.generationFaultInjector;
  const storeAuthority = (registry as AgentRegistryStore & {
    getAuthorityBinding?: () => string;
  }).getAuthorityBinding?.();
  const registryAuthorityBase = normalizeRegistryAuthority(
    options.registryAuthority ?? storeAuthority
      ?? (options.stores?.registry ? "injected-registry-v1" : "signed-json-v1"),
  );
  let registryAuthorityPromise: Promise<string> | null = null;
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

  async function resolveRegistryAuthority(): Promise<string> {
    if (!registryAuthorityPromise) {
      registryAuthorityPromise = getGovernanceStateAuthority({ dataDir, secret })
        .then(({ installationId, epoch }) => {
          const digest = createHash("sha256")
            .update(stableStringify({ registryAuthorityBase, installationId, epoch }), "utf8")
            .digest("hex");
          return normalizeRegistryAuthority(`registry-authority-v2:${digest}`);
        })
        .catch((error) => {
          registryAuthorityPromise = null;
          throw error;
        });
    }
    return registryAuthorityPromise;
  }

  async function audit(event: AuditEventInput): Promise<void> {
    const stamped: AgentGovernanceAuditEvent = {
      ...event,
      id: event.id ?? `age_${randomUUID()}`,
      timestamp: now(),
    };
    await auditLog.record(stamped);
    // Lifecycle events carrying an agentId also land in that agent's
    // append-only audit.ndjson.
    if (stamped.agentId) {
      try {
        await files.appendAudit(stamped.agentId, stamped);
      } catch (cause) {
        startupMaintenanceReady = false;
        startupMaintenancePromise = null;
        throw Object.assign(new Error(
          "The central governance audit committed but its per-Agent mirror did not; recovery is required.",
          { cause },
        ), {
          name: "AgentAuditMirrorWriteError",
          code: "AGENT_AUDIT_MIRROR_WRITE_FAILED",
          category: "persistence",
          statusCode: 503,
          eventId: stamped.id,
        });
      }
    }
  }

  async function verifyAuditMirrors(repair: boolean): Promise<void> {
    const central = await auditLog.read(100_000);
    const centralTruncated = central.some((event) => event.checkpoint?.truncated === true);
    const byAgent = new Map<string, AgentGovernanceAuditEvent[]>();
    for (const event of central) {
      if (!event.agentId || !event.id) continue;
      const events = byAgent.get(event.agentId) ?? [];
      events.push(event);
      byAgent.set(event.agentId, events);
    }
    for (const [agentId, expectedEvents] of byAgent) {
      let mirrored: AgentGovernanceAuditEvent[];
      try {
        mirrored = await files.readAudit(agentId, 100_000);
      } catch (cause) {
        throw Object.assign(new Error("Agent audit mirror authentication or chain verification failed.", { cause }), {
          code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
        });
      }
      const expectedIds = new Set(expectedEvents.map((event) => event.id!));
      const seenMirrorIds = new Set<string>();
      const retainedMirrorEvents: AgentGovernanceAuditEvent[] = [];
      let retainedSequenceStarted = false;
      for (const event of mirrored) {
        if (event.id && seenMirrorIds.has(event.id)) {
          throw Object.assign(new Error("Agent audit mirror contains a duplicate event identity."), {
            code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
          });
        }
        if (event.id) seenMirrorIds.add(event.id);
        if (event.id && expectedIds.has(event.id)) {
          retainedSequenceStarted = true;
          retainedMirrorEvents.push(event);
        } else if (retainedSequenceStarted) {
          throw Object.assign(new Error("Agent audit mirror has an unexpected event inside the retained sequence."), {
            code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
          });
        } else if (!centralTruncated) {
          throw Object.assign(new Error("Agent audit mirror has an event absent from the untruncated central audit."), {
            code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
          });
        }
      }
      if (retainedMirrorEvents.length > expectedEvents.length) {
        throw Object.assign(new Error("Agent audit mirror exceeds the retained central sequence."), {
          code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
        });
      }
      for (let index = 0; index < retainedMirrorEvents.length; index += 1) {
        const actual = retainedMirrorEvents[index];
        const expected = expectedEvents[index];
        if (actual.id !== expected.id) {
          throw Object.assign(new Error("Agent audit mirror has a middle gap or reordered event."), {
            code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
          });
        }
        if (stableStringify(actual) !== stableStringify(expected)) {
          throw Object.assign(new Error("Agent audit mirror diverges from the retained central event."), {
            code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
          });
        }
      }
      if (retainedMirrorEvents.length < expectedEvents.length) {
        if (!repair) {
          throw Object.assign(new Error("Agent audit mirror is missing a retained central suffix."), {
            code: "AGENT_AUDIT_MIRROR_INTEGRITY_FAILED",
          });
        }
        for (const expected of expectedEvents.slice(retainedMirrorEvents.length)) {
          await files.appendAudit(agentId, expected);
        }
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
        subclass: input.name ? input.name.trim().slice(0, 64) : "general",
      },
      proposedTraits,
      proposedRiskLevel,
    };
  }

  async function assembleLayerStack(input: {
    agentId: string;
    tenantId: string;
    classification: AgentClassification;
    traits: string[];
    instanceRules?: PolicyLayerContent;
    taskPolicyKeys?: string[];
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
    await push(`agent:${input.agentId}`);
    if (input.instanceRules && Object.keys(input.instanceRules).length > 0) {
      stack.push({
        policyKey: `agent:${input.agentId}:creation-delta`,
        version: 1,
        policyType: "instance",
        scopeKey: input.agentId,
        content: input.instanceRules,
        contentHash: computePolicyContentHash(input.instanceRules),
        status: "active",
        createdAt: now(),
      });
    }
    for (const taskPolicyKey of input.taskPolicyKeys ?? []) {
      const policyKey = `task:${taskPolicyKey}`;
      const before = stack.length;
      await push(policyKey);
      if (stack.length === before) {
        throw Object.assign(new Error(`Task policy ${policyKey} is not active.`), {
          name: "TaskPolicyNotActive",
          code: "TASK_POLICY_NOT_ACTIVE",
        });
      }
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

  async function actorAncestry(ctx: GovernanceContext): Promise<string[]> {
    const actorAgentId = ctx.actorAgentId;
    if (!actorAgentId) return [];
    const actor = await registry.get(actorAgentId, ctx.tenantId);
    if (!actor) {
      throw forbidden(
        "AGENT_ACTOR_IDENTITY_INVALID",
        "The authenticated Agent actor does not exist in the caller tenant.",
      );
    }
    const ancestry: string[] = [];
    const seen = new Set<string>([actor.agentId]);
    let parentAgentId = actor.parentAgentId;
    while (parentAgentId) {
      if (seen.has(parentAgentId)) {
        throw forbidden(
          "AGENT_ACTOR_ANCESTRY_INVALID",
          "The authenticated Agent actor has an invalid ancestry chain.",
        );
      }
      seen.add(parentAgentId);
      const parent = await registry.get(parentAgentId, ctx.tenantId);
      if (!parent) {
        throw forbidden(
          "AGENT_ACTOR_ANCESTRY_INVALID",
          "The authenticated Agent actor has an incomplete ancestry chain.",
        );
      }
      ancestry.push(parent.agentId);
      parentAgentId = parent.parentAgentId;
    }
    return ancestry;
  }

  async function assertAgentActorTargetAllowed(
    ctx: GovernanceContext,
    targetAgentId: string,
    operation: "policy" | "lifecycle",
  ): Promise<void> {
    if (!ctx.actorAgentId) return;
    const violation = validateNoSelfModification({
      actorAgentId: ctx.actorAgentId,
      targetAgentId,
      ancestry: await actorAncestry(ctx),
    });
    if (!violation) return;
    throw forbidden(
      operation === "lifecycle"
        ? "SELF_LIFECYCLE_MODIFICATION_DENIED"
        : violation.code,
      operation === "lifecycle"
        ? "An Agent actor may not revoke or change the lifecycle of itself or an ancestor."
        : violation.message,
    );
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
  ): Promise<{ policy: EffectiveAgentPolicy; manifest: AgentPolicyManifest; delta: AgentPolicyDelta } | null> {
    const record = currentRecord ?? await registry.getUnscoped(agentId);
    if (!record) return null;
    let bundle;
    try {
      bundle = await files.loadBundle(agentId);
    } catch {
      bundle = null;
    }
    const policy = bundle?.policy ?? null;
    const manifest = bundle?.manifest ?? null;
    const delta = bundle?.delta ?? null;
    const recordMatches = bundle
      ? stableStringify(bundle.record) === stableStringify(record)
      : false;
    const integrity = policy && manifest && delta && recordMatches
      ? verifyEffectivePolicyIntegrity(policy, manifest, secret, record, delta)
      : { ok: false, reason: bundle ? "BUNDLE_RECORD_MISMATCH" : "BUNDLE_LOAD_FAILED" };
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
        policyHash: policy?.policyHash ?? record.policyHash,
      });
      return null;
    }
    return { policy: policy!, manifest: manifest!, delta: delta! };
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
      agentId: target.record.agentId,
      tenantId: target.record.tenantId,
      classification: target.record.classification,
      traits: target.record.traits,
      instanceRules: target.delta.instanceRules,
      taskPolicyKeys: target.delta.taskPolicyKeys ?? [],
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
      deltaHash: computePolicyDeltaHash(target.delta),
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

  async function advanceGenerationPhase(
    plan: AgentGenerationRecoveryPlan,
    phase: AgentGenerationRecoveryPlan["phase"],
  ): Promise<void> {
    if (generationPhaseRank(plan.phase) >= generationPhaseRank(phase)) return;
    plan.phase = phase;
    await generationJournal.save(plan);
  }

  function generationAuditMatches(
    event: AgentGovernanceAuditEvent,
    plan: AgentGenerationRecoveryPlan,
    eventType: "AGENT_ACTIVATED" | "POLICY_REJECTED",
  ): boolean {
    return event.eventType === eventType
      && event.agentId === plan.record.agentId
      && event.tenantId === plan.record.tenantId
      && event.policyHash === plan.record.policyHash
      && event.metadata?.generationOperationId === plan.operationId;
  }

  async function hasGenerationAudit(
    plan: AgentGenerationRecoveryPlan,
    eventType: "AGENT_ACTIVATED" | "POLICY_REJECTED",
  ): Promise<boolean> {
    const events = await auditLog.readForAgent(plan.record.agentId, 100_000);
    return events.some((event) => generationAuditMatches(event, plan, eventType));
  }

  function generationRecordIdentityMatches(
    current: AgentRegistryRecord,
    expected: AgentRegistryRecord,
  ): boolean {
    const { status: _currentStatus, revokedAt: _currentRevokedAt, ...currentIdentity } = current;
    const { status: _expectedStatus, revokedAt: _expectedRevokedAt, ...expectedIdentity } = expected;
    return stableStringify(currentIdentity) === stableStringify(expectedIdentity);
  }

  async function emitGenerationActivated(plan: AgentGenerationRecoveryPlan): Promise<void> {
    if (await hasGenerationAudit(plan, "AGENT_ACTIVATED")) return;
    await audit({
      eventType: "AGENT_ACTIVATED",
      agentId: plan.record.agentId,
      tenantId: plan.record.tenantId,
      requestId: plan.requestId,
      policyHash: plan.record.policyHash,
      metadata: { generationOperationId: plan.operationId, generationOutcome: "activated" },
    });
  }

  async function persistGenerationFailed(
    plan: AgentGenerationRecoveryPlan,
    reason: string,
  ): Promise<void> {
    const current = await registry.getUnscoped(plan.record.agentId);
    if (current && !generationRecordIdentityMatches(current, plan.record)) {
      throw agentGenerationRecoveryError(
        `Agent ${plan.record.agentId} diverged from its generation journal; refusing recovery overwrite.`,
      );
    }
    const failedRecord: AgentRegistryRecord = {
      ...plan.record,
      status: "FAILED",
      ...(current?.revokedAt ? { revokedAt: current.revokedAt } : {}),
    };
    const failedManifest = buildManifest({
      agentId: failedRecord.agentId,
      agentHash: computeAgentHash(failedRecord),
      policyHash: plan.policy.policyHash,
      deltaHash: computePolicyDeltaHash(plan.delta),
      compiledAt: plan.policy.compiledAt,
      secret,
    });
    await files.writeAgentBundle({
      record: failedRecord,
      delta: plan.delta,
      policy: plan.policy,
      manifest: failedManifest,
    });
    await registry.upsert(failedRecord);
    if (!await hasGenerationAudit(plan, "POLICY_REJECTED")) {
      await audit({
        eventType: "POLICY_REJECTED",
        agentId: failedRecord.agentId,
        tenantId: failedRecord.tenantId,
        requestId: plan.requestId,
        policyHash: failedRecord.policyHash,
        reason,
        metadata: { generationOperationId: plan.operationId, generationOutcome: "failed" },
      });
    }
    await generationJournal.clear(plan.operationId);
  }

  async function recoverGenerationPlan(plan: AgentGenerationRecoveryPlan): Promise<void> {
    if (plan.registryAuthority !== await resolveRegistryAuthority()) {
      throw agentGenerationRecoveryError(
        "Agent generation journal belongs to a different Registry authority; refusing cross-authority replay.",
        undefined,
        "AGENT_GENERATION_RECOVERY_AUTHORITY_MISMATCH",
      );
    }
    const current = await registry.getUnscoped(plan.record.agentId);
    if (current && !generationRecordIdentityMatches(current, plan.record)) {
      throw agentGenerationRecoveryError(
        `Agent ${plan.record.agentId} lifecycle or identity diverged from the generation journal.`,
      );
    }
    const recoverableStatus = current?.status === "ACTIVE"
      || current?.status === "VALIDATED"
      || current?.status === "DRAFT";
    if (current && !recoverableStatus) {
      if (!await hasGenerationAudit(plan, "POLICY_REJECTED")) {
        await audit({
          eventType: "POLICY_REJECTED",
          agentId: current.agentId,
          tenantId: current.tenantId,
          requestId: plan.requestId,
          policyHash: current.policyHash,
          reason: `generation recovery preserved terminal status ${current.status}`,
          metadata: { generationOperationId: plan.operationId, generationOutcome: "failed" },
        });
      }
      await generationJournal.clear(plan.operationId);
      return;
    }

    if (plan.record.expiresAt <= now()) {
      await persistGenerationFailed(plan, "generation recovery rejected an Agent whose signed TTL already expired");
      return;
    }
    try {
      await assertActiveAncestorChain(plan.record, now());
    } catch (error) {
      await persistGenerationFailed(
        plan,
        `generation recovery rejected an invalid ancestor chain: ${errorMessage(error)}`,
      );
      return;
    }

    const alreadyAudited = await hasGenerationAudit(plan, "AGENT_ACTIVATED");
    if (!alreadyAudited || generationPhaseRank(plan.phase) < generationPhaseRank("active")) {
      await usage.reset(plan.record.agentId);
      await advanceGenerationPhase(plan, "usage-reset");
    }
    await files.writeAgentBundle({
      record: plan.record,
      delta: plan.delta,
      policy: plan.policy,
      manifest: plan.manifest,
    });
    await advanceGenerationPhase(plan, "bundle-written");
    if (current?.status !== "ACTIVE") {
      await registry.upsert({ ...plan.record, status: "VALIDATED" });
    }
    await advanceGenerationPhase(plan, "registry-validated");
    await emitGenerationActivated(plan);
    await advanceGenerationPhase(plan, "audited");
    await registry.upsert(plan.record);
    await advanceGenerationPhase(plan, "active");
    await generationJournal.clear(plan.operationId);
  }

  async function saveActivationPhase(
    plan: PolicyActivationRecoveryPlan,
    phase: PolicyActivationRecoveryPlan["phase"],
  ): Promise<void> {
    plan.phase = phase;
    await activationJournal.save(plan);
  }

  async function assertNoPendingActivation(): Promise<void> {
    const [pendingActivation, pendingGeneration] = await Promise.all([
      activationJournal.load(),
      generationJournal.load(),
    ]);
    if (pendingActivation) {
      throw conflict(
        "POLICY_ACTIVATION_IN_PROGRESS",
        `Policy activation ${pendingActivation.operationId} must complete or recover before another lifecycle mutation.`,
      );
    }
    if (pendingGeneration) {
      throw conflict(
        "AGENT_GENERATION_IN_PROGRESS",
        `Agent generation ${pendingGeneration.operationId} must complete or recover before another lifecycle mutation.`,
      );
    }
  }

  async function acquireGenerationMutationLock(): Promise<() => void> {
    const deadline = Date.now() + Math.max(1_000, executionDrainTimeoutMs * 2);
    while (true) {
      const release = await acquireControlPlaneMutationLock();
      const [pendingActivation, pendingGeneration] = await Promise.all([
        activationJournal.load(),
        generationJournal.load(),
      ]);
      if (!pendingActivation && !pendingGeneration) return release;
      release();
      if (pendingGeneration) {
        throw conflict(
          "AGENT_GENERATION_IN_PROGRESS",
          `Agent generation ${pendingGeneration.operationId} must complete or recover before another generation.`,
        );
      }
      if (Date.now() >= deadline) {
        throw conflict(
          "POLICY_ACTIVATION_IN_PROGRESS",
          `Policy activation ${pendingActivation?.operationId ?? "unknown"} did not finish before the generation wait deadline.`,
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
      let bundle;
      try { bundle = await files.loadBundle(agent.agentId); }
      catch { bundle = null; }
      if (!current || current.status !== "ACTIVE" || current.policyHash !== expectedRecord.policyHash
        || !bundle || stableStringify(bundle.record) !== stableStringify(current)
        || bundle.policy.policyHash !== expectedPolicy.policyHash
        || bundle.manifest.signature !== expectedManifest.signature
        || !verifyEffectivePolicyIntegrity(bundle.policy, bundle.manifest, secret, current, bundle.delta).ok) {
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
        deltaHash: computePolicyDeltaHash(agent.delta),
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
        // Resolve the authenticated installation identity before reading any
        // recovery intent. A same-key WAL copied from another data root must
        // fail before it can write a Registry record, bundle, usage or audit.
        await resolveRegistryAuthority();
        const [pendingGeneration, pendingActivation] = await Promise.all([
          generationJournal.load(),
          activationJournal.load(),
        ]);
        if (pendingGeneration && pendingActivation) {
          throw agentGenerationRecoveryError(
            "Generation and policy activation journals coexist; refusing ambiguous cross-store recovery.",
          );
        }
        if (pendingGeneration) await recoverGenerationPlan(pendingGeneration);
        if (pendingActivation) await recoverActivationPlan(pendingActivation);
        await verifyAuditMirrors(true);

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
      if (ctx.actorAgentId && input.parentAgentId !== ctx.actorAgentId) {
        throw forbidden(
          "AGENT_ACTOR_CHILD_PARENT_REQUIRED",
          "An Agent actor may only generate a child bound directly to itself as parent.",
        );
      }
      // Allocate and audit the draft before asking an optional model for a
      // classification proposal. The model is untrusted and may be slow; it
      // must never hold the lifecycle mutation lock needed by emergency
      // revoke or policy activation. All authority-bearing reads and the
      // deterministic compilation still happen after the lock is acquired.
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

      // Classification is only a proposal. Risk backfill, parent checks,
      // entitlements, policy loading and compilation remain deterministic
      // and are re-read under the mutation lock below.
      let proposalSource: "request" | "gateway_model" | "deterministic" = input.classification
        ? "request"
        : "deterministic";
      let modelProposalFailed = false;
      let modelPolicyDraftProposed = false;
      let proposal: Awaited<ReturnType<ModelProposer["proposeClassification"]>> = input.classification
        ? {
          classification: input.classification,
          proposedTraits: input.proposedTraits ?? [],
          proposedRiskLevel: input.proposedRiskLevel ?? "low",
        }
        : null;
      if (!proposal && modelProposer) {
        try {
          const candidate = await modelProposer.proposeClassification(input.task, {
            name: input.name,
            requestedTools: [...input.requestedTools],
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            requestId: ctx.requestId,
          });
          if (candidate) {
            modelPolicyDraftProposed = candidate.policyDraft !== undefined;
            proposal = {
              ...candidate,
              ...(candidate.policyDraft !== undefined
                ? { policyDraft: normalizeModelPolicyDraft(candidate.policyDraft) }
                : {}),
            };
            proposalSource = "gateway_model";
          } else {
            modelProposalFailed = true;
          }
        } catch {
          proposal = null;
          modelProposalFailed = true;
        }
      }
      if (!proposal) proposal = deterministicProposal(input);
      const explicitInstanceRules = input.instanceRules !== undefined;
      const proposedInstanceRules = proposalSource === "gateway_model" ? proposal.policyDraft : undefined;
      const modelPolicyDraftAdopted = !explicitInstanceRules
        && proposedInstanceRules !== undefined
        && Object.keys(proposedInstanceRules).length > 0;
      const effectiveInstanceRules = explicitInstanceRules
        ? input.instanceRules
        : modelPolicyDraftAdopted ? proposedInstanceRules : undefined;

      const releaseControlPlaneMutation = await acquireGenerationMutationLock();
      const generationEpoch = controlPlaneEpoch;
      const releaseGenerationLock = await acquireGenerationLock(
        input.parentAgentId ? `${ctx.tenantId}:parent:${input.parentAgentId}` : `${ctx.tenantId}:root`,
      );
      try {
      // 1. Deterministic risk backfill over the model/request proposal.
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
        metadata: {
          proposalSource,
          modelProposalFailed,
          modelPolicyDraftProposed,
          modelPolicyDraftAdopted,
        },
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
        agentId,
        tenantId: ctx.tenantId,
        classification: recomputed.classification,
        traits: recomputed.traits,
        instanceRules: effectiveInstanceRules,
        taskPolicyKeys: normalizeTaskPolicyKeys(input.taskPolicyKeys),
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

      // 4. Persist under an authenticated generation WAL. The record carries
      //    its intended ACTIVE terminal image, but it is not externally
      //    returned until bundle, registry and activation audit all commit.
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
      const delta: AgentPolicyDelta = {
        agentId,
        inherits: stack
          .filter((layer) => layer.policyKey !== `agent:${agentId}:creation-delta`)
          .map((layer) => ({ policyKey: layer.policyKey, version: layer.version })),
        instanceRules: effectiveInstanceRules ?? {},
        taskPolicyKeys: normalizeTaskPolicyKeys(input.taskPolicyKeys),
      };
      const manifest = buildManifest({
        agentId,
        agentHash,
        policyHash: policy.policyHash,
        deltaHash: computePolicyDeltaHash(delta),
        compiledAt: policy.compiledAt,
        secret,
      });
      if (generationEpoch !== controlPlaneEpoch) {
        throw policyEpochChanged(generationEpoch, controlPlaneEpoch);
      }
      const generationPlan = await generationJournal.create({
        actor: ctx.userId,
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        registryAuthority: await resolveRegistryAuthority(),
        phase: "prepared",
        record,
        delta,
        policy,
        manifest,
      });
      let activationCommitted = false;
      try {
        const faultDetail = { operationId: generationPlan.operationId, agentId };
        await generationFaultInjector?.("after-generation-journal", faultDetail);
        await usage.reset(agentId);
        await generationFaultInjector?.("after-generation-usage", faultDetail);
        await advanceGenerationPhase(generationPlan, "usage-reset");
        await files.writeAgentBundle({ record, delta, policy, manifest });
        await generationFaultInjector?.("after-generation-bundle", faultDetail);
        await advanceGenerationPhase(generationPlan, "bundle-written");
        // Persist a non-runnable central record before the audit. ACTIVE is a
        // separate final commit after AGENT_ACTIVATED is durable, so no crash
        // window can leave an unaudited runnable Agent in the registry.
        await registry.upsert({ ...record, status: "VALIDATED" });
        await generationFaultInjector?.("after-generation-registry", faultDetail);
        await advanceGenerationPhase(generationPlan, "registry-validated");
        await emitGenerationActivated(generationPlan);
        await generationFaultInjector?.("after-generation-audit", faultDetail);
        await advanceGenerationPhase(generationPlan, "audited");
        await registry.upsert(record);
        activationCommitted = true;
        await generationFaultInjector?.("after-generation-active", faultDetail);
        await advanceGenerationPhase(generationPlan, "active");
        try {
          await generationJournal.clear(generationPlan.operationId);
        } catch {
          // The signed activation audit plus the exact ACTIVE registry/bundle
          // is the terminal commit. Retain the WAL for idempotent recovery
          // rather than failing or compensating an already-committed Agent.
          startupMaintenanceReady = false;
          startupMaintenancePromise = null;
        }
      } catch (error) {
        if (isAgentGenerationCrashSimulation(error)) {
          startupMaintenanceReady = false;
          startupMaintenancePromise = null;
          throw error;
        }
        if (activationCommitted) {
          // A post-audit journal write failure cannot undo the committed audit.
          // Leave the authenticated WAL for the next call/startup to verify and
          // clear, and return the already-committed Agent exactly once.
          startupMaintenanceReady = false;
          startupMaintenancePromise = null;
        } else {
          try {
            await persistGenerationFailed(
              generationPlan,
              `Agent generation failed before activation audit: ${errorMessage(error)}`,
            );
          } catch (recoveryError) {
            startupMaintenanceReady = false;
            startupMaintenancePromise = null;
            throw agentGenerationTransactionError(error, recoveryError, agentId);
          }
          throw agentGenerationTransactionError(error, null, agentId);
        }
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
      return (await loadVerifiedPolicyInternal(agentId, record))?.policy ?? null;
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
      await assertAgentActorTargetAllowed(ctx, agentId, "lifecycle");
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
      if (ctx.actorAgentId) {
        throw forbidden(
          "AGENT_ACTOR_APPROVAL_DECISION_DENIED",
          "Agent actors may not approve or reject governance approvals.",
        );
      }
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
      if (input.policyType === "instance") {
        await assertAgentActorTargetAllowed(ctx, input.scopeKey, "policy");
      }
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
      if (ctx.actorAgentId) {
        throw forbidden(
          "AGENT_ACTOR_POLICY_ACTIVATION_DENIED",
          "Agent actors may not activate governance policies.",
        );
      }
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
            targets.push({
              record,
              oldPolicy: verifiedOld.policy,
              oldManifest: verifiedOld.manifest,
              delta: verifiedOld.delta,
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

    async checkHealth() {
      let stateIntegrity: AgentGovernanceServiceHealth["stateIntegrity"] = "verified";
      let auditIntegrity: AgentGovernanceServiceHealth["auditIntegrity"] = "verified";
      try {
        await Promise.all([registry.listAll(), catalog.list()]);
      } catch {
        stateIntegrity = "failed";
      }
      try {
        // Startup reconciliation already performs the full central-to-Agent
        // mirror comparison once. Public readiness checks verify the signed
        // central chain only; they must not rescan every per-Agent audit file.
        await auditLog.read(1);
      } catch {
        auditIntegrity = "failed";
      }
      return {
        ready: stateIntegrity === "verified" && auditIntegrity === "verified",
        startupRecovery: "ready",
        stateIntegrity,
        auditIntegrity,
      };
    },

    async verifyAllAgentBundles() {
      const records = await registry.listAll();
      if (records.length > 10_000) {
        throw bundleVerificationError("Agent bundle verification exceeds its bounded Agent limit.");
      }
      for (const record of records) {
        let bundle;
        try {
          bundle = await files.loadBundle(record.agentId);
        } catch (cause) {
          throw bundleVerificationError("An Agent bundle could not be loaded safely.", cause);
        }
        const recordMatches = record.status === "ACTIVE"
          ? stableStringify(bundle.record) === stableStringify(record)
          : generationRecordIdentityMatches(bundle.record, record);
        if (!recordMatches) {
          throw bundleVerificationError("An Agent bundle record diverges from the central Registry.");
        }
        const integrity = verifyEffectivePolicyIntegrity(
          bundle.policy,
          bundle.manifest,
          secret,
          bundle.record,
          bundle.delta,
          { requireActive: false },
        );
        if (!integrity.ok) {
          throw bundleVerificationError(`An Agent bundle failed integrity verification (${integrity.reason}).`);
        }
      }
      return { verifiedAgentCount: records.length };
    },

    async stats() {
      const agents = await registry.listAll();
      const registryHealth = (registry as AgentRegistryStore & {
        getHealth?: () => Record<string, unknown>;
      }).getHealth?.();
      return {
        agents: agents.length,
        byStatus: agents.reduce<Record<string, number>>((acc, record) => {
          acc[record.status] = (acc[record.status] ?? 0) + 1;
          return acc;
        }, {}),
        policies: (await catalog.list()).length,
        storage: {
          configured: true,
          pathExposed: false,
          registry: registryHealth ? {
            storageMode: registryHealth.storageMode,
            durable: registryHealth.durable === true,
            transactional: registryHealth.transactional === true,
            distributed: registryHealth.distributed === true,
            distributedCapable: registryHealth.distributedCapable === true,
            distributedVerified: registryHealth.distributedVerified === true,
            singleHost: registryHealth.singleHost === true,
            available: registryHealth.available !== false,
            schemaVersion: registryHealth.schemaVersion,
          } : {
            storageMode: "single-process-json",
            durable: true,
            transactional: false,
            distributed: false,
            singleHost: true,
            available: true,
          },
        },
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
  if (ctx.actorAgentId !== undefined && ctx.actorAgentId !== null
    && (typeof ctx.actorAgentId !== "string"
      || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(ctx.actorAgentId))) {
    throw forbidden(
      "AGENT_ACTOR_IDENTITY_INVALID",
      "Governance context actorAgentId must be a valid server-issued Agent identity.",
    );
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

function normalizeTaskPolicyKeys(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 32
    || value.some((item) => typeof item !== "string" || !/^[a-z][a-z0-9._-]{0,63}$/u.test(item))) {
    throw Object.assign(new Error("taskPolicyKeys must contain at most 32 portable policy scope keys."), {
      name: "TaskPolicyBindingInvalid",
      code: "TASK_POLICY_BINDING_INVALID",
    });
  }
  const unique = [...new Set(value)];
  if (unique.length !== value.length) {
    throw Object.assign(new Error("taskPolicyKeys must not contain duplicates."), {
      name: "TaskPolicyBindingInvalid",
      code: "TASK_POLICY_BINDING_INVALID",
    });
  }
  return unique;
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

function isAgentGenerationCrashSimulation(error: unknown): boolean {
  return Boolean(error && typeof error === "object"
    && (error as { code?: unknown }).code === "AGENT_GENERATION_CRASH_SIMULATION");
}

function generationPhaseRank(phase: AgentGenerationRecoveryPlan["phase"]): number {
  return ["prepared", "usage-reset", "bundle-written", "registry-validated", "audited", "active"].indexOf(phase);
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

function agentGenerationRecoveryError(
  message: string,
  cause?: unknown,
  code = "AGENT_GENERATION_RECOVERY_REQUIRED",
): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "AgentGenerationRecoveryError", code },
  );
}

function normalizeRegistryAuthority(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_.:-]{1,256}$/u.test(normalized)) {
    throw agentGenerationRecoveryError(
      "Agent Registry authority binding is invalid.",
      undefined,
      "AGENT_REGISTRY_AUTHORITY_INVALID",
    );
  }
  return normalized;
}

function bundleVerificationError(message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    {
      name: "AgentBundleIntegrityError",
      code: "AGENT_GOVERNANCE_BUNDLE_INTEGRITY_FAILED",
      category: "integrity",
      statusCode: 503,
      retryable: false,
    },
  );
}

function agentGenerationTransactionError(
  cause: unknown,
  recoveryError: unknown,
  agentId: string,
): Error {
  const recovered = recoveryError === null;
  const error = new Error(
    recovered
      ? `Agent generation failed before activation and Agent ${agentId} was persisted fail-closed.`
      : `Agent generation failed and Agent ${agentId} requires startup recovery.`,
    cause === undefined ? undefined : { cause },
  ) as Error & {
    code: string;
    agentId: string;
    failClosed: boolean;
    recoveryError?: string;
  };
  error.name = "AgentGenerationTransactionFailed";
  error.code = recovered
    ? "AGENT_GENERATION_TRANSACTION_FAILED"
    : "AGENT_GENERATION_RECOVERY_REQUIRED";
  error.agentId = agentId;
  error.failClosed = recovered;
  if (recoveryError !== null) error.recoveryError = errorMessage(recoveryError);
  return error;
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
