import { createRuntimeGatewayBrainAdapter } from "@unified-ai-system/employee-brain-adapter";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";
import { assertWorkforceCodeTaskFence } from "./workforceDagExecutor.ts";
import { readWorkforceCodeRoleOperation } from "./workforceRoleProvider.ts";
import { buildConsensusMessages, parseConsensusOpinion } from "./workforceConsensusReview.ts";
import { consensusError, consensusTextHash, createWorkforceConsensusReport, readWorkforceConsensusMetadata,
  type WorkforceConsensusMetadata, type WorkforceConsensusEntry } from "./workforceConsensusReport.ts";

/** A single existing Workforce run. It never retries a role or grants another Provider operation. */
export function createWorkforceConsensusSession(input: { executionId: string; metadata: WorkforceConsensusMetadata; agentFence: any }) {
  const metadata = readWorkforceConsensusMetadata(input.metadata), entries = new Map<string, WorkforceConsensusEntry>();
  const started = new Set<string>();
  for (const binding of metadata.review.perspectives) entries.set(binding.roleId, {
    roleId: binding.roleId, taskId: null, responseText: null, responseHash: null, errorCode: null, inputReceipt: null });
  return {
    async runRole(roleId: string, taskId: string, rawRoleAdapter: any, taskFence: object, signal: AbortSignal) {
      const binding = metadata.review.perspectives.find(item => item.roleId === roleId);
      if (!binding || started.has(roleId)) throw consensusError("WORKFORCE_CONSENSUS_ROLE_REUSED", "Only one independent opinion is allowed per reviewed role.");
      started.add(roleId);
      const entry = entries.get(roleId)!; entry.taskId = taskId;
      try {
        const frame = { executionId: input.executionId, taskId, roleId, agentId: metadata.agentId,
          agentRunId: metadata.agentRunId, agentFence: input.agentFence };
        await assertWorkforceCodeTaskFence(taskFence, frame, "commit");
        const operation = readWorkforceCodeRoleOperation(rawRoleAdapter, { ...frame, taskFence,
          planId: metadata.planId, planDigest: metadata.planDigest, profileHash: metadata.profileHash });
        const adapter = createRuntimeGatewayBrainAdapter({ context: { employeeId: binding.employeeId, roleId,
          governedAgentId: metadata.agentId, agentRunId: metadata.agentRunId, executionId: input.executionId,
          taskId, planId: metadata.planId, planDigest: metadata.planDigest, profileHash: metadata.profileHash }, providerAdapter: rawRoleAdapter });
        const messages = buildConsensusMessages(metadata.review, binding.perspective);
        throwIfExecutionAborted(signal);
        const result = await adapter.generate({ request: { messages, options: { maxOutputTokens: adapter.binding.maxOutputTokens } },
          target: { providerId: binding.providerId, modelId: binding.modelId } });
        throwIfExecutionAborted(signal); await assertWorkforceCodeTaskFence(taskFence, frame, "commit");
        if (Buffer.byteLength(result.text) > 65536) throw consensusError("WORKFORCE_CONSENSUS_OPINION_INVALID", "The opinion exceeds its bounded report size.");
        const opinion = parseConsensusOpinion(result.text, metadata.review, binding.perspective);
        const proof = operation.getInputReceipt();
        if (!proof || proof.sourceMessagesHash !== consensusTextHash(JSON.stringify(messages))
          || proof.gatewayRequestId !== result.workforceContribution.receipt.gatewayRequestId) {
          throw consensusError("WORKFORCE_CONSENSUS_INPUT_UNCONFIRMED", "The entire frozen review input was not confirmed by the actual Gateway operation.");
        }
        Object.assign(entry, { responseText: result.text, responseHash: consensusTextHash(result.text), inputReceipt: proof });
        return { roleMeta: { roleId, name: binding.perspective }, llmDriven: true, workforceContribution: result.workforceContribution,
          consensusOpinion: opinion, consensusInputHash: proof.sourceMessagesHash };
      } catch (error: any) {
        entry.errorCode = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{0,95}$/u.test(error.code) ? error.code : "WORKFORCE_CONSENSUS_ROLE_FAILED";
        throw error;
      }
    },
    finish(executionStatus: string, roleProviderRun: any) {
      return createWorkforceConsensusReport({ executionId: input.executionId, metadata, executionStatus,
        entries: [...entries.values()], receipts: roleProviderRun.getReceipts(), dispatchCount: roleProviderRun.getUsage().totalRequests });
    },
  };
}
