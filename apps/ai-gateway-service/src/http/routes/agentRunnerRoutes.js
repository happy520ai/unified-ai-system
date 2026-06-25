// =============================================================================
// agentRunnerRoutes.js — Agent Runner 路由模块
// 从 httpServer.js 提取的 agent-runner 和 local-agent 路由
// =============================================================================

/**
 * 创建 Agent Runner 路由 handler 集合
 * @param {Object} application
 * @param {Object} helpers
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createAgentRunnerRoutes(application, helpers) {
  const { agentIntentExplainer, localOperationLoop } = application;
  const { readJson, writeJson, createOkEnvelope, createErrorEnvelope, writeServiceLog } = helpers;

  const handlers = new Map();

  // POST /agent-runner/intent-approval-preview
  handlers.set("POST /agent-runner/intent-approval-preview", {
    handler: async function handleIntentApprovalPreview(req, res, { startedAt, body }) {
      if (!body) {
        writeJson(res, 400, createErrorEnvelope("invalid_json", "Request body required", { startedAt }));
        return;
      }
      try {
        const result = await agentIntentExplainer.explainIntent(body);
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(res, 500, createErrorEnvelope("intent_preview_failed", error.message, { startedAt }));
      }
    },
    public: true,
    description: "意图审批预览",
  });

  // POST /agent-runner/local-operation
  handlers.set("POST /agent-runner/local-operation", {
    handler: async function handleLocalOperation(req, res, { startedAt, body }) {
      if (!body) {
        writeJson(res, 400, createErrorEnvelope("invalid_json", "Request body required", { startedAt }));
        return;
      }
      try {
        const result = await localOperationLoop.runOperation(body);
        writeServiceLog("local_operation_completed", { durationMs: Date.now() - startedAt });
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(res, 500, createErrorEnvelope("local_operation_failed", error.message, { startedAt }));
      }
    },
    public: true,
    description: "本地操作执行",
  });

  // POST /local-agent/intent-preview
  handlers.set("POST /local-agent/intent-preview", {
    handler: async function handleLocalAgentIntentPreview(req, res, { startedAt, body }) {
      if (!body) {
        writeJson(res, 400, createErrorEnvelope("invalid_json", "Request body required", { startedAt }));
        return;
      }
      try {
        const result = await agentIntentExplainer.explainIntent(body);
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(res, 500, createErrorEnvelope("intent_preview_failed", error.message, { startedAt }));
      }
    },
    public: true,
    description: "本地 Agent 意图预览",
  });

  // POST /local-agent/operation-plan
  handlers.set("POST /local-agent/operation-plan", {
    handler: async function handleOperationPlan(req, res, { startedAt, body }) {
      if (!body) {
        writeJson(res, 400, createErrorEnvelope("invalid_json", "Request body required", { startedAt }));
        return;
      }
      try {
        const result = await localOperationLoop.createPlan(body);
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(res, 500, createErrorEnvelope("operation_plan_failed", error.message, { startedAt }));
      }
    },
    public: true,
    description: "本地 Agent 操作计划",
  });

  // POST /local-agent/patch-proposal
  handlers.set("POST /local-agent/patch-proposal", {
    handler: async function handlePatchProposal(req, res, { startedAt, body }) {
      if (!body) {
        writeJson(res, 400, createErrorEnvelope("invalid_json", "Request body required", { startedAt }));
        return;
      }
      try {
        const result = await localOperationLoop.createPatchProposal(body);
        writeJson(res, 200, createOkEnvelope(result, { startedAt }));
      } catch (error) {
        writeJson(res, 500, createErrorEnvelope("patch_proposal_failed", error.message, { startedAt }));
      }
    },
    public: true,
    description: "本地 Agent 补丁提案",
  });

  return { handlers };
}
