import type { ContractMetadata } from "./common.js";
import type { RiskLevel } from "./governance.js";

/**
 * Agent Governance contracts.
 *
 * These types define the governed agent control plane: classification,
 * versioned policy layers, deterministic compilation into an
 * EffectivePolicy, per-call tool enforcement, approvals, lifecycle and
 * cascade revocation.
 *
 * Core invariant (enforced by the policy engine, never by model output):
 *   child agent permissions ⊆ parent agent permissions
 *   ⊆ creator entitlements ⊆ class capability ceiling
 *   ⊆ root policy allowance.
 */

// ---------------------------------------------------------------------------
// Decision algebra
// ---------------------------------------------------------------------------

/**
 * Tool decision values, ordered by strictness:
 * allow (1) < require_approval (2) < deny (3).
 *
 * Conflicts always resolve to the stricter decision. Tools that are not
 * explicitly granted are denied by default.
 */
export type AgentToolDecision = "allow" | "require_approval" | "deny";

/** Numeric strictness used for max-merge; defined once in runtime.ts. */
export {
  AGENT_TOOL_DECISION_STRICTNESS,
  AGENT_GOVERNANCE_REDACTED_FIELDS,
} from "../runtime.js";

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Initial agent families. */
export type AgentFamily =
  | "analysis"
  | "execution"
  | "communication"
  | "monitoring"
  | "development"
  | "orchestration"
  | "governance";

/** Initial risk-bearing traits. */
export type AgentTrait =
  | "read_only"
  | "write_capable"
  | "external_communication"
  | "handles_sensitive_data"
  | "financial_operation"
  | "code_execution"
  | "subagent_creator"
  | "destructive_operation";

/** Multi-dimensional classification proposed for an agent. */
export interface AgentClassification {
  family: AgentFamily;
  domain: string;
  subclass: string;
}

// ---------------------------------------------------------------------------
// Tool registry descriptors
// ---------------------------------------------------------------------------

/** Tool action type. */
export type ToolActionType = "read" | "write";

/** How a tool's credentials are handled. Agents never see credentials. */
export type ToolCredentialMode = "server_side";

/**
 * Governance descriptor for a registered tool. Tool-declared risk labels
 * are authoritative: an agent's self-declared classification can never
 * lower them (the classifier backfills implied traits instead).
 */
export interface ToolGovernanceDescriptor {
  name: string;
  description?: string;
  actionType: ToolActionType;
  riskTraits: AgentTrait[];
  riskLevel: RiskLevel;
  defaultDecision: AgentToolDecision;
  credentialMode: ToolCredentialMode;
}

// ---------------------------------------------------------------------------
// Policy layers
// ---------------------------------------------------------------------------

/** Policy layer types, most-global to most-specific. */
export type PolicyType =
  | "emergency"
  | "root"
  | "tenant"
  | "family"
  | "domain"
  | "subclass"
  | "trait"
  | "instance"
  | "task";

/** Numeric limits that merge by taking the minimum. */
export interface PolicyLimits {
  maxGenerationDepth?: number;
  maxChildrenPerAgent?: number;
  maxRuntimeSeconds?: number;
  maxSteps?: number;
  maxToolCalls?: number;
  maxRecords?: number;
}

/**
 * Safety booleans merge with OR: if any layer in the stack requires the
 * safeguard, the effective policy requires it.
 */
export interface PolicySafetyRequirements {
  auditRequired?: boolean;
  outputRedactionRequired?: boolean;
  approvalRequired?: boolean;
  sandboxRequired?: boolean;
  detailedLoggingRequired?: boolean;
}

/**
 * Permission booleans merge with AND: every layer that expresses a value
 * must allow it; the default is closed (false).
 */
export interface PolicyPermissions {
  canCreateChildren?: boolean;
  canWrite?: boolean;
  canSendExternalMessage?: boolean;
  canExecuteCode?: boolean;
}

/** Inclusive resource range scope (for example order_date from/to). */
export interface PolicyResourceRange {
  from?: string;
  to?: string;
}

/** Resource scope constraints. Unset dimensions are unconstrained. */
export interface PolicyResourceScope {
  allowedTenants?: string[];
  allowedResourceSets?: Record<string, string[]>;
  resourceRanges?: Record<string, PolicyResourceRange>;
  deniedResources?: string[];
  deniedOutputFields?: string[];
}

/** Mandatory root/emergency assertions. `deny` values are absolute. */
export interface PolicyMandatoryRules {
  auditRequired?: boolean;
  credentialsExposedToAgent?: boolean;
  crossTenantAccess?: "allow" | "deny";
  selfPolicyModification?: "allow" | "deny";
  gatewayBypass?: "allow" | "deny";
  permissionExpansion?: "allow" | "deny";
}

/** Structured content of one policy layer version. */
export interface PolicyLayerContent {
  mandatory?: PolicyMandatoryRules;
  limits?: PolicyLimits;
  capabilityCeiling?: string[];
  toolRules?: Record<string, AgentToolDecision>;
  dataRules?: PolicyResourceScope;
  requirements?: PolicySafetyRequirements;
  permissions?: PolicyPermissions;
}

/** Lifecycle status of a policy layer version. */
export type PolicyStatus = "draft" | "active" | "superseded";

/**
 * One immutable policy layer version. A (policyKey, version) pair can be
 * created once and never overwritten; activation supersedes the previous
 * active version of the same key.
 */
export interface PolicyRecord {
  policyKey: string;
  version: number;
  policyType: PolicyType;
  scopeKey: string;
  content: PolicyLayerContent;
  contentHash: string;
  status: PolicyStatus;
  createdAt: string;
  activatedAt?: string;
  supersededAt?: string;
}

/** Reference to one policy layer version used during compilation. */
export interface PolicyBinding {
  policyKey: string;
  version: number;
  bindingType: PolicyType;
}

// ---------------------------------------------------------------------------
// Drafts (model output never goes further than a draft)
// ---------------------------------------------------------------------------

/** Draft produced by the Agent Factory before deterministic validation. */
export interface AgentDraft {
  name: string;
  task: string;
  requestedTools: string[];
  ttlSeconds: number;
  parentAgentId: string | null;
  classification: AgentClassification;
  proposedTraits: AgentTrait[];
  proposedRiskLevel: RiskLevel;
}

// ---------------------------------------------------------------------------
// Effective policy
// ---------------------------------------------------------------------------

/**
 * Deterministically compiled permission snapshot. Produced only by the
 * policy engine from the ordered layer stack; hash and signature protect
 * integrity at runtime.
 */
export interface EffectiveAgentPolicy {
  agentId: string;
  classification: AgentClassification;
  traits: AgentTrait[];
  riskLevel: RiskLevel;
  toolDecisions: Record<string, AgentToolDecision>;
  grantedTools: string[];
  limits: PolicyLimits;
  requirements: PolicySafetyRequirements;
  permissions: PolicyPermissions;
  scope: PolicyResourceScope;
  expiresAt: string;
  lineage: PolicyBinding[];
  policyHash: string;
  compiledAt: string;
}

/**
 * Tamper-evidence manifest stored beside each agent's effective policy.
 * signature = HMAC-SHA256 over `${agentHash}:${policyHash}`.
 */
export interface AgentPolicyManifest {
  agentId: string;
  agentHash: string;
  policyHash: string;
  signature: string;
  compiledAt: string;
}

// ---------------------------------------------------------------------------
// Registry and lifecycle
// ---------------------------------------------------------------------------

/** Agent lifecycle states. */
export type AgentStatus =
  | "DRAFT"
  | "VALIDATED"
  | "ACTIVE"
  | "COMPLETED"
  | "EXPIRED"
  | "REVOKED"
  | "FAILED"
  | "ARCHIVED";

/** Central registry record for one governed agent. */
export interface AgentRegistryRecord {
  agentId: string;
  name: string;
  purpose: string;
  tenantId: string;
  ownerUserId: string;
  createdBy: string;
  parentAgentId: string | null;
  generationDepth: number;
  classification: AgentClassification;
  traits: AgentTrait[];
  riskLevel: RiskLevel;
  requestedTools: string[];
  grantedTools: string[];
  policyHash: string;
  status: AgentStatus;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

/** Per-agent usage counters enforced on every tool call. */
export interface AgentUsageCounters {
  toolCalls: number;
  steps: number;
  records: number;
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

/** Approval lifecycle states. */
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

/**
 * Approval request for a require_approval decision. The arguments hash
 * locks the exact arguments: after approval only those arguments may
 * execute; any change requires a new approval.
 */
export interface AgentToolApprovalRecord {
  id: string;
  agentId: string;
  toolName: string;
  argumentsHash: string;
  status: ApprovalStatus;
  requestedAt: string;
  expiresAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

/** Agent governance audit event types. */
export type AgentGovernanceEventType =
  | "AGENT_DRAFT_CREATED"
  | "AGENT_CLASSIFIED"
  | "POLICY_VALIDATED"
  | "POLICY_REJECTED"
  | "AGENT_ACTIVATED"
  | "AGENT_RUN_STARTED"
  | "TOOL_REQUESTED"
  | "TOOL_ALLOWED"
  | "TOOL_DENIED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_REJECTED"
  | "AGENT_EXPIRED"
  | "AGENT_REVOKED"
  | "POLICY_RECOMPILED"
  | "POLICY_SIGNATURE_FAILED";

/** One append-only audit event (redacted arguments only). */
export interface AgentGovernanceAuditEvent {
  eventType: AgentGovernanceEventType;
  requestId?: string;
  agentId?: string;
  parentAgentId?: string | null;
  tenantId?: string;
  toolName?: string;
  decision?: AgentToolDecision;
  reason?: string;
  policyHash?: string;
  previousPolicyHash?: string;
  timestamp: string;
  metadata?: ContractMetadata;
}
