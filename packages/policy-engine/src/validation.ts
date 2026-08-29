/**
 * Policy Validator — the only gate between a draft and the compiler.
 *
 * Model output arrives as an AgentDraft; nothing becomes an agent until
 * this module accepts it. Validation covers schema, classification,
 * tool registration, tool-risk backfill completeness, sub-agent subset
 * rules, generation limits and expiry ceilings.
 */

import type {
  AgentDraft,
  AgentRegistryRecord,
  AgentTrait,
  EffectiveAgentPolicy,
  PolicyLimits,
  PolicyPermissions,
  RiskLevel,
  ToolGovernanceDescriptor,
} from "@unified-ai-system/shared-contracts";
import {
  deriveToolRisk,
  isAgentTrait,
  isValidClassification,
  maxRiskLevel,
} from "./classification.ts";
import { earliestExpiry } from "./merge.ts";

export interface AgentDraftValidationError {
  code: string;
  message: string;
  tools?: string[];
}

export interface ParentValidationContext {
  record: AgentRegistryRecord;
  effective: EffectiveAgentPolicy;
  currentChildrenCount?: number;
}

export interface AgentDraftValidationInput {
  draft: AgentDraft;
  toolDescriptors:
    | Map<string, ToolGovernanceDescriptor>
    | Record<string, ToolGovernanceDescriptor>;
  parent?: ParentValidationContext | null;
  /** Permission booleans of the applicable family-layer policy. */
  familyPermissions?: PolicyPermissions | null;
  rootLimits?: PolicyLimits | null;
  now?: string;
}

export interface AgentDraftValidationResult {
  valid: boolean;
  errors: AgentDraftValidationError[];
  computed: {
    expiresAt: string;
    generationDepth: number;
    impliedTraits: AgentTrait[];
    impliedRiskLevel: RiskLevel;
  };
}

const MAX_NAME_LENGTH = 200;
const MAX_TASK_LENGTH = 4000;
const MAX_TTL_SECONDS = 60 * 60 * 24 * 30;

function toDescriptorLookup(
  descriptors: AgentDraftValidationInput["toolDescriptors"],
): Map<string, ToolGovernanceDescriptor> {
  if (descriptors instanceof Map) return descriptors;
  return new Map(Object.entries(descriptors));
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

export function validateAgentDraft(input: AgentDraftValidationInput): AgentDraftValidationResult {
  const errors: AgentDraftValidationError[] = [];
  const now = input.now ?? new Date().toISOString();
  const draft = input.draft ?? ({} as AgentDraft);
  const lookup = toDescriptorLookup(input.toolDescriptors);

  // 1. Schema
  if (typeof draft.name !== "string" || draft.name.trim() === "" || draft.name.length > MAX_NAME_LENGTH) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "Agent name must be a non-empty string of at most 200 characters." });
  }
  if (typeof draft.task !== "string" || draft.task.trim() === "" || draft.task.length > MAX_TASK_LENGTH) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "Agent task must be a non-empty string of at most 4000 characters." });
  }
  if (typeof draft.ttlSeconds !== "number" || !Number.isInteger(draft.ttlSeconds) || draft.ttlSeconds <= 0 || draft.ttlSeconds > MAX_TTL_SECONDS) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: `ttlSeconds must be an integer between 1 and ${MAX_TTL_SECONDS}.` });
  }
  if (!Array.isArray(draft.requestedTools) || draft.requestedTools.some((tool) => typeof tool !== "string" || tool.trim() === "")) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "requestedTools must be an array of non-empty tool names." });
  }
  if (draft.parentAgentId !== null && typeof draft.parentAgentId !== "string") {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "parentAgentId must be a string or null." });
  }
  if (new Set(draft.requestedTools ?? []).size !== (draft.requestedTools ?? []).length) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "requestedTools must not contain duplicates." });
  }

  // 2. Classification validity
  if (!isValidClassification(draft.classification)) {
    errors.push({ code: "CLASSIFICATION_INVALID", message: "Classification must carry a known family plus non-empty domain and subclass." });
  }

  // 3. Traits known
  const unknownTraits = (draft.proposedTraits ?? []).filter((trait) => !isAgentTrait(trait));
  if (unknownTraits.length > 0) {
    errors.push({ code: "TRAIT_UNKNOWN", message: `Unknown traits: ${unknownTraits.join(", ")}.` });
  }

  // 4. Requested tools registered
  const requested = Array.isArray(draft.requestedTools) ? draft.requestedTools : [];
  const unregistered = requested.filter((tool) => !lookup.has(tool));
  if (unregistered.length > 0) {
    errors.push({ code: "TOOL_UNREGISTERED", message: "Requested tools are not registered in the tool registry.", tools: unregistered });
  }

  // 5-6. Tool-risk backfill completeness and risk level
  const descriptors = requested.map((tool) => lookup.get(tool));
  const derived = deriveToolRisk(descriptors);
  const proposedTraits = (draft.proposedTraits ?? []).filter(isAgentTrait);
  const finalTraits = new Set<AgentTrait>([...proposedTraits, ...derived.impliedTraits]);
  const missingTraits = derived.impliedTraits.filter((trait) => !proposedTraits.includes(trait));
  if (missingTraits.length > 0 && !errors.some((error) => error.code === "TOOL_UNREGISTERED")) {
    // The service must run recomputeClassification before validation; a
    // draft that still misses implied traits was not backfilled.
    errors.push({ code: "TRAIT_BACKFILL_INCOMPLETE", message: "Tool-implied risk traits are missing from the draft.", tools: missingTraits });
  }
  const effectiveRisk = maxRiskLevel([draft.proposedRiskLevel, derived.impliedRiskLevel]);
  if (draft.proposedRiskLevel && derived.impliedRiskLevel && effectiveRisk !== draft.proposedRiskLevel
    && !errors.some((error) => error.code === "TOOL_UNREGISTERED")
    && missingTraits.length === 0) {
    errors.push({ code: "RISK_UNDERSTATED", message: `Declared risk level ${draft.proposedRiskLevel} understates tool-implied risk ${derived.impliedRiskLevel}.` });
  }

  // 7. Parent / sub-agent rules
  let generationDepth = 0;
  let expiresAt = addSeconds(now, typeof draft.ttlSeconds === "number" && draft.ttlSeconds > 0 ? draft.ttlSeconds : 3600);
  const parent = input.parent ?? null;
  if (draft.parentAgentId != null && draft.parentAgentId !== "") {
    if (!parent) {
      errors.push({ code: "PARENT_UNAVAILABLE", message: `Parent agent ${draft.parentAgentId} was not found or was not supplied for validation.` });
    } else {
      const parentRecord = parent.record;
      const parentEffective = parent.effective;
      generationDepth = (parentRecord.generationDepth ?? 0) + 1;

      if (parentRecord.status !== "ACTIVE") {
        errors.push({ code: "PARENT_NOT_ACTIVE", message: `Parent agent status is ${parentRecord.status}; only ACTIVE parents may spawn children.` });
      }
      if (parentRecord.expiresAt && parentRecord.expiresAt <= now) {
        errors.push({ code: "PARENT_EXPIRED", message: "Parent agent has expired; children cannot be created from it." });
      }

      // Sub-agent creation requires the parent to carry subagent_creator
      // and the compiled permission to create children.
      if (!parentRecord.traits.includes("subagent_creator") || parentEffective.permissions.canCreateChildren !== true) {
        errors.push({ code: "SUBAGENT_CREATOR_REQUIRED", message: "Parent agent must carry the subagent_creator trait and compiled canCreateChildren permission." });
      }

      // Child tool set must be a subset of the parent's granted tools.
      const parentGranted = new Set(parentEffective.grantedTools ?? []);
      const offending = requested.filter((tool) => !parentGranted.has(tool));
      if (offending.length > 0) {
        errors.push({ code: "PARENT_TOOL_SUBSET_VIOLATION", message: "Child requested tools outside the parent's granted set.", tools: offending });
      }

      // Risk labels can only be added, never removed, down the chain.
      const removedTraits = (parentRecord.traits ?? []).filter(
        (trait) => trait !== "subagent_creator" && trait !== "read_only" && !finalTraits.has(trait),
      );
      if (removedTraits.length > 0) {
        errors.push({ code: "PARENT_TRAIT_REMOVAL", message: "Child may not drop the parent's risk traits.", tools: removedTraits });
      }

      // subagent_creator is not self-assignable: the child may carry it
      // only when the parent carries it and the family layer allows it.
      if (finalTraits.has("subagent_creator")
        && (!parentRecord.traits.includes("subagent_creator") || input.familyPermissions?.canCreateChildren === false)) {
        errors.push({ code: "CHILD_SUBAGENT_CREATOR_NOT_ALLOWED", message: "subagent_creator may only be inherited when the parent carries it and the family policy allows child creation." });
      }

      // Depth and children-count ceilings.
      const maxDepth = input.rootLimits?.maxGenerationDepth ?? parentEffective.limits.maxGenerationDepth;
      if (typeof maxDepth === "number" && generationDepth > maxDepth) {
        errors.push({ code: "PARENT_DEPTH_EXCEEDED", message: `Generation depth ${generationDepth} exceeds the maximum of ${maxDepth}.` });
      }
      const maxChildren = parentEffective.limits.maxChildrenPerAgent
        ?? input.rootLimits?.maxChildrenPerAgent;
      if (typeof maxChildren === "number" && typeof parent.currentChildrenCount === "number"
        && parent.currentChildrenCount >= maxChildren) {
        errors.push({ code: "PARENT_CHILDREN_LIMIT_EXCEEDED", message: `Parent already has ${parent.currentChildrenCount} children; ceiling is ${maxChildren}.` });
      }

      // Child lifetime may not exceed the parent's. The raw TTL expiry
      // is checked before clamping so an over-long TTL is rejected, while
      // the computed expiry still carries the parent ceiling forward.
      const parentExpiry = earliestExpiry([parentRecord.expiresAt, parentEffective.expiresAt]);
      if (parentExpiry) {
        const rawExpiry = addSeconds(now, typeof draft.ttlSeconds === "number" && draft.ttlSeconds > 0 ? draft.ttlSeconds : 3600);
        if (rawExpiry > parentExpiry) {
          errors.push({ code: "PARENT_EXPIRY_CEILING", message: `Child TTL would outlive the parent (expiry ceiling ${parentExpiry}); TTL must be reduced.` });
        }
        expiresAt = earliestExpiry([expiresAt, parentExpiry]) ?? expiresAt;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    computed: {
      expiresAt,
      generationDepth,
      impliedTraits: derived.impliedTraits,
      impliedRiskLevel: derived.impliedRiskLevel,
    },
  };
}

/**
 * Self-modification guard: an agent identity may never validate a draft
 * or policy change that targets itself or its own ancestry.
 */
export function validateNoSelfModification(input: {
  actorAgentId?: string | null;
  targetAgentId: string;
  ancestry?: string[];
}): AgentDraftValidationError | null {
  if (!input.actorAgentId) return null;
  if (input.actorAgentId === input.targetAgentId) {
    return { code: "SELF_POLICY_MODIFICATION_DENIED", message: "An agent may not modify its own policy." };
  }
  if ((input.ancestry ?? []).includes(input.actorAgentId)) {
    return { code: "SELF_POLICY_MODIFICATION_DENIED", message: "An agent may not modify the policy of its ancestors." };
  }
  return null;
}
