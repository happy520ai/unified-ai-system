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
  AgentTrait,
  EffectiveAgentPolicy,
  PolicyBinding,
  PolicyLimits,
  PolicyPermissions,
  PolicyRecord,
  RiskLevel,
  ToolGovernanceDescriptor,
} from "@unified-ai-system/shared-contracts";
import { DEFAULT_TOOL_DECISION, isAgentToolDecision, mergeDecisions } from "./decisionAlgebra.ts";
import { computePolicyHash } from "./integrity.ts";
import {
  earliestExpiry,
  intersectCapabilities,
  intersectStringSets,
  mergeLimits,
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
  /** Creator entitlements: tools the creating user/tenant may grant. */
  userAllowedTools?: string[] | null;
  /** ISO timestamp — injected so tests stay deterministic. */
  now: string;
}

function toDescriptorLookup(
  descriptors: CompileEffectivePolicyInput["toolDescriptors"],
): Map<string, ToolGovernanceDescriptor> {
  if (descriptors instanceof Map) return descriptors;
  return new Map(Object.entries(descriptors));
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

export function compileEffectivePolicy(input: CompileEffectivePolicyInput): EffectiveAgentPolicy {
  const lookup = toDescriptorLookup(input.toolDescriptors);
  const contents = input.layerStack.map((layer) => layer.content);

  // Capability: requested tools reduced by every expressed ceiling,
  // including the parent agent's granted set and creator entitlements.
  const capability = intersectCapabilities(
    input.requestedTools,
    [
      input.userAllowedTools ?? null,
      ...contents.map((content) => content?.capabilityCeiling ?? null),
      input.parentEffective?.grantedTools ?? null,
    ],
  );

  // Decisions: strictest wins across every layer rule, the parent's
  // compiled decision, and the tool registry's default decision.
  const toolDecisions: Record<string, AgentToolDecisionOf> = {};
  for (const tool of capability) {
    const descriptor = lookup.get(tool);
    const candidates: AgentToolDecisionOf[] = [];
    if (descriptor?.defaultDecision && isAgentToolDecision(descriptor.defaultDecision)) {
      candidates.push(descriptor.defaultDecision);
    }
    for (const content of contents) {
      const rule = content?.toolRules?.[tool];
      if (isAgentToolDecision(rule)) candidates.push(rule);
    }
    const parentDecision = input.parentEffective?.toolDecisions?.[tool];
    if (isAgentToolDecision(parentDecision)) candidates.push(parentDecision);
    toolDecisions[tool] = mergeDecisions(candidates);
  }
  // Tools explicitly denied by name stay denied even outside capability,
  // so audits can explain the denial.
  for (const content of contents) {
    for (const [tool, rule] of Object.entries(content?.toolRules ?? {})) {
      if (rule === "deny" && !(tool in toolDecisions)) toolDecisions[tool] = "deny";
    }
  }

  const grantedTools = capability.filter((tool) => toolDecisions[tool] !== "deny");

  const limits: PolicyLimits = mergeLimits([
    ...contents.map((content) => content?.limits ?? null),
    input.parentEffective?.limits ?? null,
  ]);
  const requirements = mergeSafetyRequirements([
    ...contents.map((content) => content?.requirements ?? null),
    input.parentEffective?.requirements ?? null,
  ]);
  const permissions: PolicyPermissions = mergePermissions([
    ...contents.map((content) => content?.permissions ?? null),
    input.parentEffective?.permissions ?? null,
  ]);
  const scope = mergeResourceScopes([
    ...contents.map((content) => content?.dataRules ?? null),
    input.parentEffective?.scope ?? null,
  ]);

  const expiresAt = earliestExpiry([
    addSeconds(input.now, input.ttlSeconds),
    input.parentEffective?.expiresAt ?? null,
  ]) ?? addSeconds(input.now, input.ttlSeconds);

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
    limits,
    requirements,
    permissions,
    scope,
    expiresAt,
    lineage,
    compiledAt: input.now,
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
  const clamped: RecompileClamp[] = [];
  const decisionStrictness = { allow: 1, require_approval: 2, deny: 3 } as const;

  const toolDecisions: Record<string, AgentToolDecisionOf> = { ...next.toolDecisions };
  for (const tool of previous.grantedTools) {
    const oldDecision = previous.toolDecisions[tool] ?? "deny";
    const newDecision = toolDecisions[tool] ?? "deny";
    if (decisionStrictness[newDecision] < decisionStrictness[oldDecision]) {
      toolDecisions[tool] = oldDecision;
      clamped.push({ field: "toolDecision", tool, from: newDecision, to: oldDecision });
    }
  }
  for (const tool of Object.keys(toolDecisions)) {
    if (!previous.grantedTools.includes(tool) && toolDecisions[tool] !== "deny") {
      clamped.push({ field: "toolDecision", tool, from: toolDecisions[tool], to: "deny" });
      toolDecisions[tool] = "deny";
    }
  }
  const grantedTools = Object.keys(toolDecisions)
    .filter((tool) => toolDecisions[tool] !== "deny")
    .sort();

  const limits: PolicyLimits = { ...next.limits };
  for (const key of Object.keys(limits) as Array<keyof PolicyLimits>) {
    const oldValue = previous.limits[key];
    const newValue = limits[key];
    if (typeof oldValue === "number" && typeof newValue === "number" && newValue > oldValue) {
      limits[key] = oldValue;
      clamped.push({ field: `limits.${key}`, from: String(newValue), to: String(oldValue) });
    }
  }

  let expiresAt = next.expiresAt;
  if (previous.expiresAt && expiresAt > previous.expiresAt) {
    expiresAt = previous.expiresAt;
    clamped.push({ field: "expiresAt", from: next.expiresAt, to: previous.expiresAt });
  }

  const permissions = mergePermissions([next.permissions, previous.permissions]);

  const scope = mergeResourceScopes([next.scope, previous.scope]);

  const policy: Omit<EffectiveAgentPolicy, "policyHash"> = {
    ...next,
    toolDecisions,
    grantedTools,
    limits,
    permissions,
    scope,
    expiresAt,
  };
  return { policy: { ...policy, policyHash: computePolicyHash(policy) }, clamped };
}

/** True when the policy's expiry has passed relative to `now`. */
export function isPolicyExpired(policy: Pick<EffectiveAgentPolicy, "expiresAt">, now: string): boolean {
  return typeof policy.expiresAt === "string" && policy.expiresAt !== "" && policy.expiresAt <= now;
}
