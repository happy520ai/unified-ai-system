/**
 * Policy Compiler — deterministic compilation of the ordered layer stack
 * into one EffectiveAgentPolicy.
 *
 * The compiler is the only producer of effective permissions. It never
 * reads model output directly (the validator gates drafts first) and its
 * output is content-hashed so runtime enforcement can detect tampering.
 *
 * Merge laws (fixed, non-negotiable):
 *   decision  = strictest across all layers (allow < require_approval < deny)
 *   capability = requested ∩ user ∩ tenant ∩ parent ∩ every layer ceiling
 *   limits    = minimum across layers
 *   expiry    = earliest across sources
 *   allowed   = intersection; denied = union
 *   safety OR / permissions AND
 */

import type {
  AgentClassification,
  AgentCreatorEntitlements,
  AgentTrait,
  EffectiveAgentPolicy,
  EffectivePolicyMandatoryRules,
  PolicyBinding,
  PolicyLayerContent,
  PolicyLimits,
  PolicyMandatoryRules,
  PolicyPermissions,
  PolicyRecord,
  PolicySafetyRequirements,
  RiskLevel,
  ToolGovernanceDescriptor,
} from "@unified-ai-system/shared-contracts";
import {
  DEFAULT_TOOL_DECISION,
  decisionStrictness,
  isAgentToolDecision,
  isSafeToolName,
  mergeDecisions,
} from "./decisionAlgebra.ts";
import { computePolicyContentHash, computePolicyHash, stableStringify } from "./integrity.ts";
import { isAgentTrait, isValidClassification } from "./classification.ts";
import {
  earliestExpiry,
  intersectCapabilities,
  mergeLimits,
  mergeMandatoryRules,
  mergePermissions,
  mergeResourceScopes,
  mergeSafetyRequirements,
} from "./merge.ts";

export interface CompileEffectivePolicyInput {
  agentId: string;
  classification: AgentClassification;
  traits: AgentTrait[];
  riskLevel: RiskLevel;
  requestedTools: string[];
  ttlSeconds: number;
  /** Active policy layers, most-global to most-specific (order is lineage only). */
  layerStack: PolicyRecord[];
  toolDescriptors:
    | Map<string, ToolGovernanceDescriptor>
    | Record<string, ToolGovernanceDescriptor>;
  parentEffective?: EffectiveAgentPolicy | null;
  /** Trusted, server-derived creator ceiling. Null or runtime omission grants nothing. */
  creatorEntitlements: AgentCreatorEntitlements | null;
  /** ISO timestamp — injected so tests stay deterministic. */
  now: string;
}

export interface PolicyLayerValidationError {
  code: string;
  message: string;
  policyKey?: string;
}

export interface PolicyLayerValidationResult {
  valid: boolean;
  errors: PolicyLayerValidationError[];
}

export class PolicyCompilationError extends Error {
  readonly errors: PolicyLayerValidationError[];

  constructor(errors: PolicyLayerValidationError[]) {
    super(errors.map((error) => `${error.code}: ${error.message}`).join(" | "));
    this.name = "PolicyCompilationError";
    this.errors = errors;
  }
}

const POLICY_TYPES = new Set([
  "emergency", "root", "tenant", "family", "domain", "subclass", "trait", "instance", "task",
]);
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30;
const LIMIT_KEYS = [
  "maxGenerationDepth",
  "maxChildrenPerAgent",
  "maxWorkforceRoles",
  "maxRuntimeSeconds",
  "maxSteps",
  "maxToolCalls",
  "maxRecords",
] as const;
const REQUIREMENT_KEYS = [
  "auditRequired",
  "outputRedactionRequired",
  "approvalRequired",
  "sandboxRequired",
  "detailedLoggingRequired",
] as const;
const PERMISSION_KEYS = [
  "canCreateChildren",
  "canWrite",
  "canSendExternalMessage",
  "canExecuteCode",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "string" && item.trim() === item && item.length > 0);
}

function validatePolicyContent(content: unknown, policyKey: string): PolicyLayerValidationError[] {
  const errors: PolicyLayerValidationError[] = [];
  const add = (code: string, message: string) => errors.push({ code, message, policyKey });
  if (!isRecord(content)) {
    add("POLICY_CONTENT_INVALID", "Policy content must be an object.");
    return errors;
  }
  if (content.mandatory !== undefined) {
    if (!isRecord(content.mandatory)) {
      add("POLICY_MANDATORY_INVALID", "mandatory must be an object.");
    } else {
      const mandatory = content.mandatory;
      for (const key of ["auditRequired", "credentialsExposedToAgent"] as const) {
        if (mandatory[key] !== undefined && typeof mandatory[key] !== "boolean") {
          add("POLICY_MANDATORY_INVALID", `mandatory.${key} must be boolean.`);
        }
      }
      if (mandatory.credentialsExposedToAgent === true) {
        add("POLICY_MANDATORY_UNSAFE", "Agent credentials must remain server-side and cannot be exposed by policy.");
      }
      for (const key of ["crossTenantAccess", "selfPolicyModification", "gatewayBypass", "permissionExpansion"] as const) {
        if (mandatory[key] !== undefined && mandatory[key] !== "allow" && mandatory[key] !== "deny") {
          add("POLICY_MANDATORY_INVALID", `mandatory.${key} must be allow or deny.`);
        }
      }
    }
  }
  if (content.limits !== undefined) {
    if (!isRecord(content.limits)) {
      add("POLICY_LIMITS_INVALID", "limits must be an object.");
    } else {
      for (const key of LIMIT_KEYS) {
        const value = content.limits[key];
        if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) {
          add("POLICY_LIMITS_INVALID", `limits.${key} must be a non-negative safe integer.`);
        }
      }
    }
  }
  if (content.capabilityCeiling !== undefined
    && (!isStringArray(content.capabilityCeiling) || content.capabilityCeiling.some((tool) => !isSafeToolName(tool)))) {
    add("POLICY_CAPABILITY_INVALID", "capabilityCeiling must contain safe, non-empty tool names.");
  }
  if (content.toolRules !== undefined) {
    if (!isRecord(content.toolRules)) {
      add("POLICY_TOOL_RULES_INVALID", "toolRules must be an object.");
    } else {
      for (const [tool, decision] of Object.entries(content.toolRules)) {
        if (!isSafeToolName(tool) || !isAgentToolDecision(decision)) {
          add("POLICY_TOOL_RULES_INVALID", `Invalid tool rule for ${JSON.stringify(tool)}.`);
        }
      }
    }
  }
  for (const [field, keys] of [
    ["requirements", REQUIREMENT_KEYS],
    ["permissions", PERMISSION_KEYS],
  ] as const) {
    const value = content[field];
    if (value !== undefined && !isRecord(value)) {
      add("POLICY_BOOLEAN_RULES_INVALID", `${field} must be an object.`);
    } else if (isRecord(value)) {
      for (const key of keys) {
        if (value[key] !== undefined && typeof value[key] !== "boolean") {
          add("POLICY_BOOLEAN_RULES_INVALID", `${field}.${key} must be boolean.`);
        }
      }
    }
  }
  if (isRecord(content.requirements) && content.requirements.sandboxRequired === true) {
    add(
      "POLICY_SANDBOX_ATTESTATION_UNAVAILABLE",
      "sandboxRequired cannot be activated until a runtime lane supplies a non-forgeable, effect-bound isolation attestation.",
    );
  }
  if (content.dataRules !== undefined && !isRecord(content.dataRules)) {
    add("POLICY_SCOPE_INVALID", "dataRules must be an object.");
  } else if (isRecord(content.dataRules)) {
    const scope = content.dataRules;
    for (const field of ["allowedTenants", "deniedResources", "deniedOutputFields"] as const) {
      if (scope[field] !== undefined && !isStringArray(scope[field])) {
        add("POLICY_SCOPE_INVALID", `dataRules.${field} must be an array of non-empty strings.`);
      }
    }
    if (scope.allowedResourceSets !== undefined) {
      if (!isRecord(scope.allowedResourceSets)) {
        add("POLICY_SCOPE_INVALID", "dataRules.allowedResourceSets must be an object.");
      } else {
        for (const [key, values] of Object.entries(scope.allowedResourceSets)) {
          if (!isSafeToolName(key) || !isStringArray(values)) {
            add("POLICY_SCOPE_INVALID", `Invalid allowed resource set ${JSON.stringify(key)}.`);
          }
        }
      }
    }
    if (scope.resourceRanges !== undefined) {
      if (!isRecord(scope.resourceRanges)) {
        add("POLICY_SCOPE_INVALID", "dataRules.resourceRanges must be an object.");
      } else {
        for (const [key, range] of Object.entries(scope.resourceRanges)) {
          if (!isSafeToolName(key) || !isRecord(range)
            || (range.from !== undefined && typeof range.from !== "string")
            || (range.to !== undefined && typeof range.to !== "string")) {
            add("POLICY_SCOPE_INVALID", `Invalid resource range ${JSON.stringify(key)}.`);
          }
        }
      }
    }
  }
  return errors;
}

export function validatePolicyLayerContent(
  content: unknown,
  policyKey = "policy",
): PolicyLayerValidationResult {
  const errors = validatePolicyContent(content, policyKey);
  return { valid: errors.length === 0, errors };
}

/** Strict pre-compilation validation for immutable active policy versions. */
export function validatePolicyLayerStack(layerStack: unknown): PolicyLayerValidationResult {
  if (!Array.isArray(layerStack)) {
    return { valid: false, errors: [{ code: "POLICY_STACK_INVALID", message: "Policy layer stack must be an array." }] };
  }
  const errors: PolicyLayerValidationError[] = [];
  const rootCount = layerStack.filter(
    (layer) => isRecord(layer) && layer.policyType === "root",
  ).length;
  if (rootCount !== 1) {
    errors.push({
      code: "POLICY_ROOT_REQUIRED",
      message: `Exactly one active root policy is required; received ${rootCount}.`,
    });
  }
  for (const rawLayer of layerStack) {
    if (!isRecord(rawLayer)) {
      errors.push({ code: "POLICY_RECORD_INVALID", message: "Policy layer must be an object." });
      continue;
    }
    const policyKey = typeof rawLayer.policyKey === "string" ? rawLayer.policyKey : "<unknown>";
    if (policyKey === "<unknown>" || policyKey.trim() === "") {
      errors.push({ code: "POLICY_RECORD_INVALID", message: "policyKey must be a non-empty string.", policyKey });
    }
    if (!Number.isSafeInteger(rawLayer.version) || (rawLayer.version as number) <= 0) {
      errors.push({ code: "POLICY_RECORD_INVALID", message: "version must be a positive safe integer.", policyKey });
    }
    if (!POLICY_TYPES.has(String(rawLayer.policyType))) {
      errors.push({ code: "POLICY_RECORD_INVALID", message: "policyType is invalid.", policyKey });
    }
    if (typeof rawLayer.scopeKey !== "string" || rawLayer.scopeKey.trim() === "") {
      errors.push({ code: "POLICY_RECORD_INVALID", message: "scopeKey must be a non-empty string.", policyKey });
    }
    if (rawLayer.status !== "active") {
      errors.push({ code: "POLICY_NOT_ACTIVE", message: "Only active policy versions may be compiled.", policyKey });
    }
    const contentErrors = validatePolicyContent(rawLayer.content, policyKey);
    errors.push(...contentErrors);
    if (contentErrors.length === 0) {
      try {
        const expectedHash = computePolicyContentHash(rawLayer.content as PolicyLayerContent);
        if (rawLayer.contentHash !== expectedHash) {
          errors.push({ code: "POLICY_CONTENT_HASH_MISMATCH", message: "Policy content hash does not match its immutable content.", policyKey });
        }
      } catch {
        errors.push({ code: "POLICY_CONTENT_INVALID", message: "Policy content cannot be canonically hashed.", policyKey });
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

function toDescriptorLookup(
  descriptors: CompileEffectivePolicyInput["toolDescriptors"],
): Map<string, ToolGovernanceDescriptor> {
  const entries = descriptors instanceof Map
    ? Array.from(descriptors.entries())
    : isRecord(descriptors) ? Object.entries(descriptors) : [];
  return new Map(entries.filter(([name, descriptor]) => (
    isSafeToolName(name)
      && isRecord(descriptor)
      && descriptor.name === name
      && (descriptor.actionType === "read" || descriptor.actionType === "write")
      && Array.isArray(descriptor.riskTraits)
      && descriptor.riskTraits.every((trait) => isAgentTrait(trait))
      && RISK_LEVELS.has(String(descriptor.riskLevel))
      && isAgentToolDecision(descriptor.defaultDecision)
      && descriptor.credentialMode === "server_side"
  )) as Array<[string, ToolGovernanceDescriptor]>);
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

export function compileEffectivePolicy(input: CompileEffectivePolicyInput): EffectiveAgentPolicy {
  if (!input || typeof input !== "object"
    || typeof input.agentId !== "string" || input.agentId.trim() === ""
    || !isValidClassification(input.classification)
    || !Array.isArray(input.traits) || input.traits.some((trait) => !isAgentTrait(trait))
    || !RISK_LEVELS.has(input.riskLevel)) {
    throw new PolicyCompilationError([{ code: "COMPILATION_INPUT_INVALID", message: "Agent identity and classification input is invalid." }]);
  }
  if (input.parentEffective !== undefined && input.parentEffective !== null
    && (!isRecord(input.parentEffective)
      || typeof input.parentEffective.agentId !== "string"
      || !Array.isArray(input.parentEffective.grantedTools)
      || input.parentEffective.grantedTools.some((tool) => !isSafeToolName(tool))
      || !isRecord(input.parentEffective.toolDecisions)
      || !isRecord(input.parentEffective.permissions)
      || !isRecord(input.parentEffective.limits)
      || !isRecord(input.parentEffective.scope)
      || !Number.isFinite(Date.parse(input.parentEffective.expiresAt)))) {
    throw new PolicyCompilationError([{ code: "PARENT_POLICY_INVALID", message: "Parent effective policy is malformed or expired-boundary data is missing." }]);
  }
  const layerValidation = validatePolicyLayerStack(input.layerStack);
  if (!layerValidation.valid) throw new PolicyCompilationError(layerValidation.errors);
  if (!Array.isArray(input.requestedTools) || input.requestedTools.some((tool) => !isSafeToolName(tool))) {
    throw new PolicyCompilationError([{ code: "REQUESTED_TOOLS_INVALID", message: "requestedTools must contain safe tool names." }]);
  }
  if (!Number.isSafeInteger(input.ttlSeconds) || input.ttlSeconds <= 0 || input.ttlSeconds > MAX_TTL_SECONDS
    || typeof input.now !== "string" || !Number.isFinite(Date.parse(input.now))) {
    throw new PolicyCompilationError([{ code: "COMPILATION_INPUT_INVALID", message: "ttlSeconds and now must be valid." }]);
  }
  const normalizedNow = new Date(input.now).toISOString();
  const lookup = toDescriptorLookup(input.toolDescriptors);
  const contents = input.layerStack.map((layer) => layer.content);
  const creatorAllowed = input.creatorEntitlements
    && isStringArray(input.creatorEntitlements.allowedTools)
    && input.creatorEntitlements.allowedTools.every(isSafeToolName)
    ? input.creatorEntitlements.allowedTools
    : [];
  const permissions: PolicyPermissions = mergePermissions([
    input.creatorEntitlements?.permissions ?? {
      canCreateChildren: false,
      canWrite: false,
      canSendExternalMessage: false,
      canExecuteCode: false,
    },
    ...contents.map((content) => content?.permissions ?? null),
    input.parentEffective?.permissions ?? null,
  ]);

  // Capability: requested tools reduced by every expressed ceiling,
  // including the parent agent's granted set and creator entitlements.
  const capability = intersectCapabilities(
    input.requestedTools,
    [
      creatorAllowed,
      ...contents.map((content) => content?.capabilityCeiling ?? null),
      input.parentEffective?.grantedTools ?? null,
    ],
  );

  // Decisions: strictest wins across every layer rule, the parent's
  // compiled decision, and the tool registry's default decision.
  const toolDecisions = Object.create(null) as Record<string, AgentToolDecisionOf>;
  for (const tool of capability) {
    const descriptor = lookup.get(tool);
    const candidates: AgentToolDecisionOf[] = [];
    if (descriptor?.defaultDecision && isAgentToolDecision(descriptor.defaultDecision)) {
      candidates.push(descriptor.defaultDecision);
    }
    if (!descriptor
      || (descriptor.actionType === "write" && permissions.canWrite !== true)
      || (descriptor.riskTraits.includes("external_communication")
        && permissions.canSendExternalMessage !== true)
      || (descriptor.riskTraits.includes("code_execution")
        && permissions.canExecuteCode !== true)
      || (descriptor.riskTraits.includes("subagent_creator")
        && permissions.canCreateChildren !== true)) {
      candidates.push("deny");
    }
    for (const content of contents) {
      const rules = content?.toolRules;
      const rule = rules && Object.hasOwn(rules, tool) ? rules[tool] : undefined;
      if (isAgentToolDecision(rule)) candidates.push(rule);
    }
    const parentDecisions = input.parentEffective?.toolDecisions;
    const parentDecision = parentDecisions && Object.hasOwn(parentDecisions, tool)
      ? parentDecisions[tool]
      : undefined;
    if (isAgentToolDecision(parentDecision)) candidates.push(parentDecision);
    toolDecisions[tool] = mergeDecisions(candidates);
  }
  // Tools explicitly denied by name stay denied even outside capability,
  // so audits can explain the denial.
  for (const content of contents) {
    for (const [tool, rule] of Object.entries(content?.toolRules ?? {})) {
      if (rule === "deny" && isSafeToolName(tool) && !Object.hasOwn(toolDecisions, tool)) {
        toolDecisions[tool] = "deny";
      }
    }
  }

  const grantedTools = capability.filter((tool) => toolDecisions[tool] !== "deny");

  const limits: PolicyLimits = mergeLimits([
    ...contents.map((content) => content?.limits ?? null),
    input.parentEffective?.limits ?? null,
  ]);
  const mandatory = mergeMandatoryRules([
    ...contents.map((content) => content?.mandatory ?? null),
    input.parentEffective?.mandatory ?? null,
  ]);
  const requirements = mergeSafetyRequirements([
    ...contents.map((content) => content?.requirements ?? null),
    input.parentEffective?.requirements ?? null,
    mandatory.auditRequired ? { auditRequired: true } : null,
  ]);
  const scope = mergeResourceScopes([
    ...contents.map((content) => content?.dataRules ?? null),
    input.parentEffective?.scope ?? null,
  ]);

  const expiresAt = earliestExpiry([
    addSeconds(normalizedNow, input.ttlSeconds),
    input.parentEffective?.expiresAt ?? null,
  ]) ?? addSeconds(normalizedNow, input.ttlSeconds);

  const lineage: PolicyBinding[] = input.layerStack.map((layer) => ({
    policyKey: layer.policyKey,
    version: layer.version,
    bindingType: layer.policyType,
  }));

  const policy: Omit<EffectiveAgentPolicy, "policyHash"> = {
    agentId: input.agentId,
    classification: input.classification,
    traits: [...input.traits].sort(),
    riskLevel: input.riskLevel,
    toolDecisions,
    grantedTools,
    mandatory,
    limits,
    requirements,
    permissions,
    scope,
    expiresAt,
    lineage,
    compiledAt: normalizedNow,
  };
  return { ...policy, policyHash: computePolicyHash(policy) };
}

type AgentToolDecisionOf = EffectiveAgentPolicy["toolDecisions"][string];

export interface RecompileClamp {
  field: string;
  tool?: string;
  from: string;
  to: string;
}

export interface RecompileResult {
  policy: EffectiveAgentPolicy;
  /** Every place a looser recompilation was clamped back to the old grant. */
  clamped: RecompileClamp[];
}

/**
 * Recompilation after a policy-layer change. Stricter rules apply
 * automatically; looser rules must never expand an existing agent's
 * permissions — the new compile is clamped down to the old effective
 * grant wherever it would grow.
 */
export function recompileWithoutExpansion(
  next: Omit<EffectiveAgentPolicy, "policyHash">,
  previous: EffectiveAgentPolicy,
): RecompileResult {
  // Runtime callers commonly pass the complete compiler result. Structural
  // TypeScript typing does not strip excess fields, so remove the old hash
  // explicitly before constructing and hashing the next content snapshot.
  const { policyHash: _discardedRuntimeHash, ...nextContent } = next as EffectiveAgentPolicy;
  const clamped: RecompileClamp[] = [];
  const previousGranted = new Set((previous.grantedTools ?? []).filter(isSafeToolName));
  const nextGranted = new Set((next.grantedTools ?? []).filter(isSafeToolName));
  const tools = new Set<string>([
    ...Object.keys(previous.toolDecisions ?? {}).filter(isSafeToolName),
    ...Object.keys(next.toolDecisions ?? {}).filter(isSafeToolName),
    ...previousGranted,
    ...nextGranted,
  ]);
  const toolDecisions = Object.create(null) as Record<string, AgentToolDecisionOf>;
  const decisionOf = (
    source: Pick<EffectiveAgentPolicy, "toolDecisions">,
    granted: Set<string>,
    tool: string,
  ): AgentToolDecisionOf => {
    if (!granted.has(tool) || !Object.hasOwn(source.toolDecisions ?? {}, tool)) return DEFAULT_TOOL_DECISION;
    const value = source.toolDecisions[tool];
    return isAgentToolDecision(value) ? value : DEFAULT_TOOL_DECISION;
  };
  for (const tool of tools) {
    const oldDecision = decisionOf(previous, previousGranted, tool);
    const newDecision = decisionOf(next, nextGranted, tool);
    const effective = decisionStrictness(newDecision) >= decisionStrictness(oldDecision)
      ? newDecision
      : oldDecision;
    toolDecisions[tool] = effective;
    if (effective !== newDecision) {
      clamped.push({ field: "toolDecision", tool, from: newDecision, to: effective });
    }
  }
  const grantedTools = Object.keys(toolDecisions)
    .filter((tool) => toolDecisions[tool] !== "deny")
    .sort();

  const limits: PolicyLimits = {};
  for (const key of LIMIT_KEYS) {
    const oldValue = previous.limits[key];
    const newValue = next.limits[key];
    const oldValid = typeof oldValue === "number" && Number.isFinite(oldValue) && oldValue >= 0;
    const newValid = typeof newValue === "number" && Number.isFinite(newValue) && newValue >= 0;
    if (oldValid) {
      limits[key] = newValid ? Math.min(oldValue, newValue) : oldValue;
      if (!newValid || newValue > oldValue) {
        clamped.push({ field: `limits.${key}`, from: newValue === undefined ? "<unset>" : String(newValue), to: String(oldValue) });
      }
    } else if (newValid) {
      limits[key] = newValue;
    } else if (oldValue !== undefined || newValue !== undefined) {
      limits[key] = 0;
      clamped.push({ field: `limits.${key}`, from: "<invalid>", to: "0" });
    }
  }

  const previousExpiry = earliestExpiry([previous.expiresAt]) ?? "1970-01-01T00:00:00.000Z";
  const nextExpiry = earliestExpiry([next.expiresAt]);
  const expiresAt = earliestExpiry([previousExpiry, nextExpiry]) ?? "1970-01-01T00:00:00.000Z";
  if (nextExpiry === null || expiresAt !== nextExpiry) {
    clamped.push({ field: "expiresAt", from: nextExpiry ?? "<invalid>", to: expiresAt });
  }

  const requirements: PolicySafetyRequirements = {};
  for (const key of REQUIREMENT_KEYS) {
    const oldValue = previous.requirements?.[key];
    const newValue = next.requirements?.[key];
    if (oldValue !== undefined || newValue !== undefined) {
      requirements[key] = oldValue === true || newValue === true;
      if (oldValue === true && newValue !== true) {
        clamped.push({ field: `requirements.${key}`, from: newValue === undefined ? "<unset>" : String(newValue), to: "true" });
      }
    }
  }

  const permissions: PolicyPermissions = {};
  for (const key of PERMISSION_KEYS) {
    const oldValue = previous.permissions?.[key] === true;
    const nextRaw = next.permissions?.[key];
    const newValue = typeof nextRaw === "boolean" ? nextRaw : oldValue;
    permissions[key] = oldValue && newValue;
    if (!oldValue && newValue) {
      clamped.push({ field: `permissions.${key}`, from: "true", to: "false" });
    }
  }

  const scope = mergeResourceScopes([next.scope, previous.scope]);
  if (stableStringify(scope) !== stableStringify(next.scope)) {
    clamped.push({ field: "scope", from: "next", to: "intersection-with-previous" });
  }
  const previousMandatory = mergeMandatoryRules([
    (previous as EffectiveAgentPolicy & { mandatory?: EffectivePolicyMandatoryRules }).mandatory,
  ]);
  const mandatory = mergeMandatoryRules([
    (next as Omit<EffectiveAgentPolicy, "policyHash"> & { mandatory?: PolicyMandatoryRules }).mandatory,
    previousMandatory,
  ]);
  if (stableStringify(mandatory) !== stableStringify(next.mandatory)) {
    clamped.push({ field: "mandatory", from: "next", to: "strictest-with-previous" });
  }
  if (mandatory.auditRequired) requirements.auditRequired = true;

  const policy: Omit<EffectiveAgentPolicy, "policyHash"> = {
    ...nextContent,
    agentId: previous.agentId,
    classification: previous.classification,
    traits: [...previous.traits],
    riskLevel: previous.riskLevel,
    toolDecisions,
    grantedTools,
    mandatory,
    limits,
    requirements,
    permissions,
    scope,
    expiresAt,
  };
  return { policy: { ...policy, policyHash: computePolicyHash(policy) }, clamped };
}

/** True when the policy's expiry has passed relative to `now`. */
export function isPolicyExpired(policy: Pick<EffectiveAgentPolicy, "expiresAt">, now: string): boolean {
  const expiry = typeof policy?.expiresAt === "string" ? Date.parse(policy.expiresAt) : Number.NaN;
  const reference = typeof now === "string" ? Date.parse(now) : Number.NaN;
  return !Number.isFinite(expiry) || !Number.isFinite(reference) || expiry <= reference;
}
