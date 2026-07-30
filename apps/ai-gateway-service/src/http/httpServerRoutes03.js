import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";

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

  if (request.method === "GET" && url.pathname === "/cost/summary") {
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
        summary: await readResponseCacheSummary(),
      },
      cacheHardeningPreview: {
        cachePersistenceAvailable: true,
        cachePolicyVersion: createResponseCachePolicy().cachePolicyVersion,
        mode: createResponseCachePolicy().mode,
        semanticModelEnabled: false,
        semanticDecisionUsedAsFinalAuthority: false,
        allowIntentSoftHit: createResponseCachePolicy().allowIntentSoftHit,
        allowMultilingualIntentSoftHit: createResponseCachePolicy().allowMultilingualIntentSoftHit,
        summary: await readResponseCacheSummary(),
      },
    }, { startedAt }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/cache/health") {
    const policy = createResponseCachePolicy();
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
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
      defaultNvidiaChatLaneChanged: false,
    }, { startedAt }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/cache/lookup") {
    const body = await readCapabilityJson({ request, response, startedAt, code: "response_cache_lookup_invalid_json" });
    if (!body) return;

    try {
      const key = body.cacheKey ? { cacheKey: body.cacheKey } : createResponseCacheKey(body);
      const result = await lookupCache({ cacheKey: key.cacheKey });
      writeJson(response, 200, createOkEnvelope({
        mode: createResponseCachePolicy().mode,
        cacheKey: key.cacheKey,
        cacheDecision: result.cacheDecision,
        cacheHitType: result.cacheHitType,
        duplicateReason: result.duplicateReason,
        finalDecisionBy: result.finalDecisionBy,
        semanticDecisionUsedAsFinalAuthority: false,
        ...result,
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
      });
      writeJson(response, 200, createOkEnvelope({
        mode: createResponseCachePolicy().mode,
        ...result,
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
      ...(await readResponseCacheSummary()),
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
      events: await listResponseCacheAuditTrail({ limit }),
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
        const resp = await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
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
        const resp = await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
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
