import { createOkEnvelope, createErrorEnvelope } from "@unified-ai-system/shared-utils";
import { createRouteFailureEnvelope } from "../core/gatewayService.js";
import { writeJson, writeSseHeaders, writeSseEvent, writeServiceLog } from "./utils/responseUtils.js";
import { normalizeChatBody, extractChatPrompt } from "./utils/chatUtils.js";
import { evaluateTaijiBeidouChatPreviewHook } from "../gateway/taijiBeidouChatPreviewHook.js";
import { handleChatLocalActionRoute, routeChatActionProposal } from "../owner-automation/chatActionProposalRouter.js";
import { TASK_TO_INTENT_MAP } from "../chat-gateway/chatGatewayTaskMatrix.js";

const OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG = "OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED";

export function createChatRoutes(ctx) {
  const { application, gatewayService, circuitBreakerRegistry, metricsCollector, wsServer } = ctx;
  const handlers = new Map();

  // POST /chat/stream
  handlers.set("POST /chat/stream", async (request, response, { startedAt, body }) => {
    const streamInput = normalizeChatBody(body, application.config);
    const providerKey = streamInput?.providerId ?? streamInput?.provider ?? "gateway";
    const breaker = circuitBreakerRegistry ? circuitBreakerRegistry.getOrCreate(providerKey) : null;

    if (breaker && breaker.getState() === "open") {
      writeSseHeaders(response);
      writeSseEvent(response, "error", { code: "CIRCUIT_OPEN", message: "Provider circuit breaker is open, try again later." });
      writeServiceLog("request_stream_failed", { method: request.method, path: "/chat/stream", reason: "circuit_open", durationMs: Date.now() - startedAt });
      response.end();
      return;
    }

    writeSseHeaders(response);

    let failed = false;
    let clientClosed = false;
    response.on("close", () => { clientClosed = true; });

    try {
      const streamFn = async () => {
        for await (const event of gatewayService.executeStream(streamInput)) {
          if (clientClosed) break;
          if (event.type === "error") {
            failed = true;
            writeSseEvent(response, "error", event.envelope);
            throw new Error(event.envelope?.code || "stream_error");
          }
          writeSseEvent(response, event.type, event);
        }
        if (failed) throw new Error("stream_provider_error");
      };
      if (breaker) {
        await breaker.execute(streamFn);
      } else {
        await streamFn();
      }
    } catch (error) {
      failed = true;
      if (!clientClosed) writeSseEvent(response, "error", { code: error?.code || "STREAM_FAILED", message: error?.message || "Stream failed." });
    }

    writeServiceLog(failed ? "request_stream_failed" : "request_stream_completed", {
      method: request.method,
      path: "/chat/stream",
      durationMs: Date.now() - startedAt,
    });
    if (!clientClosed) response.end();
  });

  // POST /chat
  handlers.set("POST /chat", async (request, response, { startedAt, body }) => {
    const taijiBeidouChatHook = evaluateTaijiBeidouChatPreviewHook({ body, route: "/chat" });
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

    // Fall through to gateway execution
    const chatInput = normalizeChatBody(body, application.config);
    const providerKey = chatInput?.providerId ?? chatInput?.provider ?? "gateway";
    const breaker = circuitBreakerRegistry ? circuitBreakerRegistry.getOrCreate(providerKey) : null;
    const result = breaker
      ? await breaker.execute(() => gatewayService.execute(chatInput))
      : await gatewayService.execute(chatInput);
    writeServiceLog(result.success ? "request_completed" : "request_failed", {
      method: request.method,
      path: "/chat",
      code: result.code,
      requestId: result.meta?.requestId,
      provider: result.data?.selectedProvider ?? result.error?.provider,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, result.success ? 200 : 400, result);
  });

  // POST /gateway/route
  handlers.set("POST /gateway/route", async (request, response, { startedAt, body }) => {
    const chatInput = body;
    const providerKey = chatInput?.providerId ?? chatInput?.provider ?? "gateway";
    const breaker = circuitBreakerRegistry ? circuitBreakerRegistry.getOrCreate(providerKey) : null;
    const result = breaker
      ? await breaker.execute(() => gatewayService.execute(chatInput))
      : await gatewayService.execute(chatInput);
    writeServiceLog(result.success ? "request_completed" : "request_failed", {
      method: request.method,
      path: "/gateway/route",
      code: result.code,
      requestId: result.meta?.requestId,
      provider: result.data?.selectedProvider ?? result.error?.provider,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, result.success ? 200 : 400, result);
  });

  // POST /gateway/mock
  handlers.set("POST /gateway/mock", async (request, response, { startedAt, body }) => {
    const result = await gatewayService.execute(body);
    writeServiceLog(result.success ? "request_completed" : "request_failed", {
      method: request.method,
      path: "/gateway/mock",
      code: result.code,
      requestId: result.meta?.requestId,
      provider: result.data?.selectedProvider ?? result.error?.provider,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, result.success ? 200 : 400, result);
  });

  // POST /route
  handlers.set("POST /route", async (request, response, { startedAt, body }) => {
    const result = await gatewayService.execute(body);
    writeServiceLog(result.success ? "request_completed" : "request_failed", {
      method: request.method,
      path: "/route",
      code: result.code,
      requestId: result.meta?.requestId,
      provider: result.data?.selectedProvider ?? result.error?.provider,
      durationMs: Date.now() - startedAt,
    });
    writeJson(response, result.success ? 200 : 400, result);
  });

  // GET /ws/info
  handlers.set("GET /ws/info", async (_request, response, { startedAt }) => {
    writeJson(response, 200, createOkEnvelope({
      route: "/ws/info",
      websocket: true,
      endpoint: "/ws",
      connectionCount: wsServer.getConnectionCount(),
      protocols: ["json"],
      description: "Real-time bidirectional chat via WebSocket",
    }, { startedAt }));
  });

  return { handlers };
}
