import { computeArgumentsHash } from "../agent-governance/toolProxy.ts";
import type {
  AgentGovernanceCallContext,
  AgentGovernanceToolProxy,
  ToolProxyVerdict,
} from "../agent-governance/toolProxy.ts";
import type { AgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import type {
  McpGatewayIdentity,
  McpGatewayService,
  PreparedMcpToolCall,
} from "./mcpGatewayService.ts";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";

const GOVERNED_MCP_POLICY_TOOL = "mcp";

export interface GovernedMcpIdentity extends McpGatewayIdentity {
  tenantId?: unknown;
  userId?: unknown;
  permissions?: unknown;
}

export interface GovernedMcpRequestBody {
  agentId?: unknown;
  server?: unknown;
  tool?: unknown;
  arguments?: unknown;
}

export type GovernedMcpExecutionResult =
  | {
      outcome: "approval_required";
      code: string;
      approvalId: string;
      serverId: string;
      toolName: string;
      externalEffectRequired: boolean;
    }
  | {
      outcome: "executed";
      result: unknown;
      serverId: string;
      toolName: string;
      externalEffect: { required: boolean; reservationFingerprint: string | null };
      governance: {
        policyToolName: "mcp";
        resultVerdict: string;
        resultCode: string;
      };
    };

export async function executeGovernedMcpCall(input: {
  governance: { service: AgentGovernanceService; toolProxy: AgentGovernanceToolProxy };
  mcpGatewayService: McpGatewayService;
  identity: GovernedMcpIdentity | null | undefined;
  body: GovernedMcpRequestBody;
  requestId?: string;
  externalEffect?: { effectKeyHash?: unknown; effectKeyInvalid?: boolean };
  signal?: AbortSignal;
}): Promise<GovernedMcpExecutionResult> {
  throwIfExecutionAborted(input.signal);
  const identity = requireEnterpriseIdentity(input.identity);
  const agentId = requireAgentId(input.body.agentId);
  const governanceContext: AgentGovernanceCallContext = {
    agentId,
    tenantId: identity.tenantId,
    userId: identity.userId,
    ...(input.requestId ? { requestId: input.requestId } : {}),
  };
  const authorized = await input.governance.service.authorizeAgentExecution(agentId, {
    tenantId: identity.tenantId,
    userId: identity.userId,
    permissions: identity.permissions,
    requestId: input.requestId,
  });
  const runSignal = combineMcpExecutionSignals(input.signal, authorized.executionLease.signal);

  const executionState: {
    toolLease: ToolProxyVerdict["executionLease"] | null;
    completedCall: Awaited<ReturnType<McpGatewayService["callTool"]>> | null;
  } = { toolLease: null, completedCall: null };
  let output: GovernedMcpExecutionResult | undefined;
  let primaryError: unknown;
  let hasPrimaryError = false;
  try {
    output = await performGovernedMcpCall();
  } catch (error) {
    hasPrimaryError = true;
    primaryError = executionState.completedCall?.externalEffect.required
      ? createGovernedMcpPostDispatchUncertainError(executionState.completedCall, error, "result-enforcement")
      : error;
  }

  let releaseError: unknown;
  let hasReleaseError = false;
  try {
    executionState.toolLease?.release();
  } catch (error) {
    hasReleaseError = true;
    releaseError = error;
  }
  try {
    authorized.executionLease.release();
  } catch (error) {
    if (!hasReleaseError) {
      hasReleaseError = true;
      releaseError = error;
    }
  }

  if (hasPrimaryError) throw primaryError;
  if (hasReleaseError) {
    throw executionState.completedCall?.externalEffect.required
      ? createGovernedMcpPostDispatchUncertainError(executionState.completedCall, releaseError, "lease-release")
      : releaseError;
  }
  if (!output) {
    throw governanceError("MCP_GOVERNANCE_RESULT_MISSING", "Governed MCP execution produced no result.", 503);
  }
  return output;

  async function performGovernedMcpCall(): Promise<GovernedMcpExecutionResult> {
    throwIfExecutionAborted(runSignal);
    const prepared = await input.mcpGatewayService.prepareToolCall(input.identity, {
      server: input.body.server as string,
      tool: input.body.tool as string,
      ...(input.body.arguments !== undefined
        ? { arguments: input.body.arguments as Record<string, unknown> }
        : {}),
    });
    throwIfExecutionAborted(runSignal);
    const canonicalParams = toCanonicalParams(prepared);
    const verdict = await input.governance.toolProxy.enforce({
      context: governanceContext,
      toolName: GOVERNED_MCP_POLICY_TOOL,
      params: canonicalParams,
      resourceContext: buildTrustedMcpResourceContext(prepared, canonicalParams),
    });
    executionState.toolLease = verdict.executionLease ?? null;
    const toolSignal = combineMcpExecutionSignals(runSignal, verdict.executionLease?.signal);
    throwIfExecutionAborted(toolSignal);

    if (verdict.outcome === "approval_required") {
      if (!verdict.approvalId) {
        throw governanceError(
          "MCP_GOVERNANCE_APPROVAL_INVALID",
          "Agent Governance returned an incomplete MCP approval decision.",
          503,
        );
      }
      return {
        outcome: "approval_required",
        code: verdict.code ?? "TOOL_APPROVAL_REQUIRED",
        approvalId: verdict.approvalId,
        serverId: prepared.serverId,
        toolName: prepared.toolName,
        externalEffectRequired: prepared.externalEffectRequired,
      };
    }
    if (verdict.outcome !== "allow" || !verdict.policy || !verdict.executionLease) {
      throw governanceError(
        verdict.code ?? "MCP_GOVERNANCE_DENIED",
        verdict.reason ?? "Agent Governance denied this MCP tool call.",
        403,
      );
    }
    // Approval retries execute only the authenticated, decrypted envelope
    // returned by the one-shot approval store. The HTTP retry object is never
    // forwarded once approvedParams is present.
    const executionParams = verdict.approvedParams === undefined
      ? canonicalParams
      : requireCanonicalParams(verdict.approvedParams);
    const executionPrepared = await input.mcpGatewayService.prepareToolCall(input.identity, {
      server: executionParams.serverName,
      tool: executionParams.toolName,
      arguments: executionParams.args,
    });
    throwIfExecutionAborted(toolSignal);
    await authorized.executionLease.assertActive("reserve");
    throwIfExecutionAborted(toolSignal);
    executionState.completedCall = await input.mcpGatewayService.callTool(input.identity, {
      server: executionPrepared.serverId,
      tool: executionPrepared.toolName,
      arguments: executionPrepared.arguments,
      externalEffect: {
        ...(input.externalEffect ?? {}),
        fenceFingerprint: authorized.executionLease.fingerprint,
        fenceRequired: true,
        assertFence: (phase) => authorized.executionLease.assertActive(phase),
      },
      signal: toolSignal,
    });
    const metered = await input.governance.toolProxy.enforceResult({
      context: governanceContext,
      toolName: GOVERNED_MCP_POLICY_TOOL,
      policy: verdict.policy,
      result: executionState.completedCall.result,
      descriptor: null,
    });
    return {
      outcome: "executed",
      ...executionState.completedCall,
      result: metered.result,
      governance: {
        policyToolName: GOVERNED_MCP_POLICY_TOOL,
        resultVerdict: metered.verdict,
        resultCode: metered.code,
      },
    };
  }
}

function combineMcpExecutionSignals(...candidates: Array<AbortSignal | null | undefined>): AbortSignal | undefined {
  const signals = [...new Set(candidates.filter((signal): signal is AbortSignal => Boolean(signal)))];
  if (signals.length === 0) return undefined;
  if (signals.length === 1) return signals[0];
  return AbortSignal.any(signals);
}

function createGovernedMcpPostDispatchUncertainError(
  called: Awaited<ReturnType<McpGatewayService["callTool"]>>,
  cause: unknown,
  phase: "result-enforcement" | "lease-release",
) {
  const reservationFingerprint = called.externalEffect.reservationFingerprint;
  const error = Object.assign(new Error(
    "The upstream MCP mutation completed dispatch, but post-dispatch governance could not confirm a safe response. Do not retry; reconcile with the upstream system.",
    { cause },
  ), {
    name: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
    code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
    category: "provider",
    statusCode: 502,
    retryable: false,
    outcomeUnknown: true,
    reservationFingerprint,
    details: {
      outcomeUnknown: true,
      reservationFingerprint,
      phase,
      serverId: called.serverId,
      toolName: called.toolName,
      reconciliation: "Inspect the upstream system and the durable effect reservation before any operator-authorized retry.",
    },
  });
  return error;
}

type CanonicalMcpParams = {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
};

function toCanonicalParams(prepared: PreparedMcpToolCall): CanonicalMcpParams {
  return {
    serverName: prepared.serverId,
    toolName: prepared.toolName,
    args: prepared.arguments,
  };
}

function requireCanonicalParams(value: unknown): CanonicalMcpParams {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw governanceError(
      "APPROVED_MCP_ARGUMENTS_INVALID",
      "Authenticated approved MCP parameters are malformed.",
      409,
    );
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 3 || keys[0] !== "args" || keys[1] !== "serverName" || keys[2] !== "toolName"
    || !Object.prototype.hasOwnProperty.call(record, "serverName")
    || !Object.prototype.hasOwnProperty.call(record, "toolName")
    || !Object.prototype.hasOwnProperty.call(record, "args")
    || typeof record.serverName !== "string" || typeof record.toolName !== "string"
    || !record.args || typeof record.args !== "object" || Array.isArray(record.args)) {
    throw governanceError(
      "APPROVED_MCP_ARGUMENTS_INVALID",
      "Authenticated approved MCP parameters are malformed.",
      409,
    );
  }
  return {
    serverName: record.serverName,
    toolName: record.toolName,
    args: record.args as Record<string, unknown>,
  };
}

function buildTrustedMcpResourceContext(
  prepared: PreparedMcpToolCall,
  canonicalParams: CanonicalMcpParams,
) {
  const target = `mcp://${prepared.serverId}/${encodeURIComponent(prepared.toolName)}`;
  const approvalReview = {
    schemaVersion: 1 as const,
    reviewable: prepared.approvalReview.reviewable,
    effectType: "mcp:upstream-tool-call",
    ...(!prepared.approvalReview.reviewable
      ? { unavailableReason: "No operator-configured safe MCP argument review is available." }
      : {}),
    mcp: {
      serverId: prepared.serverId,
      toolName: prepared.toolName,
      target,
      targetFingerprint: `sha256:${prepared.targetFingerprint}`,
      argumentsHash: computeArgumentsHash(canonicalParams.args),
      argumentsBytes: Buffer.byteLength(JSON.stringify(canonicalParams.args), "utf8"),
      externalEffectRequired: prepared.externalEffectRequired,
      reviewedArguments: prepared.approvalReview.reviewedArguments,
      omittedArgumentKeys: prepared.approvalReview.omittedArgumentKeys,
    },
  };
  return {
    resourceKeys: {
      serverName: prepared.serverId,
      toolName: prepared.toolName,
    },
    resources: [target],
    approvalReview,
  };
}

function requireEnterpriseIdentity(identity: GovernedMcpIdentity | null | undefined) {
  const tenantId = typeof identity?.tenantId === "string" ? identity.tenantId.trim() : "";
  const userId = typeof identity?.userId === "string" ? identity.userId.trim() : "";
  if (!tenantId || !userId) {
    throw governanceError(
      "GOVERNANCE_IDENTITY_REQUIRED",
      "Governed MCP calls require an authenticated enterprise tenant and user.",
      403,
    );
  }
  return {
    tenantId,
    userId,
    permissions: Array.isArray(identity?.permissions)
      ? identity.permissions.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function requireAgentId(value: unknown) {
  const agentId = typeof value === "string" ? value.trim() : "";
  if (!agentId) {
    throw governanceError(
      "MCP_AGENT_ID_REQUIRED",
      "agentId is required while Agent Governance is enabled.",
      400,
    );
  }
  return agentId;
}

function governanceError(code: string, message: string, statusCode: number) {
  return Object.assign(new Error(message), {
    name: code,
    code,
    category: statusCode === 403 ? "auth" : "governance",
    statusCode,
  });
}
