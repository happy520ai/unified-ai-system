/**
 * Runtime scope and usage evaluation helpers.
 *
 * These are the per-call checks the Tool Proxy runs after signature and
 * decision checks: tenant/resource scope membership and usage ceilings.
 * Pure functions — the proxy supplies the live counters.
 */

import type {
  AgentUsageCounters,
  PolicyLimits,
  PolicyResourceScope,
} from "@unified-ai-system/shared-contracts";

export interface ScopeCheckRequest {
  tenantId?: string;
  /** Concrete resource dimension values, e.g. { region: "eu-west-1" }. */
  resourceKeys?: Record<string, string>;
  /** Values to bound-check against ranged scopes, e.g. { order_date: "2026-08-15" }. */
  rangeValues?: Record<string, string>;
  /** Resource identifiers the call would touch. */
  resources?: string[];
  /** Output fields the result would expose. */
  outputFields?: string[];
}

export interface ScopeCheckResult {
  allowed: boolean;
  reason?: string;
}

/** Fail-closed scope evaluation against the compiled policy scope. */
export function evaluateResourceScope(
  scope: PolicyResourceScope | undefined | null,
  request: ScopeCheckRequest,
): ScopeCheckResult {
  if (!scope || typeof scope !== "object") return { allowed: true };

  if (Array.isArray(scope.allowedTenants) && scope.allowedTenants.length >= 0) {
    if (typeof request.tenantId !== "string" || request.tenantId === "") {
      return { allowed: false, reason: "TENANT_ID_REQUIRED" };
    }
    if (!scope.allowedTenants.includes(request.tenantId)) {
      return { allowed: false, reason: "TENANT_OUT_OF_SCOPE" };
    }
  }

  for (const [dimension, value] of Object.entries(request.resourceKeys ?? {})) {
    const allowedSet = scope.allowedResourceSets?.[dimension];
    if (Array.isArray(allowedSet) && !allowedSet.includes(value)) {
      return { allowed: false, reason: `RESOURCE_OUT_OF_SCOPE:${dimension}` };
    }
  }

  for (const [dimension, value] of Object.entries(request.rangeValues ?? {})) {
    const range = scope.resourceRanges?.[dimension];
    if (!range) continue;
    if (typeof range.from === "string" && value < range.from) {
      return { allowed: false, reason: `RESOURCE_RANGE_OUT_OF_SCOPE:${dimension}` };
    }
    if (typeof range.to === "string" && value > range.to) {
      return { allowed: false, reason: `RESOURCE_RANGE_OUT_OF_SCOPE:${dimension}` };
    }
  }

  const deniedResources = scope.deniedResources ?? [];
  if (deniedResources.length > 0) {
    const hit = (request.resources ?? []).find((resource) => deniedResources.includes(resource));
    if (hit !== undefined) {
      return { allowed: false, reason: `RESOURCE_DENIED:${hit}` };
    }
  }

  const deniedFields = scope.deniedOutputFields ?? [];
  if (deniedFields.length > 0) {
    const hit = (request.outputFields ?? []).find((field) => deniedFields.includes(field));
    if (hit !== undefined) {
      return { allowed: false, reason: `OUTPUT_FIELD_DENIED:${hit}` };
    }
  }

  return { allowed: true };
}

/** Usage ceiling check: a call that would exceed a cap is rejected. */
export function checkUsageLimits(
  limits: PolicyLimits | undefined | null,
  counters: AgentUsageCounters,
): ScopeCheckResult {
  const usage = counters ?? { toolCalls: 0, steps: 0, records: 0 };
  if (typeof limits?.maxToolCalls === "number" && usage.toolCalls >= limits.maxToolCalls) {
    return { allowed: false, reason: "TOOL_CALL_LIMIT_REACHED" };
  }
  if (typeof limits?.maxSteps === "number" && usage.steps >= limits.maxSteps) {
    return { allowed: false, reason: "STEP_LIMIT_REACHED" };
  }
  if (typeof limits?.maxRecords === "number" && usage.records >= limits.maxRecords) {
    return { allowed: false, reason: "RECORD_LIMIT_REACHED" };
  }
  return { allowed: true };
}
