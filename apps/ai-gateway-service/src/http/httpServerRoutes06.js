import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { resolveChatResultHttpStatus } from "./routes/chatRoutes.js";
import { applyIdempotencyResponseHeaders } from "./idempotencyCoordinator.ts";
import { getGuardrailsEngine } from "../guardrails/guardrailsEngine.ts";

export async function dispatchHttpRoutes06(context) {
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
    createRagMessages, createRagChatData, OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG, application,
    request, response, url, startedAt,
    approvalStore, fileContextStore, phase319LocalOperation, connectorFeishuDryRun,
    connectorWeComDryRun, capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService,
    enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService,
    modelImportService, modelLibraryStore, providerConfigRoutes, userExperienceService,
    workforceService, workflowService, wsServer,
    idempotencyCoordinator,
  } = context;

  if (request.method === "POST" && url.pathname === "/knowledge/retrieve") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      writeJson(
        response,
        400,
        createErrorEnvelope("knowledge_invalid_json", "Knowledge retrieve body must be valid JSON.", {
          startedAt,
          category: "validation",
        }),
      );
      return;
    }

    try {
      const result = await knowledgeService.retrieve(body, getRequestContext(request));
      writeServiceLog("knowledge_retrieve_completed", {
        method: request.method,
        path: url.pathname,
        chunkCount: result.chunks.length,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeServiceLog("knowledge_retrieve_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "knowledge_retrieve_failed", error instanceof Error ? error.message : "Knowledge retrieve failed.", {
          startedAt,
          category: error?.category ?? "knowledge",
          retryable: false,
          details: error?.details,
        }),
      );
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/chat/rag/stream") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      const parseError = new Error("RAG stream request body must be valid JSON.");
      parseError.code = "VALIDATION_ERROR";
      parseError.type = "validation";
      parseError.category = "validation";
      parseError.retryable = false;
      writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
      return;
    }

    try {
      const prompt = extractChatPrompt(body);
      if (!prompt) {
        const validationError = new Error("RAG stream request requires a prompt, query, or user message.");
        validationError.code = "VALIDATION_ERROR";
        validationError.category = "validation";
        validationError.retryable = false;
        throw validationError;
      }

      const retrieveRequest = createRagRetrieveRequest(body, prompt);
      const retrieveResult = await knowledgeService.retrieve(retrieveRequest, getRequestContext(request));
      const citations = createRagCitations(retrieveResult.chunks);
      const ragMessages = createRagMessages(prompt, citations);
      const chatInput = normalizeRagChatBody(
        {
          ...body,
          prompt,
          metadata: {
            ...(body.metadata ?? {}),
            phase: "phase-31a-rag-stream-chat",
            ragEnabled: true,
            ragMode: "service-side-stream",
            knowledgeInjected: citations.length > 0,
            knowledgeCitationCount: citations.length,
          },
        },
        application.config,
        { messages: ragMessages },
      );

      let clientClosed = false;
      response.on("close", () => {
        clientClosed = true;
      });
      writeSseHeaders(response);
      writeSseEvent(response, "knowledge", {
        type: "knowledge",
        prompt,
        query: retrieveRequest.query,
        citations,
        retrieved: citations.length > 0,
        chunkCount: retrieveResult.chunks?.length ?? 0,
      });

      let failed = false;
      for await (const event of gatewayService.executeStream(chatInput)) {
        if (clientClosed) break;
        if (event.type === "error") {
          failed = true;
          writeSseEvent(response, "error", event.envelope);
          break;
        }

        writeSseEvent(response, event.type, {
          ...event,
          rag: {
            enabled: true,
            mode: "service-side-stream",
            citationCount: citations.length,
          },
        });
      }

      writeServiceLog(failed ? "rag_stream_failed" : "rag_stream_completed", {
        method: request.method,
        path: url.pathname,
        citationCount: citations.length,
        durationMs: Date.now() - startedAt,
      });
      if (!clientClosed) response.end();
    } catch (error) {
      writeServiceLog("rag_stream_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "rag_stream_failed", error instanceof Error ? error.message : "RAG stream failed.", {
          startedAt,
          category: error?.category ?? "rag",
          retryable: error?.retryable ?? false,
          details: error?.details,
        }),
      );
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/chat/rag") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      const parseError = new Error("RAG chat request body must be valid JSON.");
      parseError.code = "VALIDATION_ERROR";
      parseError.type = "validation";
      parseError.category = "validation";
      parseError.retryable = false;
      writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
      return;
    }

    try {
      const prompt = extractChatPrompt(body);
      if (!prompt) {
        const validationError = new Error("RAG chat request requires a prompt, query, or user message.");
        validationError.code = "VALIDATION_ERROR";
        validationError.category = "validation";
        validationError.retryable = false;
        throw validationError;
      }

      const retrieveRequest = createRagRetrieveRequest(body, prompt);
      const retrieveResult = await knowledgeService.retrieve(retrieveRequest, getRequestContext(request));
      const citations = createRagCitations(retrieveResult.chunks);
      const ragMessages = createRagMessages(prompt, citations);
      const chatInput = normalizeRagChatBody(
        {
          ...body,
          prompt,
          metadata: {
            ...(body.metadata ?? {}),
            phase: "phase-29a-service-rag-chat",
            ragEnabled: true,
            ragMode: "service-side",
            knowledgeInjected: citations.length > 0,
            knowledgeCitationCount: citations.length,
          },
        },
        application.config,
        { messages: ragMessages },
      );
      const chatResult = await gatewayService.execute(chatInput);
      const ragData = createRagChatData({
        prompt,
        retrieveRequest,
        retrieveResult,
        citations,
        chatResult,
      });

      writeServiceLog(chatResult.success ? "rag_chat_completed" : "rag_chat_failed", {
        method: request.method,
        path: url.pathname,
        code: chatResult.code,
        requestId: chatResult.meta?.requestId,
        provider: chatResult.data?.selectedProvider ?? chatResult.error?.provider,
        citationCount: citations.length,
        durationMs: Date.now() - startedAt,
      });

      if (!chatResult.success) {
        writeJson(response, 400, {
          ...chatResult,
          data: {
            ...(chatResult.data ?? {}),
            rag: ragData.rag,
            knowledge: ragData.knowledge,
          },
        });
        return;
      }

      writeJson(response, 200, createOkEnvelope(ragData, { startedAt, traceId: body?.context?.traceId }));
    } catch (error) {
      writeServiceLog("rag_chat_failed", {
        method: request.method,
        path: url.pathname,
        code: error?.code,
        durationMs: Date.now() - startedAt,
      });
      writeJson(
        response,
        error?.category === "validation" ? 400 : 422,
        createErrorEnvelope(error?.code ?? "rag_chat_failed", error instanceof Error ? error.message : "RAG chat failed.", {
          startedAt,
          category: error?.category ?? "rag",
          retryable: error?.retryable ?? false,
          details: error?.details,
        }),
      );
    }
    return;
  }

  if (
    request.method === "POST" &&
    (url.pathname === "/chat/stream" ||
      url.pathname === "/chat" ||
      url.pathname === "/gateway/route" ||
      url.pathname === "/gateway/mock" ||
      url.pathname === "/route")
  ) {
    let body;
    try {
      body = await readJson(request);
    } catch {
      const parseError = new Error("Route request body must be valid JSON.");
      parseError.code = "VALIDATION_ERROR";
      parseError.type = "validation";
      parseError.category = "validation";
      parseError.retryable = false;
      writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
      return;
    }

    if (url.pathname === "/chat") {
      const taijiBeidouChatHook = evaluateTaijiBeidouChatPreviewHook({ body, route: url.pathname });
      if (taijiBeidouChatHook.action === "respond") {
        writeJson(response, taijiBeidouChatHook.responseStatus ?? 200, createOkEnvelope(taijiBeidouChatHook.result, { startedAt }));
        return;
      }

      const prompt = extractChatPrompt(body);
      const localActionProposal = routeChatActionProposal({ prompt, env: application.runtimeEnv ?? process.env });
      if (localActionProposal.action === "respond") {
        const localActionResult = await handleChatLocalActionRoute({
          prompt,
          env: application.runtimeEnv ?? process.env,
          approval: body?.ownerAutomationApproval ?? null,
          evidencePhase: "phase1911a",
        });
        writeJson(response, 200, createOkEnvelope({
          route: "/chat",
          actionType: "local_action_preview",
          approvalRequired: true,
          handoffActionId: localActionResult.localActionProposal?.actionId ?? null,
          localActionExecuted: localActionResult.chatTriggeredLocalAction === true,
          completionVerified: false,
          verificationReason: "本地桌面动作请求需要通过 action preview 链路处理，不能由普通聊天直接标记完成。",
          providerCalled: false,
          providerCallsMade: false,
          currentPageModelSelectionWarning: null,
          localActionProposal: localActionResult.localActionProposal,
          approvalGate: localActionResult.approvalGate ?? null,
          chatTriggeredLocalAction: localActionResult.chatTriggeredLocalAction === true,
          desktopFileCreated: localActionResult.desktopFileCreated === true,
          desktopFileCreatedCount: localActionResult.desktopFileCreatedCount ?? 0,
          chatGatewayExecuteProviderChainCalled: false,
          ownerAutomationChatProposalFlag: OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG,
          chatDefaultBehaviorPreserved: true,
          chatGatewayExecuteDefaultBehaviorPreserved: true,
          userVisibleSummary: localActionResult.localActionProposal?.userVisibleSummary ?? "已识别本地桌面动作；默认只生成 action proposal，不执行真实桌面动作。",
          statusLabel: "preview",
          statusDescription: "此请求已识别为本地桌面动作预览，需要审批后才能真实执行。仅生成说明文本不等于真实完成。",
          safety: {
            overwriteDetected: false,
            desktopScanPerformed: false,
            desktopOtherFilesRead: false,
            secretValueExposed: false,
          },
        }, { startedAt }));
        return;
      }
    }

    const isChatStreamRoute = url.pathname === "/chat/stream";
    const promptEnhancementRequested = body?.promptEnhancement?.enabled === true;
    let gatewayInput = body;
    if (url.pathname === "/chat" || isChatStreamRoute) {
      try {
        gatewayInput = normalizeChatBody(body, application.config);
      } catch (error) {
        if (!promptEnhancementRequested) throw error;
        writeServiceLog("prompt_enhancement_failed", {
          method: request.method,
          path: url.pathname,
          code: error?.code,
          durationMs: Date.now() - startedAt,
        });
        if (isChatStreamRoute) {
          writeSseHeaders(response);
          writeSseEvent(response, "error", {
            code: error?.code ?? "PROMPT_ENHANCEMENT_FAILED",
            message: error instanceof Error ? error.message : "Prompt enhancement failed.",
          });
          if (!response.writableEnded && !response.destroyed) response.end();
        } else {
          writeJson(response, 400, createRouteFailureEnvelope(error, { startedAt }));
        }
        return;
      }
    }

    const promptEnhancement = gatewayInput?.metadata?.promptEnhancement ?? null;

    // Guardrails(确定性本地扫描):原生 /chat 与 /chat/stream 必须与 /v1/* 协议
    // lane 执行同一套租户隔离的输入策略——拦截秘密注入,脱敏 PII 后再进网关。
    const guardrailsEngine = getGuardrailsEngine(request.enterpriseIdentity?.tenantId);
    const guardrailInputVerdict = guardrailsEngine.inspectInput({ messages: gatewayInput?.messages });
    if (guardrailInputVerdict.decision === "block") {
      writeServiceLog("chat_guardrail_blocked", {
        method: request.method,
        path: url.pathname,
        findings: guardrailInputVerdict.findings,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 400, createErrorEnvelope("guardrail_blocked", "Request blocked by chat guardrails.", {
        startedAt,
        category: "governance",
      }));
      return;
    }
    for (const replacement of guardrailInputVerdict.replacements) {
      if (typeof gatewayInput?.messages?.[replacement.index]?.content === "string") {
        gatewayInput.messages[replacement.index].content = replacement.content;
      }
    }

    if (url.pathname === "/chat/stream") {
      let clientClosed = false;
      response.on("close", () => {
        clientClosed = true;
      });
      writeSseHeaders(response);

      let failed = false;
      for await (const event of gatewayService.executeStream(gatewayInput)) {
        if (clientClosed) break;
        if (event.type === "error") {
          failed = true;
          writeSseEvent(response, "error", event.envelope);
          break;
        }

        writeSseEvent(response, event.type, decorateStreamEvent(event, promptEnhancement));
      }

      writeServiceLog(failed ? "request_stream_failed" : "request_stream_completed", {
        method: request.method,
        path: url.pathname,
        durationMs: Date.now() - startedAt,
      });
      if (!clientClosed) response.end();
      return;
    }

    let result;
    let responseStatus;
    let idempotencyStatus = "bypassed";
    let idempotencyReplayed = false;
    if (url.pathname === "/chat") {
      const idempotencyOutcome = await idempotencyCoordinator.execute({
        request,
        route: url.pathname,
        payload: body,
        operation: async () => {
          let executionResult = await gatewayService.execute(gatewayInput);
          if (promptEnhancement) {
            executionResult = {
              ...executionResult,
              data: {
                ...(executionResult.data ?? {}),
                promptEnhancement,
              },
            };
          }
          return {
            statusCode: resolveChatResultHttpStatus(executionResult),
            payload: executionResult,
          };
        },
      });
      applyIdempotencyResponseHeaders(response, idempotencyOutcome);
      if (!idempotencyOutcome.accepted) {
        if (idempotencyOutcome.retryAfterSeconds) {
          response.setHeader("Retry-After", String(idempotencyOutcome.retryAfterSeconds));
        }
        writeJson(response, idempotencyOutcome.statusCode, createErrorEnvelope(
          idempotencyOutcome.code,
          idempotencyOutcome.message,
          {
            startedAt,
            category: idempotencyOutcome.statusCode === 503 ? "internal" : "validation",
            retryable: idempotencyOutcome.retryable,
          },
        ));
        return;
      }
      result = idempotencyOutcome.value.payload;
      responseStatus = idempotencyOutcome.value.statusCode;
      idempotencyStatus = idempotencyOutcome.status;
      idempotencyReplayed = idempotencyOutcome.replayed;
    } else {
      result = await gatewayService.execute(body);
      responseStatus = resolveChatResultHttpStatus(result);
    }
    writeServiceLog(idempotencyReplayed ? "request_idempotency_replayed" : result.success ? "request_completed" : "request_failed", {
      method: request.method,
      path: url.pathname,
      code: result.code,
      requestId: result.meta?.requestId,
      provider: result.data?.selectedProvider ?? result.error?.provider,
      idempotencyStatus,
      durationMs: Date.now() - startedAt,
    });
    // Guardrails 输出侧:与 /v1/* lane 相同的最终文本脱敏/拦截;fail-open。
    const guardrailOutputText = result?.data?.outputText;
    if (typeof guardrailOutputText === "string" && guardrailOutputText) {
      const outputVerdict = guardrailsEngine.inspectOutputText(guardrailOutputText);
      if (outputVerdict.decision === "block") {
        writeServiceLog("chat_guardrail_output_blocked", {
          method: request.method,
          path: url.pathname,
          findings: outputVerdict.findings,
          durationMs: Date.now() - startedAt,
        });
        writeJson(response, 400, createErrorEnvelope("guardrail_blocked", "Response blocked by chat guardrails.", {
          startedAt,
          category: "governance",
        }));
        return;
      }
      if (outputVerdict.text !== guardrailOutputText) {
        result = {
          ...result,
          data: {
            ...(result.data ?? {}),
            text: outputVerdict.text,
            outputText: outputVerdict.text,
            message: {
              ...(result.data?.message ?? { role: "assistant", content: "" }),
              content: outputVerdict.text,
            },
          },
        };
      }
    }
    writeJson(response, responseStatus, result);
    return;
  }

  if (request.method === "GET" && url.pathname === "/ws/info") {
    writeJson(response, 200, createOkEnvelope({
      route: "/ws/info",
      websocket: true,
      endpoint: "/ws",
      connectionCount: wsServer.getConnectionCount(),
      protocols: ["json"],
      description: "Real-time bidirectional chat via WebSocket",
    }, { startedAt }));
    return;
  }


  return ROUTE_NOT_HANDLED;
}

function decorateStreamEvent(event, promptEnhancement) {
  if (!promptEnhancement) return event;
  return {
    ...event,
    meta: {
      ...(event.meta ?? {}),
      promptEnhancement,
    },
  };
}
