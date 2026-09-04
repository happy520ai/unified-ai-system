/**
 * Deterministic agent classification.
 *
 * A model (or any caller) may only *propose* classification. The final
 * trait set and risk level are always recomputed here from the requested
 * tools' registry-declared risk labels: an agent that calls a
 * financial-write tool is financial-write risky no matter what it claims
 * to be, and a write-capable agent is never read-only.
 */

import type {
  AgentClassification,
  AgentFamily,
  AgentTrait,
  RiskLevel,
  ToolGovernanceDescriptor,
} from "@unified-ai-system/shared-contracts";

export const AGENT_FAMILIES: readonly AgentFamily[] = Object.freeze([
  "analysis",
  "execution",
  "communication",
  "monitoring",
  "development",
  "orchestration",
  "governance",
]);

export const AGENT_TRAITS: readonly AgentTrait[] = Object.freeze([
  "read_only",
  "write_capable",
  "external_communication",
  "handles_sensitive_data",
  "financial_operation",
  "code_execution",
  "subagent_creator",
  "destructive_operation",
]);

/**
 * Trait implications: asserting the key implies every listed trait.
 * Financial operations both write and touch sensitive data; code execution
 * and destructive operations write.
 */
const TRAIT_IMPLICATIONS = {
  read_only: Object.freeze([] as const),
  write_capable: Object.freeze([] as const),
  external_communication: Object.freeze([] as const),
  handles_sensitive_data: Object.freeze([] as const),
  financial_operation: Object.freeze(["write_capable", "handles_sensitive_data"] as const),
  code_execution: Object.freeze(["write_capable"] as const),
  subagent_creator: Object.freeze([] as const),
  destructive_operation: Object.freeze(["write_capable"] as const),
} satisfies Readonly<Record<AgentTrait, readonly AgentTrait[]>>;

const FAMILY_SET = new Set<string>(AGENT_FAMILIES);
const TRAIT_SET = new Set<string>(AGENT_TRAITS);

const RISK_ORDER: Readonly<Record<RiskLevel, number>> = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
});

export function isAgentFamily(value: unknown): value is AgentFamily {
  return typeof value === "string" && FAMILY_SET.has(value);
}

export function isAgentTrait(value: unknown): value is AgentTrait {
  return typeof value === "string" && TRAIT_SET.has(value);
}

export function isValidClassification(value: unknown): value is AgentClassification {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isAgentFamily(candidate.family)
    && isBoundedClassificationPart(candidate.domain)
    && isBoundedClassificationPart(candidate.subclass);
}

function isBoundedClassificationPart(value: unknown): value is string {
  return typeof value === "string" && value === value.trim()
    && value.length > 0 && value.length <= 256
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Closure of a trait set under implications, sorted and de-duplicated. */
export function normalizeTraits(traits: Array<AgentTrait | string>): AgentTrait[] {
  const closed = new Set<AgentTrait>();
  const queue = traits.filter(isAgentTrait);
  while (queue.length > 0) {
    const trait = queue.shift() as AgentTrait;
    if (closed.has(trait)) continue;
    closed.add(trait);
    for (const implied of TRAIT_IMPLICATIONS[trait]) {
      if (!closed.has(implied)) queue.push(implied);
    }
  }
  // A write-capable agent is never read-only; write wins.
  if (closed.has("write_capable")) closed.delete("read_only");
  return Array.from(closed).sort();
}

export function maxRiskLevel(levels: Array<RiskLevel | undefined | null>): RiskLevel {
  let best: RiskLevel = "low";
  let bestRank = 0;
  for (const level of levels) {
    if (!level || !(level in RISK_ORDER)) continue;
    const rank = RISK_ORDER[level];
    if (rank > bestRank) {
      best = level;
      bestRank = rank;
    }
  }
  return best;
}

export interface DerivedToolRisk {
  impliedTraits: AgentTrait[];
  impliedRiskLevel: RiskLevel;
}

/**
 * Tool-risk backfill: union the risk traits of every requested tool,
 * implied write capability for write-action tools, and the strictest tool
 * risk level. Declared classification can never lower any of these.
 */
export function deriveToolRisk(
  toolDescriptors: Array<ToolGovernanceDescriptor | undefined | null>,
): DerivedToolRisk {
  const traits = new Set<AgentTrait>();
  const riskLevels: RiskLevel[] = [];
  for (const descriptor of toolDescriptors) {
    if (!descriptor) continue;
    for (const trait of descriptor.riskTraits ?? []) {
      if (isAgentTrait(trait)) traits.add(trait);
    }
    if (descriptor.actionType === "write") traits.add("write_capable");
    if (descriptor.riskLevel) riskLevels.push(descriptor.riskLevel);
  }
  return {
    impliedTraits: normalizeTraits(Array.from(traits)),
    impliedRiskLevel: maxRiskLevel(riskLevels),
  };
}

export interface RecomputedClassification {
  classification: AgentClassification;
  traits: AgentTrait[];
  riskLevel: RiskLevel;
  addedTraits: AgentTrait[];
  riskEscalated: boolean;
}

/**
 * Final classification: proposal normalized against tool-declared risk.
 * Traits only grow (backfill) and the risk level only rises; a proposal
 * understating risk is corrected, never the other way around.
 */
export function recomputeClassification(input: {
  classification: AgentClassification;
  proposedTraits: Array<AgentTrait | string>;
  proposedRiskLevel: RiskLevel;
  toolDescriptors: Array<ToolGovernanceDescriptor | undefined | null>;
}): RecomputedClassification {
  const derived = deriveToolRisk(input.toolDescriptors);
  const merged = normalizeTraits([...input.proposedTraits, ...derived.impliedTraits]);
  const riskLevel = maxRiskLevel([input.proposedRiskLevel, derived.impliedRiskLevel]);
  const addedTraits = merged.filter((trait) => !normalizeTraits(input.proposedTraits).includes(trait));
  return {
    classification: input.classification,
    traits: merged,
    riskLevel,
    addedTraits,
    riskEscalated: RISK_ORDER[riskLevel] > RISK_ORDER[input.proposedRiskLevel],
  };
}
