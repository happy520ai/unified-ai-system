// Agent governance control-plane routes.
//
// Surfaces the governed agent lifecycle over HTTP: generate, inspect,
// revoke (cascade), approvals with locked arguments, and versioned
// policy authoring/activation with no-expansion recompilation. All
// mutations require an enterprise identity (tenant + user); reads are
// tenant-scoped and fail closed.

import type { IncomingMessage, ServerResponse } from "node:http";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import type { AgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";

interface AgentGovernanceDispatchContext {
  request: IncomingMessage & {
    method?: string;
    enterpriseIdentity?: { tenantId?: string; userId?: string; role?: string; permissions?: string[] };
  };
  response: ServerResponse;
  startedAt: number;
  url: URL;
  application?: {
    agentGovernance?: { service: AgentGovernanceService } | null;
  };
  writeServiceLog?: (event: string, data: Record<string, unknown>) => void;
  requestId?: string;
}

export const AGENT_GOVERNANCE_ROUTE_DECLARATIONS = [
  ["POST /v1/agents/generate", { permission: "workflow:run" }],
  ["GET /v1/agents/list", { permission: "dashboard:read" }],
  ["GET /v1/agents/describe", { permission: "dashboard:read" }],
  ["GET /v1/agents/effective-policy", { permission: "dashboard:read" }],
  ["GET /v1/agents/audit", { permission: "audit:read" }],
  ["POST /v1/agents/revoke", { permission: "workflow:approve" }],
  ["POST /v1/approvals/decide", { permission: "workflow:approve" }],
  ["GET /v1/approvals/list", { permission: "dashboard:read" }],
  ["POST /v1/policies/create", { permission: "user:admin" }],
  ["POST /v1/policies/activate", { permission: "user:admin" }],
  ["GET /v1/policies/list", { permission: "audit:read" }],
  ["GET /v1/governance/stats", { permission: "dashboard:read" }],
];

export async function dispatchAgentGovernanceRoutes(context: AgentGovernanceDispatchContext) {
  const { request, response, startedAt, url, application, writeServiceLog } = context;
  const governance = application?.agentGovernance;
  const route = `${request.method} ${url.pathname}`;
  if (!AGENT_GOVERNANCE_ROUTE_DECLARATIONS.some(([declaration]) => declaration === route)) {
    return ROUTE_NOT_HANDLED;
  }
  if (!governance?.service) {
    writeJson(response, 503, createErrorEnvelope(
      "AGENT_GOVERNANCE_UNAVAILABLE",
      "The agent governance control plane is not enabled in this runtime.",
      { startedAt, category: "unavailable" },
    ));
    return;
  }

  const identity = request.enterpriseIdentity;
  const tenantId = typeof identity?.tenantId === "string" ? identity.tenantId : "";
  const userId = typeof identity?.userId === "string" ? identity.userId : "";
  const ctx = {
    tenantId,
    userId,
    role: identity?.role,
    permissions: Array.isArray(identity?.permissions) ? [...identity.permissions] : [],
    requestId: context.requestId,
  };

  try {
    switch (route) {
      case "POST /v1/agents/generate": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const result = await governance.service.generateAgent({
          name: String(body?.name ?? "").trim(),
          task: String(body?.task ?? "").trim(),
          requestedTools: Array.isArray(body?.requestedTools) ? body.requestedTools.map(String) : [],
          ttlSeconds: Number(body?.ttlSeconds ?? 3600),
          parentAgentId: typeof body?.parentAgentId === "string" && body.parentAgentId !== "" ? body.parentAgentId : null,
          classification: body?.classification ?? undefined,
          proposedTraits: Array.isArray(body?.proposedTraits) ? body.proposedTraits.map(String) : undefined,
          proposedRiskLevel: body?.proposedRiskLevel,
          instanceRules: body?.instanceRules ?? undefined,
        }, ctx);
        writeServiceLog?.("agent_governance_generated", { path: url.pathname, agentId: result.agentId });
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }
      case "GET /v1/agents/list": {
        requireIdentity(ctx);
        const agents = await governance.service.listAgents(ctx.tenantId);
        writeJson(response, 200, createOkEnvelope({ agents }, { startedAt }));
        return;
      }
      case "GET /v1/agents/describe": {
        requireIdentity(ctx);
        const agentId = requireAgentId(url);
        const agent = await governance.service.getAgent(agentId, ctx.tenantId);
        if (!agent) throw notFound(`Agent ${agentId} not found.`);
        writeJson(response, 200, createOkEnvelope({ agent }, { startedAt }));
        return;
      }
      case "GET /v1/agents/effective-policy": {
        requireIdentity(ctx);
        const agentId = requireAgentId(url);
        const view = await governance.service.getEffectivePolicyView(agentId, ctx.tenantId);
        if (!view) throw notFound(`Agent ${agentId} not found.`);
        writeJson(response, 200, createOkEnvelope({ effectivePolicy: view }, { startedAt }));
        return;
      }
      case "GET /v1/agents/audit": {
        requireIdentity(ctx);
        const agentId = requireAgentId(url);
        const events = await governance.service.readAudit(agentId, ctx.tenantId, 200);
        writeJson(response, 200, createOkEnvelope({ events }, { startedAt }));
        return;
      }
      case "POST /v1/agents/revoke": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const result = await governance.service.revokeAgent(
          requireAgentIdOf(body),
          { reason: body?.reason, cascade: body?.cascade !== false },
          ctx,
        );
        writeServiceLog?.("agent_governance_revoked", { path: url.pathname, count: result.revoked.length });
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }
      case "POST /v1/approvals/decide": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const approvalId = String(body?.approvalId ?? "").trim();
        if (!approvalId || (body?.decision !== "approve" && body?.decision !== "reject")) {
          throw badRequest("approvalId and decision (approve|reject) are required.");
        }
        const approval = await governance.service.decideApproval(approvalId, body.decision, ctx);
        writeJson(response, 200, createOkEnvelope({ approval }, { startedAt }));
        return;
      }
      case "GET /v1/approvals/list": {
        requireIdentity(ctx);
        const agentId = typeof url.searchParams.get("agentId") === "string" && url.searchParams.get("agentId") !== ""
          ? url.searchParams.get("agentId")
          : null;
        const approvals = await governance.service.listApprovals(agentId, ctx.tenantId);
        writeJson(response, 200, createOkEnvelope({ approvals }, { startedAt }));
        return;
      }
      case "POST /v1/policies/create": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const policy = await governance.service.createPolicyVersion({
          policyKey: String(body?.policyKey ?? "").trim(),
          version: Number(body?.version),
          policyType: body?.policyType,
          scopeKey: String(body?.scopeKey ?? "").trim(),
          content: body?.content ?? {},
        }, ctx);
        writeJson(response, 200, createOkEnvelope({ policy }, { startedAt }));
        return;
      }
      case "POST /v1/policies/activate": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const result = await governance.service.activatePolicyVersion(
          String(body?.policyKey ?? "").trim(),
          Number(body?.version),
          ctx,
        );
        writeServiceLog?.("agent_governance_policy_activated", {
          path: url.pathname,
          policyKey: result.policy.policyKey,
          affected: result.affected.length,
        });
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }
      case "GET /v1/policies/list": {
        requireIdentity(ctx);
        const policies = await governance.service.listPolicies();
        writeJson(response, 200, createOkEnvelope({ policies }, { startedAt }));
        return;
      }
      case "GET /v1/governance/stats": {
        requireIdentity(ctx);
        const stats = await governance.service.stats();
        writeJson(response, 200, createOkEnvelope({ stats }, { startedAt }));
        return;
      }
      default:
        return ROUTE_NOT_HANDLED;
    }
  } catch (caught) {
    const error = normalizeGovernanceRouteError(caught);
    writeServiceLog?.("agent_governance_route_failed", {
      path: url.pathname,
      code: error.code,
      statusCode: error.statusCode,
      category: error.category,
    });
    writeJson(response, error.statusCode, createErrorEnvelope(
      error.code,
      error.message,
      { startedAt, category: error.category, retryable: error.retryable, details: error.details },
    ));
  }
}

type NormalizedGovernanceRouteError = {
  code: string;
  message: string;
  statusCode: number;
  category: "validation" | "authorization" | "not_found" | "conflict" | "availability" | "integrity";
  retryable: boolean;
  details?: unknown;
};

function normalizeGovernanceRouteError(caught: unknown): NormalizedGovernanceRouteError {
  const error = caught && typeof caught === "object"
    ? caught as Record<string, unknown>
    : {};
  const name = typeof error.name === "string" ? error.name : "";
  const explicitCode = typeof error.code === "string" ? error.code : "";
  const code = explicitCode || name || "AGENT_GOVERNANCE_ROUTE_FAILED";
  const explicitStatus = Number.isInteger(error.statusCode) ? Number(error.statusCode) : null;
  let statusCode = explicitStatus && explicitStatus >= 400 && explicitStatus <= 599 ? explicitStatus : 400;
  if (explicitStatus === null) {
    if (/NotFound$/u.test(name) || /(?:^|_)NOT_FOUND$/u.test(code)) statusCode = 404;
    else if (/Already|Conflict|Stale|Immutable|EpochChanged|DrainTimeout|StateChanged/u.test(name)
      || /(?:CONFLICT|STALE|ALREADY|IMMUTABLE|DRAIN_TIMEOUT|STATE_CHANGED|JOURNAL_CHANGED)/u.test(code)) statusCode = 409;
    else if (/(?:RECOVERY_REQUIRED|MIGRATION_REQUIRED|UNAVAILABLE)/u.test(code)) statusCode = 503;
    else if (/Integrity|Corrupt|TransactionFailed/u.test(name)
      || /(?:INTEGRITY|CORRUPT|TRANSACTION_FAILED)/u.test(code)) statusCode = 500;
  }
  const category = statusCode === 404 ? "not_found"
    : statusCode === 409 ? "conflict"
      : statusCode === 401 || statusCode === 403 ? "authorization"
        : statusCode === 503 ? "availability"
          : statusCode >= 500 ? "integrity"
            : "validation";
  const details = error.errors ?? (error.rolledBack !== undefined ? {
    rolledBack: error.rolledBack,
    failClosedAgentIds: Array.isArray(error.failClosedAgentIds) ? error.failClosedAgentIds : [],
  } : undefined);
  return {
    code,
    message: typeof error.message === "string" ? error.message : "Agent governance route failed.",
    statusCode,
    category,
    retryable: statusCode === 503,
    ...(details === undefined ? {} : { details }),
  };
}

function requireIdentity(ctx: { tenantId?: string; userId?: string }): asserts ctx is { tenantId: string; userId: string } {
  if (!ctx.tenantId || !ctx.userId) {
    const error = new Error("An authenticated enterprise identity (tenant + user) is required.") as Error & { statusCode: number };
    error.name = "GOVERNANCE_IDENTITY_REQUIRED";
    error.statusCode = 403;
    throw error;
  }
}

function requireAgentId(url: URL) {
  const agentId = (url.searchParams.get("agentId") ?? "").trim();
  if (!agentId) throw badRequest("agentId query parameter is required.");
  return agentId;
}

function requireAgentIdOf(body: unknown) {
  const record = (body ?? {}) as { agentId?: unknown };
  const agentId = String(record.agentId ?? "").trim();
  if (!agentId) throw badRequest("agentId is required.");
  return agentId;
}

function badRequest(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.name = "AGENT_GOVERNANCE_VALIDATION";
  error.statusCode = 400;
  return error;
}

function notFound(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.name = "AGENT_GOVERNANCE_NOT_FOUND";
  error.statusCode = 404;
  return error;
}
