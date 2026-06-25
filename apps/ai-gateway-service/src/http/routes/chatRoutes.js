// =============================================================================
// chatRoutes.js — 聊天路由模块
// 从 httpServer.js 抽取的 /chat 和 /chat/stream 路由
//
// 类型合约: @unified-ai-system/shared-contracts
// - GatewayRequest, GatewayChatRequest, GatewayResponse
// - MessageDto, AiTaskType, GatewayFinishReason
// =============================================================================

import { validators } from "../../validation/httpSchemas.js";

/**
 * @typedef {import("../../../../../../packages/shared-contracts/src/contracts/gateway.js").GatewayRequest} GatewayRequest
 * @typedef {import("../../../../../../packages/shared-contracts/src/contracts/gateway.js").GatewayResponse} GatewayResponse
 * @typedef {import("../../../../../../packages/shared-contracts/src/contracts/common.js").MessageDto} MessageDto
 */

/**
 * 创建聊天路由 handler 集合
 * @param {Object} application - Gateway application context
 * @param {Object} helpers — { readJson, writeJson, writeServiceLog, createOkEnvelope, createErrorEnvelope }
 * @returns {Object} { handlers: Map<string, Function> }
 */
export function createChatRoutes(application, helpers) {
  const { gatewayService, circuitBreakerRegistry, config } = application;
  const {
    readJson,
    writeJson,
    writeServiceLog,
    createOkEnvelope,
    createErrorEnvelope,
  } = helpers;

  // ── POST /chat — 非流式聊天补全 ──

  async function handleChat(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope(
        "chat_invalid_json",
        "Chat request body must be valid JSON.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    // zod 校验
    const validation = validators.chat(body);
    if (!validation.valid) {
      writeJson(res, 400, createErrorEnvelope(
        "chat_validation_error",
        "Request validation failed",
        { startedAt, category: "validation", details: validation.errors },
      ));
      return;
    }

    const chatInput = normalizeChatBody(body, config);
    const providerKey = chatInput?.providerId ?? chatInput?.provider ?? "gateway";
    const breaker = circuitBreakerRegistry ? circuitBreakerRegistry.getOrCreate(providerKey) : null;

    try {
      const result = breaker
        ? await breaker.execute(() => gatewayService.execute(chatInput))
        : await gatewayService.execute(chatInput);

      if (writeServiceLog) {
        writeServiceLog(result.success ? "chat_completed" : "chat_failed", {
          method: "POST",
          path: "/chat",
          code: result.code,
          requestId: result.meta?.requestId,
          provider: result.data?.selectedProvider ?? result.error?.provider,
          durationMs: Date.now() - startedAt,
        });
      }
      writeJson(res, result.success ? 200 : 400, result);
    } catch (error) {
      if (writeServiceLog) {
        writeServiceLog("chat_failed", {
          method: "POST",
          path: "/chat",
          code: error?.code,
          durationMs: Date.now() - startedAt,
        });
      }
      writeJson(res, 500, createErrorEnvelope(
        error?.code ?? "chat_execution_failed",
        error instanceof Error ? error.message : "Chat execution failed.",
        { startedAt, category: "internal" },
      ));
    }
  }

  // ── POST /chat/stream — SSE 流式聊天 ──

  async function handleChatStream(req, res, { startedAt, body }) {
    if (!body) {
      writeSseHeaders(res);
      writeSseEvent(res, "error", {
        code: "CHAT_INVALID_JSON",
        message: "Stream request body must be valid JSON.",
      });
      if (!res.writableEnded) res.end();
      return;
    }

    const streamInput = normalizeChatBody(body, config);
    const providerKey = streamInput?.providerId ?? streamInput?.provider ?? "gateway";
    const breaker = circuitBreakerRegistry ? circuitBreakerRegistry.getOrCreate(providerKey) : null;

    if (breaker && breaker.getState() === "open") {
      writeSseHeaders(res);
      writeSseEvent(res, "error", {
        code: "CIRCUIT_OPEN",
        message: "Provider circuit breaker is open, try again later.",
      });
      if (writeServiceLog) {
        writeServiceLog("chat_stream_failed", {
          method: "POST",
          path: "/chat/stream",
          reason: "circuit_open",
          durationMs: Date.now() - startedAt,
        });
      }
      if (!res.writableEnded) res.end();
      return;
    }

    writeSseHeaders(res);

    let failed = false;
    let clientClosed = false;
    res.on("close", () => { clientClosed = true; });

    try {
      const streamFn = async () => {
        for await (const event of gatewayService.executeStream(streamInput)) {
          if (clientClosed) break;
          if (event.type === "error") {
            failed = true;
            writeSseEvent(res, "error", event.envelope);
            throw new Error(event.envelope?.code || "stream_error");
          }
          writeSseEvent(res, event.type, event);
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
      if (!clientClosed) {
        writeSseEvent(res, "error", {
          code: error?.code || "STREAM_FAILED",
          message: error?.message || "Stream failed.",
        });
      }
    }

    if (writeServiceLog) {
      writeServiceLog(failed ? "chat_stream_failed" : "chat_stream_completed", {
        method: "POST",
        path: "/chat/stream",
        durationMs: Date.now() - startedAt,
      });
    }
    if (!clientClosed) res.end();
  }

  // ── 内部辅助函数 ──

  function normalizeChatBody(body, cfg) {
    const defaultTarget = resolveDefaultChatTarget(cfg);
    const currentPageSelection = normalizeCurrentPageModelSelection(body?.currentPageModelSelection);
    const fallbackTarget = defaultTarget.providerId
      ? defaultTarget
      : { providerId: "nvidia", modelId: resolveNvidiaModel(cfg) };
    const providerId = currentPageSelection?.warning
      ? fallbackTarget.providerId
      : currentPageSelection?.providerId ?? body?.providerId ?? defaultTarget.providerId;
    const modelId = currentPageSelection?.warning
      ? fallbackTarget.modelId
      : currentPageSelection?.modelId ?? body?.model ?? defaultTarget.modelId;
    const metadata = { ...(body?.metadata ?? {}) };

    if (currentPageSelection?.warning) {
      metadata.currentPageModelSelectionWarning = currentPageSelection.warning;
    }

    if (currentPageSelection?.providerId && currentPageSelection?.modelId) {
      metadata.currentPageModelSelectionApplied = {
        providerId: currentPageSelection.providerId,
        modelId: currentPageSelection.modelId,
        baseUrl: currentPageSelection.baseUrl ?? "",
        scope: "per-request",
      };
    }

    if (Array.isArray(body?.messages)) {
      return { ...body, taskType: "chat", providerId, model: modelId, metadata };
    }

    const prompt = body?.prompt ?? body?.query;
    if (typeof prompt !== "string" || prompt.length === 0) {
      return body;
    }

    return {
      context: body.context,
      taskType: "chat",
      providerId,
      model: modelId,
      messages: [{ role: "user", content: prompt }],
      options: body.options,
      metadata,
    };
  }

  function normalizeCurrentPageModelSelection(selection) {
    if (!selection || typeof selection !== "object") return null;

    const providerId = typeof selection.providerId === "string" ? selection.providerId.trim() : "";
    const modelId = typeof selection.modelId === "string" ? selection.modelId.trim() : "";
    const baseUrl = typeof selection.baseUrl === "string" ? selection.baseUrl.trim() : "";

    if (!providerId || !modelId) {
      return {
        warning: {
          code: "current_page_model_selection_ignored",
          message: "Ignored invalid currentPageModelSelection and used the default /chat route.",
        },
      };
    }

    return { providerId, modelId, baseUrl };
  }

  function resolveDefaultChatTarget(cfg) {
    const providerSelection = cfg.aiGatewayService.providerSelection;
    if (providerSelection.mode !== "fixed") return {};

    const configuredProviderId = providerSelection.defaultProviderId;
    const configuredModelId = providerSelection.defaultModelId;
    const nvidiaModel = resolveNvidiaModel(cfg);

    return {
      providerId: configuredProviderId ?? "nvidia",
      modelId: configuredModelId ?? nvidiaModel,
    };
  }

  function resolveNvidiaModel(cfg) {
    return (
      cfg.aiGatewayService.providerModels.find((p) => p.providerId === "nvidia")?.modelId ??
      cfg.aiGatewayService.providerSelection.defaultModelId
    );
  }

  function writeSseHeaders(response) {
    if (response.writableEnded || response.headersSent) return;
    response.writeHead(200, {
      "cache-control": "no-cache",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    });
    if (typeof response.flushHeaders === "function") {
      response.flushHeaders();
    }
  }

  function writeSseEvent(response, event, data) {
    if (response.writableEnded || response.destroyed) return;
    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // ── POST /chat/auto — 流式聚合为 JSON ──
  // 内部消费者（太极北斗引擎、神经发生编译器等）通过此端点
  // 调用 AI 模型，自动收集所有流式 chunk 并以 JSON 返回。
  // 兼容调用方期望的响应格式：{ success, content, text, choices }

  async function handleChatAuto(req, res, { startedAt, body }) {
    if (!body) {
      writeJson(res, 400, createErrorEnvelope(
        "chat_auto_invalid_json",
        "Chat auto request body must be valid JSON.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    // 兼容多种输入字段：message / prompt / query / text
    const prompt = body.message ?? body.prompt ?? body.query ?? body.text;
    if (typeof prompt !== "string" || prompt.length === 0) {
      writeJson(res, 400, createErrorEnvelope(
        "chat_auto_missing_prompt",
        "Chat auto request requires a message, prompt, query, or text field.",
        { startedAt, category: "validation" },
      ));
      return;
    }

    // 将简短输入转换为标准 chat 输入格式
    const chatBody = {
      ...body,
      prompt,
      // 保留调用方传入的 mode 等元数据
      metadata: {
        ...(body.metadata ?? {}),
        source: body.mode ?? "chat-auto",
        route: "/chat/auto",
      },
    };

    const streamInput = normalizeChatBody(chatBody, config);
    const providerKey = streamInput?.providerId ?? streamInput?.provider ?? "gateway";
    const breaker = circuitBreakerRegistry ? circuitBreakerRegistry.getOrCreate(providerKey) : null;

    if (breaker && breaker.getState() === "open") {
      writeJson(res, 503, createErrorEnvelope(
        "CIRCUIT_OPEN",
        "Provider circuit breaker is open, try again later.",
        { startedAt, category: "provider", retryable: true },
      ));
      return;
    }

    let outputText = "";
    let selectedProvider = "";
    let selectedModel = "";
    let failed = false;
    let errorDetail = null;

    try {
      const streamFn = async () => {
        for await (const event of gatewayService.executeStream(streamInput)) {
          if (event.type === "error") {
            failed = true;
            errorDetail = event.envelope;
            throw new Error(event.envelope?.code || "chat_auto_stream_error");
          }
          if (event.type === "chunk" && event.textDelta) {
            outputText += event.textDelta;
          }
          if (event.type === "done") {
            // done 事件包含最终聚合文本
            outputText = event.outputText || outputText;
            selectedProvider = event.selectedProvider || selectedProvider;
            selectedModel = event.selectedModel || selectedModel;
          }
          if (event.type === "start") {
            selectedProvider = event.selectedProvider || selectedProvider;
            selectedModel = event.selectedModel || selectedModel;
          }
        }
        if (failed) throw new Error("chat_auto_provider_error");
      };

      if (breaker) {
        await breaker.execute(streamFn);
      } else {
        await streamFn();
      }
    } catch (error) {
      failed = true;
      if (!errorDetail) {
        errorDetail = {
          code: error?.code || "CHAT_AUTO_FAILED",
          message: error instanceof Error ? error.message : "Chat auto execution failed.",
        };
      }
    }

    if (writeServiceLog) {
      writeServiceLog(failed ? "chat_auto_failed" : "chat_auto_completed", {
        method: "POST",
        path: "/chat/auto",
        provider: selectedProvider,
        model: selectedModel,
        outputLength: outputText.length,
        durationMs: Date.now() - startedAt,
      });
    }

    if (failed) {
      writeJson(res, 422, {
        status: "error",
        error: errorDetail?.code || "chat_auto_failed",
        message: errorDetail?.message || "Chat auto execution failed.",
        content: "",
        text: "",
        choices: [],
      });
      return;
    }

    // 返回兼容调用方期望的格式：
    // callGatewayAI 解析: parsed.content || parsed.text || parsed.choices
    writeJson(res, 200, {
      success: true,
      content: outputText,
      text: outputText,
      choices: [
        {
          message: { role: "assistant", content: outputText },
          text: outputText,
          finish_reason: "stop",
        },
      ],
      selectedProvider,
      selectedModel,
      meta: {
        route: "/chat/auto",
        durationMs: Date.now() - startedAt,
      },
    });
  }

  // ── 导出 ──

  const handlers = new Map([
    ["POST /chat", { handler: handleChat, public: true, description: "非流式聊天补全" }],
    ["POST /chat/stream", { handler: handleChatStream, public: true, description: "SSE 流式聊天" }],
    ["POST /chat/auto", { handler: handleChatAuto, public: true, description: "流式聚合 JSON — 内部 AI 调用端点" }],
  ]);

  return { handlers };
}
