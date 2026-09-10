import { stableStringify } from "@unified-ai-system/policy-engine";
import { assertWorkforceCodeTaskFence } from "../workforce/workforceDagExecutor.ts";
import { assertWorkflowHandoffOrigin, readWorkflowHandoffMetadata, readWorkflowHandoffOrigin, workflowHandoffError,
  workflowHandoffHash, workflowHandoffOwner, workflowHandoffRequest, type WorkflowHandoffMetadata, type WorkflowHandoffOrigin } from "../workforce/workforceWorkflowHandoffBinding.ts";
import type { WorkflowRunInspection } from "@unified-ai-system/shared-contracts";
import type { WorkflowExecutionCallbacks } from "./durableWorkflowRunStore.ts";

type Identity = { tenantId: string; userId: string };
type Data = Record<string, any>;
type Bound = { origin: WorkflowHandoffOrigin; request: Data; used: boolean; assertActive(): Promise<unknown> };

/** Private capabilities owned by one concrete local workflow service. No JSON flag can create one. */
export function createWorkflowHandoffContexts(options: {
  outputRootHash: string;
  inspect(workflowId: string, identity: Identity): WorkflowRunInspection;
}) {
  const contexts = new WeakMap<object, Bound>(), usedFences = new WeakSet<object>();
  const identityOf = (identity: Identity) => {
    if (!identity || typeof identity.tenantId !== "string" || !identity.tenantId || typeof identity.userId !== "string" || !identity.userId) {
      throw workflowHandoffError("WORKFORCE_WORKFLOW_OWNER_REQUIRED", "A workflow handoff requires the authenticated task owner.", 403);
    }
    return { tenantId: identity.tenantId, userId: identity.userId };
  };
  const metadataOf = (value: WorkflowHandoffMetadata) => {
    const metadata = readWorkflowHandoffMetadata(value);
    if (metadata.review.outputRootHash !== options.outputRootHash) throw workflowHandoffError("WORKFORCE_WORKFLOW_ROOT_CHANGED", "The reviewed workflow output root changed.");
    return metadata;
  };
  const register = (bound: Omit<Bound, "used">) => {
    const context = Object.freeze({}); contexts.set(context, { ...bound, used: false });
    return { context, origin: bound.origin, request: structuredClone(bound.request) };
  };
  return {
    async initial(input: { executionId: string; metadata: WorkflowHandoffMetadata; identity: Identity; taskId: string;
      agentRunId: string | null; taskFence: object; agentFence: unknown }) {
      const identity = identityOf(input.identity), metadata = metadataOf(input.metadata);
      const request = workflowHandoffRequest(input.executionId, metadata);
      const expected = { executionId: input.executionId, taskId: input.taskId, roleId: metadata.review.roleId,
        agentId: metadata.agentId, agentRunId: input.agentRunId ?? "", agentFence: input.agentFence };
      const assertActive = () => assertWorkforceCodeTaskFence(input.taskFence, expected, "commit");
      await assertActive();
      if (usedFences.has(input.taskFence)) throw workflowHandoffError("WORKFORCE_WORKFLOW_CLAIM_REUSED", "This task claim already handed off its workflow.", 403);
      usedFences.add(input.taskFence);
      const origin = readWorkflowHandoffOrigin({ version: 1, workflowId: request.workflowId,
        executionId: input.executionId, planId: metadata.planId, planDigest: metadata.planDigest, agentId: metadata.agentId,
        agentRunId: input.agentRunId, taskId: input.taskId, roleId: metadata.review.roleId,
        tenantFingerprint: workflowHandoffOwner("tenant", identity.tenantId), subjectFingerprint: workflowHandoffOwner("subject", identity.userId),
        reviewHash: metadata.review.reviewHash, claimFingerprint: workflowHandoffHash((input.taskFence as { fencingToken?: string }).fencingToken) });
      return register({ origin, request, assertActive });
    },
    recovery(input: { executionId: string; metadata: WorkflowHandoffMetadata; identity: Identity; workflowId: string; taskId: string;
      assertActive(): Promise<unknown> }) {
      const identity = identityOf(input.identity), metadata = metadataOf(input.metadata);
      const request = workflowHandoffRequest(input.executionId, metadata);
      if (request.workflowId !== input.workflowId || typeof input.assertActive !== "function") {
        throw workflowHandoffError("WORKFORCE_WORKFLOW_RECOVERY_BINDING_INVALID", "Recovery does not match the original handoff.", 403);
      }
      const stored = options.inspect(request.workflowId, identity);
      const origin = assertWorkflowHandoffOrigin(stored.request?.workforceHandoff, { executionId: input.executionId, planId: metadata.planId, metadata, identity });
      if (origin.taskId !== input.taskId || stableStringify(stored.request) !== stableStringify({ goal: request.goal, query: request.query,
        topK: request.topK, sourceIds: request.sourceIds, artifactName: request.artifactName, workforceHandoff: origin })) {
        throw workflowHandoffError("WORKFORCE_WORKFLOW_RECOVERY_BINDING_INVALID", "Recovery must keep the exact original task and frozen workflow input.", 403);
      }
      if (stored.status !== "completed" && (!stored.canResume || stored.outcomeUnknown && stored.resumeAction !== "recheck-governance-only")) {
        throw workflowHandoffError("WORKFORCE_WORKFLOW_RECOVERY_REQUIRED", "The workflow is active or its publication remains unresolved.");
      }
      return register({ origin, request, assertActive: input.assertActive });
    },
    async consume(context: unknown, request: Data, scope: Data, callbacks?: WorkflowExecutionCallbacks) {
      if (context === undefined) return { origin: null, callbacks };
      const bound = context && typeof context === "object" ? contexts.get(context) : undefined;
      if (!bound || bound.used || scope.workflowGovernancePending !== true || scope.governedAgentId !== bound.origin.agentId
        || bound.origin.tenantFingerprint !== workflowHandoffOwner("tenant", scope.tenantId)
        || bound.origin.subjectFingerprint !== workflowHandoffOwner("subject", scope.userId)
        || stableStringify(request) !== stableStringify(bound.request) || !callbacks?.beforePublish || !callbacks.beforeReplay) {
        throw workflowHandoffError("WORKFORCE_WORKFLOW_CONTEXT_INVALID", "The workflow context is missing, reused or belongs to another task.", 403);
      }
      bound.used = true;
      await bound.assertActive();
      return { origin: bound.origin, callbacks: {
        beforePublish: async (material) => {
          await bound.assertActive();
          const admitted = await callbacks.beforePublish(material);
          return { ...admitted, assertActive: async () => { await admitted.assertActive(); await bound.assertActive(); } };
        },
        beforeReplay: async (material) => { await bound.assertActive(); await callbacks.beforeReplay(material); await bound.assertActive(); },
      } satisfies WorkflowExecutionCallbacks };
    },
  };
}
