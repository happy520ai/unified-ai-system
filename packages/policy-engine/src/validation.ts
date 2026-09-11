/**
 * Policy Validator — the only gate between a draft and the compiler.
 *
 * Model output arrives as an AgentDraft; nothing becomes an agent until
 * this module accepts it. Validation covers schema, classification,
 * tool registration, tool-risk backfill completeness, sub-agent subset
 * rules, generation limits and expiry ceilings.
 */

import type {
  AgentCreatorEntitlements,
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
import { mergeLimits } from "./merge.ts";
import { isSafeToolName } from "./decisionAlgebra.ts";

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
  /** Untrusted runtime input; validation must reject malformed values without throwing. */
  draft: AgentDraft | unknown;
  toolDescriptors:
    | Map<string, ToolGovernanceDescriptor>
    | Record<string, ToolGovernanceDescriptor>;
  parent?: ParentValidationContext | null;
  /** Permission booleans of the applicable family-layer policy. */
  familyPermissions?: PolicyPermissions | null;
  /** Trusted creator authorization, never sourced from the draft. */
  creatorEntitlements?: AgentCreatorEntitlements | null;
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
const RISK_LEVELS = new Set<string>(["low", "medium", "high", "critical"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toDescriptorLookup(
  descriptors: AgentDraftValidationInput["toolDescriptors"],
): Map<string, ToolGovernanceDescriptor> {
  if (descriptors instanceof Map) return descriptors;
  return isRecord(descriptors)
    ? new Map(Object.entries(descriptors) as Array<[string, ToolGovernanceDescriptor]>)
    : new Map();
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

export function validateAgentDraft(input: AgentDraftValidationInput): AgentDraftValidationResult {
  const errors: AgentDraftValidationError[] = [];
  const suppliedNow = input.now ?? new Date().toISOString();
  const validNow = typeof suppliedNow === "string" && Number.isFinite(Date.parse(suppliedNow));
  const now = validNow
    ? new Date(suppliedNow).toISOString()
    : "1970-01-01T00:00:00.000Z";
  if (!validNow) {
    errors.push({ code: "VALIDATION_TIME_INVALID", message: "now must be a valid ISO timestamp." });
  }
  const draft = isRecord(input.draft) ? input.draft : {};
  const lookup = toDescriptorLookup(input.toolDescriptors);
  const requested = Array.isArray(draft.requestedTools)
    ? draft.requestedTools.filter((tool): tool is string => typeof tool === "string")
    : [];
  const proposedTraitValues = Array.isArray(draft.proposedTraits) ? draft.proposedTraits : [];
  const ttlSeconds = typeof draft.ttlSeconds === "number"
    && Number.isSafeInteger(draft.ttlSeconds)
    && draft.ttlSeconds > 0
    ? draft.ttlSeconds
    : 1;

  // 1. Schema
  if (typeof draft.name !== "string" || draft.name.trim() === "" || draft.name.length > MAX_NAME_LENGTH) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "Agent name must be a non-empty string of at most 200 characters." });
  }
  if (typeof draft.task !== "string" || draft.task.trim() === "" || draft.task.length > MAX_TASK_LENGTH) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "Agent task must be a non-empty string of at most 4000 characters." });
  }
  if (typeof draft.ttlSeconds !== "number" || !Number.isSafeInteger(draft.ttlSeconds) || draft.ttlSeconds <= 0 || draft.ttlSeconds > MAX_TTL_SECONDS) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: `ttlSeconds must be an integer between 1 and ${MAX_TTL_SECONDS}.` });
  }
  if (!Array.isArray(draft.requestedTools)
    || draft.requestedTools.some((tool) => !isSafeToolName(tool))) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "requestedTools must be an array of non-empty tool names." });
  }
  if (draft.parentAgentId !== null
    && (typeof draft.parentAgentId !== "string" || draft.parentAgentId.trim() === "")) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "parentAgentId must be a string or null." });
  }
  if (Array.isArray(draft.requestedTools) && new Set(draft.requestedTools).size !== draft.requestedTools.length) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "requestedTools must not contain duplicates." });
  }
  if (!Array.isArray(draft.proposedTraits)) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "proposedTraits must be an array." });
  }
  if (!RISK_LEVELS.has(String(draft.proposedRiskLevel))) {
    errors.push({ code: "DRAFT_SCHEMA_INVALID", message: "proposedRiskLevel must be a known risk level." });
  }

  // 2. Classification validity
  if (!isValidClassification(draft.classification)) {
    errors.push({ code: "CLASSIFICATION_INVALID", message: "Classification must carry a known family plus non-empty domain and subclass." });
  }

  // 3. Traits known
  const unknownTraits = proposedTraitValues.filter((trait) => !isAgentTrait(trait));
  if (unknownTraits.length > 0) {
    errors.push({ code: "TRAIT_UNKNOWN", message: `Unknown traits: ${unknownTraits.join(", ")}.` });
  }

  // 4. Requested tools registered
  const unregistered = requested.filter((tool) => !lookup.has(tool));
  if (unregistered.length > 0) {
    errors.push({ code: "TOOL_UNREGISTERED", message: "Requested tools are not registered in the tool registry.", tools: unregistered });
  }

  // 5-6. Tool-risk backfill completeness and risk level
  const descriptors = requested.map((tool) => lookup.get(tool));
  const derived = deriveToolRisk(descriptors);
  const proposedTraits = proposedTraitValues.filter(isAgentTrait);
  const finalTraits = new Set<AgentTrait>([...proposedTraits, ...derived.impliedTraits]);
  const missingTraits = derived.impliedTraits.filter((trait) => !proposedTraits.includes(trait));
  if (missingTraits.length > 0 && !errors.some((error) => error.code === "TOOL_UNREGISTERED")) {
    // The service must run recomputeClassification before validation; a
    // draft that still misses implied traits was not backfilled.
    errors.push({ code: "TRAIT_BACKFILL_INCOMPLETE", message: "Tool-implied risk traits are missing from the draft.", tools: missingTraits });
  }
  const proposedRiskLevel = RISK_LEVELS.has(String(draft.proposedRiskLevel))
    ? draft.proposedRiskLevel as RiskLevel
    : "low";
  const effectiveRisk = maxRiskLevel([proposedRiskLevel, derived.impliedRiskLevel]);
  if (derived.impliedRiskLevel && effectiveRisk !== proposedRiskLevel
    && !errors.some((error) => error.code === "TOOL_UNREGISTERED")
    && missingTraits.length === 0) {
    errors.push({ code: "RISK_UNDERSTATED", message: `Declared risk level ${String(draft.proposedRiskLevel)} understates tool-implied risk ${derived.impliedRiskLevel}.` });
  }

  // 7. Parent / sub-agent rules
  let generationDepth = 0;
  let expiresAt = addSeconds(now, ttlSeconds);
  const parent = input.parent ?? null;
  if (typeof draft.parentAgentId === "string" && draft.parentAgentId !== "") {
    if (!parent) {
      errors.push({ code: "PARENT_UNAVAILABLE", message: `Parent agent ${draft.parentAgentId} was not found or was not supplied for validation.` });
    } else {
      const rawParentRecord: unknown = (parent as ParentValidationContext).record;
      const rawParentEffective: unknown = (parent as ParentValidationContext).effective;
      const parentRecord = isRecord(rawParentRecord)
        ? rawParentRecord as unknown as AgentRegistryRecord
        : {
          agentId: "",
          generationDepth: -1,
          status: "REVOKED",
          expiresAt: "",
          traits: [],
        } as unknown as AgentRegistryRecord;
      const parentEffective = isRecord(rawParentEffective)
        ? rawParentEffective as unknown as EffectiveAgentPolicy
        : {
          agentId: "",
          grantedTools: [],
          permissions: {},
          limits: {},
          expiresAt: "",
        } as unknown as EffectiveAgentPolicy;
      if (!isRecord(rawParentRecord) || !isRecord(rawParentEffective)) {
        errors.push({ code: "PARENT_CONTEXT_INVALID", message: "Parent registry and effective-policy records are required." });
      }
      if (parentRecord.agentId !== draft.parentAgentId || parentEffective.agentId !== draft.parentAgentId) {
        errors.push({ code: "PARENT_CONTEXT_MISMATCH", message: "Supplied parent context does not match parentAgentId." });
      }
      if (!Number.isSafeInteger(parentRecord.generationDepth) || parentRecord.generationDepth < 0) {
        errors.push({ code: "PARENT_CONTEXT_INVALID", message: "Parent generationDepth must be a non-negative safe integer." });
        generationDepth = Number.MAX_SAFE_INTEGER;
      } else {
        generationDepth = parentRecord.generationDepth + 1;
      }

      if (parentRecord.status !== "ACTIVE") {
        errors.push({ code: "PARENT_NOT_ACTIVE", message: `Parent agent status is ${parentRecord.status}; only ACTIVE parents may spawn children.` });
      }
      if (typeof parentRecord.expiresAt !== "string" || !Number.isFinite(Date.parse(parentRecord.expiresAt))) {
        errors.push({ code: "PARENT_CONTEXT_INVALID", message: "Parent expiry must be a valid timestamp." });
      } else if (parentRecord.expiresAt <= now) {
        errors.push({ code: "PARENT_EXPIRED", message: "Parent agent has expired; children cannot be created from it." });
      }

      // Sub-agent creation requires the parent to carry subagent_creator
      // and the compiled permission to create children.
      if (!Array.isArray(parentRecord.traits)
        || !parentRecord.traits.includes("subagent_creator")
        || parentEffective.permissions?.canCreateChildren !== true) {
        errors.push({ code: "SUBAGENT_CREATOR_REQUIRED", message: "Parent agent must carry the subagent_creator trait and compiled canCreateChildren permission." });
      }

      // Child tool set must be a subset of the parent's granted tools.
      const parentGranted = new Set(Array.isArray(parentEffective.grantedTools) ? parentEffective.grantedTools : []);
      const offending = requested.filter((tool) => !parentGranted.has(tool));
      if (offending.length > 0) {
        errors.push({ code: "PARENT_TOOL_SUBSET_VIOLATION", message: "Child requested tools outside the parent's granted set.", tools: offending });
      }

      // Risk labels can only be added, never removed, down the chain.
      const removedTraits = (Array.isArray(parentRecord.traits) ? parentRecord.traits : []).filter(
        (trait) => trait !== "subagent_creator" && trait !== "read_only" && !finalTraits.has(trait),
      );
      if (removedTraits.length > 0) {
        errors.push({ code: "PARENT_TRAIT_REMOVAL", message: "Child may not drop the parent's risk traits.", tools: removedTraits });
      }

      // subagent_creator is not self-assignable: the child may carry it
      // only when the parent carries it and the family layer allows it.
      if (finalTraits.has("subagent_creator")
        && (!Array.isArray(parentRecord.traits)
          || !parentRecord.traits.includes("subagent_creator")
          || input.familyPermissions?.canCreateChildren !== true)) {
        errors.push({ code: "CHILD_SUBAGENT_CREATOR_NOT_ALLOWED", message: "subagent_creator may only be inherited when the parent carries it and the family policy allows child creation." });
      }

      // Depth and children-count ceilings.
      const maxDepth = mergeLimits([
        input.rootLimits ?? null,
        parentEffective.limits ?? null,
      ]).maxGenerationDepth;
      if (typeof maxDepth === "number" && generationDepth > maxDepth) {
        errors.push({ code: "PARENT_DEPTH_EXCEEDED", message: `Generation depth ${generationDepth} exceeds the maximum of ${maxDepth}.` });
      }
      const maxChildren = mergeLimits([
        input.rootLimits ?? null,
        parentEffective.limits ?? null,
      ]).maxChildrenPerAgent;
      if (typeof maxChildren === "number") {
        if (!Number.isSafeInteger(parent.currentChildrenCount) || (parent.currentChildrenCount as number) < 0) {
          errors.push({ code: "PARENT_CHILDREN_COUNT_REQUIRED", message: "A trusted current child count is required when a child ceiling applies." });
        } else if ((parent.currentChildrenCount as number) >= maxChildren) {
          errors.push({ code: "PARENT_CHILDREN_LIMIT_EXCEEDED", message: `Parent already has ${parent.currentChildrenCount} children; ceiling is ${maxChildren}.` });
        }
      }

      // Child lifetime may not exceed the parent's. The raw TTL expiry
      // is checked before clamping so an over-long TTL is rejected, while
      // the computed expiry still carries the parent ceiling forward.
      const parentExpiry = earliestExpiry([parentRecord.expiresAt, parentEffective.expiresAt]);
      if (parentExpiry) {
        const rawExpiry = addSeconds(now, ttlSeconds);
        if (rawExpiry > parentExpiry) {
          errors.push({ code: "PARENT_EXPIRY_CEILING", message: `Child TTL would outlive the parent (expiry ceiling ${parentExpiry}); TTL must be reduced.` });
        }
        expiresAt = earliestExpiry([expiresAt, parentExpiry]) ?? expiresAt;
      }
    }
  } else if (finalTraits.has("subagent_creator")
    && (input.creatorEntitlements?.permissions?.canCreateChildren !== true
      || input.familyPermissions?.canCreateChildren !== true)) {
    errors.push({
      code: "SUBAGENT_CREATOR_ENTITLEMENT_REQUIRED",
      message: "A root agent may carry subagent_creator only when trusted creator and family permissions explicitly allow it.",
    });
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
  if (!input || typeof input !== "object" || typeof input.targetAgentId !== "string" || input.targetAgentId.trim() === "") {
    return { code: "SELF_POLICY_GUARD_INPUT_INVALID", message: "A valid target agent id is required." };
  }
  if (input.actorAgentId == null) return null;
  if (typeof input.actorAgentId !== "string" || input.actorAgentId.trim() === ""
    || (input.ancestry !== undefined
      && (!Array.isArray(input.ancestry) || input.ancestry.some((agentId) => typeof agentId !== "string" || agentId.trim() === "")))) {
    return { code: "SELF_POLICY_GUARD_INPUT_INVALID", message: "Actor and ancestry identifiers must be valid strings." };
  }
  if (input.actorAgentId === input.targetAgentId) {
    return { code: "SELF_POLICY_MODIFICATION_DENIED", message: "An agent may not modify its own policy." };
  }
  if ((input.ancestry ?? []).includes(input.targetAgentId)) {
    return { code: "SELF_POLICY_MODIFICATION_DENIED", message: "An agent may not modify the policy of its ancestors." };
  }
  return null;
}
