import type { PolicyLayerContent } from "@unified-ai-system/shared-contracts";
import { stableStringify, validatePolicyLayerContent } from "@unified-ai-system/policy-engine";

const MAX_DRAFT_BYTES = 12 * 1024;
const MAX_DRAFT_DEPTH = 8;
const MAX_DRAFT_NODES = 512;
const MAX_ARRAY_ITEMS = 128;
const MAX_STRING_LENGTH = 512;
const TOP_LEVEL_KEYS = new Set([
  "mandatory", "limits", "capabilityCeiling", "toolRules", "dataRules", "requirements", "permissions",
]);
const NESTED_KEYS = Object.freeze({
  mandatory: new Set([
    "auditRequired", "credentialsExposedToAgent", "crossTenantAccess", "selfPolicyModification",
    "gatewayBypass", "permissionExpansion",
  ]),
  limits: new Set([
    "maxGenerationDepth", "maxChildrenPerAgent", "maxWorkforceRoles", "maxRuntimeSeconds",
    "maxSteps", "maxToolCalls", "maxRecords",
  ]),
  requirements: new Set([
    "auditRequired", "outputRedactionRequired", "approvalRequired", "sandboxRequired", "detailedLoggingRequired",
  ]),
  permissions: new Set(["canCreateChildren", "canWrite", "canSendExternalMessage", "canExecuteCode"]),
  dataRules: new Set([
    "allowedTenants", "allowedResourceSets", "resourceRanges", "deniedResources", "deniedOutputFields",
  ]),
});
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor", "toJSON"]);

export function normalizeModelPolicyDraft(value: unknown): PolicyLayerContent {
  const state = { nodes: 0 };
  assertPlainObject(value, "policyDraft", 0, state);
  assertOnlyKeys(value, TOP_LEVEL_KEYS, "policyDraft");
  for (const key of ["mandatory", "limits", "requirements", "permissions", "dataRules"] as const) {
    const nested = value[key];
    if (nested === undefined) continue;
    assertPlainObject(nested, `policyDraft.${key}`, 1, state);
    assertOnlyKeys(nested, NESTED_KEYS[key], `policyDraft.${key}`);
  }
  if (value.toolRules !== undefined) assertDynamicMap(value.toolRules, "policyDraft.toolRules", state, 1, false);
  if (value.capabilityCeiling !== undefined) {
    assertStringArray(value.capabilityCeiling, "policyDraft.capabilityCeiling", state, 1);
  }
  const dataRules = value.dataRules;
  if (isPlainObject(dataRules)) {
    for (const key of ["allowedTenants", "deniedResources", "deniedOutputFields"] as const) {
      if (dataRules[key] !== undefined) assertStringArray(dataRules[key], `policyDraft.dataRules.${key}`, state, 2);
    }
    if (dataRules.allowedResourceSets !== undefined) {
      assertDynamicMap(dataRules.allowedResourceSets, "policyDraft.dataRules.allowedResourceSets", state, 2, true);
    }
    if (dataRules.resourceRanges !== undefined) {
      assertPlainObject(dataRules.resourceRanges, "policyDraft.dataRules.resourceRanges", 2, state);
      for (const [key, range] of Object.entries(dataRules.resourceRanges)) {
        assertSafeKey(key, "policyDraft.dataRules.resourceRanges");
        assertPlainObject(range, `policyDraft.dataRules.resourceRanges.${key}`, 3, state);
        assertOnlyKeys(range, new Set(["from", "to"]), `policyDraft.dataRules.resourceRanges.${key}`);
        for (const endpoint of [range.from, range.to]) {
          if (endpoint !== undefined) assertBoundedString(endpoint, "resource range endpoint");
        }
      }
    }
  }
  inspectJsonValue(value, "policyDraft", 0, state, new WeakSet());
  const cloned = structuredClone(value) as PolicyLayerContent;
  let encoded: string;
  try {
    encoded = stableStringify(cloned);
  } catch (cause) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID", cause);
  }
  if (Buffer.byteLength(encoded, "utf8") > MAX_DRAFT_BYTES) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_LIMIT_EXCEEDED");
  }
  const validation = validatePolicyLayerContent(cloned, "model-instance-draft");
  if (!validation.valid) throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID");
  return deepFreeze(cloned);
}

function inspectJsonValue(
  value: unknown,
  path: string,
  depth: number,
  state: { nodes: number },
  ancestors: WeakSet<object>,
): void {
  state.nodes += 1;
  if (state.nodes > MAX_DRAFT_NODES || depth > MAX_DRAFT_DEPTH) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_LIMIT_EXCEEDED");
  }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    assertBoundedString(value, path);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID");
    }
    return;
  }
  if (typeof value !== "object" || value === null) throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID");
  if (ancestors.has(value)) throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (!isPlainArray(value) || value.length > MAX_ARRAY_ITEMS) {
        throw draftError("AGENT_MODEL_POLICY_DRAFT_LIMIT_EXCEEDED");
      }
      value.forEach((item, index) => inspectJsonValue(item, `${path}[${index}]`, depth + 1, state, ancestors));
      return;
    }
    assertPlainObject(value, path, depth, state, false);
    for (const [key, child] of Object.entries(value)) {
      assertSafeKey(key, path);
      inspectJsonValue(child, `${path}.${key}`, depth + 1, state, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

function assertDynamicMap(
  value: unknown,
  path: string,
  state: { nodes: number },
  depth: number,
  arraysOnly: boolean,
): void {
  assertPlainObject(value, path, depth, state);
  for (const [key, child] of Object.entries(value)) {
    assertSafeKey(key, path);
    if (arraysOnly) assertStringArray(child, `${path}.${key}`, state, depth + 1);
  }
}

function assertStringArray(value: unknown, path: string, state: { nodes: number }, depth: number): void {
  if (!isPlainArray(value) || value.length > MAX_ARRAY_ITEMS) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_LIMIT_EXCEEDED");
  }
  value.forEach((item) => assertBoundedString(item, path));
  if (depth > MAX_DRAFT_DEPTH) throw draftError("AGENT_MODEL_POLICY_DRAFT_LIMIT_EXCEEDED");
  state.nodes += value.length;
  if (state.nodes > MAX_DRAFT_NODES) throw draftError("AGENT_MODEL_POLICY_DRAFT_LIMIT_EXCEEDED");
}

function assertPlainObject(
  value: unknown,
  _path: string,
  depth: number,
  state: { nodes: number },
  count = true,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value) || depth > MAX_DRAFT_DEPTH || Object.keys(value).length > MAX_ARRAY_ITEMS) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID");
  }
  if (count) {
    state.nodes += 1;
    if (state.nodes > MAX_DRAFT_NODES) throw draftError("AGENT_MODEL_POLICY_DRAFT_LIMIT_EXCEEDED");
  }
  for (const key of Object.keys(value)) assertSafeKey(key, "policyDraft");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => (
    descriptor.enumerable === true && descriptor.get === undefined && descriptor.set === undefined
  ));
}

function isPlainArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || Object.getOwnPropertySymbols(value).length > 0) return false;
  const ownKeys = Reflect.ownKeys(value).filter((key) => key !== "length");
  if (ownKeys.length !== value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || descriptor.enumerable !== true || descriptor.get !== undefined
      || descriptor.set !== undefined || !Object.hasOwn(descriptor, "value")) return false;
  }
  return true;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: Set<string>, _path: string): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_UNKNOWN_FIELD");
  }
}

function assertSafeKey(key: string, _path: string): void {
  if (!key || key.length > 256 || FORBIDDEN_KEYS.has(key) || /[\u0000-\u001f\u007f]/u.test(key)) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID");
  }
}

function assertBoundedString(value: unknown, _path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_STRING_LENGTH
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw draftError("AGENT_MODEL_POLICY_DRAFT_INVALID");
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function draftError(code: string, cause?: unknown): Error {
  return Object.assign(
    new Error("Agent model PolicyDraft was invalid or exceeded its safety bounds.", cause === undefined ? undefined : { cause }),
    { name: code, code },
  );
}
