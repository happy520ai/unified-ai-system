import { createHash } from "node:crypto";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";

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
  run(request: Record<string, unknown>, context: Record<string, unknown>): Promise<Record<string, unknown>>;
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
  let completedResult: Record<string, unknown> | null = null;
  let output: Record<string, unknown> | undefined;
  let primaryError: unknown;
  let releaseError: unknown;

  try {
    throwIfExecutionAborted(runSignal);
    const target = buildWorkflowTarget(identity.tenantId, input.body);
    const verdict = await input.governance.toolProxy.enforce({
      context: {
        agentId,
        tenantId: identity.tenantId,
        userId: identity.userId,
        ...(input.requestId ? { requestId: input.requestId } : {}),
      },
      toolName: "file_write",
      params: {
        file_path: target.logicalPath,
        content_sha256: target.goalDigest,
      },
      resourceContext: {
        resourceKeys: {
          workflowTenant: target.tenantDigest,
          workflowArtifact: target.artifactDigest,
        },
        resources: [target.logicalPath],
      },
    });
    toolLease = verdict.executionLease ?? null;
    const executionSignal = combineSignals(runSignal, toolLease?.signal);
    throwIfExecutionAborted(executionSignal);
    if (verdict.outcome !== "allow" || !verdict.policy || !toolLease) {
      throw workflowError(
        verdict.code ?? "WORKFLOW_AGENT_GOVERNANCE_DENIED",
        verdict.reason ?? "Agent Governance denied the controlled workflow artifact write.",
        verdict.outcome === "approval_required" ? 409 : 403,
      );
    }

    const { agentId: _callerAgentId, ...workflowBody } = input.body;
    completedResult = await input.workflowService.run(workflowBody, {
      ...input.requestContext,
      tenantId: identity.tenantId,
      signal: executionSignal,
    });
    const metered = await input.governance.toolProxy.enforceResult({
      context: {
        agentId,
        tenantId: identity.tenantId,
        userId: identity.userId,
        ...(input.requestId ? { requestId: input.requestId } : {}),
      },
      toolName: "file_write",
      policy: verdict.policy,
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
  } catch (error) {
    primaryError = error;
  }

  try {
    toolLease?.release();
  } catch (error) {
    releaseError = error;
  }
  try {
    authorization.executionLease.release();
  } catch (error) {
    releaseError ??= error;
  }

  if (primaryError) {
    throw completedResult
      ? createWorkflowOutcomeUncertainError(completedResult, primaryError)
      : primaryError;
  }
  if (releaseError) {
    throw completedResult
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

function buildWorkflowTarget(tenantId: string, body: Record<string, unknown>) {
  const tenantDigest = digest(tenantId).slice(0, 24);
  const goal = typeof body.goal === "string"
    ? body.goal
    : typeof body.prompt === "string"
      ? body.prompt
      : typeof body.query === "string" ? body.query : "";
  const goalDigest = digest(goal);
  const requestedName = typeof body.artifactName === "string" ? body.artifactName : "server-generated";
  const artifactDigest = digest(requestedName).slice(0, 24);
  return {
    tenantDigest,
    goalDigest,
    artifactDigest,
    logicalPath: `.data/workflows/tenant-${tenantDigest}/artifact-${artifactDigest}.md`,
  };
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
      artifactSha256: typeof artifact.sha256 === "string" ? artifact.sha256 : null,
      artifactFileName: typeof artifact.fileName === "string" ? artifact.fileName : null,
      reconciliation: "Inspect the tenant-partitioned workflow artifact before any operator-authorized retry.",
    },
  });
}
