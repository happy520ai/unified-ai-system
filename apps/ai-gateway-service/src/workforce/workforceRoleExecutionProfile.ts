import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceRoleExecutionBinding, WorkforceRoleExecutionProfile,
  WorkforceRoleExecutionProfileInput } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";

const PROFILE_KEYS = ["version", "mode", "profileId", "maxTotalRequests", "maxConcurrentRoles", "bindings"];
const BINDING_KEYS = ["roleId", "employeeId", "providerId", "modelId", "maxRequests",
  "maxInputTokens", "maxOutputTokens", "timeoutMs"];

/** Pure contract construction. It neither enables execution nor reads runtime configuration. */
export function freezeWorkforceRoleExecutionProfile(value: unknown): WorkforceRoleExecutionProfile {
  const source = exactRecord(value, PROFILE_KEYS);
  if (source.version !== 1 || source.mode !== "gateway-llm-required"
    || !Array.isArray(source.bindings) || source.bindings.length < 1 || source.bindings.length > 128) throw invalidProfile();
  const bindings = source.bindings.map((value): WorkforceRoleExecutionBinding => {
    const binding = exactRecord(value, BINDING_KEYS);
    return Object.freeze({
      roleId: identifier(binding.roleId), employeeId: identifier(binding.employeeId),
      providerId: identifier(binding.providerId, true), modelId: identifier(binding.modelId, true),
      maxRequests: integer(binding.maxRequests, 1, 5),
      maxInputTokens: integer(binding.maxInputTokens, 1, 1_000_000),
      maxOutputTokens: integer(binding.maxOutputTokens, 1, 1_000_000),
      timeoutMs: integer(binding.timeoutMs, 1_000, 3_600_000),
    });
  }).sort((left, right) => left.roleId < right.roleId ? -1 : left.roleId > right.roleId ? 1 : 0);
  if (new Set(bindings.map((binding) => binding.roleId)).size !== bindings.length) throw invalidProfile();
  const profile: WorkforceRoleExecutionProfileInput = {
    version: 1, mode: "gateway-llm-required", profileId: identifier(source.profileId),
    maxTotalRequests: integer(source.maxTotalRequests, bindings.length,
      bindings.reduce((sum, binding) => sum + binding.maxRequests, 0)),
    maxConcurrentRoles: integer(source.maxConcurrentRoles, 1, Math.min(8, bindings.length)),
    bindings: Object.freeze(bindings),
  };
  return Object.freeze({ ...profile, profileHash: digest(profile) });
}

/** Durable reviews must contain the complete exact profile, not just a trusted-looking hash. */
export function readFrozenWorkforceRoleExecutionProfile(value: unknown): WorkforceRoleExecutionProfile {
  const source = exactRecord(value, [...PROFILE_KEYS, "profileHash"]);
  const { profileHash, ...input } = source;
  const profile = freezeWorkforceRoleExecutionProfile(input);
  if (profileHash !== profile.profileHash) throw invalidProfile();
  return profile;
}

function digest(profile: WorkforceRoleExecutionProfileInput): string {
  return `sha256:${createHash("sha256").update(stableStringify(profile), "utf8").digest("hex")}`;
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidProfile();
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) throw invalidProfile();
  return value as Record<string, unknown>;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw invalidProfile();
  return Number(value);
}

function identifier(value: unknown, modelIdentifier = false): string {
  const pattern = modelIdentifier ? /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u : /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
  if (typeof value !== "string" || !pattern.test(value) || containsSensitivePublicationText(value)) throw invalidProfile();
  return value;
}

function invalidProfile(): Error & { code: string; category: string; retryable: false } {
  return Object.assign(new Error("Workforce role execution profile is malformed, unsafe, or inconsistent."), {
    code: "WORKFORCE_ROLE_EXECUTION_PROFILE_INVALID", category: "configuration", retryable: false as const,
  });
}
