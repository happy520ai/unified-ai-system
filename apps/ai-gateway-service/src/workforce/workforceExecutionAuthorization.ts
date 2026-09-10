import { createHash } from "node:crypto";

import { AUTONOMY_MODES } from "./autonomyModes.js";
import type { WorkforceCodeDeliveryReadiness, WorkforceCodeDeliveryReview, WorkforceRoleExecutionProfile, WorkforceSelectionDecision, WorkforceWorkflowHandoffReview } from "@unified-ai-system/shared-contracts";
import { readWorkforceWorkflowHandoffReview } from "./workforceWorkflowHandoffProfile.ts";
import { readFrozenWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { readFrozenWorkforceSelectionReview } from "./workforceSelectionReview.ts";
import { readWorkforceCodeDeliveryReview } from "./workforceCodeDeliveryProfile.ts";

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
  roleExecution?: WorkforceRoleExecutionProfile;
  selectionReview?: WorkforceSelectionDecision;
  codeDelivery?: WorkforceCodeDeliveryReview;
  workflowHandoff?: WorkforceWorkflowHandoffReview;
  /** Display-only projection from describeExecution, never included in the approval digest. */
  codeDeliveryReadiness?: WorkforceCodeDeliveryReadiness;
}

const PLAN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_CANONICAL_DEPTH = 16;

export function createWorkforceExecutionDescriptor(params: {
  input?: Record<string, unknown>;
  plan: Record<string, unknown>;
  autonomyMode: string;
  /** Server-owned profile; never read from input.roleExecution or other request JSON. */
  roleExecution?: WorkforceRoleExecutionProfile;
  /** Only the server's frozen selection context, never input.selectionReview. */
  selectionReview?: WorkforceSelectionDecision;
  /** Server-configured review only; input.codeDelivery is merely a selector. */
  codeDelivery?: WorkforceCodeDeliveryReview;
  workflowHandoff?: WorkforceWorkflowHandoffReview;
}): WorkforceExecutionDescriptor {
  const input = params.input ?? {};
  const planId = normalizeWorkforcePlanId(input.planId ?? params.plan.workforceId);
  const requiredScopes = requiredScopesForMode(params.autonomyMode);
  const roleExecution = params.roleExecution === undefined
    ? undefined : readFrozenWorkforceRoleExecutionProfile(params.roleExecution);
  const selectionReview = params.selectionReview === undefined
    ? undefined : readFrozenWorkforceSelectionReview(params.selectionReview, roleExecution);
  const codeDelivery = params.codeDelivery === undefined
    ? undefined : readWorkforceCodeDeliveryReview(params.codeDelivery, roleExecution);
  const workflowHandoff = params.workflowHandoff === undefined ? undefined : readWorkforceWorkflowHandoffReview(params.workflowHandoff);
  if (workflowHandoff && (params.plan.goal !== workflowHandoff.goal || !Array.isArray(params.plan.selectedRoles)
    || !params.plan.selectedRoles.includes(workflowHandoff.roleId)
    || params.autonomyMode !== AUTONOMY_MODES.DRY_RUN && params.autonomyMode !== AUTONOMY_MODES.CONTROLLED_EXECUTION)) {
    throw createAuthorizationError("WORKFORCE_WORKFLOW_HANDOFF_INVALID", "The handoff must belong to this controlled execution plan.");
  }
  if (codeDelivery && params.autonomyMode !== AUTONOMY_MODES.DRY_RUN
    && params.autonomyMode !== AUTONOMY_MODES.CONTROLLED_EXECUTION) {
    throw createAuthorizationError("WORKFORCE_CODE_DELIVERY_BINDING_INVALID", "Code delivery does not support sandbox merge modes.");
  }
  if (selectionReview && (!Array.isArray(params.plan.selectedRoles)
    || JSON.stringify([...params.plan.selectedRoles].sort()) !== JSON.stringify(selectionReview.roleIds))) {
    throw createAuthorizationError("WORKFORCE_SELECTION_REVIEW_INVALID", "The selected roles must match the complete execution plan.");
  }
  const digestPayload = canonicalize({
    schema: workflowHandoff ? "workforce-execution-approval/v5" : codeDelivery ? "workforce-execution-approval/v4" : selectionReview ? "workforce-execution-approval/v3" : roleExecution ? "workforce-execution-approval/v2" : "workforce-execution-approval/v1",
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
    ...(roleExecution ? { roleExecution } : {}),
    ...(selectionReview ? { selectionReview } : {}),
    ...(codeDelivery ? { codeDelivery } : {}),
    ...(workflowHandoff ? { workflowHandoff } : {}),
  });
  const planDigest = createHash("sha256")
    .update(JSON.stringify(digestPayload), "utf8")
    .digest("hex");

  return Object.freeze({
    planId,
    planDigest,
    autonomyMode: params.autonomyMode,
    requiredScopes: Object.freeze([...requiredScopes]) as unknown as string[],
    ...(roleExecution ? { roleExecution } : {}),
    ...(selectionReview ? { selectionReview } : {}),
    ...(codeDelivery ? { codeDelivery } : {}),
    ...(workflowHandoff ? { workflowHandoff } : {}),
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
