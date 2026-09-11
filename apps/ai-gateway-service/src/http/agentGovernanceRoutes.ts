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
    enterpriseIdentity?: {
      tenantId?: string;
      userId?: string;
      role?: string;
      permissions?: string[];
      /** Trusted server-bound Agent actor identity; never sourced from JSON. */
      actorAgentId?: unknown;
    };
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
  ["GET /v1/agents", { permission: "dashboard:read" }],
  ["GET /v1/agents/list", { permission: "dashboard:read" }],
  ["GET /v1/agents/describe", { permission: "dashboard:read" }],
  ["GET /v1/agents/effective-policy", { permission: "dashboard:read" }],
  ["GET /v1/agents/audit", { permission: "audit:read" }],
  ["POST /v1/agents/revoke", { permission: "workflow:approve" }],
  ["POST /v1/approvals/decide", { permission: "workflow:approve" }],
  ["GET /v1/approvals", { permission: "dashboard:read" }],
  ["GET /v1/approvals/list", { permission: "dashboard:read" }],
  ["POST /v1/policies", { permission: "user:admin" }],
  ["POST /v1/policies/create", { permission: "user:admin" }],
  ["POST /v1/policies/activate", { permission: "user:admin" }],
  ["GET /v1/policies", { permission: "audit:read" }],
  ["GET /v1/policies/list", { permission: "audit:read" }],
  ["GET /v1/governance/stats", { permission: "dashboard:read" }],
];

export async function dispatchAgentGovernanceRoutes(context: AgentGovernanceDispatchContext) {
  const { request, response, startedAt, url, application, writeServiceLog } = context;
  const governance = application?.agentGovernance;
  const resolvedRoute = resolveAgentGovernanceRoute(request.method, url.pathname);
  if (!resolvedRoute) {
    return ROUTE_NOT_HANDLED;
  }
  const route = resolvedRoute.compatibilityRoute;
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
    ...(identity && Object.hasOwn(identity, "actorAgentId")
      ? { actorAgentId: identity.actorAgentId as string | null | undefined }
      : {}),
  };

  try {
    switch (route) {
      case "POST /v1/agents/generate": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const requestedTools = body?.requestedTools ?? body?.requested_tools;
        const ttlSeconds = body?.ttlSeconds ?? body?.ttl_seconds;
        const parentAgentId = body?.parentAgentId ?? body?.parent_agent_id;
        const result = await governance.service.generateAgent({
          name: String(body?.name ?? "").trim(),
          task: String(body?.task ?? "").trim(),
          requestedTools: Array.isArray(requestedTools) ? requestedTools.map(String) : [],
          ttlSeconds: Number(ttlSeconds ?? 3600),
          parentAgentId: typeof parentAgentId === "string" && parentAgentId !== "" ? parentAgentId : null,
          classification: body?.classification ?? undefined,
          proposedTraits: Array.isArray(body?.proposedTraits ?? body?.proposed_traits)
            ? (body.proposedTraits ?? body.proposed_traits).map(String)
            : undefined,
          proposedRiskLevel: body?.proposedRiskLevel ?? body?.proposed_risk_level,
          instanceRules: body?.instanceRules ?? body?.instance_rules ?? undefined,
          taskPolicyKeys: Array.isArray(body?.taskPolicyKeys ?? body?.task_policy_keys)
            ? (body.taskPolicyKeys ?? body.task_policy_keys).map(String)
            : undefined,
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
        const agentId = resolvedRoute.agentId ?? requireAgentId(url);
        const agent = await governance.service.getAgent(agentId, ctx.tenantId);
        if (!agent) throw notFound(`Agent ${agentId} not found.`);
        writeJson(response, 200, createOkEnvelope({ agent }, { startedAt }));
        return;
      }
      case "GET /v1/agents/effective-policy": {
        requireIdentity(ctx);
        const agentId = resolvedRoute.agentId ?? requireAgentId(url);
        const view = await governance.service.getEffectivePolicyView(agentId, ctx.tenantId);
        if (!view) throw notFound(`Agent ${agentId} not found.`);
        writeJson(response, 200, createOkEnvelope({ effectivePolicy: view }, { startedAt }));
        return;
      }
      case "GET /v1/agents/audit": {
        requireIdentity(ctx);
        const agentId = resolvedRoute.agentId ?? requireAgentId(url);
        const events = await governance.service.readAudit(agentId, ctx.tenantId, 200);
        writeJson(response, 200, createOkEnvelope({ events }, { startedAt }));
        return;
      }
      case "POST /v1/agents/revoke": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const bodyAgentId = body?.agentId ?? body?.agent_id;
        assertPathIdentityMatch(
          resolvedRoute.agentId,
          bodyAgentId,
          "AGENT_REVOKE_PATH_IDENTITY_CONFLICT",
          "The request body agentId conflicts with the path-bound Agent.",
        );
        const result = await governance.service.revokeAgent(
          resolvedRoute.agentId ?? requireAgentIdOf(body),
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
        const approvalId = resolvedRoute.approvalId ?? String(body?.approvalId ?? body?.approval_id ?? "").trim();
        const decision = resolvedRoute.decision ?? body?.decision;
        assertPathIdentityMatch(
          resolvedRoute.approvalId,
          body?.approvalId ?? body?.approval_id,
          "APPROVAL_PATH_IDENTITY_CONFLICT",
          "The request body approvalId conflicts with the path-bound approval.",
        );
        assertPathIdentityMatch(
          resolvedRoute.decision,
          body?.decision,
          "APPROVAL_PATH_DECISION_CONFLICT",
          "The request body decision conflicts with the path-bound decision.",
        );
        if (!approvalId || (decision !== "approve" && decision !== "reject")) {
          throw badRequest("approvalId and decision (approve|reject) are required.");
        }
        const approval = await governance.service.decideApproval(approvalId, decision, ctx);
        writeJson(response, 200, createOkEnvelope({ approval }, { startedAt }));
        return;
      }
      case "GET /v1/approvals/list": {
        requireIdentity(ctx);
        const agentId = typeof url.searchParams.get("agentId") === "string" && url.searchParams.get("agentId") !== ""
          ? url.searchParams.get("agentId")
          : null;
        if (agentId && !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)) {
          throw badRequest("agentId must be a server-issued governed Agent identifier.");
        }
        const approvals = await governance.service.listApprovals(agentId, ctx.tenantId);
        writeJson(response, 200, createOkEnvelope({ approvals }, { startedAt }));
        return;
      }
      case "POST /v1/policies/create": {
        requireIdentity(ctx);
        const body = await readJson(request);
        const policy = await governance.service.createPolicyVersion({
          policyKey: String(body?.policyKey ?? body?.policy_key ?? "").trim(),
          version: Number(body?.version),
          policyType: body?.policyType ?? body?.policy_type,
          scopeKey: String(body?.scopeKey ?? body?.scope_key ?? "").trim(),
          content: body?.content ?? {},
        }, ctx);
        writeJson(response, 200, createOkEnvelope({ policy }, { startedAt }));
        return;
      }
      case "POST /v1/policies/activate": {
        requireIdentity(ctx);
        const body = await readJson(request);
        assertPathIdentityMatch(
          resolvedRoute.policyKey,
          body?.policyKey ?? body?.policy_key,
          "POLICY_PATH_IDENTITY_CONFLICT",
          "The request body policyKey conflicts with the path-bound Policy.",
        );
        assertPathIdentityMatch(
          resolvedRoute.policyVersion,
          body?.version,
          "POLICY_PATH_VERSION_CONFLICT",
          "The request body version conflicts with the path-bound Policy version.",
        );
        const result = await governance.service.activatePolicyVersion(
          resolvedRoute.policyKey ?? String(body?.policyKey ?? body?.policy_key ?? "").trim(),
          resolvedRoute.policyVersion ?? Number(body?.version),
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

type ResolvedAgentGovernanceRoute = {
  compatibilityRoute: string;
  agentId?: string;
  approvalId?: string;
  decision?: "approve" | "reject";
  policyKey?: string;
  policyVersion?: number;
};

function resolveAgentGovernanceRoute(method: unknown, pathname: unknown): ResolvedAgentGovernanceRoute | null {
  const normalizedMethod = String(method ?? "GET").toUpperCase();
  const normalizedPath = (String(pathname ?? "/").replace(/\/+$/u, "") || "/");
  const exactRoute = `${normalizedMethod} ${normalizedPath}`;
  if (AGENT_GOVERNANCE_ROUTE_DECLARATIONS.some(([declaration]) => declaration === exactRoute)) {
    return {
      compatibilityRoute: exactRoute === "GET /v1/agents"
        ? "GET /v1/agents/list"
        : exactRoute === "GET /v1/approvals"
          ? "GET /v1/approvals/list"
        : exactRoute === "POST /v1/policies"
          ? "POST /v1/policies/create"
          : exactRoute === "GET /v1/policies"
            ? "GET /v1/policies/list"
          : exactRoute,
    };
  }

  const agentMatch = /^\/v1\/agents\/(agt_[A-Za-z0-9_-]{1,128})(?:\/(effective-policy|audit|revoke))?$/u.exec(normalizedPath);
  if (agentMatch) {
    const [, agentId, action] = agentMatch;
    if (normalizedMethod === "GET" && action === undefined) {
      return { compatibilityRoute: "GET /v1/agents/describe", agentId };
    }
    if (normalizedMethod === "GET" && action === "effective-policy") {
      return { compatibilityRoute: "GET /v1/agents/effective-policy", agentId };
    }
    if (normalizedMethod === "GET" && action === "audit") {
      return { compatibilityRoute: "GET /v1/agents/audit", agentId };
    }
    if (normalizedMethod === "POST" && action === "revoke") {
      return { compatibilityRoute: "POST /v1/agents/revoke", agentId };
    }
  }

  const approvalMatch = /^\/v1\/approvals\/([A-Za-z0-9_-]{1,160})\/(approve|reject)$/u.exec(normalizedPath);
  if (normalizedMethod === "POST" && approvalMatch) {
    return {
      compatibilityRoute: "POST /v1/approvals/decide",
      approvalId: approvalMatch[1],
      decision: approvalMatch[2] as "approve" | "reject",
    };
  }

  const policyMatch = /^\/v1\/policies\/([^/]{1,160})\/(\d{1,9})\/activate$/u.exec(normalizedPath);
  if (normalizedMethod === "POST" && policyMatch) {
    const policyKey = decodePathSegment(policyMatch[1]);
    const policyVersion = Number(policyMatch[2]);
    if (!policyKey || !Number.isSafeInteger(policyVersion) || policyVersion < 1) return null;
    return {
      compatibilityRoute: "POST /v1/policies/activate",
      policyKey,
      policyVersion,
    };
  }
  return null;
}

function decodePathSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded && !/[\/\\\u0000-\u001f\u007f]/u.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

type NormalizedGovernanceRouteError = {
  code: string;
  message: string;
  statusCode: number;
  category: "validation" | "authorization" | "governance" | "internal";
  retryable: boolean;
  details?: Record<string, unknown>;
};

const AGENT_GENERATION_RECOVERY_REQUIRED = "AGENT_GENERATION_RECOVERY_REQUIRED";
const GOVERNED_AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;

function normalizeGovernanceRouteError(caught: unknown): NormalizedGovernanceRouteError {
  const error = caught && typeof caught === "object"
    ? caught as Record<string, unknown>
    : {};
  const name = typeof error.name === "string" ? error.name : "";
  const explicitCode = typeof error.code === "string" ? error.code : "";
  const code = explicitCode || name || "AGENT_GOVERNANCE_ROUTE_FAILED";
  const generationOutcomeUnknown = code === AGENT_GENERATION_RECOVERY_REQUIRED;
  const explicitStatus = Number.isInteger(error.statusCode) ? Number(error.statusCode) : null;
  let statusCode = explicitStatus && explicitStatus >= 400 && explicitStatus <= 599 ? explicitStatus : 400;
  if (generationOutcomeUnknown) {
    statusCode = 503;
  } else if (explicitStatus === null) {
    if (/NotFound$/u.test(name) || /(?:^|_)NOT_FOUND$/u.test(code)) statusCode = 404;
    else if (/Already|Conflict|Stale|Immutable|EpochChanged|DrainTimeout|StateChanged/u.test(name)
      || /(?:CONFLICT|STALE|ALREADY|IMMUTABLE|DRAIN_TIMEOUT|STATE_CHANGED|JOURNAL_CHANGED)/u.test(code)) statusCode = 409;
    else if (/(?:RECOVERY_REQUIRED|MIGRATION_REQUIRED|UNAVAILABLE)/u.test(code)) statusCode = 503;
    else if (/Integrity|Corrupt|TransactionFailed/u.test(name)
      || /(?:INTEGRITY|CORRUPT|TRANSACTION_FAILED)/u.test(code)) statusCode = 500;
  }
  const category = statusCode === 401 || statusCode === 403
    ? "authorization"
    : statusCode >= 500
      ? statusCode === 503 ? "governance" : "internal"
      : statusCode === 400 || statusCode === 422
        ? "validation"
        : "governance";
  const safeAgentId = typeof error.agentId === "string"
    && GOVERNED_AGENT_ID_PATTERN.test(error.agentId)
    ? error.agentId
    : null;
  const validationErrors = sanitizeValidationErrors(error.errors);
  const details: Record<string, unknown> | undefined = generationOutcomeUnknown
    ? {
        outcomeUnknown: true,
        retrySafe: false,
        reconciliation: {
          required: true,
          operation: "agent-generation",
          ...(safeAgentId ? { agentId: safeAgentId } : {}),
        },
      }
    : validationErrors ? { validationErrors }
      : error.rolledBack !== undefined ? {
        rolledBack: error.rolledBack === true,
        failClosedAgentIds: Array.isArray(error.failClosedAgentIds)
          ? error.failClosedAgentIds.filter((value): value is string => (
            typeof value === "string" && GOVERNED_AGENT_ID_PATTERN.test(value)
          )).slice(0, 256)
          : [],
      } : undefined;
  return {
    code,
    message: generationOutcomeUnknown
      ? "Agent generation may have committed; reconcile the Agent before issuing another generation request."
      : typeof error.message === "string" ? error.message : "Agent governance route failed.",
    statusCode,
    category,
    retryable: generationOutcomeUnknown ? false : statusCode === 503,
    ...(details === undefined ? {} : { details }),
  };
}

function sanitizeValidationErrors(value: unknown): Array<{ code: string; message: string }> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.slice(0, 50).map((item) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const rawCode = typeof record.code === "string" ? record.code : "POLICY_VALIDATION_FAILED";
    const rawMessage = typeof record.message === "string"
      ? record.message
      : "Policy validation failed.";
    return {
      code: /^[A-Z][A-Z0-9_]{0,127}$/u.test(rawCode) ? rawCode : "POLICY_VALIDATION_FAILED",
      message: rawMessage.replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, 500),
    };
  });
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
  const record = (body ?? {}) as { agentId?: unknown; agent_id?: unknown };
  const agentId = String(record.agentId ?? record.agent_id ?? "").trim();
  if (!agentId) throw badRequest("agentId is required.");
  return agentId;
}

function assertPathIdentityMatch(
  pathValue: unknown,
  bodyValue: unknown,
  code: string,
  message: string,
): void {
  if (pathValue === undefined || bodyValue === undefined || bodyValue === null || bodyValue === "") return;
  if (String(bodyValue).trim() === String(pathValue)) return;
  throw Object.assign(new Error(message), {
    name: "AgentGovernancePathConflict",
    code,
    statusCode: 409,
  });
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
