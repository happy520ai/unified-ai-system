// Extracted verbatim from agentGovernanceService.ts so the trailing helper
// cluster (context guards, error factories, policy matching, and recovery
// helpers) lives beside the service factory. Pure mechanical move; behaviour
// unchanged.
import type { GovernanceContext, CreatePolicyVersionInput } from "./agentGovernanceService.types.ts";
import type { PolicyRecord, AgentRegistryRecord, EffectiveAgentPolicy } from "@unified-ai-system/shared-contracts";
import type { AgentGenerationRecoveryPlan } from "./agentGenerationJournal.ts";
import type { PolicyCatalogActivationState } from "./policyCatalogStore.ts";
import { isPolicyExpired } from "@unified-ai-system/policy-engine";

export function requireContext(ctx: GovernanceContext): void {
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

export function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.min(maximum, Math.floor(parsed));
}

export function configuredNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeTaskPolicyKeys(value: unknown): string[] {
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

export function notFound(message: string): Error {
  const error = new Error(message);
  error.name = "NotFound";
  return error;
}

export function forbidden(code: string, message: string): Error & { code: string; statusCode: number } {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.name = code;
  error.code = code;
  error.statusCode = 403;
  return error;
}

export function conflict(code: string, message: string): Error & { code: string; statusCode: number } {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.name = code;
  error.code = code;
  error.statusCode = 409;
  return error;
}

export function requirePlatformTenant(ctx: GovernanceContext, platformTenantId: string): void {
  if (ctx.tenantId !== platformTenantId) {
    throw forbidden(
      "PLATFORM_TENANT_REQUIRED",
      "Global Agent Governance policy changes require the configured platform tenant.",
    );
  }
}

export function assertCanonicalPolicyBinding(input: CreatePolicyVersionInput): void {
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

export function policyAppliesToAgent(
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

export function activeBindingMatches(
  active: PolicyRecord | null,
  binding: { version: number | null; contentHash: string | null },
): boolean {
  if (binding.version === null) return active === null && binding.contentHash === null;
  return active?.version === binding.version && active.contentHash === binding.contentHash;
}

export function isPolicyActivationCrashSimulation(error: unknown): boolean {
  return Boolean(error && typeof error === "object"
    && (error as { code?: unknown }).code === "POLICY_ACTIVATION_CRASH_SIMULATION");
}

export function isAgentGenerationCrashSimulation(error: unknown): boolean {
  return Boolean(error && typeof error === "object"
    && (error as { code?: unknown }).code === "AGENT_GENERATION_CRASH_SIMULATION");
}

export function generationPhaseRank(phase: AgentGenerationRecoveryPlan["phase"]): number {
  return ["prepared", "usage-reset", "bundle-written", "registry-validated", "audited", "active"].indexOf(phase);
}

export function activationStateEqual(
  left: PolicyCatalogActivationState,
  right: PolicyCatalogActivationState,
): boolean {
  return left.sequence === right.sequence
    && left.lastOperationId === right.lastOperationId
    && left.lastOutcome === right.lastOutcome;
}

export function policyActivationRecoveryError(message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "PolicyActivationRecoveryError", code: "POLICY_ACTIVATION_RECOVERY_REQUIRED" },
  );
}

export function builtInPolicyMigrationError(message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "BuiltInPolicyMigrationError", code: "BUILT_IN_POLICY_MIGRATION_REQUIRED" },
  );
}

export function agentGenerationRecoveryError(
  message: string,
  cause?: unknown,
  code = "AGENT_GENERATION_RECOVERY_REQUIRED",
): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "AgentGenerationRecoveryError", code },
  );
}

export function normalizeRegistryAuthority(value: unknown): string {
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

export function bundleVerificationError(message: string, cause?: unknown): Error {
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

export function agentGenerationTransactionError(
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

export function policyEpochChanged(expected: number, actual: number): Error {
  const error = new Error(
    `Agent generation observed policy epoch ${expected}, but control-plane epoch is now ${actual}.`,
  );
  error.name = "PolicyEpochChanged";
  return error;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export function policyActivationTransactionError(
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
