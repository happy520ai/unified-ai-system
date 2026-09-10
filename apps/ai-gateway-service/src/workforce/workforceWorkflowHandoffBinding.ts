import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceWorkflowHandoffReview } from "@unified-ai-system/shared-contracts";
import { readWorkforceWorkflowHandoffReview } from "./workforceWorkflowHandoffProfile.ts";

export type WorkflowHandoffMetadata = { version: 1; agentId: string; planId: string; planDigest: string; review: WorkforceWorkflowHandoffReview };
export type WorkflowHandoffOrigin = {
  version: 1; workflowId: string; executionId: string; planId: string; planDigest: string;
  agentId: string; agentRunId: string | null; taskId: string; roleId: string;
  tenantFingerprint: string; subjectFingerprint: string; reviewHash: string; claimFingerprint: string;
};
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
export function readWorkflowHandoffOrigin(value: unknown): WorkflowHandoffOrigin {
  const data = value as WorkflowHandoffOrigin;
  if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).sort().join() !== [...ORIGIN_KEYS].sort().join()
    || data.version !== 1 || !/^wfh_[a-f0-9]{64}$/u.test(data.workflowId)
    || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(data.agentId)
    || data.agentRunId !== null && (typeof data.agentRunId !== "string" || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(data.agentRunId))
    || ![data.executionId, data.planId, data.taskId, data.roleId].every(id => typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u.test(id))
    || ![data.planDigest, data.tenantFingerprint, data.subjectFingerprint, data.claimFingerprint].every(hash => typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash))
    || typeof data.reviewHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(data.reviewHash)
    || data.workflowId !== `wfh_${workflowHandoffHash(["workforce-workflow-v1", data.executionId, data.agentId, data.reviewHash])}`) {
    throw workflowHandoffError("WORKFORCE_WORKFLOW_ORIGIN_INVALID", "Workflow origin does not match a complete task binding.");
  }
  return Object.freeze({ ...data });
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
  return origin;
}
