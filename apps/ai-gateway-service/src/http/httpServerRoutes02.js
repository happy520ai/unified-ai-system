import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { createPrometheusExporter } from "../observability/prometheusExporter.js";
import { getAiMetricsSnapshot } from "../observability/aiMetrics.ts";

export async function dispatchHttpRoutes02(context) {
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
    request, response, url, startedAt, rateLimiter, resilienceMetrics, a2aGateway,
    approvalStore, fileContextStore, phase319LocalOperation, connectorFeishuDryRun,
    connectorWeComDryRun, capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService,
    enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService,
    modelImportService, modelLibraryStore, providerConfigRoutes, userExperienceService,
    workforceService, workflowService, wsServer, healthzInFlightThreshold, healthzInFlightDegradationPercent,
    gatewayLifecycle, idempotencyCoordinator, webSocketConnectionLeaseManager,
  } = context;

  if (request.method === "GET" && url.pathname === "/dashboard/status") {
    writeJson(response, 200, createOkEnvelope(userExperienceService.getDashboard(getRequestContext(request)), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/auth/status") {
    writeJson(
      response,
      200,
      createOkEnvelope(
        {
          ...userExperienceService.getAuthStatus(),
          enterprise: enterpriseGovernanceService.getHealth(),
        },
        { startedAt },
      ),
    );
    return;
  }

  if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/health/check")) {
    writeJson(response, 200, createOkEnvelope(createHealth(application), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/livez") {
    const lifecycle = gatewayLifecycle?.snapshot?.() ?? {
      state: "ready",
      isReady: true,
      isLive: true,
      reason: null,
    };
    writeJson(response, lifecycle.isLive ? 200 : 503, createOkEnvelope({
      status: lifecycle.isLive ? "alive" : "stopped",
      lifecycle,
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && (url.pathname === "/healthz" || url.pathname === "/ready")) {
    const healthSnapshot = createHealth(application);
    const readinessSnapshot = createSetupReadiness(application);
    const resilienceSnapshot = resilienceMetrics?.snapshot?.() ?? {};
    const currentInFlight = Number.isFinite(Number(resilienceSnapshot.currentInFlight))
      ? Number(resilienceSnapshot.currentInFlight)
      : 0;
    const saturationThreshold = Number.isFinite(Number(healthzInFlightThreshold)) && Number(healthzInFlightThreshold) > 0
      ? Number(healthzInFlightThreshold)
      : 0;
    const saturationPercent = Number.isFinite(Number(healthzInFlightDegradationPercent)) && Number(healthzInFlightDegradationPercent) > 0
      ? Number(healthzInFlightDegradationPercent)
      : null;
    const saturated = saturationThreshold > 0 && currentInFlight >= saturationThreshold;
    const lifecycle = gatewayLifecycle?.snapshot?.() ?? null;
    const idempotency = await readIdempotencyHealth(idempotencyCoordinator);
    const rateLimit = await readRateLimitHealth(rateLimiter);
    const webSocketLease = await readWebSocketLeaseHealth(webSocketConnectionLeaseManager);
    const a2aTaskStore = readA2ATaskStoreHealth(a2aGateway);
    const workforceClaimStore = await readWorkforceClaimStoreHealth(application?.workforceExecutor);
    const readinessFailures = collectReadinessFailures(healthSnapshot, readinessSnapshot, {
      saturated,
      gatewayErrorCircuitState: resilienceSnapshot?.gatewayErrorCircuitState,
      lifecycleState: lifecycle?.state,
      idempotencyStoreUnavailable: idempotency?.storeMode === "postgres" && idempotency?.available !== true,
      rateLimitStoreUnavailable: rateLimit?.storeMode === "postgres" && rateLimit?.available !== true,
      webSocketLeaseStoreUnavailable: Boolean(webSocketConnectionLeaseManager) && webSocketLease?.available !== true,
      a2aTaskStoreUnavailable: Boolean(a2aGateway) && a2aTaskStore?.available !== true,
      workforceClaimStoreUnavailable: workforceClaimStore?.distributed === true
        && workforceClaimStore.available !== true,
    });
    resilienceMetrics?.recordReadinessCheck?.(readinessFailures);
    const degraded = saturated || readinessFailures.length > 0;

    const payload = {
      status: degraded ? "degraded" : "ready",
      health: healthSnapshot,
      readiness: readinessSnapshot,
      resilience: resilienceSnapshot,
      readinessFailureCount: readinessFailures.length,
      readinessFailures,
      isReady: !degraded,
      lifecycle,
      idempotency,
      rateLimit,
      webSocketLease,
      a2aTaskStore,
      workforceClaimStore,
      saturation: {
        inFlight: currentInFlight,
        threshold: saturationThreshold,
        thresholdPercent: saturationPercent,
      },
    };

    if (degraded) {
      writeJson(
        response,
        503,
        createErrorEnvelope(
          "service_unready",
          "Service is temporarily unhealthy.",
          {
            startedAt,
            category: "health",
            details: payload,
          },
        ),
      );
      return;
    }
    writeJson(response, 200, createOkEnvelope(payload, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/setup/readiness") {
    writeJson(response, 200, createOkEnvelope(createSetupReadiness(application), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/usage/summary") {
    const requestLogger = application?.requestLogger;
    if (!requestLogger) {
      writeJson(response, 200, createOkEnvelope({ enabled: false, reason: "usage_ledger_not_configured" }, { startedAt }));
      return;
    }
    writeJson(response, 200, createOkEnvelope({
      enabled: true,
      stats: await requestLogger.getStats({
        tenantId: request.enterpriseIdentity?.tenantId ?? "default",
      }),
      health: requestLogger.getHealth(),
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/usage/logs") {
    const requestLogger = application?.requestLogger;
    if (!requestLogger) {
      writeJson(response, 200, createOkEnvelope({ enabled: false, reason: "usage_ledger_not_configured" }, { startedAt }));
      return;
    }
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1), 500);
    const filter = {
      limit,
      tenantId: request.enterpriseIdentity?.tenantId ?? "default",
      provider: url.searchParams.get("provider") ?? undefined,
      model: url.searchParams.get("model") ?? undefined,
      statusCode: url.searchParams.get("statusCode") ? Number(url.searchParams.get("statusCode")) : undefined,
    };
    const records = await requestLogger.query(filter);
    writeJson(response, 200, createOkEnvelope({
      enabled: true,
      count: records.length,
      records,
    }, { startedAt }));
    return;
  }

  // 自有 key 用量查询：虚拟 key 持有者查看本 key 的实时预算/限流状态，
  // 不暴露其他 key 或租户数据。
  if (request.method === "GET" && url.pathname === "/usage/my-key") {
    const fingerprint = request.enterpriseIdentity?.apiKeyFingerprint;
    if (!fingerprint) {
      writeJson(response, 403, createErrorEnvelope(
        "USAGE_MY_KEY_VIRTUAL_KEY_REQUIRED",
        "Only virtual-key callers (uai- keys) can query their own key usage.",
        { startedAt, category: "auth" },
      ));
      return;
    }
    const manager = enterpriseGovernanceService?.getApiKeyManager?.();
    if (!manager) {
      writeJson(response, 200, createOkEnvelope({
        enabled: false,
        reason: "virtual_key_manager_unavailable",
        keyFingerprint: fingerprint,
      }, { startedAt }));
      return;
    }
    const usage = manager.describeUsage({ keyId: fingerprint });
    if (!usage) {
      writeJson(response, 404, createErrorEnvelope(
        "USAGE_MY_KEY_NOT_FOUND",
        "No active virtual key matches the caller identity; it may have been revoked.",
        { startedAt, category: "auth" },
      ));
      return;
    }
    writeJson(response, 200, createOkEnvelope({
      enabled: true,
      keyFingerprint: fingerprint,
      key: usage,
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/metrics") {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const healthSnapshot = createHealth(application);
    const readinessSnapshot = createSetupReadiness(application);
    const stats = await (application?.requestLogger?.getStats?.({
      tenantId: request.enterpriseIdentity?.tenantId ?? "default",
    }) ?? {});
    const usageLedger = application?.requestLogger?.getHealth?.() ?? null;
    const readinessResilienceSnapshot = resilienceMetrics?.snapshot?.() ?? {};
    const currentInFlight = Number.isFinite(Number(readinessResilienceSnapshot.currentInFlight))
      ? Number(readinessResilienceSnapshot.currentInFlight)
      : 0;
    const saturationThreshold = Number.isFinite(Number(healthzInFlightThreshold)) && Number(healthzInFlightThreshold) > 0
      ? Number(healthzInFlightThreshold)
      : 0;
    const saturated = saturationThreshold > 0 && currentInFlight >= saturationThreshold;
    const lifecycle = gatewayLifecycle?.snapshot?.() ?? null;
    const idempotency = await readIdempotencyHealth(idempotencyCoordinator);
    const rateLimit = await readRateLimitHealth(rateLimiter);
    const webSocketLease = await readWebSocketLeaseHealth(webSocketConnectionLeaseManager);
    const a2aTaskStore = readA2ATaskStoreHealth(a2aGateway);
    const workforceClaimStore = await readWorkforceClaimStoreHealth(application?.workforceExecutor);
    const readinessFailures = collectReadinessFailures(healthSnapshot, readinessSnapshot, {
      saturated,
      gatewayErrorCircuitState: readinessResilienceSnapshot?.gatewayErrorCircuitState,
      lifecycleState: lifecycle?.state,
      idempotencyStoreUnavailable: idempotency?.storeMode === "postgres" && idempotency?.available !== true,
      rateLimitStoreUnavailable: rateLimit?.storeMode === "postgres" && rateLimit?.available !== true,
      webSocketLeaseStoreUnavailable: Boolean(webSocketConnectionLeaseManager) && webSocketLease?.available !== true,
      a2aTaskStoreUnavailable: Boolean(a2aGateway) && a2aTaskStore?.available !== true,
      workforceClaimStoreUnavailable: workforceClaimStore?.distributed === true
        && workforceClaimStore.available !== true,
    });
    const snapshot = {
      totalRequests: stats.totalRequests ?? 0,
      activeConnections: wsServer?.getConnectionCount?.() ?? 0,
      rateLimiter: rateLimit,
      resilience: readinessResilienceSnapshot ?? null,
      health: healthSnapshot,
      readiness: readinessSnapshot,
      readinessFailures,
      readinessFailureCount: readinessFailures.length,
      lifecycle,
      idempotency,
      webSocketLease,
      a2aTaskStore,
      workforceClaimStore,
      usageLedger,
      latency: stats.latencyQuantiles
        ?? (stats.avgLatencyMs
          ? { p50: stats.avgLatencyMs, p95: stats.avgLatencyMs, p99: stats.avgLatencyMs }
          : undefined),
      totalErrors: Math.round((stats.totalRequests ?? 0) * (stats.errorRate ?? 0)),
      providerScores: application?.healthScorer?.getAllScores?.() ?? {},
      ai: getAiMetricsSnapshot(),
    };
    const body = exporter.formatMetrics(snapshot);
    if (!response.headersSent && typeof response.writeHead === "function") {
      response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8" });
    } else if (!response.headersSent) {
      response.statusCode = 200;
    }
    response.end(body);
    return;
  }

  if (request.method === "GET" && url.pathname === "/providers") {
    writeJson(response, 200, createOkEnvelope(createProviders(application), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/models/capability-router/status") {
    writeJson(response, 200, createOkEnvelope(capabilityRouterService.getStatus(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/provider-config/status") {
    writeJson(response, 200, createOkEnvelope(providerConfigRoutes.status(), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/provider-config/save") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "provider_config_save_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(providerConfigRoutes.save(body), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/provider-config/test") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "provider_config_test_invalid_json" });
    if (!body) return;
    const result = await providerConfigRoutes.test(body);
    writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/model-library") {
    const registry = modelLibraryStore.getRegistry();
    const usabilityMatrix = buildModelUsabilityMatrix({ registry });
    writeJson(
      response,
      200,
      createOkEnvelope(
        {
          registry,
          usabilityMatrix,
          providerConfig: providerConfigRoutes.status(),
          routesAvailable: {
            saveProviderConfig: true,
            testProviderKey: true,
            refreshModelLibrary: true,
            testSelectedModel: true,
            setTaskDefault: true,
            chatGateway: true,
            usabilityMatrix: true,
            verificationPlan: true,
            verifyDryRun: true,
          },
        },
        { startedAt },
      ),
    );
    return;
  }

  if (request.method === "GET" && url.pathname === "/model-library/usability-matrix") {
    const registry = modelLibraryStore.getRegistry();
    writeJson(response, 200, createOkEnvelope({ matrix: buildModelUsabilityMatrix({ registry }) }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/model-library/verification-plan") {
    const registry = modelLibraryStore.getRegistry();
    const matrix = buildModelUsabilityMatrix({ registry });
    const plan = createModelVerificationPlan({
      registry,
      matrix,
      maxModels: url.searchParams.get("maxModels") ?? undefined,
      bucket: url.searchParams.get("bucket") ?? "",
      includeUnverified: url.searchParams.get("includeUnverified") !== "false",
      includeFailedRetry: url.searchParams.get("includeFailedRetry") === "true",
      realSmokeEnabled: url.searchParams.get("realSmokeEnabled") === "true",
      rpmLimit: url.searchParams.get("rpmLimit") ?? undefined,
      providerId: url.searchParams.get("providerId") ?? "nvidia",
      env: application.runtimeEnv ?? process.env,
    });
    writeJson(response, 200, createOkEnvelope({ plan }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/model-library/verify-dry-run") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_verify_dry_run_invalid_json" });
    if (!body) return;
    const registry = modelLibraryStore.getRegistry();
    const matrix = buildModelUsabilityMatrix({ registry });
    const plan = createModelVerificationPlan({
      registry,
      matrix,
      ...body,
      realSmokeEnabled: false,
      env: application.runtimeEnv ?? process.env,
    });
    writeJson(response, 200, createOkEnvelope({ plan, providerCalled: false }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/model-library/refresh") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_refresh_invalid_json" });
    if (!body) return;
    const registry = await modelLibraryStore.refreshCatalog({ allowLiveDiscovery: body.allowLiveDiscovery === true });
    writeJson(response, 200, createOkEnvelope({ registry, usabilityMatrix: buildModelUsabilityMatrix({ registry }) }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/model-library/test-model") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_test_invalid_json" });
    if (!body) return;
    const result = await testPhase312AModel({ application, body });
    if (result.success === false) {
      const statusCode = result.code === "real_smoke_not_enabled" ? 503 : 400;
      writeJson(response, statusCode, createErrorEnvelope(
        result.code,
        result.message,
        {
          startedAt,
          category: "request",
          retryable: result.code === "real_smoke_not_enabled",
          details: result,
        },
      ));
      return;
    }
    writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/model-library/task-default") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_task_default_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(modelLibraryStore.setTaskDefault(body), { startedAt }));
    return;
  }

  if (request.method === "POST" && (url.pathname === "/chat-gateway/execute" || url.pathname === "/chat/gateway")) {
    const body = await readCapabilityJson({ request, response, startedAt, code: "chat_gateway_execute_invalid_json" });
    if (!body) return;
    const taijiBeidouExecuteHook = evaluateTaijiBeidouChatGatewayExecutePreviewHook({ body, route: url.pathname });
    if (taijiBeidouExecuteHook.action === "respond") {
      writeJson(response, taijiBeidouExecuteHook.responseStatus ?? 200, createOkEnvelope(taijiBeidouExecuteHook.result, { startedAt }));
      return;
    }
    const result = await runPhase312AChatGateway({ application, body, startedAt });
    writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/three-mode/execute") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "three_mode_execute_invalid_json" });
    if (!body) return;
    const result = await executeThreeModeRequest({ request: body, application });
    writeJson(response, result.success ? 200 : 422, result);
    return;
  }

  if (request.method === "GET" && url.pathname === "/real-capabilities/status") {
    writeJson(response, 200, createOkEnvelope(await fiveCapabilityActivationService.getStatus(), { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/real-capabilities/activate-five") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "real_capabilities_activate_five_invalid_json" });
    if (!body) return;
    const result = await fiveCapabilityActivationService.activateFive(body);
    writeServiceLog("five_real_capability_activation_completed", {
      method: request.method,
      path: url.pathname,
      runId: result.runId,
      executionStatus: result.executionStatus,
      providerNetworkAttempted: result.providerNetworkAttempted,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, result.completionVerified ? 200 : 422, createOkEnvelope(result, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/chat-gateway/task-matrix") {
    writeJson(response, 200, createOkEnvelope({ taskId: "task_matrix", taskMatrix: TASK_MATRIX }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/chat-gateway/evidence/")) {
    const evidenceId = url.pathname.split("/chat-gateway/evidence/")[1];
    const record = await getEvidenceById(evidenceId);
    if (record) {
      writeJson(response, 200, createOkEnvelope(record, { startedAt }));
    } else {
      writeJson(response, 404, createErrorEnvelope("evidence_not_found", `Evidence ${evidenceId} not found.`, { startedAt }));
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/chat-gateway/dry-run-task") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "dry_run_task_invalid_json" });
    if (!body) return;
    const dryRunResult = await runPhase314ADryRunTask({ application, body, startedAt });
    writeJson(response, 200, createOkEnvelope(dryRunResult, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/chat-gateway/latency-policy") {
    writeJson(response, 200, createOkEnvelope({
      phase: "Phase315A",
      timeoutTypes: PHASE315A_TIMEOUT_TYPES,
      latencyRiskLevels: PHASE315A_LATENCY_RISK_LEVELS,
      completionConfidenceValues: PHASE315A_COMPLETION_CONFIDENCE,
      dryRunCases: LATENCY_DRY_RUN_CASES.map((item) => item.caseId),
      realFallbackDefaultEnabled: false,
      browserRealSmokeRouteAdded: false,
    }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/chat-gateway/latency-dry-run") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "latency_dry_run_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(runPhase315ALatencyDryRun(body), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/workbench/diagnostics/status") {
    const registry = modelLibraryStore.getRegistry();
    const matrix = buildModelUsabilityMatrix({ registry });
    const records = Array.isArray(matrix.records) ? matrix.records : [];
    const selectableChatModels = records.filter((item) => {
      const bucket = String(item?.capabilityBucket ?? "").toLowerCase();
      return item?.verificationStatus === "smoke_passed"
        && item?.selectable === true
        && item?.directChatAllowed === true
        && (bucket === "chat" || bucket === "reasoning_chat" || bucket === "code");
    }).map((item) => item.modelId);

    writeJson(response, 200, createOkEnvelope({
      phase: "Phase318A",
      health: createHealth(application),
      doctor: {
        command: "cmd /c pnpm doctor:phase13a",
        executed: false,
        status: "not_run",
        note: "UI 只读显示 doctor 命令边界，不自动执行。",
      },
      modelLibrary: {
        totalRecords: records.length,
        smokePassedRecords: records.filter((item) => item?.verificationStatus === "smoke_passed").length,
        selectableChatModels,
        failedRecords: records.filter((item) => item?.verificationStatus === "smoke_failed").map((item) => item.modelId),
      },
      chatGateway: {
        executeRoute: true,
        dryRunRoute: true,
        taskMatrixCount: TASK_MATRIX.length,
        defaultChatChanged: false,
        blockedActionsProviderCalled: false,
      },
      providerStatus: providerConfigRoutes.status(),
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/codex-handoff/next-task") {
    writeJson(response, 200, createOkEnvelope(createNextCodexTask(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/codex-loop/status") {
    writeJson(response, 200, createOkEnvelope(await readCodexLoopStatus(), { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/cost/health") {
    writeJson(
      response,
      200,
      createOkEnvelope(
        {
          success: true,
          enabled: true,
          mode: "preview-only",
          externalApiCalled: false,
          paidApiCalled: false,
          apiKeyRead: false,
          defaultNvidiaChatLaneChanged: false,
        },
        { startedAt },
      ),
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/cost/estimate") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "token_cost_estimate_invalid_json" });
    if (!body) return;

    try {
      const result = checkTokenCostGuard({
        ...body,
        requestType: body.requestType ?? "cost-estimate-preview",
      });
      writeJson(
        response,
        200,
        createOkEnvelope(
          {
            mode: "preview-only",
            estimate: result.estimate,
            savings: result.savings,
            cache: result.cache,
            safety: result.safety,
          },
          { startedAt },
        ),
      );
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "token_cost_estimate_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/cost/guard/check") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "token_cost_guard_invalid_json" });
    if (!body) return;

    try {
      const result = checkTokenCostGuard({
        ...body,
        requestType: body.requestType ?? "cost-guard-check-preview",
      });
      await appendEstimateRecord({
        requestType: body.requestType ?? "cost-guard-check-preview",
        provider: body.provider ?? "preview-provider",
        model: body.model ?? "preview-model",
        modelTier: result.estimate.modelTier,
        estimate: result.estimate,
        savings: result.savings,
        cache: result.cache,
        decision: result.decision,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "token_cost_guard_failed" });
    }
    return;
  }


  return ROUTE_NOT_HANDLED;
}

function collectReadinessFailures(healthSnapshot, readinessSnapshot, context = {}) {
  const readinessFailures = [];
  const isProviderReadinessReady = readinessSnapshot?.status === "ready";

  if (healthSnapshot?.status !== "ready" || !isProviderReadinessReady) {
    readinessFailures.push("service-dependency");
  }
  if (healthSnapshot?.knowledge?.status !== "ready") {
    readinessFailures.push("knowledge");
  }
  if (healthSnapshot?.workflow?.status !== "ready") {
    readinessFailures.push("workflow");
  }
  if (healthSnapshot?.workforce?.status !== "ready") {
    readinessFailures.push("workforce");
  }
  if (healthSnapshot?.usageLedger?.requiredForRealProviders === true
    && healthSnapshot.usageLedger.status !== "ready") {
    readinessFailures.push("usage-ledger-unavailable");
  }
  if (healthSnapshot?.enterprise?.audit?.central
    && healthSnapshot.enterprise.audit.central.status !== "ready") {
    readinessFailures.push("audit-central-store-unavailable");
  }
  if (context?.saturated) {
    readinessFailures.push("inflight-saturation");
  }
  if (context?.gatewayErrorCircuitState && context.gatewayErrorCircuitState !== "closed") {
    readinessFailures.push("gateway-error-circuit");
  }
  if (context?.lifecycleState && context.lifecycleState !== "ready") {
    readinessFailures.push("service-draining");
  }
  if (context?.idempotencyStoreUnavailable) {
    readinessFailures.push("idempotency-store-unavailable");
  }
  if (context?.rateLimitStoreUnavailable) {
    readinessFailures.push("rate-limit-store-unavailable");
  }
  if (context?.webSocketLeaseStoreUnavailable) {
    readinessFailures.push("websocket-lease-store-unavailable");
  }
  if (context?.a2aTaskStoreUnavailable) {
    readinessFailures.push("a2a-task-store-unavailable");
  }
  if (context?.workforceClaimStoreUnavailable) {
    readinessFailures.push("workforce-claim-store-unavailable");
  }

  return Array.from(new Set(readinessFailures));
}

async function readWorkforceClaimStoreHealth(workforceExecutor) {
  if (!workforceExecutor?.getTaskClaimHealth) return null;
  try {
    const snapshot = await workforceExecutor.getTaskClaimHealth();
    return {
      mode: snapshot?.mode ?? "unknown",
      distributed: snapshot?.distributed === true,
      available: snapshot?.available === true,
      activeClaims: Number(snapshot?.activeClaims ?? 0),
      maxClaims: Number(snapshot?.maxClaims ?? 0),
      statsUpdatedAt: snapshot?.statsUpdatedAt ?? null,
    };
  } catch {
    return {
      mode: "unknown",
      distributed: true,
      available: false,
      activeClaims: 0,
      maxClaims: 0,
      statsUpdatedAt: null,
    };
  }
}

function readA2ATaskStoreHealth(a2aGateway) {
  if (!a2aGateway?.getTaskStoreHealth) return null;
  try {
    const snapshot = a2aGateway.getTaskStoreHealth();
    return {
      mode: snapshot?.mode ?? "unknown",
      durable: snapshot?.durable === true,
      required: snapshot?.required === true,
      available: snapshot?.available === true,
      reason: snapshot?.reason ?? null,
      ttlMs: Number(snapshot?.ttlMs ?? 0),
      maxEntries: Number(snapshot?.maxEntries ?? 0),
      maxEntriesPerOwner: Number(snapshot?.maxEntriesPerOwner ?? 0),
      maxTaskBytes: Number(snapshot?.maxTaskBytes ?? 0),
      maxHistoryMessages: Number(snapshot?.maxHistoryMessages ?? 0),
      maxArtifacts: Number(snapshot?.maxArtifacts ?? 0),
    };
  } catch {
    return {
      available: false,
      durable: false,
      mode: "unknown",
      reason: "health_probe_failed",
    };
  }
}

async function readIdempotencyHealth(coordinator) {
  if (!coordinator) return null;
  if (typeof coordinator.checkHealth === "function") return coordinator.checkHealth();
  return coordinator.getStats?.() ?? null;
}

async function readRateLimitHealth(rateLimiter) {
  if (!rateLimiter) return null;
  if (typeof rateLimiter.checkHealth === "function") return rateLimiter.checkHealth();
  return rateLimiter.getStats?.() ?? null;
}

async function readWebSocketLeaseHealth(manager) {
  if (!manager) return null;
  try {
    const snapshot = typeof manager.checkHealth === "function"
      ? await manager.checkHealth()
      : await manager.getStats?.();
    return sanitizeWebSocketLeaseHealth(snapshot);
  } catch {
    return sanitizeWebSocketLeaseHealth(null);
  }
}

function sanitizeWebSocketLeaseHealth(snapshot) {
  const safeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  return {
    storeMode: "postgres",
    distributed: true,
    available: snapshot?.available === true,
    activeLocalLeases: safeNumber(snapshot?.activeLocalLeases),
    leaseMs: safeNumber(snapshot?.leaseMs),
    localSafetyMs: safeNumber(snapshot?.localSafetyMs),
    maxRows: safeNumber(snapshot?.maxRows),
    acquired: safeNumber(snapshot?.acquired),
    denied: safeNumber(snapshot?.denied),
    lost: safeNumber(snapshot?.lost),
    released: safeNumber(snapshot?.released),
  };
}
