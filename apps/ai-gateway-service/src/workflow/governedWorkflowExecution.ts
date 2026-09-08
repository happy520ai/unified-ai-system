import { createHash } from "node:crypto";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";
import type { AgentToolApprovalReview, EffectiveAgentPolicy } from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { isSafeWorkflowArtifactContent, workflowArtifactApprovalArguments } from "../agent-governance/agentApprovalStore.ts";
import { computeArgumentsHash, effectiveGovernedToolDecision, evaluateGovernedToolScope } from "../agent-governance/toolProxy.ts";
import type { WorkflowExecutionCallbacks, WorkflowPublicationMaterial } from "./durableWorkflowRunStore.ts";

import type { AgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import type {
  AgentGovernanceToolProxy,
  ToolProxyVerdict,
} from "../agent-governance/toolProxy.ts";

type WorkflowIdentity = {
  tenantId?: unknown;
  userId?: unknown;
  permissions?: unknown;
};

type WorkflowService = {
  run(request: Record<string, unknown>, context: Record<string, unknown>, callbacks?: WorkflowExecutionCallbacks): Promise<object>;
  markGovernanceUncertain?(workflowId: unknown, context: Record<string, unknown>): void | Promise<void>;
  confirmGovernanceComplete?(workflowId: unknown, context: Record<string, unknown>, deliveredResult: object): void | Promise<void>;
};

export async function executeGovernedWorkflowRun(input: {
  governance: { service: AgentGovernanceService; toolProxy: AgentGovernanceToolProxy };
  workflowService: WorkflowService;
  identity: WorkflowIdentity | null | undefined;
  body: Record<string, unknown>;
  requestContext: Record<string, unknown>;
  requestId?: string;
  signal?: AbortSignal;
}) {
  const identity = requireWorkflowIdentity(input.identity);
  const agentId = requireWorkflowAgentId(input.body.agentId);
  throwIfExecutionAborted(input.signal);
  const authorization = await input.governance.service.authorizeAgentExecution(agentId, {
    tenantId: identity.tenantId,
    userId: identity.userId,
    permissions: identity.permissions,
    requestId: input.requestId,
  });
  const runSignal = combineSignals(input.signal, authorization.executionLease.signal);
  let toolLease: ToolProxyVerdict["executionLease"] | null = null;
  const releaseToolLease = () => { toolLease?.release(); };
  let completedResult: Record<string, unknown> | null = null;
  let output: Record<string, unknown> | undefined;
  let primaryError: unknown;
  let releaseError: unknown;
  let resultPolicy: EffectiveAgentPolicy | null = null;
  let replayed = false;
  let needsConfirmation = false;
  const callContext = { agentId, tenantId: identity.tenantId, userId: identity.userId,
    ...(input.requestId ? { requestId: input.requestId } : {}) };
  const assertActive = async () => {
    throwIfExecutionAborted(combineSignals(runSignal, toolLease?.signal));
    await authorization.executionLease.assertActive();
    throwIfExecutionAborted(combineSignals(runSignal, toolLease?.signal));
  };

  try {
    await assertActive();
    assertWorkflowDecision(authorization.policy);
    const { agentId: _callerAgentId, ...workflowBody } = input.body;
    completedResult = { ...await input.workflowService.run(workflowBody, {
      ...input.requestContext,
      tenantId: identity.tenantId,
      userId: identity.userId,
      workflowGovernancePending: true,
      signal: runSignal,
    }, {
      beforePublish: async (material) => {
        if (resultPolicy) throw workflowError("WORKFLOW_GOVERNANCE_CALLBACK_REUSED", "A workflow admission cannot authorize another publication.", 403);
        await assertActive();
        const { workflow, params, resourceContext } = describeWorkflowPublication(material, identity);
        const safe = isSafeWorkflowArtifactContent(material.content);
        const review: Omit<AgentToolApprovalReview, "policyHash"> = safe
          ? { schemaVersion: 1, reviewable: true, effectType: "workflow:artifact-write", workflow }
          : { schemaVersion: 1, reviewable: false, effectType: "workflow:artifact-write",
            unavailableReason: "The complete prepared Markdown is unsafe or exceeds the bounded operator review." };
        const verdict = await input.governance.toolProxy.enforce({ context: callContext, toolName: "file_write", params,
          resourceContext: { ...resourceContext, approvalReview: review } });
        toolLease = verdict.executionLease ?? null;
        await assertActive();
        if (verdict.outcome !== "allow" || !verdict.policy || !toolLease) {
          throw Object.assign(workflowError(verdict.code ?? "WORKFLOW_AGENT_GOVERNANCE_DENIED",
            verdict.reason ?? "Agent Governance denied the controlled workflow artifact write.", verdict.outcome === "approval_required" ? 409 : 403),
          { details: { ...(verdict.approvalId ? { approvalId: verdict.approvalId } : {}), workflowId: material.workflowId } });
        }
        const decision = effectiveGovernedToolDecision(verdict.policy, "file_write");
        if (decision === "deny" || decision === "require_approval" && (!verdict.approvalId || !safe
          || stableStringify(verdict.approvedParams) !== stableStringify(params)
          || stableStringify(verdict.approvalReview) !== stableStringify({ ...review, policyHash: verdict.policy.policyHash }))) {
          throw workflowError("WORKFLOW_APPROVED_MATERIAL_MISMATCH", "Approved workflow material does not match the frozen target and content.", 403);
        }
        resultPolicy = verdict.policy; needsConfirmation = true;
        return { assertActive, authorization: { version: 1, agentId, policyHash: verdict.policy.policyHash,
          subjectFingerprint: material.subjectFingerprint, workflowId: material.workflowId, inputHash: material.inputHash,
          argumentsHash: computeArgumentsHash(params), contentHash: material.contentHash, contentBytes: material.contentBytes,
          targetFingerprint: material.target.fingerprint, decision, approvalId: verdict.approvalId ?? null } };
      },
      beforeReplay: async (material) => {
        await assertActive();
        const { params, resourceContext } = describeWorkflowPublication({ ...material, content: null }, identity);
        const receipt = material.authorization;
        if (material.governancePending && !receipt || receipt && (receipt.agentId !== agentId
          || receipt.argumentsHash !== computeArgumentsHash(params))) {
          throw workflowError("WORKFLOW_ORIGINAL_AUTHORIZATION_UNVERIFIED", "The original publication authorization does not match this workflow receipt.", 409);
        }
        assertWorkflowDecision(authorization.policy);
        const scope = evaluateGovernedToolScope(authorization.policy, identity.tenantId, params, resourceContext);
        if (!scope.allowed) throw workflowError("TOOL_SCOPE_DENIED", scope.reason ?? "The current policy cannot return this workflow receipt.", 403);
        const reservation = await input.governance.service.reserveUsage(agentId, authorization.policy.limits, {});
        if (!reservation.allowed) throw workflowError(reservation.reason ?? "USAGE_LIMIT_REACHED", "Current Agent limits do not permit this receipt.", 403);
        await input.governance.service.emitAudit({ eventType: "TOOL_REQUESTED", ...callContext, toolName: "workflow_receipt",
          reason: "WORKFLOW_RECEIPT_REPLAY: no new publication or approval consumption", argumentsRedacted: true });
        replayed = true; needsConfirmation = material.governancePending; resultPolicy = authorization.policy;
      },
    }) };
    if (!resultPolicy) throw workflowError("WORKFLOW_GOVERNANCE_CALLBACK_REQUIRED", "Workflow execution bypassed its server-created publication or receipt check.", 503);
    await assertActive();
    const metered = await input.governance.toolProxy.enforceResult({
      context: {
        agentId,
        tenantId: identity.tenantId,
        userId: identity.userId,
        ...(input.requestId ? { requestId: input.requestId } : {}),
      },
      toolName: replayed ? "workflow_receipt" : "file_write",
      policy: resultPolicy,
      result: completedResult,
      descriptor: {
        kind: "record-array",
        selector: ["knowledge", "citations"],
        onLimitExceeded: "truncate",
        itemKind: "object",
      },
    });
    if (metered.verdict === "replace") {
      throw workflowError(
        metered.code,
        "Workflow result governance could not safely return the published artifact response.",
        403,
      );
    }
    output = metered.result as Record<string, unknown>;
    await assertActive();
  } catch (error) {
    primaryError = error;
  }

  try {
    releaseToolLease();
  } catch (error) {
    releaseError = error;
  }
  try {
    authorization.executionLease.release();
  } catch (error) {
    releaseError ??= error;
  }

  if (completedResult && needsConfirmation && !primaryError && !releaseError) {
    try {
      await input.workflowService.confirmGovernanceComplete?.(completedResult.workflowId, {
        tenantId: identity.tenantId, userId: identity.userId,
      }, output!);
    } catch (error) { primaryError = error; }
  }
  if (completedResult && needsConfirmation && (primaryError || releaseError)) {
    try {
      await input.workflowService.markGovernanceUncertain?.(completedResult.workflowId, {
        tenantId: identity.tenantId, userId: identity.userId,
      });
    } catch { /* The original governance failure remains an unknown outcome. */ }
  }
  if (primaryError) {
    throw completedResult && needsConfirmation
      ? createWorkflowOutcomeUncertainError(completedResult, primaryError)
      : primaryError;
  }
  if (releaseError) {
    throw completedResult && needsConfirmation
      ? createWorkflowOutcomeUncertainError(completedResult, releaseError)
      : releaseError;
  }
  if (!output) {
    throw workflowError("WORKFLOW_GOVERNANCE_RESULT_MISSING", "Governed workflow produced no safe result.", 503);
  }
  return output;
}

function requireWorkflowIdentity(identity: WorkflowIdentity | null | undefined) {
  const tenantId = typeof identity?.tenantId === "string" ? identity.tenantId.trim() : "";
  const userId = typeof identity?.userId === "string" ? identity.userId.trim() : "";
  if (!tenantId || !userId) {
    throw workflowError(
      "WORKFLOW_GOVERNANCE_IDENTITY_REQUIRED",
      "Governed workflow execution requires an authenticated tenant and user.",
      403,
    );
  }
  return {
    tenantId,
    userId,
    permissions: Array.isArray(identity?.permissions)
      ? identity.permissions.filter((permission): permission is string => typeof permission === "string")
      : [],
  };
}

function requireWorkflowAgentId(value: unknown) {
  const agentId = typeof value === "string" ? value.trim() : "";
  if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)) {
    throw workflowError(
      "WORKFLOW_AGENT_ID_REQUIRED",
      "agentId is required for workflow execution while Agent Governance is enabled.",
      400,
    );
  }
  return agentId;
}

function assertWorkflowDecision(policy: EffectiveAgentPolicy) {
  if (effectiveGovernedToolDecision(policy, "file_write") === "deny") {
    throw workflowError("TOOL_DENIED_BY_POLICY", "The current policy does not grant the controlled workflow artifact operation.", 403);
  }
}

function describeWorkflowPublication(material: WorkflowPublicationMaterial, identity: { tenantId: string; userId: string }) {
  if (material.subjectFingerprint !== digest(JSON.stringify(["workflow-owner-v1", identity.tenantId, identity.userId]))
    || material.tenantPartition !== `tenant-${digest(identity.tenantId).slice(0, 24)}`) {
    throw workflowError("WORKFLOW_GOVERNANCE_SUBJECT_MISMATCH", "Prepared workflow ownership does not match authenticated server identity.", 403);
  }
  const workflow: NonNullable<AgentToolApprovalReview["workflow"]> = {
    workflowId: material.workflowId, inputHash: `sha256:${material.inputHash}`, subjectFingerprint: `sha256:${material.subjectFingerprint}`,
    target: { scope: "managed-workflow-output", tenantPartition: material.tenantPartition, fileName: material.target.fileName,
      rootFingerprint: `sha256:${material.target.rootFingerprint}`, fingerprint: `sha256:${material.target.fingerprint}` },
    content: material.content ?? "", contentHash: `sha256:${material.contentHash}`, contentBytes: material.contentBytes,
    writeMode: "exclusive-no-overwrite",
  };
  const params = workflowArtifactApprovalArguments(workflow);
  return { workflow, params, resourceContext: {
    resourceKeys: { workflowTenant: digest(identity.tenantId).slice(0, 24), workflowArtifact: digest(material.requestedName).slice(0, 24) },
    resources: [params.file_path],
  } };
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function combineSignals(...candidates: Array<AbortSignal | null | undefined>): AbortSignal | undefined {
  const signals = [...new Set(candidates.filter((signal): signal is AbortSignal => Boolean(signal)))];
  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];
  return AbortSignal.any(signals);
}

function workflowError(code: string, message: string, statusCode: number) {
  return Object.assign(new Error(message), {
    name: code,
    code,
    category: statusCode === 403 ? "auth" : "governance",
    statusCode,
  });
}

function createWorkflowOutcomeUncertainError(result: Record<string, unknown>, cause: unknown) {
  const artifact = result.artifact && typeof result.artifact === "object"
    ? result.artifact as Record<string, unknown>
    : {};
  return Object.assign(new Error(
    "The controlled workflow artifact was published, but post-write governance did not complete. Do not retry blindly; reconcile the returned artifact fingerprint.",
    { cause },
  ), {
    name: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN",
    code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN",
    category: "governance",
    statusCode: 502,
    retryable: false,
    outcomeUnknown: true,
    details: {
      outcomeUnknown: true,
      workflowId: result.workflowId,
      artifactSha256: typeof artifact.sha256 === "string" ? artifact.sha256 : null,
      artifactFileName: typeof artifact.fileName === "string" ? artifact.fileName : null,
      reconciliation: "Inspect the tenant-partitioned workflow artifact before any operator-authorized retry.",
    },
  });
}
