// T-094 leaf: the governed proxy operations registry and scope-evaluation helpers extracted
// from toolProxy.ts (B-20 A-prime closure certified by .pm/t094-g1-closure-r3.json), breaking
// the toolProxy <-> workforceCodeDeliveryRuntime runtime cycle.
import type { AgentToolApprovalReview, EffectiveAgentPolicy } from "@unified-ai-system/shared-contracts";
import { evaluateResourceScope, getEffectiveToolDecision } from "@unified-ai-system/policy-engine";
import type { AgentGovernanceSandboxAttestation, AgentGovernanceToolProxy } from "./toolProxy.types.ts";

export type WorkforceProxyOperations = Readonly<Pick<AgentGovernanceToolProxy, "enforce" | "enforceResult">>;
export const workforceProxyOperations = new WeakMap<object, WorkforceProxyOperations>();

/** Fixed operations from an actual enforcing proxy; its presence alone grants no code authority. */
export function readWorkforceCodeDeliveryToolProxy(value: unknown): WorkforceProxyOperations | null {
  return value && typeof value === "object" ? workforceProxyOperations.get(value) ?? null : null;
}

export function effectiveGovernedToolDecision(policy: EffectiveAgentPolicy, toolName: string) {
  const configured = getEffectiveToolDecision(policy, toolName);
  return configured === "allow" && policy.requirements.approvalRequired === true
    ? "require_approval" : configured;
}

export function evaluateGovernedToolScope(
  policy: EffectiveAgentPolicy, tenantId: string, params: unknown,
  resourceContext?: Parameters<AgentGovernanceToolProxy["enforce"]>[0]["resourceContext"],
) {
  return evaluateResourceScope(policy.scope, buildScopeCheckRequest(tenantId, params, policy.scope, resourceContext));
}

function buildScopeCheckRequest(
  tenantId: string,
  params: unknown,
  scope: EffectiveAgentPolicy["scope"],
  trusted?: {
    resourceKeys?: Record<string, string>;
    rangeValues?: Record<string, string>;
    resources?: string[];
    outputFields?: string[];
    approvalReview?: Omit<AgentToolApprovalReview, "policyHash">;
    sandboxAttestation?: AgentGovernanceSandboxAttestation;
  },
) {
  const record = params && typeof params === "object" && !Array.isArray(params)
    ? params as Record<string, unknown>
    : {};
  const declaredResourceKeys = asStringRecord(record.resourceKeys);
  const declaredRangeValues = asStringRecord(record.rangeValues);
  const resourceKeys: Record<string, string> = { ...declaredResourceKeys, ...(trusted?.resourceKeys ?? {}) };
  const rangeValues: Record<string, string> = { ...declaredRangeValues, ...(trusted?.rangeValues ?? {}) };
  for (const dimension of Object.keys(scope?.allowedResourceSets ?? {})) {
    const value = readDimension(record, dimension);
    if (value !== null) resourceKeys[dimension] = value;
  }
  for (const dimension of Object.keys(scope?.resourceRanges ?? {})) {
    const value = readDimension(record, dimension);
    if (value !== null) rangeValues[dimension] = value;
  }
  const resources = new Set<string>();
  for (const key of ["resource", "resourceId", "path", "file_path", "uri", "url", "database", "table"]) {
    const value = record[key];
    if (typeof value === "string" && value !== "") resources.add(value);
  }
  for (const value of Array.isArray(record.resources) ? record.resources : []) {
    if (typeof value === "string" && value !== "") resources.add(value);
  }
  for (const value of trusted?.resources ?? []) {
    if (typeof value === "string" && value !== "") resources.add(value);
  }
  const requestedFields = [record.outputFields, record.fields, record.select]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value): value is string => typeof value === "string" && value !== "");
  requestedFields.push(...(trusted?.outputFields ?? []).filter((value) => typeof value === "string" && value !== ""));
  return {
    tenantId,
    resourceKeys,
    rangeValues,
    resources: [...resources],
    outputFields: requestedFields,
  };
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

function readDimension(record: Record<string, unknown>, dimension: string): string | null {
  const direct = record[dimension];
  if (typeof direct === "string" && direct !== "") return direct;
  const nested = record.resource;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const value = (nested as Record<string, unknown>)[dimension];
    if (typeof value === "string" && value !== "") return value;
  }
  return null;
}
