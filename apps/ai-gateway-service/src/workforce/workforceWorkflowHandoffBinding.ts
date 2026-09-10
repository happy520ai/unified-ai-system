import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceWorkflowHandoffReview, WorkforceHookPayloads, WorkforceHookReceipt } from "@unified-ai-system/shared-contracts";
import { readWorkforceWorkflowHandoffReview } from "./workforceWorkflowHandoffProfile.ts";
import { readWorkforceHookReceipt } from "./workforceLifecycleHooks.ts";

export type WorkflowHandoffMetadata = { version: 1; agentId: string; planId: string; planDigest: string; review: WorkforceWorkflowHandoffReview };
type WorkflowHandoffOriginFields = {
  workflowId: string; executionId: string; planId: string; planDigest: string;
  agentId: string; agentRunId: string | null; taskId: string; roleId: string;
  tenantFingerprint: string; subjectFingerprint: string; reviewHash: string; claimFingerprint: string;
};
export type WorkflowHandoffOrigin = WorkflowHandoffOriginFields & ({ version: 1; hookReceipt?: never } | { version: 2; hookReceipt: WorkforceHookReceipt });
export const workflowHandoffHash = (value: unknown) => createHash("sha256").update(stableStringify(value)).digest("hex");
export const workflowHandoffOwner = (kind: "tenant" | "subject", id: string) => workflowHandoffHash(["workforce-workflow-owner-v1", kind, id]);
export function workflowHandoffError(code: string, message: string, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode, category: "governance", retryable: false });
}

export function readWorkflowHandoffMetadata(value: unknown): WorkflowHandoffMetadata {
  const data = value as WorkflowHandoffMetadata;
  if (!data || typeof data !== "object" || Object.keys(data).sort().join() !== "agentId,planDigest,planId,review,version"
    || data.version !== 1 || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(data.agentId) || !/^[a-f0-9]{64}$/u.test(data.planDigest)
    || typeof data.planId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(data.planId)) {
    throw workflowHandoffError("WORKFORCE_WORKFLOW_BINDING_INVALID", "Stored workflow handoff identity is invalid.");
  }
  return Object.freeze({ version: 1, agentId: data.agentId, planId: data.planId, planDigest: data.planDigest, review: readWorkforceWorkflowHandoffReview(data.review) });
}

export function workflowHandoffRequest(executionId: string, metadata: WorkflowHandoffMetadata) {
  const binding = readWorkflowHandoffMetadata(metadata);
  const suffix = workflowHandoffHash(["workforce-workflow-v1", executionId, binding.agentId, binding.review.reviewHash]);
  return Object.freeze({ workflowId: `wfh_${suffix}`, goal: binding.review.goal, query: binding.review.query,
    topK: binding.review.topK, sourceIds: [...binding.review.sourceIds],
    artifactName: `workforce-${binding.review.roleId.slice(0, 32)}-${suffix.slice(0, 24)}.md` });
}

const ORIGIN_KEYS = ["version", "workflowId", "executionId", "planId", "planDigest", "agentId", "agentRunId", "taskId", "roleId", "tenantFingerprint", "subjectFingerprint", "reviewHash", "claimFingerprint"];
/** The hook receipt binds the complete original task origin and its exact guarded payload. */
export function workflowHandoffHookIntent(origin: WorkflowHandoffOrigin, payload: WorkforceHookPayloads["beforeWorkflowRun"]) {
  const original = { ...Object.fromEntries(ORIGIN_KEYS.map(key => [key, origin[key as keyof WorkflowHandoffOrigin]])), version: 1 };
  const requestHash = `sha256:${workflowHandoffHash(["workforce-workflow-hook-request-v1", original, payload])}`;
  return Object.freeze({ kind: "workflow" as const, requestHash,
    operationId: `hkop_${workflowHandoffHash(["workforce-workflow-hook-operation-v1", origin.workflowId, origin.claimFingerprint, requestHash])}` });
}
export function readWorkflowHandoffOrigin(value: unknown): WorkflowHandoffOrigin {
  const data = originRecord(value);
  if ((data.version !== 1 && data.version !== 2) || Object.keys(data).sort().join() !== [...ORIGIN_KEYS, ...(data.version === 2 ? ["hookReceipt"] : [])].sort().join()
    || typeof data.workflowId !== "string" || !/^wfh_[a-f0-9]{64}$/u.test(data.workflowId)
    || typeof data.agentId !== "string" || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(data.agentId)
    || data.agentRunId !== null && (typeof data.agentRunId !== "string" || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(data.agentRunId))
    || ![data.executionId, data.planId, data.taskId, data.roleId].every(id => typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u.test(id))
    || ![data.planDigest, data.tenantFingerprint, data.subjectFingerprint, data.claimFingerprint].every(hash => typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash))
    || typeof data.reviewHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(data.reviewHash)
    || data.workflowId !== `wfh_${workflowHandoffHash(["workforce-workflow-v1", data.executionId, data.agentId, data.reviewHash])}`) {
    throw workflowHandoffError("WORKFORCE_WORKFLOW_ORIGIN_INVALID", "Workflow origin does not match a complete task binding.");
  }
  if (data.version === 1) return Object.freeze({ ...data }) as WorkflowHandoffOrigin;
  try {
    const hookReceipt = readWorkforceHookReceipt(data.hookReceipt), payload = hookReceipt.payload as WorkforceHookPayloads["beforeWorkflowRun"] | null;
    if (hookReceipt.event !== "beforeWorkflowRun" || hookReceipt.outcome !== "passed" || hookReceipt.handlerId !== "workflow.guard" || hookReceipt.access !== "read-only"
      || !payload || payload.planId !== data.planId || payload.workflowId !== data.workflowId || payload.taskId !== data.taskId
      || payload.agentId !== data.agentId || payload.reviewHash !== data.reviewHash) throw new Error();
    const intent = workflowHandoffHookIntent(data as WorkflowHandoffOrigin, payload);
    if (hookReceipt.operationId !== intent.operationId || hookReceipt.requestHash !== intent.requestHash) throw new Error();
    return Object.freeze({ ...data, hookReceipt }) as WorkflowHandoffOrigin;
  } catch { throw workflowHandoffError("WORKFORCE_WORKFLOW_HOOK_RECEIPT_INVALID", "The original workflow hook receipt is invalid or belongs to another handoff.", 403); }
}

export function assertWorkflowHandoffOrigin(value: unknown, expected: {
  executionId: string; planId: string; metadata: WorkflowHandoffMetadata; identity: { tenantId: string; userId: string };
}) {
  const origin = readWorkflowHandoffOrigin(value), metadata = readWorkflowHandoffMetadata(expected.metadata);
  if (origin.executionId !== expected.executionId || origin.planId !== expected.planId || origin.agentId !== metadata.agentId
    || origin.planDigest !== metadata.planDigest || origin.roleId !== metadata.review.roleId || origin.reviewHash !== metadata.review.reviewHash
    || origin.tenantFingerprint !== workflowHandoffOwner("tenant", expected.identity.tenantId)
    || origin.subjectFingerprint !== workflowHandoffOwner("subject", expected.identity.userId)) {
    throw workflowHandoffError("WORKFORCE_WORKFLOW_ORIGIN_MISMATCH", "Workflow belongs to another task, plan, Agent or owner.", 403);
  }
  if (origin.version === 2) {
    const receipt = origin.hookReceipt, payload = receipt.payload as WorkforceHookPayloads["beforeWorkflowRun"];
    if (payload.goal !== metadata.review.goal || payload.outputRootHash !== metadata.review.outputRootHash
      || receipt.tenantFingerprint !== `sha256:${workflowHandoffHash(["workforce-hook-tenant-v1", expected.identity.tenantId])}`
      || receipt.subjectFingerprint !== `sha256:${workflowHandoffHash(["workforce-hook-subject-v1", expected.identity.tenantId, expected.identity.userId])}`) {
      throw workflowHandoffError("WORKFORCE_WORKFLOW_HOOK_RECEIPT_INVALID", "The workflow hook receipt no longer matches its reviewed goal, target or authenticated owner.", 403);
    }
  }
  return origin;
}

function originRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw workflowHandoffError("WORKFORCE_WORKFLOW_ORIGIN_INVALID", "Workflow origin must be complete plain data.");
  }
  const entries = Reflect.ownKeys(value).map(key => {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !ORIGIN_KEYS.includes(key) && key !== "hookReceipt" || !field || !("value" in field) || !field.enumerable) {
      throw workflowHandoffError("WORKFORCE_WORKFLOW_ORIGIN_INVALID", "Workflow origin contains unsupported fields.");
    }
    return [key, field.value];
  });
  return Object.fromEntries(entries);
}
