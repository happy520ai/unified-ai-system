// =============================================================================
// workforceRoutes.js — Workforce / Workflow 路由模块
// 从 httpServer.js 抽取的 /workforce/* 和 /workflow/* 路由
// =============================================================================

import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";

import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { redactSecretsInText } from "../security/secretSafety.js";

const GOVERNED_WORKFORCE_TOOL_NAME = "workforce_execute";
const GOVERNED_AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;

const ACTIVE_EXECUTION_ROUTES = new Set([
  "POST /workforce/execute",
  "POST /workforce/execute/approve",
  "POST /workforce/execute/revoke",
  "POST /workforce/execute/status",
  "POST /workforce/execute/cancel",
]);

export async function dispatchWorkforceExecutionRoutes(context) {
  const key = `${context.request.method} ${context.url.pathname}`;
  if (!ACTIVE_EXECUTION_ROUTES.has(key)) return ROUTE_NOT_HANDLED;
  const body = await context.readCapabilityJson({
    request: context.request,
    response: context.response,
    startedAt: context.startedAt,
    code: "workforce_execution_invalid_json",
  });
  if (!body) return undefined;
  const routes = createWorkforceRoutes(context.application, {
    ...context,
    writeErrorResponse: context.writeCapabilityError,
  });
  const route = routes.handlers.get(key);
  if (!route) return ROUTE_NOT_HANDLED;
  await route.handler(context.request, context.response, {
    startedAt: context.startedAt,
    body,
  });
  return undefined;
}

/**
 * 创建 Workforce 路由 handler 集合
 * @param {Object} application
 * @param {Object} helpers
 */
export function createWorkforceRoutes(application, helpers) {
  const { agentGovernance, workforceExecutor, workforceService, workflowService } = application;
  const {
    readCapabilityJson,
    requestExecution,
    writeJson,
    writeServiceLog,
    writeErrorResponse,
    createOkEnvelope,
    createErrorEnvelope,
  } = helpers;

  // ── GET /workflow/health ──
  async function handleWorkflowHealth(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(workflowService.getHealth(), { startedAt }));
  }

  // ── GET /workflow/actions ──
  async function handleWorkflowActions(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(workflowService.listActions(), { startedAt }));
  }

  // ── GET /workforce/health ──
  async function handleWorkforceHealth(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(workforceService.getHealth(), { startedAt }));
  }

  // ── GET /workforce/agents ──
  async function handleWorkforceAgents(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(workforceService.listAgents(), { startedAt }));
  }

  // ── POST /workforce/plan ──
  async function handleWorkforcePlan(req, res, { startedAt, body }) {
    if (!body) return;
    if (!body.goal) {
      writeErrorResponse({ response: res, error: { code: "WORKFORCE_GOAL_REQUIRED", message: "Goal is required", statusCode: 400 }, startedAt, fallbackCode: "workforce_plan_invalid_json" });
      return;
    }
    try {
      const result = workforceService.plan(body);
      const autoSaveResult = await workforceService.savePlan({ plan: result });
      const responseData = {
        ...result,
        autoSaved: true,
        planId: autoSaveResult.planId,
        autoSave: {
          phase: "phase-225a-agent-workforce-auto-save-latest-plan",
          status: autoSaveResult.status,
          planId: autoSaveResult.planId,
          savedAt: autoSaveResult.savedAt,
          historyVisible: true,
          handoffCodexReady: true,
          manualSaveStillAvailable: true,
          executionEnabled: false,
          codexExecInvoked: false,
          workflowRun: false,
          worktreeCreated: false,
        },
      };
      writeServiceLog("workforce_plan_completed", { method: "POST", path: "/workforce/plan", workforceId: responseData.workforceId, roleCount: responseData.selectedRoles?.length ?? 0, autoSaved: true, planId: autoSaveResult.planId, durationMs: Date.now() - startedAt });
      writeJson(res, 200, createOkEnvelope(responseData, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeServiceLog("workforce_plan_failed", { method: "POST", path: "/workforce/plan", code: error?.code, durationMs: Date.now() - startedAt });
      writeErrorResponse({ response: res, error, startedAt, fallbackCode: "workforce_plan_failed" });
    }
  }

  // ── POST /workforce/run-local ──
  async function handleWorkforceRunLocal(req, res, { startedAt, body }) {
    if (agentGovernance) {
      writeJson(res, 409, createErrorEnvelope(
        "WORKFORCE_RUN_LOCAL_REQUIRES_GOVERNED_EXECUTION",
        "Agent Governance is enabled; use POST /workforce/execute with a server-issued Agent identity.",
        { startedAt, category: "governance", details: { replacementRoute: "/workforce/execute" } },
      ));
      return;
    }
    if (!body) body = await readCapabilityJson({ request: req, response: res, startedAt, code: "workforce_run_local_invalid_json" });
    if (!body) return;
    try {
      const result = await workforceService.runLocal(body);
      writeServiceLog("workforce_real_local_run_completed", { method: "POST", path: "/workforce/run-local", runId: result.runId, planId: result.planId, workforceId: result.workforceId, taskCount: result.taskQueue?.length ?? 0, providerCallsMade: false, durationMs: Date.now() - startedAt });
      writeJson(res, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeServiceLog("workforce_real_local_run_failed", { method: "POST", path: "/workforce/run-local", code: error?.code, durationMs: Date.now() - startedAt });
      writeErrorResponse({ response: res, error, startedAt, fallbackCode: "workforce_real_local_run_failed" });
    }
  }

  // ── GET /workforce/tier ──
  async function handleWorkforceTier(_req, res, { startedAt }) {
    try {
      writeJson(res, 200, createOkEnvelope(await workforceService.getCurrentTier(), { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "tier_read_failed" });
    }
  }

  // ── POST /workforce/tier ──
  async function handleWorkforceTierSet(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "tier_set_bad" });
    if (!b) return;
    try {
      const r = await workforceService.setTier(b);
      writeJson(res, r?.success ? 200 : 422, createOkEnvelope(r, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "tier_set_failed" });
    }
  }

  // ── GET /workforce/autonomy/usage ──
  async function handleAutonomyUsage(_req, res, { startedAt }) {
    try {
      writeJson(res, 200, createOkEnvelope(await workforceService.getAutonomyUsage(), { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "autonomy_usage_failed" });
    }
  }

  // ── GET /workforce/autonomy/trust ──
  async function handleAutonomyTrust(_req, res, { startedAt }) {
    try {
      writeJson(res, 200, createOkEnvelope(await workforceService.getTrustSnapshot(), { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "autonomy_trust_failed" });
    }
  }

  // ── POST /workforce/autonomy/token ──
  async function handleAutonomyToken(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "autonomy_token_bad" });
    if (!b) return;
    try {
      writeJson(res, 200, createOkEnvelope(await workforceService.issueAutonomyToken(b), { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "autonomy_token_failed" });
    }
  }

  // ── POST /workforce/autonomy/token/revoke ──
  async function handleAutonomyTokenRevoke(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "autonomy_revoke_bad" });
    if (!b) return;
    try {
      writeJson(res, 200, createOkEnvelope(await workforceService.revokeAutonomyToken(b.tokenId, b.revokedBy, b.reason), { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "autonomy_revoke_failed" });
    }
  }

  // ── POST /workforce/diagnostic/read ──
  async function handleDiagnosticRead(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "diag_read_bad" });
    if (!b) return;
    try {
      const requestor = requireExecutionUserId(req);
      const diagnosticChannel = workforceExecutor.getDiagnosticChannel();
      writeJson(res, 200, createOkEnvelope(await diagnosticChannel.read({ ...b, requestor }), { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "diag_read_failed" });
    }
  }

  // ── POST /workforce/tier/gate ──
  async function handleTierGate(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "tier_gate_bad" });
    if (!b) return;
    try {
      const r = await workforceService.passGate(b);
      writeJson(res, r?.success ? 200 : 422, createOkEnvelope(r, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "tier_gate_failed" });
    }
  }

  // ── POST /workforce/tier/fallback ──
  async function handleTierFallback(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "tier_fb_bad" });
    if (!b) return;
    try {
      writeJson(res, 200, createOkEnvelope(await workforceService.fallBackTier(b), { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "tier_fb_failed" });
    }
  }

  // ── POST /workforce/execute ──
  async function handleWorkforceExecute(req, res, { startedAt, body }) {
    if (!body) return;
    if (!body.goal) {
      writeErrorResponse({ response: res, error: { code: "WORKFORCE_GOAL_REQUIRED", message: "Goal is required", statusCode: 400 }, startedAt, fallbackCode: "execute_bad" });
      return;
    }
    let governedExecution = null;
    let completedResult = null;
    let output = null;
    let approval = null;
    let primaryError = null;
    let releaseError = null;
    try {
      const userId = requireExecutionUserId(req);
      const tenantId = requireExecutionTenantId(req);
      const input = { ...body, userId, tenantId };
      governedExecution = await authorizeGovernedWorkforceExecution(req, input);
      if (governedExecution?.approval) {
        approval = governedExecution.approval;
      } else {
        const effectiveInput = governedExecution
          ? applyApprovedWorkforceInput(input, governedExecution.approvedParams)
          : input;
        completedResult = governedExecution
          ? await workforceExecutor.execute(effectiveInput, {
              signal: requestExecution?.signal ?? null,
              agentGovernance: {
                context: governedExecution.context,
                policy: governedExecution.policy,
                executionLease: governedExecution.executionLease,
                remainingSteps: governedExecution.remainingSteps,
                reserveStep: governedExecution.reserveStep,
              },
            })
          : requestExecution?.signal
            ? await workforceExecutor.execute(input, { signal: requestExecution.signal })
            : await workforceExecutor.execute(input);
        output = completedResult;
        if (governedExecution) {
          const metered = await agentGovernance.toolProxy.enforceResult({
            context: governedExecution.context,
            toolName: GOVERNED_WORKFORCE_TOOL_NAME,
            policy: governedExecution.policy,
            result: completedResult,
            // Workforce returns an orchestration envelope rather than a record
            // collection. A configured maxRecords ceiling therefore remains
            // fail-closed until a dedicated result contract is introduced.
            descriptor: null,
          });
          if (!metered || typeof metered !== "object" || !Object.hasOwn(metered, "result")) {
            throw workforceGovernanceError(
              "WORKFORCE_RESULT_GOVERNANCE_INVALID",
              "Workforce completed, but terminal governance returned a malformed result.",
              503,
            );
          }
          if (metered?.verdict === "replace") {
            throw workforceGovernanceError(
              metered.code ?? "WORKFORCE_GOVERNED_RESULT_REPLACED",
              "Workforce completed, but its terminal result could not be returned safely.",
              503,
            );
          }
          output = metered.result;
        }
      }
    } catch (e) {
      primaryError = e;
    }
    for (const [lease, release] of [
      [governedExecution?.toolExecutionLease, () => governedExecution.toolExecutionLease.release()],
      [governedExecution?.executionLease, () => governedExecution.executionLease.release()],
    ]) {
      if (typeof lease?.release !== "function") continue;
      try { await release(); }
      catch (error) { releaseError ??= error; }
    }
    if (approval && !primaryError) {
      writeJson(res, 202, createOkEnvelope(approval, { startedAt }));
      return;
    }
    const terminalError = primaryError ?? releaseError;
    if (terminalError) {
      writeErrorResponse({
        response: res,
        error: completedResult && governedExecution
          ? workforceOutcomeUncertainError(completedResult, governedExecution, terminalError)
          : terminalError,
        startedAt,
        fallbackCode: "execute_failed",
      });
      return;
    }
    writeJson(res, output?.success ? 200 : 422, createOkEnvelope(output, { startedAt }));
  }

  async function authorizeGovernedWorkforceExecution(request, input) {
    const service = agentGovernance?.service;
    const toolProxy = agentGovernance?.toolProxy;
    if (!service) return null;
    if (!toolProxy || typeof toolProxy.enforce !== "function" || typeof toolProxy.enforceResult !== "function") {
      throw workforceGovernanceError(
        "WORKFORCE_GOVERNANCE_RUNTIME_UNAVAILABLE",
        "The Agent Governance Tool Proxy is unavailable for Workforce execution.",
        503,
      );
    }
    const context = buildGovernedWorkforceContext(request, input.agentId);
    if (!context) {
      throw workforceGovernanceError(
        "WORKFORCE_GOVERNANCE_IDENTITY_REQUIRED",
        "Governed Workforce execution requires a server-issued agentId and authenticated tenant/user identity.",
        403,
      );
    }
    if (typeof service.authorizeAgentExecution !== "function") {
      throw workforceGovernanceError(
        "WORKFORCE_GOVERNANCE_RUNTIME_UNAVAILABLE",
        "The governance runtime cannot authorize Workforce Agent execution.",
        503,
      );
    }

    const authorized = await service.authorizeAgentExecution(context.agentId, context);
    const rootRecord = authorized?.record;
    if (!rootRecord || rootRecord.parentAgentId !== null || rootRecord.generationDepth !== 0) {
      authorized?.executionLease?.release?.();
      throw workforceGovernanceError(
        "WORKFORCE_ROOT_AGENT_REQUIRED",
        "Governed Workforce execution requires an authorized root Agent.",
        403,
      );
    }
    if (!authorized?.policy || !authorized?.executionLease?.signal
      || typeof authorized.executionLease.assertActive !== "function"
      || typeof authorized.executionLease.release !== "function") {
      authorized?.executionLease?.release?.();
      throw workforceGovernanceError(
        "WORKFORCE_GOVERNANCE_EXECUTION_DENIED",
        "The governed Agent is not authorized to execute Workforce.",
        403,
      );
    }

    let descriptor;
    let toolExecutionLease = null;
    try {
      if (typeof workforceExecutor?.describeExecution !== "function") {
        throw workforceGovernanceError(
          "WORKFORCE_GOVERNANCE_DESCRIPTOR_UNAVAILABLE",
          "The Workforce executor cannot produce a canonical execution descriptor.",
          503,
        );
      }
      descriptor = await workforceExecutor.describeExecution(input);
      const requestedParams = createSafeWorkforceGovernanceParams(input, descriptor);
      const proxyVerdict = await toolProxy.enforce({
        context,
        toolName: GOVERNED_WORKFORCE_TOOL_NAME,
        params: requestedParams,
        resourceContext: {
          resourceKeys: {
            planId: requestedParams.planId,
            planDigest: requestedParams.planDigest,
          },
          resources: [`workforce:plan:${requestedParams.planId}`],
          approvalReview: createWorkforceApprovalReview(input, descriptor, requestedParams),
        },
      });
      if (proxyVerdict?.outcome === "approval_required" && proxyVerdict.approvalId) {
        return {
          context,
          policy: authorized.policy,
          executionLease: authorized.executionLease,
          toolExecutionLease: null,
          approval: {
            outcome: "approval_required",
            code: proxyVerdict.code ?? "TOOL_APPROVAL_REQUIRED",
            approvalId: proxyVerdict.approvalId,
            agentId: context.agentId,
            toolName: GOVERNED_WORKFORCE_TOOL_NAME,
            planId: requestedParams.planId,
            planDigest: requestedParams.planDigest,
          },
        };
      }
      if (proxyVerdict?.outcome === "approval_required") {
        proxyVerdict?.executionLease?.release?.();
        throw workforceGovernanceError(
          "WORKFORCE_GOVERNANCE_APPROVAL_INVALID",
          "Agent Governance returned an incomplete Workforce approval decision.",
          503,
        );
      }
      if (proxyVerdict?.outcome !== "allow" || !proxyVerdict.executionLease
        || typeof proxyVerdict.executionLease.release !== "function") {
        proxyVerdict?.executionLease?.release?.();
        throw workforceGovernanceError(
          proxyVerdict?.code ?? "WORKFORCE_GOVERNANCE_TOOL_DENIED",
          proxyVerdict?.reason ?? "The effective Agent policy denied Workforce execution.",
          403,
        );
      }
      toolExecutionLease = proxyVerdict.executionLease;
      const approvedParams = readApprovedWorkforceParams(proxyVerdict, requestedParams);
      const usage = typeof service.getUsage === "function"
        ? await service.getUsage(context.agentId)
        : { steps: 0 };
      const maxSteps = authorized.policy.limits?.maxSteps;
      const remainingSteps = typeof maxSteps === "number"
        ? Math.max(0, Math.floor(maxSteps) - Math.max(0, Math.floor(Number(usage?.steps) || 0)))
        : null;
      return {
        context,
        policy: authorized.policy,
        executionLease: authorized.executionLease,
        toolExecutionLease,
        approvedParams,
        remainingSteps,
        reserveStep: () => service.reserveUsage(context.agentId, authorized.policy.limits, { steps: 1 }),
      };
    } catch (error) {
      toolExecutionLease?.release?.();
      authorized.executionLease.release();
      throw error;
    }
  }

  async function handleWorkforceExecuteApprove(req, res, { startedAt, body }) {
    if (!body) return;
    try {
      const userId = requireExecutionUserId(req);
      const tenantId = requireExecutionTenantId(req);
      const result = await workforceExecutor.approveExecution(
        { ...body, userId, tenantId },
        userId,
        body.approvedScopes,
      );
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "execute_approval_failed" });
    }
  }

  async function handleWorkforceExecuteRevoke(req, res, { startedAt, body }) {
    if (!body) return;
    try {
      const userId = requireExecutionUserId(req);
      const tenantId = requireExecutionTenantId(req);
      const result = await workforceExecutor.revokeApproval(body.planId, userId, body.reason, tenantId);
      writeJson(res, result?.success ? 200 : 404, createOkEnvelope(result, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "execute_approval_revoke_failed" });
    }
  }

  async function handleWorkforceExecuteStatus(req, res, { startedAt, body }) {
    if (!body) body = await readCapabilityJson({ request: req, response: res, startedAt, code: "execute_status_bad" });
    if (!body) return;
    try {
      const identity = requireExecutionIdentity(req);
      const result = await workforceExecutor.getStatus(body.executionId, identity);
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "execute_status_failed" });
    }
  }

  async function handleWorkforceExecuteCancel(req, res, { startedAt, body }) {
    if (!body) body = await readCapabilityJson({ request: req, response: res, startedAt, code: "execute_cancel_bad" });
    if (!body) return;
    try {
      const identity = requireExecutionIdentity(req);
      const result = await workforceExecutor.cancel(body.executionId, body.reason, identity);
      writeJson(res, result?.success === false ? 409 : 200, createOkEnvelope(result, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "execute_cancel_failed" });
    }
  }

  // ── POST /workforce/plans/save ──
  async function handleWorkforcePlansSave(req, res, { startedAt, body }) {
    if (!body) body = await readCapabilityJson({ request: req, response: res, startedAt, code: "plans_save_bad" });
    if (!body) return;
    try {
      const result = await workforceService.savePlan(body);
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "plans_save_failed" });
    }
  }

  // ── GET /workforce/plans ──
  async function handleWorkforcePlans(_req, res, { startedAt }) {
    try {
      const plans = await workforceService.listPlans();
      writeJson(res, 200, createOkEnvelope(plans, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "plans_list_failed" });
    }
  }

  // ── 导出 ──
  const handlers = new Map([
    ["GET /workflow/health", { handler: handleWorkflowHealth, public: false, permission: "dashboard:read" }],
    ["GET /workflow/actions", { handler: handleWorkflowActions, public: false, permission: "dashboard:read" }],
    ["GET /workforce/health", { handler: handleWorkforceHealth, public: false, permission: "dashboard:read" }],
    ["GET /workforce/agents", { handler: handleWorkforceAgents, public: false, permission: "dashboard:read" }],
    ["POST /workforce/plan", { handler: handleWorkforcePlan, public: false, permission: "workflow:run" }],
    ["POST /workforce/run-local", { handler: handleWorkforceRunLocal, public: false, permission: "workflow:run" }],
    ["GET /workforce/tier", { handler: handleWorkforceTier, public: false, permission: "dashboard:read" }],
    ["POST /workforce/tier", { handler: handleWorkforceTierSet, public: false, permission: "workflow:run" }],
    ["POST /workforce/tier/gate", { handler: handleTierGate, public: false, permission: "workflow:run" }],
    ["POST /workforce/tier/fallback", { handler: handleTierFallback, public: false, permission: "workflow:run" }],
    ["GET /workforce/autonomy/usage", { handler: handleAutonomyUsage, public: false, permission: "dashboard:read" }],
    ["GET /workforce/autonomy/trust", { handler: handleAutonomyTrust, public: false, permission: "dashboard:read" }],
    ["POST /workforce/autonomy/token", { handler: handleAutonomyToken, public: false, permission: "workflow:run" }],
    ["POST /workforce/autonomy/token/revoke", { handler: handleAutonomyTokenRevoke, public: false, permission: "workflow:run" }],
    ["POST /workforce/diagnostic/read", { handler: handleDiagnosticRead, public: false, permission: "audit:read" }],
    ["POST /workforce/execute", { handler: handleWorkforceExecute, public: false, permission: "workflow:run" }],
    ["POST /workforce/execute/approve", { handler: handleWorkforceExecuteApprove, public: false, permission: "workflow:approve" }],
    ["POST /workforce/execute/revoke", { handler: handleWorkforceExecuteRevoke, public: false, permission: "workflow:approve" }],
    ["POST /workforce/execute/status", { handler: handleWorkforceExecuteStatus, public: false, permission: "dashboard:read" }],
    ["POST /workforce/execute/cancel", { handler: handleWorkforceExecuteCancel, public: false, permission: "workflow:run" }],
    ["POST /workforce/plans/save", { handler: handleWorkforcePlansSave, public: false, permission: "workflow:run" }],
    ["GET /workforce/plans", { handler: handleWorkforcePlans, public: false, permission: "dashboard:read" }],
  ]);

  return { handlers };

  function requireExecutionUserId(request) {
    const identity = request?.enterpriseIdentity;
    const userId = identity?.userId ?? identity?.subject ?? identity?.id;
    if (typeof userId !== "string" || !userId.trim()) {
      const error = new Error("An authenticated enterprise identity is required for workforce execution.");
      error.code = "WORKFORCE_EXECUTION_IDENTITY_REQUIRED";
      error.statusCode = 401;
      throw error;
    }
    if (!workforceExecutor) {
      const error = new Error("The controlled workforce executor is unavailable.");
      error.code = "WORKFORCE_EXECUTOR_UNAVAILABLE";
      error.statusCode = 503;
      throw error;
    }
    return userId.trim();
  }

  function requireExecutionTenantId(request) {
    const tenantId = request?.enterpriseIdentity?.tenantId;
    return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : "default";
  }

  function requireExecutionIdentity(request) {
    return {
      userId: requireExecutionUserId(request),
      tenantId: requireExecutionTenantId(request),
    };
  }
}

function buildGovernedWorkforceContext(request, agentId) {
  const identity = request?.enterpriseIdentity;
  const normalizedAgentId = typeof agentId === "string" && GOVERNED_AGENT_ID_PATTERN.test(agentId)
    ? agentId
    : null;
  const tenantId = typeof identity?.tenantId === "string" && identity.tenantId.trim()
    ? identity.tenantId.trim()
    : null;
  const userId = typeof identity?.userId === "string" && identity.userId.trim()
    ? identity.userId.trim()
    : null;
  if (!normalizedAgentId || !tenantId || !userId) return null;
  return {
    agentId: normalizedAgentId,
    tenantId,
    userId,
    role: identity.role,
    permissions: Array.isArray(identity.permissions) ? [...identity.permissions] : [],
  };
}

function createSafeWorkforceGovernanceParams(input, descriptor) {
  const goal = typeof input?.goal === "string" ? input.goal.trim() : "";
  const planDigest = typeof descriptor?.planDigest === "string" ? descriptor.planDigest : "";
  if (!/^[a-f0-9]{64}$/u.test(planDigest)) {
    throw workforceGovernanceError(
      "WORKFORCE_GOVERNANCE_DESCRIPTOR_INVALID",
      "The Workforce execution descriptor did not contain a canonical plan digest.",
      503,
    );
  }
  return Object.freeze({
    goal,
    planId: descriptor.planId,
    planDigest,
    goalDigest: createHash("sha256").update(goal, "utf8").digest("hex"),
    goalBytes: Buffer.byteLength(goal, "utf8"),
    options: Object.freeze({
      autonomyMode: typeof descriptor?.autonomyMode === "string" ? descriptor.autonomyMode : "unknown",
      requiredScopes: Object.freeze(Array.isArray(descriptor?.requiredScopes) ? [...descriptor.requiredScopes] : []),
      selectedRoleCount: Array.isArray(input?.selectedRoles) ? input.selectedRoles.length : null,
      templateSelected: typeof input?.selectedTemplate === "string" || typeof input?.templateId === "string",
    }),
  });
}

function createWorkforceApprovalReview(input, descriptor, params) {
  const goal = typeof input?.goal === "string" ? input.goal.trim() : "";
  const redacted = redactSecretsInText(goal)
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]{8,}/giu, "$1 ***REDACTED***")
    .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu, "$1=***REDACTED***");
  const reviewable = goal.length > 0 && goal.length <= 4_000 && redacted === goal
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(goal);
  if (!reviewable) {
    return Object.freeze({
      schemaVersion: 1,
      reviewable: false,
      effectType: "workforce:execute",
      unavailableReason: "Workforce goal contains secret-like or unsafe text and cannot be shown for approval.",
    });
  }
  const reviewOptions = Object.freeze({
    selectedRoleCount: params.options.selectedRoleCount,
    templateSelected: params.options.templateSelected,
  });
  return Object.freeze({
    schemaVersion: 1,
    reviewable: true,
    effectType: "workforce:execute",
    workforce: Object.freeze({
      goal,
      goalDigest: `sha256:${params.goalDigest}`,
      goalBytes: params.goalBytes,
      planId: params.planId,
      planDigest: `sha256:${params.planDigest}`,
      autonomyMode: params.options.autonomyMode,
      requiredScopes: Object.freeze([...params.options.requiredScopes]),
      optionsHash: `sha256:${createHash("sha256").update(stableStringify(reviewOptions), "utf8").digest("hex")}`,
      options: reviewOptions,
    }),
  });
}

function readApprovedWorkforceParams(verdict, requestedParams) {
  if (verdict?.approvedParams === undefined) return requestedParams;
  const approved = verdict.approvedParams;
  if (!approved || typeof approved !== "object" || Array.isArray(approved)
    || stableStringify(approved) !== stableStringify(requestedParams)) {
    throw workforceGovernanceError(
      "WORKFORCE_APPROVED_PARAMS_INVALID",
      "Authenticated approved Workforce parameters do not match the canonical execution descriptor.",
      409,
    );
  }
  return approved;
}

function applyApprovedWorkforceInput(input, approvedParams) {
  if (!approvedParams || typeof approvedParams !== "object" || Array.isArray(approvedParams)) {
    throw workforceGovernanceError(
      "WORKFORCE_APPROVED_PARAMS_INVALID",
      "Canonical Workforce execution parameters are unavailable.",
      409,
    );
  }
  return {
    ...input,
    goal: approvedParams.goal,
    planId: approvedParams.planId,
    autonomyMode: approvedParams.options.autonomyMode,
  };
}

function workforceGovernanceError(code, message, statusCode) {
  return Object.assign(new Error(message), {
    code,
    statusCode,
    category: statusCode >= 500 ? "availability" : "authorization",
  });
}

function workforceOutcomeUncertainError(completedResult, governedExecution, cause) {
  const approved = governedExecution?.approvedParams;
  const planId = safeReconciliationIdentifier(
    approved?.planId ?? completedResult?.planId,
  );
  const planDigest = typeof approved?.planDigest === "string" && /^[a-f0-9]{64}$/u.test(approved.planDigest)
    ? approved.planDigest
    : null;
  const executionId = safeReconciliationIdentifier(
    completedResult?.executionId ?? completedResult?.runId,
  );
  return Object.assign(new Error(
    "Workforce execution completed, but terminal governance did not; reconcile before retrying.",
    { cause },
  ), {
    code: "WORKFORCE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
    statusCode: 503,
    category: "governance",
    retryable: false,
    details: {
      outcomeUnknown: true,
      retrySafe: false,
      reconciliation: {
        required: true,
        agentId: governedExecution?.context?.agentId,
        ...(planId ? { planId } : {}),
        ...(planDigest ? { planDigest } : {}),
        ...(executionId ? { executionId } : {}),
      },
    },
  });
}

function safeReconciliationIdentifier(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized && normalized.length <= 160 && /^[A-Za-z0-9_.:-]+$/u.test(normalized)
    ? normalized
    : null;
}
