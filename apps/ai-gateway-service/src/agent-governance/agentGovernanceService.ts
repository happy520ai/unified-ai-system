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

import { randomUUID } from "node:crypto";
import type {
  AgentClassification,
  AgentGovernanceAuditEvent,
  AgentPolicyManifest,
  AgentRegistryRecord,
  AgentToolApprovalRecord,
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
  isPolicyExpired,
  recompileWithoutExpansion,
  recomputeClassification,
  validateAgentDraft,
  verifyEffectivePolicyIntegrity,
} from "@unified-ai-system/policy-engine";
import type {
  AgentFileStore,
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
} from "./policyCatalogStore.ts";
import { createPolicyCatalogStore } from "./policyCatalogStore.ts";
import type {
  ToolRiskCatalog,
} from "./toolRiskCatalog.ts";
import { createToolRiskCatalog } from "./toolRiskCatalog.ts";
import type {
  UsageStore,
} from "./usageStore.ts";
import { createUsageStore } from "./usageStore.ts";
import { resolveGovernanceSecret } from "./governanceSecret.ts";

export interface GovernanceContext {
  tenantId: string;
  userId: string;
  role?: string;
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
  findApprovedArguments(agentId: string, toolName: string, args: unknown): Promise<{ approvalId: string; args: unknown } | null>;
  createApproval(agentId: string, toolName: string, args: unknown, tenantId: string, reason?: string): Promise<AgentToolApprovalRecord>;
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
}

export function createAgentGovernanceService(options: AgentGovernanceServiceOptions = {}): AgentGovernanceService {
  const env = options.env ?? process.env;
  const dataDir = options.dataDir ?? ".data/agent-governance";
  const now = options.now ?? (() => new Date().toISOString());
  const secret = resolveGovernanceSecret({ env, dataDir });
  const catalog: PolicyCatalogStore = createPolicyCatalogStore({ storePath: `${dataDir}/policies.json`, now });
  const registry: AgentRegistryStore = createAgentRegistryStore({ storePath: `${dataDir}/agents.json`, now });
  const files: AgentFileStore = createAgentFileStore({ dataDir });
  const approvals: AgentApprovalStore = createAgentApprovalStore({ storePath: `${dataDir}/approvals.json`, secret, now });
  const auditLog: GovernanceAuditLog = createGovernanceAuditLog({ logPath: `${dataDir}/audit-events.jsonl` });
  const usage: UsageStore = createUsageStore({ dataDir, now });
  const toolCatalog: ToolRiskCatalog = options.toolRiskCatalog ?? createToolRiskCatalog();
  const modelProposer = options.modelProposer ?? null;

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
    classification: AgentClassification;
    traits: string[];
    instanceRules?: PolicyLayerContent;
  }): Promise<PolicyRecord[]> {
    const stack: PolicyRecord[] = [];
    const push = async (policyKey: string) => {
      const record = await catalog.getActive(policyKey);
      if (record) stack.push(record);
    };
    await push("root-policy");
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
        contentHash: "inline",
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
    const effective = await files.loadPolicy(parentAgentId);
    if (!effective) return null;
    return { record, effective };
  }

  return {
    async generateAgent(input, ctx) {
      requireContext(ctx);
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
      const rootPolicy = await catalog.getActive("root-policy");
      const familyPolicy = await catalog.getActive(`${recomputed.classification.family}-family`);
      const validation = validateAgentDraft({
        draft,
        toolDescriptors: descriptorMap(),
        parent: parent ? {
          record: parent.record,
          effective: parent.effective,
          currentChildrenCount: await registry.countChildren(parent.record.agentId),
        } : null,
        familyPermissions: familyPolicy?.content.permissions ?? null,
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
      await usage.reset(agentId);
      await audit({
        eventType: "AGENT_ACTIVATED",
        agentId,
        tenantId: ctx.tenantId,
        requestId: ctx.requestId,
        policyHash: policy.policyHash,
      });

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
      const record = await registry.get(agentId, ctx.tenantId);
      if (!record) throw notFound(`Agent ${agentId} not found for tenant.`);
      const revoked: string[] = [];
      const targets: AgentRegistryRecord[] = [record];
      if (input.cascade !== false) {
        const queue = [record.agentId];
        while (queue.length > 0) {
          const current = queue.shift() as string;
          for (const child of await registry.listByParent(current)) {
            if (child.status !== "REVOKED" && child.status !== "ARCHIVED") {
              targets.push(child);
              queue.push(child.agentId);
            }
          }
        }
      }
      for (const target of targets) {
        if (target.status === "REVOKED") continue;
        await registry.upsert({ ...target, status: "REVOKED", revokedAt: now() });
        revoked.push(target.agentId);
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
      return { revoked };
    },

    async decideApproval(approvalId, decision, ctx) {
      requireContext(ctx);
      const approval = await approvals.get(approvalId);
      if (!approval) throw notFound("Approval not found.");
      const record = await registry.getUnscoped(approval.agentId);
      if (!record || record.tenantId !== ctx.tenantId) {
        throw notFound("Approval not found.");
      }
      const decided = await approvals.decide(approvalId, decision, ctx.userId);
      await audit({
        eventType: decision === "approve" ? "APPROVAL_APPROVED" : "APPROVAL_REJECTED",
        agentId: approval.agentId,
        tenantId: ctx.tenantId,
        toolName: approval.toolName,
        requestId: ctx.requestId,
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
      const record = await catalog.create(input, ctx.userId);
      await audit({
        eventType: "POLICY_VALIDATED",
        tenantId: ctx.tenantId,
        requestId: ctx.requestId,
        policyHash: record.contentHash,
        reason: `created ${record.policyKey}@${record.version}`,
      });
      return record;
    },

    async activatePolicyVersion(policyKey, version, ctx) {
      requireContext(ctx);
      const activated = await catalog.activate(policyKey, version, ctx.userId);
      const affected: ActivatePolicyResult["affected"] = [];
      for (const record of await registry.listAll()) {
        const oldPolicy = await files.loadPolicy(record.agentId);
        if (!oldPolicy) continue;
        if (!oldPolicy.lineage.some((binding) => binding.policyKey === policyKey)) continue;
        const delta = await files.loadDelta(record.agentId);
        const parentEffective = record.parentAgentId
          ? (await files.loadPolicy(record.parentAgentId)) ?? null
          : null;
        const stack = await assembleLayerStack({
          classification: record.classification,
          traits: record.traits,
          instanceRules: delta?.instanceRules,
        });
        const nextRaw = compileEffectivePolicy({
          agentId: record.agentId,
          classification: record.classification,
          traits: record.traits,
          riskLevel: record.riskLevel,
          requestedTools: record.requestedTools,
          // Recompiles never extend lifetime: use the old expiry.
          ttlSeconds: Math.max(1, Math.floor((new Date(oldPolicy.expiresAt).getTime() - new Date(now()).getTime()) / 1000)),
          layerStack: stack,
          toolDescriptors: descriptorMap(),
          parentEffective,
          now: now(),
        });
        const { policy, clamped } = recompileWithoutExpansion(nextRaw, oldPolicy);
        const nextRecord: AgentRegistryRecord = {
          ...record,
          grantedTools: policy.grantedTools,
          policyHash: policy.policyHash,
        };
        const manifest = buildManifest({
          agentId: record.agentId,
          agentHash: computeAgentHash(nextRecord),
          policyHash: policy.policyHash,
          compiledAt: policy.compiledAt,
          secret,
        });
        await files.writeAgentBundle({
          record: nextRecord,
          delta: delta ?? { agentId: record.agentId, inherits: [], instanceRules: {} },
          policy,
          manifest,
        });
        await registry.upsert(nextRecord);
        await audit({
          eventType: "POLICY_RECOMPILED",
          agentId: record.agentId,
          tenantId: record.tenantId,
          policyHash: policy.policyHash,
          previousPolicyHash: oldPolicy.policyHash,
          requestId: ctx.requestId,
          reason: `${policyKey}@${version} activated${clamped.length > 0 ? `; ${clamped.length} expansion clamped` : ""}`,
        });
        affected.push({
          agentId: record.agentId,
          previousPolicyHash: oldPolicy.policyHash,
          policyHash: policy.policyHash,
          clamped: clamped.length,
        });
      }
      return { policy: activated, affected };
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
      return files.readAudit(agentId, limit);
    },

    async emitAudit(event) {
      await audit(event);
    },

    async loadVerifiedPolicy(agentId) {
      const policy = await files.loadPolicy(agentId);
      const manifest = await files.loadManifest(agentId);
      if (!policy || !manifest) return null;
      const integrity = verifyEffectivePolicyIntegrity(policy, manifest, secret);
      if (!integrity.ok) {
        await audit({
          eventType: "POLICY_SIGNATURE_FAILED",
          agentId,
          reason: integrity.reason,
          policyHash: policy.policyHash,
        });
        return null;
      }
      return { policy, manifest };
    },

    async getUsage(agentId) {
      return usage.get(agentId);
    },

    async incrementUsage(agentId, field) {
      await usage.increment(agentId, field);
    },

    async findApprovedArguments(agentId, toolName, args) {
      const { computeArgumentsHash } = await import("@unified-ai-system/policy-engine");
      const matched = await approvals.matchApproved(agentId, toolName, computeArgumentsHash(args));
      if (!matched) return null;
      return { approvalId: matched.id, args: matched.args };
    },

    async createApproval(agentId, toolName, args, tenantId, reason) {
      const approval = await approvals.create({ agentId, toolName, arguments: args, tenantId, reason });
      await audit({
        eventType: "APPROVAL_REQUESTED",
        agentId,
        tenantId,
        toolName,
        reason,
      });
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
        dataDir,
      };
    },
  };

  async function expireAgentsInternal(): Promise<number> {
    let count = 0;
    const nowIso = now();
    for (const record of await registry.listAll()) {
      if (record.status === "ACTIVE" && record.expiresAt && record.expiresAt <= nowIso) {
        await registry.upsert({ ...record, status: "EXPIRED" });
        await audit({
          eventType: "AGENT_EXPIRED",
          agentId: record.agentId,
          tenantId: record.tenantId,
          policyHash: record.policyHash,
        });
        count += 1;
      }
    }
    await approvals.expireStale(nowIso);
    return count;
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

function notFound(message: string): Error {
  const error = new Error(message);
  error.name = "NotFound";
  return error;
}

export function agentPolicyIsExpired(policy: EffectiveAgentPolicy, nowIso: string): boolean {
  return isPolicyExpired(policy, nowIso);
}
