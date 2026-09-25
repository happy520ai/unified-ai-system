// T-094 leaf: type-only declarations extracted from agentGovernanceService.ts
// (mechanical move certified by .pm/t094-leaf-closures.json; no runtime declarations dragged).
import type {
  AgentClassification,
  AgentGovernanceAuditEvent,
  AgentPolicyManifest,
  AgentRegistryRecord,
  AgentToolApprovalRecord,
  AgentToolApprovalReview,
  EffectiveAgentPolicy,
  PolicyLayerContent,
  PolicyRecord,
  RiskLevel,
} from "@unified-ai-system/shared-contracts";
import type { GatewayExecutionContext } from "../http/httpRequestExecution.ts";

export interface GovernanceContext {
  tenantId: string;
  userId: string;
  role?: string;
  permissions?: string[];
  requestId?: string;
  /** Server-owned request lifetime; never loaded from a request body or journal. */
  execution?: GatewayExecutionContext;
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
  /** Reads the original consumed approval; it never consumes it again or grants a new execution lease. */
  verifyConsumedArguments(input: { approvalId: string; agentId: string; tenantId: string; toolName: string;
    args: unknown; policyHash: string; executionId: string }): Promise<{ args: unknown; review: AgentToolApprovalReview } | null>;
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
    execution?: GatewayExecutionContext;
  }): Promise<{
    classification: AgentClassification;
    proposedTraits: string[];
    proposedRiskLevel: RiskLevel;
    policyDraft?: PolicyLayerContent;
  } | null>;
}
