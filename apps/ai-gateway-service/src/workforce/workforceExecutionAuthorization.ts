import { createHash } from "node:crypto";

import { AUTONOMY_MODES } from "./autonomyModes.js";

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const WORKFORCE_EXECUTION_SCOPES = Object.freeze({
  EXECUTE: "workforce:execute",
  SANDBOX_MERGE: "workforce:sandbox-merge",
  AUTO_MERGE: "workforce:auto-merge",
});

export interface WorkforceExecutionDescriptor {
  planId: string;
  planDigest: string;
  autonomyMode: string;
  requiredScopes: string[];
}

const PLAN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_CANONICAL_DEPTH = 16;

export function createWorkforceExecutionDescriptor(params: {
  input?: Record<string, unknown>;
  plan: Record<string, unknown>;
  autonomyMode: string;
}): WorkforceExecutionDescriptor {
  const input = params.input ?? {};
  const planId = normalizeWorkforcePlanId(input.planId ?? params.plan.workforceId);
  const requiredScopes = requiredScopesForMode(params.autonomyMode);
  const digestPayload = canonicalize({
    schema: "workforce-execution-approval/v1",
    planId,
    tenantId: typeof input.tenantId === "string" && input.tenantId.trim()
      ? input.tenantId.trim()
      : "default",
    autonomyMode: params.autonomyMode,
    goal: params.plan.goal,
    selectedRoles: params.plan.selectedRoles,
    selectedTemplate: params.plan.selectedTemplate,
    clarificationAnswers: input.clarificationAnswers ?? null,
    context: input.context ?? null,
    operationType: input.operationType ?? null,
  });
  const planDigest = createHash("sha256")
    .update(JSON.stringify(digestPayload), "utf8")
    .digest("hex");

  return Object.freeze({
    planId,
    planDigest,
    autonomyMode: params.autonomyMode,
    requiredScopes: Object.freeze([...requiredScopes]) as unknown as string[],
  });
}

export function normalizeWorkforcePlanId(value: unknown): string {
  if (typeof value !== "string" || !PLAN_ID_PATTERN.test(value.trim())) {
    throw createAuthorizationError(
      "WORKFORCE_PLAN_ID_INVALID",
      "planId must be 1-160 characters using letters, numbers, dot, underscore, colon, or hyphen.",
    );
  }
  return value.trim();
}

export function requiredScopesForMode(autonomyMode: string): string[] {
  if (autonomyMode === AUTONOMY_MODES.CONTROLLED_EXECUTION) {
    return [WORKFORCE_EXECUTION_SCOPES.EXECUTE];
  }
  if (autonomyMode === AUTONOMY_MODES.SANDBOX_MERGE) {
    return [
      WORKFORCE_EXECUTION_SCOPES.EXECUTE,
      WORKFORCE_EXECUTION_SCOPES.SANDBOX_MERGE,
    ];
  }
  if (autonomyMode === AUTONOMY_MODES.SANDBOX_MERGE_AUTO) {
    return [
      WORKFORCE_EXECUTION_SCOPES.EXECUTE,
      WORKFORCE_EXECUTION_SCOPES.SANDBOX_MERGE,
      WORKFORCE_EXECUTION_SCOPES.AUTO_MERGE,
    ];
  }
  return [];
}

function canonicalize(value: unknown, depth = 0): JsonValue {
  if (depth > MAX_CANONICAL_DEPTH) {
    throw createAuthorizationError(
      "WORKFORCE_APPROVAL_INPUT_TOO_DEEP",
      "Execution approval input exceeds the maximum nesting depth.",
    );
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw createAuthorizationError("WORKFORCE_APPROVAL_INPUT_INVALID", "Approval input contains a non-finite number.");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== undefined) output[key] = canonicalize(child, depth + 1);
    }
    return output;
  }
  throw createAuthorizationError(
    "WORKFORCE_APPROVAL_INPUT_INVALID",
    "Execution approval input must contain JSON-compatible values only.",
  );
}

function createAuthorizationError(code: string, message: string): Error & { code: string; statusCode: number } {
  return Object.assign(new Error(message), { code, statusCode: 400 });
}
