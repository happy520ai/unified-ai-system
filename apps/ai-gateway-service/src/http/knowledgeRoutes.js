// =============================================================================
// knowledgeRoutes.js — 知识库路由模块
// 从 httpServer.js 抽取的 /knowledge/* 路由
// =============================================================================

import { getSupportedKnowledgeFileTypes, parseKnowledgeFile } from "../knowledge/documentParsers.js";
import { validators } from "../validation/httpSchemas.js";

/**
 * 创建知识库路由 handler 集合
 * @param {Object} application
 * @param {Object} helpers — { readJson, readCapabilityJson, writeJson, writeServiceLog, writeErrorResponse, createOkEnvelope, createErrorEnvelope }
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createKnowledgeRoutes(application, helpers) {
  const { knowledgeService, userExperienceService } = application;
  const { readJson, readCapabilityJson, writeJson, writeServiceLog, writeErrorResponse, createOkEnvelope, createErrorEnvelope } = helpers;

  // ── GET /knowledge/health ──
  async function handleKnowledgeHealth(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(knowledgeService.getHealth(), { startedAt }));
  }

  // ── GET /knowledge/infra/readiness ──
  async function handleKnowledgeInfraReadiness(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(application.knowledgeInfra.getReadiness(), { startedAt }));
  }

  // ── GET /knowledge/sources ──
  async function handleKnowledgeSources(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope(knowledgeService.listSources(), { startedAt }));
  }

  // ── GET /knowledge/file-types ──
  async function handleKnowledgeFileTypes(_req, res, { startedAt }) {
    writeJson(res, 200, createOkEnvelope({ supported: getSupportedKnowledgeFileTypes() }, { startedAt }));
  }

  // ── POST /knowledge/graph/retrieve ──
  async function handleKnowledgeGraphRetrieve(req, res, { startedAt }) {
    const body = await readCapabilityJson({ request: req, response: res, startedAt, code: "graph_invalid_json" });
    if (!body) return;
    try {
      writeJson(res, 200, createOkEnvelope(userExperienceService.retrieveGraph(body), { startedAt }));
    } catch (error) {
      writeErrorResponse({ response: res, error, startedAt, fallbackCode: "graph_retrieve_failed" });
    }
  }

  // ── POST /knowledge/load ──
  async function handleKnowledgeLoad(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope("knowledge_invalid_json", "Knowledge load body must be valid JSON.", { startedAt, category: "validation" }));
      return;
    }

    // zod 校验
    const validation = validators.knowledgeLoad(body);
    if (!validation.valid) {
      writeJson(res, 400, createErrorEnvelope("knowledge_validation_error", "Request validation failed", { startedAt, category: "validation", details: validation.errors }));
      return;
    }

    try {
      const result = knowledgeService.loadDocuments(validation.data);
      writeServiceLog("knowledge_load_completed", { method: "POST", path: "/knowledge/load", sourceId: result.sourceId, loadedCount: result.loadedCount, durationMs: Date.now() - startedAt });
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeServiceLog("knowledge_load_failed", { method: "POST", path: "/knowledge/load", code: error?.code, durationMs: Date.now() - startedAt });
      writeJson(res, error?.category === "validation" ? 400 : 422, createErrorEnvelope(error?.code ?? "knowledge_load_failed", error instanceof Error ? error.message : "Knowledge load failed.", { startedAt, category: error?.category ?? "knowledge", retryable: false, details: error?.details }));
    }
  }

  // ── POST /knowledge/load/file ──
  async function handleKnowledgeLoadFile(req, res, { startedAt }) {
    let body;
    try {
      body = await readJson(req);
    } catch {
      writeJson(res, 400, createErrorEnvelope("knowledge_invalid_json", "Knowledge file load body must be valid JSON.", { startedAt, category: "validation" }));
      return;
    }
    try {
      const files = Array.isArray(body?.files) ? body.files : [];
      if (files.length === 0) {
        const error = new Error("Knowledge file load requires at least one file.");
        error.code = "KNOWLEDGE_FILE_LOAD_FILES_REQUIRED";
        error.category = "validation";
        throw error;
      }
      const documents = [];
      const skipped = [];
      for (const file of files) {
        try {
          documents.push(await parseKnowledgeFile(file));
        } catch (error) {
          skipped.push({ fileName: file?.fileName ?? file?.name ?? "unknown", code: error?.code ?? "KNOWLEDGE_FILE_PARSE_FAILED", message: error instanceof Error ? error.message : "File parse failed.", details: error?.details });
        }
      }
      if (documents.length === 0) {
        const error = new Error("No uploaded file produced loadable text.");
        error.code = "KNOWLEDGE_FILE_LOAD_NO_DOCUMENTS";
        error.category = "validation";
        error.details = { skipped };
        throw error;
      }
      const result = knowledgeService.loadDocuments({ sourceId: body.sourceId ?? "ui-file-import-source", sourceTitle: body.sourceTitle ?? "UI File Import Source", metadata: { parserEntry: "knowledge-load-file", ...(body.metadata ?? {}) }, documents });
      writeServiceLog("knowledge_file_load_completed", { method: "POST", path: "/knowledge/load/file", sourceId: result.sourceId, loadedCount: result.loadedCount, skippedCount: skipped.length, durationMs: Date.now() - startedAt });
      writeJson(res, 200, createOkEnvelope({ ...result, skipped, supported: getSupportedKnowledgeFileTypes() }, { startedAt }));
    } catch (error) {
      writeServiceLog("knowledge_file_load_failed", { method: "POST", path: "/knowledge/load/file", code: error?.code, durationMs: Date.now() - startedAt });
      writeJson(res, error?.category === "validation" ? 400 : 422, createErrorEnvelope(error?.code ?? "knowledge_file_load_failed", error instanceof Error ? error.message : "Knowledge file load failed.", { startedAt, category: error?.category ?? "knowledge", retryable: false, details: error?.details }));
    }
  }

  // ── POST /knowledge/retrieve ──
  async function handleKnowledgeRetrieve(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope("knowledge_invalid_json", "Knowledge retrieve body must be valid JSON.", { startedAt, category: "validation" }));
      return;
    }

    // zod 校验
    const validation = validators.knowledgeRetrieve(body);
    if (!validation.valid) {
      writeJson(res, 400, createErrorEnvelope("knowledge_validation_error", "Request validation failed", { startedAt, category: "validation", details: validation.errors }));
      return;
    }

    try {
      const result = knowledgeService.retrieve(validation.data);
      writeServiceLog("knowledge_retrieve_completed", { method: "POST", path: "/knowledge/retrieve", chunkCount: result.chunks.length, durationMs: Date.now() - startedAt });
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeServiceLog("knowledge_retrieve_failed", { method: "POST", path: "/knowledge/retrieve", code: error?.code, durationMs: Date.now() - startedAt });
      writeJson(res, error?.category === "validation" ? 400 : 422, createErrorEnvelope(error?.code ?? "knowledge_retrieve_failed", error instanceof Error ? error.message : "Knowledge retrieve failed.", { startedAt, category: error?.category ?? "knowledge", retryable: false }));
    }
  }

  // ── POST /knowledge/delete ──
  async function handleKnowledgeDelete(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope("knowledge_invalid_json", "Knowledge delete body must be valid JSON.", { startedAt, category: "validation" }));
      return;
    }
    const docId = body.documentId || body.docId;
    if (!docId) {
      writeJson(res, 400, createErrorEnvelope("knowledge_delete_docid_required", "documentId is required.", { startedAt, category: "validation" }));
      return;
    }
    try {
      const result = knowledgeService.deleteDocument(docId);
      writeServiceLog("knowledge_delete_completed", { method: "POST", path: "/knowledge/delete", documentId: docId, remainingCount: result.remainingCount, durationMs: Date.now() - startedAt });
      writeJson(res, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeServiceLog("knowledge_delete_failed", { method: "POST", path: "/knowledge/delete", code: error?.code, durationMs: Date.now() - startedAt });
      writeJson(res, error?.category === "validation" ? 400 : 422, createErrorEnvelope(error?.code ?? "knowledge_delete_failed", error instanceof Error ? error.message : "Knowledge delete failed.", { startedAt, category: error?.category ?? "knowledge", retryable: false }));
    }
  }

  // ── 导出 ──
  const handlers = new Map([
    ["GET /knowledge/health", { handler: handleKnowledgeHealth, public: true }],
    ["GET /knowledge/infra/readiness", { handler: handleKnowledgeInfraReadiness, public: true }],
    ["GET /knowledge/sources", { handler: handleKnowledgeSources, public: false, permission: "knowledge:read" }],
    ["GET /knowledge/file-types", { handler: handleKnowledgeFileTypes, public: true }],
    ["POST /knowledge/graph/retrieve", { handler: handleKnowledgeGraphRetrieve, public: false, permission: "knowledge:read" }],
    ["POST /knowledge/load", { handler: handleKnowledgeLoad, public: false, permission: "knowledge:write" }],
    ["POST /knowledge/load/file", { handler: handleKnowledgeLoadFile, public: false, permission: "knowledge:write" }],
    ["POST /knowledge/retrieve", { handler: handleKnowledgeRetrieve, public: false, permission: "knowledge:read" }],
    ["POST /knowledge/delete", { handler: handleKnowledgeDelete, public: false, permission: "knowledge:write" }],
  ]);

  return { handlers };
}
