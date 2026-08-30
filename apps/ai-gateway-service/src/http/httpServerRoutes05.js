import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { executeGovernedWorkflowRun } from "../workflow/governedWorkflowExecution.ts";

export async function dispatchHttpRoutes05(context) {
  const {
    createErrorEnvelope, createOkEnvelope, getSafeRuntimeConfig, createRouteFailureEnvelope,
    createLocalAgentIntentExplainer, runLocalOperationLoop, assertKnowledgeFileBatch, getSupportedKnowledgeFileTypes, parseKnowledgeFile,
    listModelImportProviders, detectRuntimeCredentialProviders, getRequestContext,
    createNextCodexTask, writeNextCodexTaskOutbox, readCodexLoopStatus, checkTokenCostGuard,
    appendEstimateRecord, readTokenCostSummary, readLatestMimoTokenCalibrationProfile, createResponseCacheKey,
    createResponseCachePolicy, invalidateCache, lookupCache, readResponseCacheSummary,
    writeCacheRecord, listResponseCacheAuditTrail, routeAnswerPath, routeQualityCostAnswer,
    getEvidenceById, TASK_MATRIX, LATENCY_DRY_RUN_CASES, PHASE315A_TIMEOUT_TYPES,
    PHASE315A_LATENCY_RISK_LEVELS, PHASE315A_COMPLETION_CONFIDENCE, evaluateTaijiBeidouChatGatewayExecutePreviewHook,
    evaluateTaijiBeidouChatPreviewHook, handleChatLocalActionRoute, routeChatActionProposal, buildModelUsabilityMatrix,
    createModelVerificationPlan, getPluginRegistry, readJson,
    writeJson, writeSseEvent, writeSseHeaders, writeServiceLog,
    createHealth, createSetupReadiness, runPhase312AChatGateway, runPhase314ADryRunTask,
    runPhase315ALatencyDryRun, testPhase312AModel, createProviders, setRuntimeProviderCredential,
    sanitizeCredentialErrorDetails, createRouteModes, readAuditFilters, readEnterpriseAcceptanceReport,
    readEnterpriseReleaseCandidateDryRun, readEnterpriseOverview, buildPhase319FeatureStatus, readCapabilityJson,
    readEnterpriseJson, writeEnterpriseError, writeCapabilityError, normalizeChatBody,
    normalizeRagChatBody, extractChatPrompt, createRagRetrieveRequest, createRagCitations,
    createRagPrompt, createRagChatData, OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG, application,
    request, requestExecution, requestId, response, url, startedAt,
    approvalStore, fileContextStore, phase319LocalOperation, connectorFeishuDryRun,
    connectorWeComDryRun, capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService,
    enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService,
    modelImportService, modelLibraryStore, providerConfigRoutes, userExperienceService,
    workforceService, workflowService, wsServer,
  } = context;

  const workforceClarificationMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/clarifications$/);
  if (workforceClarificationMatch && request.method === "POST") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_clarifications_invalid_json" });
    if (!body) return;

    try {
      const planId = decodeURIComponent(workforceClarificationMatch[1]);
      const result = await workforceService.answerClarifications(planId, body, request.enterpriseIdentity?.tenantId);
      writeServiceLog("workforce_clarifications_saved", {
        method: request.method,
        path: url.pathname,
        planId: result.planId,
        answeredCount: result.answeredCount,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_clarifications_failed" });
    }
    return;
  }

  const workforceLifecycleMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/lifecycle$/);
  if (workforceLifecycleMatch && request.method === "POST") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_lifecycle_invalid_json" });
    if (!body) return;

    try {
      const planId = decodeURIComponent(workforceLifecycleMatch[1]);
      const result = await workforceService.updatePlanLifecycle(planId, body, request.enterpriseIdentity?.tenantId);
      writeServiceLog("workforce_lifecycle_saved", {
        method: request.method,
        path: url.pathname,
        planId: result.planId,
        lifecycleState: result.lifecycle?.current,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_lifecycle_failed" });
    }
    return;
  }

  const workforceReviewPackageMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/review-package$/);
  if (workforceReviewPackageMatch && request.method === "GET") {
    try {
      const planId = decodeURIComponent(workforceReviewPackageMatch[1]);
      const result = await workforceService.getPlanReviewPackage(planId, request.enterpriseIdentity?.tenantId);
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_review_package_failed" });
    }
    return;
  }

  const workforceApprovalGateMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/approval-gate$/);
  if (workforceApprovalGateMatch && request.method === "POST") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_approval_gate_invalid_json" });
    if (!body) return;

    try {
      const planId = decodeURIComponent(workforceApprovalGateMatch[1]);
      const result = await workforceService.recordPlanApprovalGate(planId, body, request.enterpriseIdentity?.tenantId);
      writeServiceLog("workforce_approval_gate_recorded", {
        method: request.method,
        path: url.pathname,
        planId: result.planId,
        decision: result.decision,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_approval_gate_failed" });
    }
    return;
  }

  const workforcePlanMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)(\/export)?$/);
  if (workforcePlanMatch && request.method === "GET") {
    try {
      const planId = decodeURIComponent(workforcePlanMatch[1]);
      const result = workforcePlanMatch[2]
        ? await workforceService.exportPlan(planId, request.enterpriseIdentity?.tenantId)
        : await workforceService.getPlan(planId, request.enterpriseIdentity?.tenantId);
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_read_failed" });
    }
    return;
  }

  if (workforcePlanMatch && request.method === "DELETE" && !workforcePlanMatch[2]) {
    try {
      const planId = decodeURIComponent(workforcePlanMatch[1]);
      const result = await workforceService.deletePlan(planId, request.enterpriseIdentity?.tenantId);
      writeServiceLog("workforce_plan_deleted", {
        method: request.method,
        path: url.pathname,
        planId: result.planId,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_delete_failed" });
    }
    return;
  }

  if (request.method === "POST" && (url.pathname === "/workflow/plan" || url.pathname === "/workflow/run")) {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("workflow_invalid_json", "Workflow request body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const result = url.pathname === "/workflow/plan"
        ? workflowService.plan(body)
        : application.agentGovernance
          ? await executeGovernedWorkflowRun({
              governance: application.agentGovernance,
              workflowService,
              identity: request.enterpriseIdentity,
              body,
              requestContext: getRequestContext(request),
              requestId,
              signal: requestExecution?.signal,
            })
          : await workflowService.run(body, getRequestContext(request));
      writeServiceLog(url.pathname === "/workflow/plan" ? "workflow_plan_completed" : "workflow_run_completed", {
        method: request.method,
        path: url.pathname,
        workflowId: result.workflowId,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeServiceLog("workflow_request_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(
        response,
        Number.isInteger(error?.statusCode)
          ? error.statusCode
          : error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "workflow_request_failed", error instanceof Error ? error.message : "Workflow request failed.", {
          startedAt,
          category: error?.category ?? "workflow",
          retryable: false,
          details: error?.details,
        }),
      );
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/memory/save") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "memory_invalid_json" });
    if (!body) return;

    try {
      writeJson(response, 200, createOkEnvelope(userExperienceService.saveMemory(body, getRequestContext(request)), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "memory_save_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/memory/list") {
    writeJson(response, 200, createOkEnvelope(userExperienceService.listMemory(getRequestContext(request)), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/memory/retrieve") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "memory_invalid_json" });
    if (!body) return;

    try {
      writeJson(response, 200, createOkEnvelope(userExperienceService.retrieveMemory(body, getRequestContext(request)), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "memory_retrieve_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/connectors/import/text") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "connector_invalid_json" });
    if (!body) return;

    try {
      writeJson(response, 200, createOkEnvelope(userExperienceService.importTextConnector(body, getRequestContext(request)), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "connector_import_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/evaluation/score") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "evaluation_invalid_json" });
    if (!body) return;

    try {
      writeJson(response, 200, createOkEnvelope(userExperienceService.scoreEvaluation(body), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "evaluation_score_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/knowledge/graph/retrieve") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "graph_invalid_json" });
    if (!body) return;

    try {
      writeJson(response, 200, createOkEnvelope(userExperienceService.retrieveGraph(body, getRequestContext(request)), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "graph_retrieve_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/knowledge/load") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("knowledge_invalid_json", "Knowledge load body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const result = knowledgeService.loadDocuments(body, getRequestContext(request));
      writeServiceLog("knowledge_load_completed", {
        method: request.method,
        path: url.pathname,
        sourceId: result.sourceId,
        loadedCount: result.loadedCount,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeServiceLog("knowledge_load_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "knowledge_load_failed", error instanceof Error ? error.message : "Knowledge load failed.", {
          startedAt,
          category: error?.category ?? "knowledge",
          retryable: false,
          details: error?.details,
        }),
      );
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/knowledge/load/file") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("knowledge_invalid_json", "Knowledge file load body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const files = Array.isArray(body?.files) ? body.files : [];
      assertKnowledgeFileBatch(files);

      const documents = [];
      const skipped = [];

      for (const file of files) {
        try {
          documents.push(await parseKnowledgeFile(file));
        } catch (error) {
          if (error?.retryable === true) throw error;
          skipped.push({
            fileName: file?.fileName ?? file?.name ?? "unknown",
            code: error?.code ?? "KNOWLEDGE_FILE_PARSE_FAILED",
            message: error instanceof Error ? error.message : "File parse failed.",
            details: error?.details,
          });
        }
      }

      if (documents.length === 0) {
        const error = new Error("No uploaded file produced loadable text.");
        error.code = "KNOWLEDGE_FILE_LOAD_NO_DOCUMENTS";
        error.category = "validation";
        error.details = { skipped };
        throw error;
      }

      const result = knowledgeService.loadDocuments({
        sourceId: body.sourceId ?? "ui-file-import-source",
        sourceTitle: body.sourceTitle ?? "UI File Import Source",
        metadata: {
          parserEntry: "knowledge-load-file",
          ...(body.metadata ?? {}),
        },
        documents,
      }, getRequestContext(request));

      writeServiceLog("knowledge_file_load_completed", {
        method: request.method,
        path: url.pathname,
        sourceId: result.sourceId,
        loadedCount: result.loadedCount,
        skippedCount: skipped.length,
        durationMs: Date.now() - startedAt,
      });
      writeJson(
        response,
        200,
        createOkEnvelope(
          {
            ...result,
            skipped,
            supported: getSupportedKnowledgeFileTypes(),
          },
          { startedAt },
        ),
      );
    } catch (error) {
      writeServiceLog("knowledge_file_load_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      const statusCode = error?.category === "validation" ? 400 : error?.category === "availability" ? 503 : 422;
      writeJson(
        response,
        statusCode,
        createErrorEnvelope(error?.code ?? "knowledge_file_load_failed", error instanceof Error ? error.message : "Knowledge file load failed.", {
          startedAt,
          category: error?.category ?? "knowledge",
          retryable: error?.retryable === true,
          details: error?.details,
        }),
      );
    }
    return;
  }


  return ROUTE_NOT_HANDLED;
}
