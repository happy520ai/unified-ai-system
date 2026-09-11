import { executeGovernedWorkflowRun } from "../workflow/governedWorkflowExecution.ts";
import { isLocalWorkflowService } from "../workflow/localWorkflowService.js";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { assertWorkflowHandoffOrigin, readWorkflowHandoffMetadata, workflowHandoffError, workflowHandoffRequest,
  type WorkflowHandoffMetadata } from "./workforceWorkflowHandoffBinding.ts";

type Data = Record<string, any>;
const factories = new WeakSet<object>();
export const isWorkforceWorkflowHandoff = (value: unknown): boolean => Boolean(value && typeof value === "object" && factories.has(value));

/** The existing workflow journal owns results. Parent status joins its immutable task reference to that journal. */
export function createWorkforceWorkflowHandoff(workflowService: Data) {
  const info = workflowService.getWorkforceHandoffInfo?.();
  if (!isLocalWorkflowService(workflowService) || info?.mode !== "single-host-sqlite" || !/^[a-f0-9]{64}$/u.test(info.outputRootHash)
    || ["run", "getRun", "recoverRun", "verifyWorkforceHandoffArtifact", "createWorkforceHandoffContext", "createWorkforceHandoffRecoveryContext"].some(name => typeof workflowService[name] !== "function")) {
    throw workflowHandoffError("WORKFORCE_WORKFLOW_UNAVAILABLE", "The concrete local workflow runtime is required.", 503);
  }
  const inspect = async (input: { executionId: string; metadata: WorkflowHandoffMetadata; identity: Data }): Promise<Data> => {
    const metadata = readWorkflowHandoffMetadata(input.metadata), request = workflowHandoffRequest(input.executionId, metadata);
    let snapshot;
    try { snapshot = workflowService.getRun(request.workflowId, input.identity); }
    catch (error) {
      if ((error as Data)?.code === "WORKFLOW_NOT_FOUND") return { workflowId: request.workflowId, status: "not_observed", taskId: null,
        roleId: metadata.review.roleId, originalPlanId: metadata.planId, originVerified: false, canResume: false, result: null };
      throw error;
    }
    const origin = assertWorkflowHandoffOrigin(snapshot.request?.workforceHandoff, { ...input, metadata, planId: metadata.planId, identity: input.identity as any });
    const expected = { goal: request.goal, query: request.query, topK: request.topK, sourceIds: request.sourceIds, artifactName: request.artifactName, workforceHandoff: origin };
    if (stableStringify(snapshot.request) !== stableStringify(expected)) throw workflowHandoffError("WORKFORCE_WORKFLOW_INPUT_MISMATCH", "The workflow no longer matches its original parent intent.");
    let artifactVerified: boolean | null = null, artifactError: string | null = null;
    if (snapshot.status === "completed" && snapshot.result) {
      try { await workflowService.verifyWorkforceHandoffArtifact(request.workflowId, input.identity); artifactVerified = true; }
      catch (error) { artifactVerified = false; artifactError = (error as Data)?.code ?? "WORKFLOW_ARTIFACT_NOT_VERIFIED"; }
    }
    return { ...snapshot, taskId: origin.taskId, roleId: origin.roleId, originalPlanId: origin.planId,
      originVerified: true, parentExecutionId: origin.executionId, artifactVerified, artifactError,
      result: artifactVerified === true ? snapshot.result : null };
  };
  const verifyResult = (result: Data, request: Data) => {
    if (result?.status !== "completed" || result.workflowId !== request.workflowId || !result.artifact
      || !/^[a-f0-9]{64}$/u.test(result.artifact.sha256) || !Number.isSafeInteger(result.artifact.bytes) || result.artifact.bytes < 1
      || typeof result.artifact.fileName !== "string" || typeof result.artifact.absolutePath !== "string") {
      throw Object.assign(workflowHandoffError("WORKFORCE_WORKFLOW_OUTCOME_UNKNOWN", "Workflow did not return a verified completed artifact.", 503), { outcomeUnknown: true });
    }
    return result;
  };
  const runtime = {
    getInfo: () => ({ implemented: true, runtimeConnected: true, enabledByDefault: false, mode: info.mode, outputRootHash: info.outputRootHash }),
    inspect,
    async run(input: { executionId: string; metadata: WorkflowHandoffMetadata; identity: Data; taskId: string; agentRunId: string | null;
      taskFence: object; agentFence: unknown; governance: Data; signal?: AbortSignal }) {
      const prepared = await workflowService.createWorkforceHandoffContext(input);
      throwIfExecutionAborted(input.signal);
      const result = await executeGovernedWorkflowRun({ governance: input.governance as any, workflowService: workflowService as any,
        identity: input.identity, body: { ...prepared.request, agentId: input.metadata.agentId },
        requestContext: { workflowHandoffContext: prepared.context }, requestId: `${prepared.request.workflowId}-handoff`, signal: input.signal });
      verifyResult(result, prepared.request);
      const observed = await inspect(input);
      if (observed.status !== "completed" || !observed.artifactVerified || stableStringify(observed.result) !== stableStringify(result)) {
        throw Object.assign(workflowHandoffError("WORKFORCE_WORKFLOW_OUTCOME_UNKNOWN", "Completed workflow could not be read back from its original journal.", 503), { outcomeUnknown: true });
      }
      return observed;
    },
    async recover(input: { executionId: string; metadata: WorkflowHandoffMetadata; identity: Data; workflowId: string; taskId: string;
      governance: Data; signal?: AbortSignal }): Promise<Data> {
      const metadata = readWorkflowHandoffMetadata(input.metadata);
      const previous = await inspect(input);
      if (!previous.originVerified || previous.taskId !== input.taskId || previous.workflowId !== input.workflowId) {
        throw workflowHandoffError("WORKFORCE_WORKFLOW_RECOVERY_BINDING_INVALID", "Only the original recorded workflow task can be recovered.", 403);
      }
      if (previous.status === "completed" && !previous.artifactVerified) throw workflowHandoffError("WORKFORCE_WORKFLOW_ARTIFACT_UNAVAILABLE", "The recorded artifact is missing or changed; recovery will not republish it.");
      const authorized = await input.governance.service.authorizeAgentExecution(metadata.agentId, input.identity);
      const signal = input.signal ? AbortSignal.any([input.signal, authorized.executionLease.signal]) : authorized.executionLease.signal;
      try {
        await authorized.executionLease.assertActive();
        if (previous.outcomeUnknown || ["unknown", "interrupted", "publishing"].includes(previous.status)) await workflowService.recoverRun(input.workflowId, { ...input.identity, signal });
        const prepared = workflowService.createWorkforceHandoffRecoveryContext({ ...input, metadata,
          assertActive: () => authorized.executionLease.assertActive() });
        const result = await executeGovernedWorkflowRun({ governance: input.governance as any, workflowService: workflowService as any,
          identity: input.identity, body: { ...prepared.request, agentId: metadata.agentId },
          requestContext: { workflowHandoffContext: prepared.context }, requestId: `${input.workflowId}-recover`, signal });
        verifyResult(result, prepared.request);
        await authorized.executionLease.assertActive();
        const observed = await inspect(input);
        if (observed.status !== "completed" || !observed.artifactVerified || stableStringify(observed.result) !== stableStringify(result)) {
          throw Object.assign(workflowHandoffError("WORKFORCE_WORKFLOW_OUTCOME_UNKNOWN", "Recovered workflow result was not confirmed by the original journal.", 503), { outcomeUnknown: true });
        }
        return { ...observed, parentExecutionResumed: false, employeeRolesRerun: false };
      } finally { authorized.executionLease.release(); }
    },
  };
  factories.add(runtime);
  return Object.freeze(Object.assign(runtime, { handoff: runtime.run, getStatus: runtime.getInfo }));
}
