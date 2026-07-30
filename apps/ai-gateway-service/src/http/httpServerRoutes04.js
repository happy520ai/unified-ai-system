import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";

export async function dispatchHttpRoutes04(context) {
  const {
    createErrorEnvelope, createOkEnvelope, getSafeRuntimeConfig, createRouteFailureEnvelope,
    createLocalAgentIntentExplainer, runLocalOperationLoop, getSupportedKnowledgeFileTypes, parseKnowledgeFile,
    listModelImportProviders, detectRuntimeCredentialProviders, getRequestContext,
    createNextCodexTask, writeNextCodexTaskOutbox, readCodexLoopStatus, checkTokenCostGuard,
    appendEstimateRecord, readTokenCostSummary, readLatestMimoTokenCalibrationProfile, createResponseCacheKey,
    createResponseCachePolicy, invalidateCache, lookupCache, readResponseCacheSummary,
    writeCacheRecord, listResponseCacheAuditTrail, routeAnswerPath, routeQualityCostAnswer,
    getEvidenceById, TASK_MATRIX, LATENCY_DRY_RUN_CASES, PHASE315A_TIMEOUT_TYPES,
    PHASE315A_LATENCY_RISK_LEVELS, PHASE315A_COMPLETION_CONFIDENCE, executeThreeModeRequest, evaluateTaijiBeidouChatGatewayExecutePreviewHook,
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
    request, response, url, startedAt,
    approvalStore, fileContextStore, phase319LocalOperation, connectorFeishuDryRun,
    connectorWeComDryRun, capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService,
    enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService,
    modelImportService, modelLibraryStore, providerConfigRoutes, userExperienceService,
    workforceService, workflowService, wsServer,
  } = context;

  if (request.method === "GET" && url.pathname === "/config/runtime") {
    writeJson(response, 200, createOkEnvelope(getSafeRuntimeConfig(application.config), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/providers/runtime-credential/detect") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("provider_runtime_credential_detect_invalid_json", "Runtime credential detection body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const result = await detectRuntimeCredentialProviders(application, body);
      writeServiceLog("provider_runtime_credential_detected", {
        method: request.method,
        path: url.pathname,
        apiKeyPresent: result.apiKeyPresent,
        detectedCount: result.detected?.length ?? 0,
        recommendedProviderId: result.recommended?.providerId,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "provider_runtime_credential_detect_failed", error instanceof Error ? error.message : "Runtime credential detection failed.", {
          startedAt,
          category: error?.category ?? "provider",
          retryable: false,
          details: sanitizeCredentialErrorDetails(error?.details),
        }),
      );
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/providers/runtime-credential") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("provider_runtime_credential_invalid_json", "Runtime credential body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const result = setRuntimeProviderCredential(application, body);
      writeServiceLog("provider_runtime_credential_set", {
        method: request.method,
        path: url.pathname,
        providerId: result.providerId,
        apiKeyPresent: result.apiKeyPresent,
        secretStorage: result.secretStorage,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "provider_runtime_credential_failed", error instanceof Error ? error.message : "Runtime credential update failed.", {
          startedAt,
          category: error?.category ?? "provider",
          retryable: false,
          details: sanitizeCredentialErrorDetails(error?.details),
        }),
      );
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/models/import/providers") {
    writeJson(response, 200, createOkEnvelope({
      providers: listModelImportProviders(),
    }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/models/import/preview") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("model_import_preview_invalid_json", "Model import preview body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const result = await modelImportService.preview(body);
      writeServiceLog("model_import_preview_completed", {
        method: request.method,
        path: url.pathname,
        status: result.status,
        providerId: result.providerId,
        modelCount: result.models?.length ?? 0,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "model_import_preview_failed", error instanceof Error ? error.message : "Model import preview failed.", {
          startedAt,
          category: error?.category ?? "provider",
          retryable: false,
          details: sanitizeCredentialErrorDetails(error?.details),
        }),
      );
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/models/import/confirm") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("model_import_confirm_invalid_json", "Model import confirm body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const result = modelImportService.confirm(body);
      writeServiceLog("model_import_confirm_completed", {
        method: request.method,
        path: url.pathname,
        status: result.status,
        providerId: result.providerId,
        modelId: result.modelId,
        runtimeChatUsable: result.runtimeChatUsable,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "model_import_confirm_failed", error instanceof Error ? error.message : "Model import confirm failed.", {
          startedAt,
          category: error?.category ?? "provider",
          retryable: false,
          details: sanitizeCredentialErrorDetails(error?.details),
        }),
      );
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/route/modes") {
    writeJson(response, 200, createOkEnvelope(createRouteModes(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/runtime-candidate/codex-exec-crs/status") {
    writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.getStatus(), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/runtime-candidate/codex-exec-crs/dry-run-smoke") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "runtime_candidate_dry_run_smoke_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.runDryRunSmoke(body), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/runtime-candidate/codex-exec-crs/guarded-one-shot") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "runtime_candidate_guarded_one_shot_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.runGuardedOneShot(body), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/runtime-candidate/codex-exec-crs/reliability") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "runtime_candidate_reliability_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.runRepeatedReliability(body), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/knowledge/health") {
    writeJson(response, 200, createOkEnvelope(knowledgeService.getHealth(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/knowledge/infra/readiness") {
    writeJson(response, 200, createOkEnvelope(application.knowledgeInfra.getReadiness(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/knowledge/sources") {
    writeJson(response, 200, createOkEnvelope(knowledgeService.listSources(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/knowledge/file-types") {
    writeJson(response, 200, createOkEnvelope({ supported: getSupportedKnowledgeFileTypes() }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/workflow/health") {
    writeJson(response, 200, createOkEnvelope(workflowService.getHealth(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/workflow/actions") {
    writeJson(response, 200, createOkEnvelope(workflowService.listActions(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/workforce/health") {
    writeJson(response, 200, createOkEnvelope(workforceService.getHealth(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/workforce/agents") {
    writeJson(response, 200, createOkEnvelope(workforceService.listAgents(), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/workforce/plan") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_plan_invalid_json" });
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
        writeServiceLog("workforce_plan_completed", {
          method: request.method,
          path: url.pathname,
          workforceId: responseData.workforceId,
          roleCount: responseData.selectedRoles?.length ?? 0,
          autoSaved: true,
          planId: autoSaveResult.planId,
          durationMs: Date.now() - startedAt,
        });
        writeJson(response, 200, createOkEnvelope(responseData, { startedAt, traceId: body?.context?.traceId }));
      } catch (error) {
      writeServiceLog("workforce_plan_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/workforce/run-local") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_run_local_invalid_json" });
    if (!body) return;

    try {
      const result = await workforceService.runLocal(body);
      writeServiceLog("workforce_real_local_run_completed", {
        method: request.method,
        path: url.pathname,
        runId: result.runId,
        planId: result.planId,
        workforceId: result.workforceId,
        taskCount: result.taskQueue?.length ?? 0,
        providerCallsMade: false,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeServiceLog("workforce_real_local_run_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_real_local_run_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/workforce/plans/save") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_plan_save_invalid_json" });
    if (!body) return;

    try {
      const result = await workforceService.savePlan(body);
      writeServiceLog("workforce_plan_saved", {
        method: request.method,
        path: url.pathname,
        planId: result.planId,
        workforceId: result.taskPackage?.workforceId,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeServiceLog("workforce_plan_save_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_save_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/workforce/plans") {
    try {
      const result = await workforceService.listPlans();
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_list_failed" });
    }
    return;
  }


  return ROUTE_NOT_HANDLED;
}
