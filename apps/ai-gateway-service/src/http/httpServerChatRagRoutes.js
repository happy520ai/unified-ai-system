import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { createRouteFailureEnvelope } from "../core/gatewayService.js";
import {
  writeJson,
  writeSseHeaders,
  writeSseEvent,
  readJson,
  writeServiceLog,
} from "./utils/responseUtils.js";
import {
  extractChatPrompt,
  createRagRetrieveRequest,
  createRagCitations,
  createRagPrompt,
  normalizeRagChatBody,
  createRagChatData,
} from "./utils/chatUtils.js";

export function createChatRagRoutes(ctx) {
  const { application, gatewayService, knowledgeService, circuitBreakerRegistry } = ctx;
  const handlers = new Map();

  // ── POST /chat/rag/stream ──
  handlers.set("POST /chat/rag/stream", async (request, response, { startedAt }) => {
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
      const retrieveResult = knowledgeService.retrieve(retrieveRequest);
      const citations = createRagCitations(retrieveResult.chunks);
      const augmentedPrompt = createRagPrompt(prompt, citations);
      const chatInput = normalizeRagChatBody(
        {
          ...body,
          prompt: augmentedPrompt,
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
      );

      const providerKey = chatInput?.providerId ?? chatInput?.provider ?? "gateway";
      const ragBreaker = circuitBreakerRegistry ? circuitBreakerRegistry.getOrCreate(providerKey) : null;

      if (ragBreaker && ragBreaker.getState() === "open") {
        writeSseHeaders(response);
        writeSseEvent(response, "knowledge", { type: "knowledge", prompt, query: retrieveRequest.query, citations, retrieved: citations.length > 0, chunkCount: retrieveResult.chunks?.length ?? 0 });
        writeSseEvent(response, "error", { code: "CIRCUIT_OPEN", message: "Provider circuit breaker is open, try again later." });
        writeServiceLog("rag_stream_failed", { method: request.method, path: "/chat/rag/stream", reason: "circuit_open", durationMs: Date.now() - startedAt });
        response.end();
        return;
      }

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
      let clientClosed = false;
      response.on("close", () => { clientClosed = true; });

      try {
        const ragStreamFn = async () => {
          for await (const event of gatewayService.executeStream(chatInput)) {
            if (clientClosed) break;
            if (event.type === "error") {
              failed = true;
              writeSseEvent(response, "error", event.envelope);
              throw new Error(event.envelope?.code || "rag_stream_error");
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
          if (failed) throw new Error("rag_stream_provider_error");
        };
        if (ragBreaker) {
          await ragBreaker.execute(ragStreamFn);
        } else {
          await ragStreamFn();
        }
      } catch (error) {
        failed = true;
        if (!clientClosed) writeSseEvent(response, "error", { code: error?.code || "RAG_STREAM_FAILED", message: error?.message || "RAG stream failed." });
      }

      writeServiceLog(failed ? "rag_stream_failed" : "rag_stream_completed", {
        method: request.method,
        path: "/chat/rag/stream",
        citationCount: citations.length,
        durationMs: Date.now() - startedAt,
      });
      if (!clientClosed) response.end();
    } catch (error) {
      writeServiceLog("rag_stream_failed", {
        method: request.method,
        path: "/chat/rag/stream",
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
  });

  // ── POST /chat/rag ──
  handlers.set("POST /chat/rag", async (request, response, { startedAt }) => {
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
      const retrieveResult = knowledgeService.retrieve(retrieveRequest);
      const citations = createRagCitations(retrieveResult.chunks);
      const augmentedPrompt = createRagPrompt(prompt, citations);
      const chatInput = normalizeRagChatBody(
        {
          ...body,
          prompt: augmentedPrompt,
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
        path: "/chat/rag",
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
        path: "/chat/rag",
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
  });

  return { handlers };
}
