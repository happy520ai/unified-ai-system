import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { getChatResponseCacheIntegration } from "../cache/chatResponseCacheIntegration.ts";
import { reserveWebhookExternalEffect } from "../external-effects/externalEffectWebhookGuard.ts";
import { readExternalEffectKeyContext } from "../external-effects/externalEffectHttpContext.ts";
import { takeRawJsonRequestBody } from "./utils/responseUtils.js";
import { hasActiveLocalClientReceiptRecoveryFailure } from "./utils/healthUtils.js";

export async function dispatchHttpRoutes03(context) {
  const {
    createErrorEnvelope, createOkEnvelope, getSafeRuntimeConfig, createRouteFailureEnvelope,
    createLocalAgentIntentExplainer, runLocalOperationLoop, getSupportedKnowledgeFileTypes, parseKnowledgeFile,
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
    request, requestExecution, response, url, startedAt,
    approvalStore, fileContextStore, phase319LocalOperation, connectorFeishuDryRun,
    connectorWeComDryRun, capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService,
    enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService, localClientManagementService,
    modelImportService, modelLibraryStore, providerConfigRoutes, userExperienceService,
    workforceService, workflowService, wsServer,
  } = context;
  const localClientScope = {
    tenantId: request.enterpriseIdentity?.tenantId,
    userId: request.enterpriseIdentity?.userId,
  };
  const localClientOnboardingIdentity = {
    tenantId: localClientScope.tenantId,
    subjectId: localClientScope.userId,
  };
  const localClientOnboardingRequestPort = {
    getHeader: (name) => request.headers?.[String(name).toLowerCase()],
    signal: requestExecution?.signal ?? new AbortController().signal,
  };
  const authenticateLocalClientTelemetry = async (body) => {
    const auth = application.localClientPopHttpAuth;
    if (!auth) {
      return Object.freeze({
        mode: "operator-authenticated",
        clientProofVerified: false,
        proofFingerprint: null,
      });
    }
    const verification = await auth.authenticate({
      authenticatedScope: {
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
      },
      clientId: body?.clientId ?? body?.id,
      method: request.method,
      canonicalPathWithQuery: `${url.pathname}${url.search}`,
      rawBody: takeRawJsonRequestBody(request),
      proofHeader: request.headers?.["x-ai-gateway-local-client-proof"],
    });
    return Object.freeze({
      mode: "managed-client-pop",
      clientProofVerified: true,
      proofFingerprint: verification.proofFingerprint,
    });
  };
  const writeLocalClientOnboardingOutcome = (outcome) => {
    setLocalClientIdempotencyHeaders(response, outcome);
    if (outcome.accepted) {
      writeJson(response, outcome.statusCode, createOkEnvelope(outcome, { startedAt }));
      return;
    }
    if (Number.isInteger(outcome.retryAfterSeconds)) {
      response.setHeader("Retry-After", String(outcome.retryAfterSeconds));
    }
    writeJson(response, outcome.statusCode, createErrorEnvelope(outcome.code, outcome.message, {
      startedAt,
      category: outcome.status === "unknown-reconcile-required" ? "integrity" : "execution",
      retryable: outcome.status === "rejected" && outcome.retryAllowed === true,
      details: {
        status: outcome.status,
        replayed: outcome.replayed,
        replayable: outcome.replayable,
        retryAllowed: outcome.retryAllowed,
        operationInvoked: outcome.operationInvoked,
        result: outcome.result,
      },
    }));
  };
  if (url.pathname.startsWith("/local-clients/")) {
    response.setHeader("Cache-Control", "no-store");
  }

  if (request.method === "GET" && url.pathname === "/cost/summary") {
    const tenantScopeIdentity = request.enterpriseIdentity;
    const summary = await readTokenCostSummary();
    writeJson(response, 200, createOkEnvelope({
      ...summary,
      calibrationPreview: readLatestMimoTokenCalibrationProfile({
        provider: "mimo",
        model: "mimo-v2.5-pro",
      }),
      cachePersistencePreview: {
        cachePersistenceAvailable: true,
        cachePolicyVersion: createResponseCachePolicy().cacheVersion,
        mode: createResponseCachePolicy().mode,
        summary: await readResponseCacheSummary({ tenantScopeIdentity }),
      },
      cacheHardeningPreview: {
        cachePersistenceAvailable: true,
        cachePolicyVersion: createResponseCachePolicy().cachePolicyVersion,
        mode: createResponseCachePolicy().mode,
        semanticModelEnabled: false,
        semanticDecisionUsedAsFinalAuthority: false,
        allowIntentSoftHit: createResponseCachePolicy().allowIntentSoftHit,
        allowMultilingualIntentSoftHit: createResponseCachePolicy().allowMultilingualIntentSoftHit,
        summary: await readResponseCacheSummary({ tenantScopeIdentity }),
      },
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/cache/health") {
    const policy = createResponseCachePolicy();
    const chatHotPathConfig = getChatResponseCacheIntegration().readConfig();
    writeJson(response, 200, createOkEnvelope({
      success: true,
      enabled: policy.enabled,
      mode: policy.mode,
      cacheVersion: policy.cacheVersion,
      cachePolicyVersion: policy.cachePolicyVersion,
      semanticModelEnabled: policy.semanticModelEnabled,
      semanticJudgeAvailable: policy.semanticJudgeAvailable,
      semanticDecisionUsedAsFinalAuthority: policy.semanticDecisionUsedAsFinalAuthority,
      allowIntentSoftHit: policy.allowIntentSoftHit,
      allowMultilingualIntentSoftHit: policy.allowMultilingualIntentSoftHit,
      chatHotPath: {
        route: "POST /v1/chat/completions",
        enabled: chatHotPathConfig.enabled,
        enabledBy: "AI_GATEWAY_RESPONSE_CACHE_ENABLED=true",
        ttlMs: chatHotPathConfig.ttlMs,
        maxPayloadBytes: chatHotPathConfig.maxPayloadBytes,
        tenantScoped: true,
      },
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
      defaultNvidiaChatLaneChanged: false,
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/mcp/health") {
    writeJson(response, 200, createOkEnvelope(
      application.mcpGatewayService
        ? application.mcpGatewayService.getReadiness()
        : { status: "disabled", upstreamCount: 0 },
      { startedAt },
    ));
    return;
  }

  if (request.method === "GET" && url.pathname === "/mcp/tools") {
    try {
      const result = await application.mcpGatewayService.listTools(request.enterpriseIdentity);
      writeJson(response, 200, createOkEnvelope({
        toolCount: result.tools.length,
        tools: result.tools,
        servers: result.servers,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "mcp_tools_list_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/mcp/call") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "mcp_call_invalid_json" });
    if (!body) return;

    try {
      const result = await application.mcpGatewayService.callTool(request.enterpriseIdentity, {
        server: body.server,
        tool: body.tool,
        ...(body.arguments && typeof body.arguments === "object" ? { arguments: body.arguments } : {}),
        externalEffect: readExternalEffectKeyContext(request),
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "mcp_tool_call_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/cache/lookup") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "response_cache_lookup_invalid_json" });
    if (!body) return;

    try {
      const key = body.cacheKey ? { cacheKey: body.cacheKey } : createResponseCacheKey(body);
      const result = await lookupCache({
        cacheKey: key.cacheKey,
        tenantScopeIdentity: request.enterpriseIdentity,
      });
      writeJson(response, 200, createOkEnvelope({
        mode: createResponseCachePolicy().mode,
        cacheDecision: result.cacheDecision,
        cacheHitType: result.cacheHitType,
        duplicateReason: result.duplicateReason,
        finalDecisionBy: result.finalDecisionBy,
        semanticDecisionUsedAsFinalAuthority: false,
        ...result,
        cacheKey: key.cacheKey,
        intentSignature: result.intentSignature ?? key.intentSignature,
        paraphraseGroupId: result.paraphraseGroupId ?? key.paraphraseGroupId,
        queryLanguage: result.queryLanguage ?? key.queryLanguage,
        externalApiCalled: false,
        paidApiCalled: false,
        apiKeyRead: false,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "response_cache_lookup_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/cache/write") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "response_cache_write_invalid_json" });
    if (!body) return;

    try {
      const key = body.cacheKey ? {
        cacheKey: body.cacheKey,
        queryHash: body.queryHash,
        selectedSourcesHash: body.selectedSourcesHash,
      } : createResponseCacheKey(body);
      const result = await writeCacheRecord({
        ...body,
        cacheKey: key.cacheKey,
        tenantScopeIdentity: request.enterpriseIdentity,
        rawQueryHash: key.rawQueryHash ?? body.rawQueryHash,
        normalizedQueryHash: key.normalizedQueryHash ?? body.normalizedQueryHash ?? key.queryHash,
        queryHash: key.queryHash ?? body.queryHash,
        queryLanguage: key.queryLanguage ?? body.queryLanguage,
        intentSignature: key.intentSignature ?? body.intentSignature,
        paraphraseGroupId: key.paraphraseGroupId ?? body.paraphraseGroupId,
        selectedSourcesHash: key.selectedSourcesHash ?? body.selectedSourcesHash,
        latestEvidenceHash: key.latestEvidenceHash ?? body.latestEvidenceHash,
        answerContractHash: key.answerContractHash ?? body.answerContractHash,
      });
      writeJson(response, 200, createOkEnvelope({
        mode: createResponseCachePolicy().mode,
        ...result,
        cacheKey: key.cacheKey,
        externalApiCalled: false,
        paidApiCalled: false,
        apiKeyRead: false,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "response_cache_write_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/cache/invalidate") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "response_cache_invalidate_invalid_json" });
    if (!body) return;

    try {
      const result = await invalidateCache({
        cacheKey: body.cacheKey,
        reason: body.reason ?? "preview-http-invalidate",
        tenantScopeIdentity: request.enterpriseIdentity,
      });
      writeJson(response, 200, createOkEnvelope({
        mode: createResponseCachePolicy().mode,
        ...result,
        cacheKey: body.cacheKey,
        externalApiCalled: false,
        paidApiCalled: false,
        apiKeyRead: false,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "response_cache_invalidate_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/cache/summary") {
    writeJson(response, 200, createOkEnvelope({
      mode: createResponseCachePolicy().mode,
      ...(await readResponseCacheSummary({ tenantScopeIdentity: request.enterpriseIdentity })),
      allowIntentSoftHit: createResponseCachePolicy().allowIntentSoftHit,
      allowMultilingualIntentSoftHit: createResponseCachePolicy().allowMultilingualIntentSoftHit,
      semanticModelEnabled: false,
      semanticDecisionUsedAsFinalAuthority: false,
      cacheHardeningPreview: true,
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/cache/audit") {
    const limit = Number(url.searchParams.get("limit") ?? 100);
    writeJson(response, 200, createOkEnvelope({
      mode: createResponseCachePolicy().mode,
      events: await listResponseCacheAuditTrail({
        limit,
        tenantScopeIdentity: request.enterpriseIdentity,
      }),
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
    }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/routing/answer-path/preview") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "answer_path_routing_preview_invalid_json" });
    if (!body) return;

    try {
      const result = routeAnswerPath({
        ...body,
        requestType: body.requestType ?? "answer-path-routing-preview",
      });
      writeJson(response, 200, createOkEnvelope({
        success: true,
        mode: "local-routing-preview-only",
        answerPath: result.answerPath,
        modelTier: result.modelTier,
        providerRecommendation: result.providerRecommendation,
        modelRecommendation: result.modelRecommendation,
        requiresPaidApi: result.requiresPaidApi,
        requiresApproval: result.requiresApproval,
        shouldBlock: result.shouldBlock,
        blockReason: result.blockReason,
        routingReason: result.routingReason,
        cacheDecision: result.cacheDecision,
        cacheHitType: result.cacheHitType,
        tokenGuardDecision: result.tokenGuard?.decision,
        paidApiCallCount: 0,
        externalApiCalled: false,
        mimoApiCalled: false,
        defaultNvidiaChatLaneChanged: false,
        mimoSetAsDefault: false,
        audit: result.audit,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "answer_path_routing_preview_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/routing/quality-cost/preview") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "quality_cost_routing_preview_invalid_json" });
    if (!body) return;

    try {
      const result = routeQualityCostAnswer({
        ...body,
        requestType: body.requestType ?? "quality-cost-routing-preview",
        requestedQualityLevel: body.requestedQualityLevel ?? "normal",
        budgetPreference: body.budgetPreference ?? "balanced",
      });
      writeJson(response, 200, createOkEnvelope({
        success: true,
        mode: "local-quality-cost-routing-preview-only",
        providerAgnostic: true,
        singleProviderLocked: false,
        answerPath: result.answerPath,
        modelTier: result.modelTier,
        providerRecommendation: result.providerRecommendation,
        modelRecommendation: result.modelRecommendation,
        premiumCandidates: result.premiumCandidates,
        defaultPremiumProvider: result.defaultPremiumProvider,
        requiresPaidApi: result.requiresPaidApi,
        requiresApproval: result.requiresApproval,
        shouldBlock: result.shouldBlock,
        blockReason: result.blockReason,
        routingReason: result.routingReason,
        qualityGateRequired: result.answerQualityGate?.qualityGateRequired === true,
        qualityTarget: result.answerQualityGate?.qualityTarget,
        progressiveEscalationEnabled: result.progressiveEscalation?.progressiveEscalationEnabled === true,
        cacheDecision: result.cacheDecision,
        cacheHitType: result.cacheHitType,
        tokenGuardDecision: result.tokenGuard?.decision,
        paidApiCallCount: 0,
        externalApiCalled: false,
        mimoApiCalled: false,
        modelActuallyCalled: false,
        defaultNvidiaChatLaneChanged: false,
        mimoSetAsDefault: false,
        audit: result.audit,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "quality_cost_routing_preview_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/local-clients/status") {
    try {
      const status = await localClientManagementService.getStatus(localClientScope);
      const onboarding = application.localClientGovernedOnboardingRuntime?.getStatus?.()
        ?? application.localClientGovernedOnboardingStatus;
      const receiptRecovery = application.localClientExecutionReceiptRecoveryStatus;
      const recoveryFailureActive = hasActiveLocalClientReceiptRecoveryFailure(receiptRecovery);
      writeJson(response, 200, createOkEnvelope({
        ...status,
        ...(recoveryFailureActive ? { status: "degraded" } : {}),
        ...(onboarding ? { onboarding } : {}),
        smartManagementScheduler: application.localClientSmartManagementScheduler?.getStatus?.()
          ?? application.localClientSmartManagementSchedulerStatus,
        clientProofAuthority: application.localClientPopIdentityStatus,
        managedProtocolDispatch: application.localClientManagedProtocolDispatchStatus,
        popSnapshotRollbackProtection:
          application.localClientPopSnapshotRollbackProtectionStatus,
        executionFeedback: {
          outbox: application.localClientExecutionFeedbackOutboxStatus,
          dispatcher: application.localClientExecutionFeedbackDispatcher?.status
            ?? application.localClientExecutionFeedbackDispatcherStatus,
          receiptJournal: application.localClientExecutionReceiptJournalStatus,
          receiptRecovery,
        },
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_status_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/provider-route") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_provider_route_invalid_json" });
    if (!body) return;
    try {
      const result = await application.localClientProviderRuntimeRouter.route({
        ...body,
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_provider_route_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/local-clients/health") {
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.healthCheck(localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_health_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/local-clients/intelligence") {
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.getIntelligence(localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_intelligence_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/local-clients/registry") {
    const includeDisabled = url.searchParams.get("includeDisabled") === "true";
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const capabilities = (url.searchParams.get("capabilities") || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.list({
        includeDisabled,
        limit,
        offset,
        capabilities,
      }, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_registry_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/discover") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_discover_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.discover(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_discover_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/discover/system") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_discover_system_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.discoverFromSystem(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_discover_system_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/heartbeat") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_heartbeat_invalid_json" });
    if (!body) return;
    try {
      const telemetryAuthority = await authenticateLocalClientTelemetry(body);
      writeJson(response, 200, createOkEnvelope({
        ...await localClientManagementService.heartbeat(body, localClientScope),
        telemetryAuthority,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_heartbeat_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/feedback") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_feedback_invalid_json" });
    if (!body) return;
    try {
      const telemetryAuthority = await authenticateLocalClientTelemetry(body);
      writeJson(response, 200, createOkEnvelope({
        ...await localClientManagementService.feedback(body, localClientScope),
        telemetryAuthority,
      }, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_feedback_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/register") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_register_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.register(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_register_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/disable") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_disable_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.disable(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_disable_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/revoke") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_revoke_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.revoke(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_revoke_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/route") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_route_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.route(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_route_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/verify") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_verify_invalid_json" });
    if (!body) return;
    try {
      const result = await application.localClientVerificationService.verifyAndPromote({
        clientId: body.clientId,
        expectedRevision: body.expectedRevision,
        expectedAdapter: body.expectedAdapter,
        expectedManifestSha256: body.expectedManifestSha256,
        signal: requestExecution?.signal ?? new AbortController().signal,
      }, {
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_verify_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/local-clients/onboarding/profiles") {
    try {
      const result = await application.localClientGovernedOnboardingApi.list(
        localClientOnboardingIdentity,
      );
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_onboarding_profiles_failed" });
    }
    return;
  }

  const localClientOnboardingVerifyMatch = /^\/local-clients\/onboarding\/profiles\/([^/]+)\/verify$/u.exec(
    url.pathname,
  );
  if (request.method === "GET" && localClientOnboardingVerifyMatch) {
    try {
      const result = await application.localClientGovernedOnboardingApi.verify({
        ...localClientOnboardingIdentity,
        profileId: decodeURIComponent(localClientOnboardingVerifyMatch[1]),
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_onboarding_verify_failed" });
    }
    return;
  }

  const localClientOnboardingProfileMatch = /^\/local-clients\/onboarding\/profiles\/([^/]+)$/u.exec(
    url.pathname,
  );
  if (request.method === "GET" && localClientOnboardingProfileMatch) {
    try {
      const result = await application.localClientGovernedOnboardingApi.inspect({
        ...localClientOnboardingIdentity,
        profileId: decodeURIComponent(localClientOnboardingProfileMatch[1]),
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_onboarding_profile_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/onboarding/plans") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_onboarding_plan_invalid_json" });
    if (!body) return;
    try {
      const result = await application.localClientGovernedOnboardingApi.plan({
        ...body,
        ...localClientOnboardingIdentity,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_onboarding_plan_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/onboarding/approve") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_onboarding_approve_invalid_json" });
    if (!body) return;
    try {
      const result = await application.localClientGovernedOnboardingApi.approve({
        ...body,
        ...localClientOnboardingIdentity,
      }, localClientOnboardingRequestPort);
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_onboarding_approve_failed" });
    }
    return;
  }

  for (const operation of ["apply", "rollback", "recover"]) {
    if (request.method !== "POST" || url.pathname !== `/local-clients/onboarding/${operation}`) continue;
    const body = await readCapabilityJson({
      request,
      response,
      startedAt,
      code: `local_client_onboarding_${operation}_invalid_json`,
    });
    if (!body) return;
    try {
      const outcome = await application.localClientGovernedOnboardingApi[operation]({
        ...body,
        ...localClientOnboardingIdentity,
      }, localClientOnboardingRequestPort);
      writeLocalClientOnboardingOutcome(outcome);
    } catch (error) {
      writeCapabilityError({
        response,
        error,
        startedAt,
        fallbackCode: `local_client_onboarding_${operation}_failed`,
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/executions/preview") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_execution_preview_invalid_json" });
    if (!body) return;
    try {
      const result = await application.localClientGovernedExecutionApi.preview({
        ...body,
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_execution_preview_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/executions/approve") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_execution_approve_invalid_json" });
    if (!body) return;
    try {
      const result = await application.localClientGovernedExecutionApi.approve({
        ...body,
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_execution_approve_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/executions/execute") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_execution_execute_invalid_json" });
    if (!body) return;
    try {
      const outcome = await application.localClientGovernedExecutionApi.execute({
        ...body,
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
      }, {
        getHeader: (name) => request.headers?.[name],
        signal: requestExecution?.signal ?? new AbortController().signal,
      });
      setLocalClientIdempotencyHeaders(response, outcome);
      if (outcome.accepted) {
        writeJson(response, outcome.statusCode, createOkEnvelope(outcome, { startedAt }));
      } else {
        if (Number.isInteger(outcome.retryAfterSeconds)) {
          response.setHeader("Retry-After", String(outcome.retryAfterSeconds));
        }
        writeJson(response, outcome.statusCode, createErrorEnvelope(outcome.code, outcome.message, {
          startedAt,
          category: outcome.status === "unknown-reconcile-required" ? "integrity" : "execution",
          retryable: outcome.status === "rejected" && outcome.retryable === true,
          details: {
            status: outcome.status,
            replayed: outcome.replayed,
            replayable: outcome.replayable,
            retryAllowed: false,
            ...(Object.hasOwn(outcome, "idempotencyStatus")
              ? { idempotencyStatus: outcome.idempotencyStatus }
              : {}),
            ...(Object.hasOwn(outcome, "operationInvoked")
              ? { operationInvoked: outcome.operationInvoked }
              : {}),
            ...(Object.hasOwn(outcome, "result") ? { result: outcome.result } : {}),
          },
        }));
      }
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_execution_execute_failed" });
    }
    return;
  }

  const localClientExecutionStatusMatch = /^\/local-clients\/executions\/([^/]+)$/u.exec(url.pathname);
  if (request.method === "GET" && localClientExecutionStatusMatch) {
    try {
      const result = await application.localClientGovernedExecutionApi.status({
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
        executionId: localClientExecutionStatusMatch[1],
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_execution_status_failed" });
    }
    return;
  }

  const localClientExecutionCancelMatch = /^\/local-clients\/executions\/([^/]+)\/cancel$/u.exec(url.pathname);
  if (request.method === "POST" && localClientExecutionCancelMatch) {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_execution_cancel_invalid_json" });
    if (!body) return;
    try {
      const result = await application.localClientGovernedExecutionApi.cancel({
        ...body,
        tenantId: localClientScope.tenantId,
        subjectId: localClientScope.userId,
        executionId: localClientExecutionCancelMatch[1],
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_execution_cancel_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/execute") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_execute_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.execute(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_execute_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/maintenance") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_maintenance_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.maintenance(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_maintenance_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/local-clients/smart-manage") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "local_client_smart_manage_invalid_json" });
    if (!body) return;
    try {
      writeJson(response, 200, createOkEnvelope(await localClientManagementService.smartManage(body, localClientScope), { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "local_client_smart_manage_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/codex-handoff/next-task") {
    try {
      const result = await writeNextCodexTaskOutbox();
      writeServiceLog("codex_next_task_handoff_generated", {
        taskId: result.taskId,
        mode: result.mode,
        executionEnabled: result.executionEnabled,
        codexExecInvoked: result.codexExecInvoked,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "codex_next_task_handoff_failed" });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/models/capability-router/preview") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "capability_router_preview_invalid_json" });
    if (!body) return;

    try {
      const result = capabilityRouterService.preview(body);
      writeServiceLog("capability_router_preview_completed", {
        method: request.method,
        path: url.pathname,
        status: result.status,
        detectedTaskType: result.task?.detectedTaskType,
        requiredCapabilities: result.task?.requiredCapabilities,
        selectedProvider: result.recommendation?.selected?.providerId,
        selectedModel: result.recommendation?.selected?.modelId,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeCapabilityError({ response, error, startedAt, fallbackCode: "capability_router_preview_failed" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/connectors") {
    writeJson(
      response,
      200,
      createOkEnvelope(
        {
          connectors: [
            {
              connectorId: "explicit-text",
              title: "Explicit Text Connector",
              mode: "manual-input",
              safety: "No crawling, no broad file scan, no background sync.",
            },
            {
              connectorId: "feishu",
              title: "Feishu / Lark",
              mode: "webhook",
              status: connectorFeishuDryRun ? "dry-run" : "ready",
              webhookConfigured: !connectorFeishuDryRun,
              dryRun: connectorFeishuDryRun,
            },
            {
              connectorId: "wecom",
              title: "WeCom / Enterprise WeChat",
              mode: "webhook",
              status: connectorWeComDryRun ? "dry-run" : "ready",
              webhookConfigured: !connectorWeComDryRun,
              dryRun: connectorWeComDryRun,
            },
          ],
        },
        { startedAt },
      ),
    );
    return;
  }

  if (request.method === "POST" && url.pathname === "/connectors/feishu/send") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "feishu_send_invalid_json" });
    if (!body) return;
    const webhookUrl = application.runtimeEnv?.FEISHU_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL || "";
    const dryRun = !webhookUrl;
    if (dryRun) {
      writeJson(response, 200, createOkEnvelope({
        route: "/connectors/feishu/send", delivered: false, dryRun: true,
        metadata: { connectorId: "feishu", messagePreview: (body.body || body.text || "").slice(0, 100) },
      }, { startedAt }));
    } else {
      try {
        const payload = { msg_type: "text", content: { text: `[${body.title || "AI Gateway"}]\n${body.body || body.text || ""}` } };
        const reservation = await reserveWebhookExternalEffect({
          gate: application.externalEffectGate,
          request,
          route: "/connectors/feishu/send",
          effectType: "webhook:feishu",
          webhookUrl,
          payload,
          tenantId: request.enterpriseIdentity?.tenantId ?? request.enterpriseIdentity?.tenant ?? "default",
        });
        await reservation.commit();
        const resp = await safeOutboundFetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await resp.json().catch(() => ({}));
        writeJson(response, 200, createOkEnvelope({
          route: "/connectors/feishu/send", delivered: resp.ok && result.code === 0, dryRun: false,
          externalMessageId: result.message_id || null,
        }, { startedAt }));
      } catch (error) {
        writeCapabilityError({ response, error, startedAt, fallbackCode: "feishu_send_failed" });
      }
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/connectors/wecom/send") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "wecom_send_invalid_json" });
    if (!body) return;
    const webhookUrl = application.runtimeEnv?.WECOM_WEBHOOK_URL || process.env.WECOM_WEBHOOK_URL || "";
    const dryRun = !webhookUrl;
    if (dryRun) {
      writeJson(response, 200, createOkEnvelope({
        route: "/connectors/wecom/send", delivered: false, dryRun: true,
        metadata: { connectorId: "wecom", messagePreview: (body.body || body.text || "").slice(0, 100) },
      }, { startedAt }));
    } else {
      try {
        const payload = { msgtype: "text", text: { content: `[${body.title || "AI Gateway"}]\n${body.body || body.text || ""}` } };
        const reservation = await reserveWebhookExternalEffect({
          gate: application.externalEffectGate,
          request,
          route: "/connectors/wecom/send",
          effectType: "webhook:wecom",
          webhookUrl,
          payload,
          tenantId: request.enterpriseIdentity?.tenantId ?? request.enterpriseIdentity?.tenant ?? "default",
        });
        await reservation.commit();
        const resp = await safeOutboundFetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await resp.json().catch(() => ({}));
        writeJson(response, 200, createOkEnvelope({
          route: "/connectors/wecom/send", delivered: resp.ok && result.errcode === 0, dryRun: false,
          externalMessageId: result.msgid || null,
        }, { startedAt }));
      } catch (error) {
        writeCapabilityError({ response, error, startedAt, fallbackCode: "wecom_send_failed" });
      }
    }
    return;
  }


  return ROUTE_NOT_HANDLED;
}

function setLocalClientIdempotencyHeaders(response, outcome) {
  const status = outcome?.accepted === true
    ? outcome.idempotencyStatus
    : outcome?.idempotencyStatus ?? "rejected";
  response.setHeader("Idempotency-Status", String(status));
  response.setHeader("Idempotency-Replayed", String(outcome?.replayed === true));
  response.setHeader("Idempotency-Replayable", String(outcome?.replayable === true));
  const exposed = new Set(
    String(response.getHeader?.("Access-Control-Expose-Headers") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  exposed.add("Idempotency-Status");
  exposed.add("Idempotency-Replayed");
  exposed.add("Idempotency-Replayable");
  response.setHeader("Access-Control-Expose-Headers", [...exposed].join(", "));
}
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";
