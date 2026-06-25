// =============================================================================
// workforceRoutes.js — Workforce / Workflow 路由模块
// 从 httpServer.js 抽取的 /workforce/* 和 /workflow/* 路由
// =============================================================================

/**
 * 创建 Workforce 路由 handler 集合
 * @param {Object} application
 * @param {Object} helpers
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createWorkforceRoutes(application, helpers) {
  const { workforceService, workflowService } = application;
  const { readCapabilityJson, writeJson, writeServiceLog, writeErrorResponse, createOkEnvelope, createErrorEnvelope } = helpers;

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
  async function handleWorkforcePlan(req, res, { startedAt }) {
    const body = await readCapabilityJson({ request: req, response: res, startedAt, code: "workforce_plan_invalid_json" });
    if (!body) return;
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
  async function handleWorkforceRunLocal(req, res, { startedAt }) {
    const body = await readCapabilityJson({ request: req, response: res, startedAt, code: "workforce_run_local_invalid_json" });
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
      writeJson(res, 200, createOkEnvelope(await workforceService.diagnosticRead(b), { startedAt }));
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
  async function handleWorkforceExecute(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "execute_bad" });
    if (!b) return;
    try {
      const result = await workforceService.execute(b);
      writeJson(res, result?.success ? 200 : 422, createOkEnvelope(result, { startedAt }));
    } catch (e) {
      writeErrorResponse({ response: res, error: e, startedAt, fallbackCode: "execute_failed" });
    }
  }

  // ── POST /workforce/plans/save ──
  async function handleWorkforcePlansSave(req, res, { startedAt }) {
    const b = await readCapabilityJson({ request: req, response: res, startedAt, code: "plans_save_bad" });
    if (!b) return;
    try {
      const result = await workforceService.savePlan(b);
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
    ["POST /workforce/diagnostic/read", { handler: handleDiagnosticRead, public: false, permission: "dashboard:read" }],
    ["POST /workforce/execute", { handler: handleWorkforceExecute, public: false, permission: "workflow:run" }],
    ["POST /workforce/plans/save", { handler: handleWorkforcePlansSave, public: false, permission: "workflow:run" }],
    ["GET /workforce/plans", { handler: handleWorkforcePlans, public: false, permission: "dashboard:read" }],
  ]);

  return { handlers };
}
