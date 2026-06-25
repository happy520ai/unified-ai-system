// =============================================================================
// modelRoutes.js — 模型路由模块
// 从 httpServer.js 抽取的 /models/* 路由
// =============================================================================

/**
 * 创建模型路由 handler 集合
 * @param {Object} application
 * @param {Object} helpers — { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope }
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createModelRoutes(application, helpers) {
  const { modelImportService, modelLibraryStore, capabilityRouterService } = application;
  const { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope } = helpers;

  // ── GET /models/capability-router/status ──
  async function handleCapabilityRouterStatus(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(capabilityRouterService.getStatus(), { startedAt }));
  }

  // ── POST /models/import/preview ──
  async function handleModelImportPreview(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope(
        "model_import_preview_invalid_json",
        "Model import preview body must be valid JSON.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    try {
      const result = await modelImportService.preview(body);
      if (writeServiceLog) {
        writeServiceLog("model_import_preview_completed", {
          method: "POST",
          path: "/models/import/preview",
          status: result.status,
          modelCount: result.models?.length ?? 0,
          durationMs: Date.now() - startedAt,
        });
      }
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeJson(res, 422, createErrorEnvelope(
        error?.code ?? "model_import_preview_failed",
        error instanceof Error ? error.message : "Model import preview failed.",
        { startedAt, category: "provider" },
      ));
    }
  }

  // ── POST /models/import/confirm ──
  async function handleModelImportConfirm(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope(
        "model_import_confirm_invalid_json",
        "Model import confirm body must be valid JSON.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    try {
      const result = modelImportService.confirm(body);
      if (writeServiceLog) {
        writeServiceLog("model_import_confirm_completed", {
          method: "POST",
          path: "/models/import/confirm",
          status: result.status,
          providerId: result.providerId,
          modelId: result.modelId,
          durationMs: Date.now() - startedAt,
        });
      }
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeJson(res, 422, createErrorEnvelope(
        error?.code ?? "model_import_confirm_failed",
        error instanceof Error ? error.message : "Model import confirm failed.",
        { startedAt, category: "provider" },
      ));
    }
  }

  // ── GET /models/library ──
  async function handleModelLibrary(_req, res, { startedAt }) {
    const registry = modelLibraryStore.getRegistry();
    writeJson(res, 200, createOkEnvelope({ registry }, { startedAt }));
  }

  // ── 导出 ──
  const handlers = new Map([
    ["GET /models/capability-router/status", { handler: handleCapabilityRouterStatus, public: true, description: "能力路由状态" }],
    ["POST /models/import/preview", { handler: handleModelImportPreview, public: true, description: "模型导入预览" }],
    ["POST /models/import/confirm", { handler: handleModelImportConfirm, public: true, description: "模型导入确认" }],
    ["GET /models/library", { handler: handleModelLibrary, public: true, description: "模型库列表" }],
  ]);

  return { handlers };
}
