/**
 * Tool decision algebra: allow < require_approval < deny.
 *
 * Conflicts always resolve to the stricter decision, and any tool without
 * an explicit grant is denied by default. These are the only rules that
 * turn layered policy into a single per-tool decision.
 */

import {
  AGENT_TOOL_DECISION_STRICTNESS,
} from "@unified-ai-system/shared-contracts";
import type { AgentToolDecision, EffectiveAgentPolicy } from "@unified-ai-system/shared-contracts";

/** Tools never explicitly granted are denied by default. */
export const DEFAULT_TOOL_DECISION: AgentToolDecision = "deny";

const DECISION_VALUES = new Set<string>(["allow", "require_approval", "deny"]);
const RESERVED_OBJECT_KEYS = new Set<string>([
  "__proto__",
  "prototype",
  ...Object.getOwnPropertyNames(Object.prototype),
]);

export function isAgentToolDecision(value: unknown): value is AgentToolDecision {
  return typeof value === "string" && DECISION_VALUES.has(value);
}

/**
 * Tool names are dictionary keys throughout the control plane. Reject names
 * that resolve through Object.prototype so a deserialized ordinary object can
 * never turn an inherited property into an apparent policy decision.
 */
export function isSafeToolName(value: unknown): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= 256
    && !RESERVED_OBJECT_KEYS.has(value);
}

/** Fail-closed lookup for effective tool decisions. */
export function getEffectiveToolDecision(
  policy: Pick<EffectiveAgentPolicy, "toolDecisions" | "grantedTools"> | null | undefined,
  toolName: unknown,
): AgentToolDecision {
  if (!policy || !isSafeToolName(toolName)) return DEFAULT_TOOL_DECISION;
  if (!Array.isArray(policy.grantedTools) || !policy.grantedTools.includes(toolName)) {
    return DEFAULT_TOOL_DECISION;
  }
  const decisions = policy.toolDecisions;
  if (!decisions || typeof decisions !== "object" || !Object.hasOwn(decisions, toolName)) {
    return DEFAULT_TOOL_DECISION;
  }
  const decision = decisions[toolName];
  return isAgentToolDecision(decision) ? decision : DEFAULT_TOOL_DECISION;
}

export function decisionStrictness(decision: AgentToolDecision): number {
  return AGENT_TOOL_DECISION_STRICTNESS[decision];
}

/** Max-strictness merge: the effective decision is the strictest input. */
export function mergeDecisions(decisions: Iterable<AgentToolDecision>): AgentToolDecision {
  let strictest: AgentToolDecision = DEFAULT_TOOL_DECISION;
  let strictestRank = 0;
  for (const decision of decisions) {
    if (!isAgentToolDecision(decision)) continue;
    const rank = decisionStrictness(decision);
    if (rank > strictestRank) {
      strictest = decision;
      strictestRank = rank;
    }
  }
  return strictest;
}

/** True when `candidate` is at least as strict as `reference`. */
export function atLeastAsStrict(candidate: AgentToolDecision, reference: AgentToolDecision): boolean {
  return decisionStrictness(candidate) >= decisionStrictness(reference);
}
