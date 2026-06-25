// =============================================================================
// legacyRoutes.js — 遗留路由模块
// 从 httpServer.js 抽取的 Codex、chat-gateway、agent-runner 等路由
// 这些路由将在后续迭代中进一步拆分为独立模块
// =============================================================================

/**
 * 创建遗留路由 handler 集合
 * @param {Object} application
 * @param {Object} helpers
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createLegacyRoutes(application, helpers) {
  const {
    codexExecCrsRuntimeCandidate,
    gatewayService,
    knowledgeService,
    workforceService,
    workflowService,
    userExperienceService,
    capabilityRouterService,
    fiveCapabilityActivationService,
    forgeService,
  } = application;

  const {
    readJson,
    writeJson,
    writeServiceLog,
    createOkEnvelope,
    createErrorEnvelope,
  } = helpers;

  const handlers = new Map();

  // ── Codex Handoff ──
  handlers.set("GET /codex-handoff/next-task", {
    handler: async function handleCodexHandoff(_req, res, { startedAt }) {
      try {
        const { createNextCodexTask, writeNextCodexTaskOutbox } = await import("../../entrypoints/handoffNextTask.js");
        const task = createNextCodexTask();
        writeNextCodexTaskOutbox(task);
        writeJson(res, 200, createOkEnvelope(task, { startedAt }));
      } catch (error) {
        writeJson(res, 500, createErrorEnvelope("codex_handoff_failed", error.message, { startedAt }));
      }
    },
    public: true,
    description: "Codex 任务交接",
  });

  // ── Codex Loop Status ──
  handlers.set("GET /codex-loop/status", {
    handler: async function handleCodexLoopStatus(_req, res, { startedAt }) {
      try {
        const { readCodexLoopStatus } = await import("../../entrypoints/codexLoopStatus.js");
        const status = readCodexLoopStatus();
        writeJson(res, 200, createOkEnvelope(status, { startedAt }));
      } catch (error) {
        writeJson(res, 500, createErrorEnvelope("codex_loop_status_failed", error.message, { startedAt }));
      }
    },
    public: true,
    description: "Codex 循环状态",
  });

  // ── Workflow Routes ──
  handlers.set("GET /workflow/health", {
    handler: async function handleWorkflowHealth(_req, res, { startedAt }) {
      const health = workflowService.getHealth();
      writeJson(res, 200, createOkEnvelope(health, { startedAt }));
    },
    public: true,
    description: "工作流健康检查",
  });

  handlers.set("GET /workflow/actions", {
    handler: async function handleWorkflowActions(_req, res, { startedAt }) {
      const actions = workflowService.getActions();
      writeJson(res, 200, createOkEnvelope({ actions }, { startedAt }));
    },
    public: true,
    description: "工作流动作列表",
  });

  // ── Forge Routes ──
  handlers.set("GET /forge/health", {
    handler: async function handleForgeHealth(_req, res, { startedAt }) {
      if (!forgeService) {
        writeJson(res, 200, createOkEnvelope({ status: "disabled" }, { startedAt }));
        return;
      }
      const health = forgeService.getHealth();
      writeJson(res, 200, createOkEnvelope(health, { startedAt }));
    },
    public: true,
    description: "Forge 健康检查",
  });

  // ── Runtime Candidate Routes ──
  handlers.set("GET /runtime-candidate/codex-exec-crs/status", {
    handler: async function handleRuntimeCandidateStatus(_req, res, { startedAt }) {
      if (!codexExecCrsRuntimeCandidate) {
        writeJson(res, 200, createOkEnvelope({ status: "not_configured" }, { startedAt }));
        return;
      }
      const status = codexExecCrsRuntimeCandidate.getStatus();
      writeJson(res, 200, createOkEnvelope(status, { startedAt }));
    },
    public: true,
    description: "运行时候选状态",
  });

  // ── Capability Router Routes ──
  handlers.set("GET /capability-router/status", {
    handler: async function handleCapabilityRouterStatus(_req, res, { startedAt }) {
      const status = capabilityRouterService.getStatus();
      writeJson(res, 200, createOkEnvelope(status, { startedAt }));
    },
    public: true,
    description: "能力路由状态",
  });

  // ── Five Capability Activation Routes ──
  handlers.set("GET /five-capability/status", {
    handler: async function handleFiveCapabilityStatus(_req, res, { startedAt }) {
      const status = fiveCapabilityActivationService.getStatus();
      writeJson(res, 200, createOkEnvelope(status, { startedAt }));
    },
    public: true,
    description: "五能力激活状态",
  });

  // ── User Experience Routes ──
  handlers.set("GET /user-experience/status", {
    handler: async function handleUserExperienceStatus(_req, res, { startedAt }) {
      const status = userExperienceService.getStatus();
      writeJson(res, 200, createOkEnvelope(status, { startedAt }));
    },
    public: true,
    description: "用户体验状态",
  });

  return { handlers };
}
