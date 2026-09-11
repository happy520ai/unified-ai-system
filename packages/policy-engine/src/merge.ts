/**
 * Deterministic merge rules for layered policy content.
 *
 * - tool decisions: max strictness (see decisionAlgebra)
 * - numeric limits: minimum across layers
 * - expiry: earliest across layers
 * - allowed sets (tenants, resources): intersection
 * - denied sets (resources, output fields): union
 * - safety requirements: OR (any layer requiring a safeguard enables it)
 * - permission booleans: AND (every expressing layer must allow; default closed)
 *
 * Every function is pure; `undefined` inputs mean "this layer does not
 * constrain this dimension".
 */

import type {
  EffectivePolicyMandatoryRules,
  PolicyLayerContent,
  PolicyLimits,
  PolicyMandatoryRules,
  PolicyPermissions,
  PolicyResourceRange,
  PolicyResourceScope,
  PolicySafetyRequirements,
} from "@unified-ai-system/shared-contracts";
import { isSafeToolName } from "./decisionAlgebra.ts";

const LIMIT_KEYS = [
  "maxGenerationDepth",
  "maxChildrenPerAgent",
  "maxWorkforceRoles",
  "maxRuntimeSeconds",
  "maxSteps",
  "maxToolCalls",
  "maxRecords",
] as const;

/** Numeric ceilings merge by taking the minimum of every expressed value. */
export function mergeLimits(layers: Array<PolicyLimits | undefined | null>): PolicyLimits {
  const merged: PolicyLimits = {};
  for (const key of LIMIT_KEYS) {
    const values: number[] = [];
    for (const layer of layers) {
      const value = layer?.[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        values.push(value);
      }
    }
    if (values.length > 0) merged[key] = Math.min(...values);
  }
  return merged;
}

/** Lifetimes merge by taking the earliest expiry; null means unconstrained. */
export function earliestExpiry(dates: Array<string | undefined | null>): string | null {
  const valid = dates
    .filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .map((value) => new Date(value).toISOString());
  if (valid.length === 0) return null;
  return valid.reduce((earliest, current) => (current < earliest ? current : earliest));
}

function normalizeSet(values: string[] | undefined | null): string[] | null {
  if (!Array.isArray(values)) return null;
  return Array.from(new Set(values.map((value) => String(value)).filter((value) => value !== "")));
}

/**
 * Intersection over every expressed set. Returns null when no layer
 * constrains the dimension (universe). An expressed-but-empty set yields
 * an empty intersection: nothing is allowed.
 */
export function intersectStringSets(sets: Array<string[] | undefined | null>): string[] | null {
  const expressed = sets.map(normalizeSet).filter((set): set is string[] => set !== null);
  if (expressed.length === 0) return null;
  const [first, ...rest] = expressed;
  const result = new Set(first);
  for (const set of rest) {
    for (const value of result) {
      if (!set.includes(value)) result.delete(value);
    }
  }
  return Array.from(result).sort();
}

/** Union over every expressed set; null when no layer constrains it. */
export function unionStringSets(sets: Array<string[] | undefined | null>): string[] | null {
  const expressed = sets.map(normalizeSet).filter((set): set is string[] => set !== null);
  if (expressed.length === 0) return null;
  return Array.from(new Set(expressed.flat())).sort();
}

/** Capability intersection: requested tools reduced by every expressed ceiling. */
export function intersectCapabilities(
  requested: string[],
  ceilings: Array<string[] | undefined | null>,
): string[] {
  const requestedSet = new Set(requested);
  for (const ceiling of ceilings) {
    const allowed = normalizeSet(ceiling);
    if (allowed === null) continue;
    for (const tool of requestedSet) {
      if (!allowed.includes(tool)) requestedSet.delete(tool);
    }
  }
  return Array.from(requestedSet).sort();
}

function orMerge(values: Array<boolean | undefined | null>): boolean | undefined {
  return values.some((value) => value === true) ? true : undefined;
}

function andMerge(values: Array<boolean | undefined | null>): boolean | undefined {
  const expressed = values.filter((value): value is boolean => typeof value === "boolean");
  if (expressed.length === 0) return false;
  return expressed.every((value) => value === true);
}

/** Safety safeguards merge with OR: one requiring layer is enough. */
export function mergeSafetyRequirements(
  layers: Array<PolicySafetyRequirements | undefined | null>,
): PolicySafetyRequirements {
  return {
    auditRequired: orMerge(layers.map((layer) => layer?.auditRequired)),
    outputRedactionRequired: orMerge(layers.map((layer) => layer?.outputRedactionRequired)),
    approvalRequired: orMerge(layers.map((layer) => layer?.approvalRequired)),
    sandboxRequired: orMerge(layers.map((layer) => layer?.sandboxRequired)),
    detailedLoggingRequired: orMerge(layers.map((layer) => layer?.detailedLoggingRequired)),
  };
}

/**
 * Permission booleans merge with AND across expressed layers. If no layer
 * grants a permission, the materialized effective value is false.
 */
export function mergePermissions(
  layers: Array<PolicyPermissions | undefined | null>,
): PolicyPermissions {
  return {
    canCreateChildren: andMerge(layers.map((layer) => layer?.canCreateChildren)),
    canWrite: andMerge(layers.map((layer) => layer?.canWrite)),
    canSendExternalMessage: andMerge(layers.map((layer) => layer?.canSendExternalMessage)),
    canExecuteCode: andMerge(layers.map((layer) => layer?.canExecuteCode)),
  };
}

function denyWins(
  values: Array<"allow" | "deny" | undefined | null>,
): "allow" | "deny" {
  const expressed = values.filter(
    (value): value is "allow" | "deny" => value === "allow" || value === "deny",
  );
  if (expressed.length === 0 || expressed.some((value) => value === "deny")) return "deny";
  return "allow";
}

/**
 * Mandatory assertions are materialized into a closed effective snapshot.
 * Deny wins for escape hatches; credentials are hidden unless every
 * expressing layer explicitly says otherwise; auditing defaults on.
 */
export function mergeMandatoryRules(
  layers: Array<PolicyMandatoryRules | EffectivePolicyMandatoryRules | undefined | null>,
): EffectivePolicyMandatoryRules {
  const auditValues = layers
    .map((layer) => layer?.auditRequired)
    .filter((value): value is boolean => typeof value === "boolean");
  return {
    auditRequired: auditValues.length === 0 || auditValues.some((value) => value === true),
    credentialsExposedToAgent: false,
    crossTenantAccess: denyWins(layers.map((layer) => layer?.crossTenantAccess)),
    selfPolicyModification: denyWins(layers.map((layer) => layer?.selfPolicyModification)),
    gatewayBypass: denyWins(layers.map((layer) => layer?.gatewayBypass)),
    permissionExpansion: denyWins(layers.map((layer) => layer?.permissionExpansion)),
  };
}

function intersectRanges(ranges: Array<PolicyResourceRange | undefined | null>, key: string): PolicyResourceRange | undefined {
  const expressed = ranges.filter((range): range is PolicyResourceRange => Boolean(range));
  if (expressed.length === 0) return undefined;
  const froms = expressed.map((range) => range.from).filter((value): value is string => typeof value === "string");
  const tos = expressed.map((range) => range.to).filter((value): value is string => typeof value === "string");
  const merged: PolicyResourceRange = {};
  // Tightest window: latest start, earliest end. A window whose start is
  // later than its end permits nothing; consumers treat it as deny-all.
  if (froms.length > 0) merged.from = froms.reduce((max, current) => (current > max ? current : max));
  if (tos.length > 0) merged.to = tos.reduce((min, current) => (current < min ? current : min));
  if (merged.from === undefined && merged.to === undefined) return undefined;
  void key;
  return merged;
}

function collectKeys(sources: Array<Record<string, unknown> | undefined | null>): string[] {
  const keys = new Set<string>();
  for (const source of sources) {
    if (source && typeof source === "object") {
      for (const key of Object.keys(source)) {
        if (isSafeToolName(key)) keys.add(key);
      }
    }
  }
  return Array.from(keys).sort();
}

/** Resource scopes merge dimension by dimension: allow ∩, deny ∪. */
export function mergeResourceScopes(
  layers: Array<PolicyResourceScope | undefined | null>,
): PolicyResourceScope {
  const merged: PolicyResourceScope = {};
  const allowedTenants = intersectStringSets(layers.map((layer) => layer?.allowedTenants));
  if (allowedTenants !== null) merged.allowedTenants = allowedTenants;

  const resourceSetKeys = collectKeys(layers.map((layer) => layer?.allowedResourceSets));
  if (resourceSetKeys.length > 0) {
    const allowedResourceSets = Object.create(null) as Record<string, string[]>;
    for (const key of resourceSetKeys) {
      const intersection = intersectStringSets(layers.map((layer) => {
        const sets = layer?.allowedResourceSets;
        return sets && Object.hasOwn(sets, key) ? sets[key] : undefined;
      }));
      if (intersection !== null) allowedResourceSets[key] = intersection;
    }
    if (Object.keys(allowedResourceSets).length > 0) merged.allowedResourceSets = allowedResourceSets;
  }

  const rangeKeys = collectKeys(layers.map((layer) => layer?.resourceRanges));
  if (rangeKeys.length > 0) {
    const resourceRanges = Object.create(null) as Record<string, PolicyResourceRange>;
    for (const key of rangeKeys) {
      const range = intersectRanges(layers.map((layer) => {
        const ranges = layer?.resourceRanges;
        return ranges && Object.hasOwn(ranges, key) ? ranges[key] : undefined;
      }), key);
      if (range !== undefined) resourceRanges[key] = range;
    }
    if (Object.keys(resourceRanges).length > 0) merged.resourceRanges = resourceRanges;
  }

  const deniedResources = unionStringSets(layers.map((layer) => layer?.deniedResources));
  if (deniedResources !== null) merged.deniedResources = deniedResources;
  const deniedOutputFields = unionStringSets(layers.map((layer) => layer?.deniedOutputFields));
  if (deniedOutputFields !== null) merged.deniedOutputFields = deniedOutputFields;
  return merged;
}

/** Extract `dataRules` scopes from a list of layer contents. */
export function scopesOf(
  layers: Array<PolicyLayerContent | undefined | null>,
): Array<PolicyResourceScope | undefined> {
  return layers.map((layer) => layer?.dataRules);
}
