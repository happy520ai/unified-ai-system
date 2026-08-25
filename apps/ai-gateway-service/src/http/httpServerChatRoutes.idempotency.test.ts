import { describe, expect, it, vi } from "vitest";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { createRouteFailureEnvelope } from "../core/gatewayService.js";
import { dispatchHttpRoutes06 } from "./httpServerRoutes06.js";
import { createIdempotencyCoordinator } from "./idempotencyCoordinator.ts";
import { readJson, writeJson } from "./utils/responseUtils.js";

function createResponse() {
  const headers = new Map<string, string>();
  return {
    headers,
    statusCode: 0,
    payload: undefined as unknown,
    writableEnded: false,
    destroyed: false,
    headersSent: false,
    setHeader(name: string, value: unknown) {
      headers.set(name.toLowerCase(), String(value));
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    writeHead(statusCode: number, values: Record<string, unknown>) {
      this.statusCode = statusCode;
      this.headersSent = true;
      for (const [name, value] of Object.entries(values)) this.setHeader(name, value);
    },
    end(body: string) {
      this.writableEnded = true;
      this.payload = JSON.parse(body);
    },
  };
}

function createRequest(key: string, body: unknown) {
  return {
    method: "POST",
    body,
    headers: { "idempotency-key": key, authorization: "Bearer test-tenant" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function createContext(execute: ReturnType<typeof vi.fn>, key: string, body: unknown) {
  const response = createResponse();
  return {
    createErrorEnvelope,
    createOkEnvelope,
    createRouteFailureEnvelope,
    readJson,
    writeJson,
    writeServiceLog: vi.fn(),
    normalizeChatBody: (value: unknown) => value,
    evaluateTaijiBeidouChatPreviewHook: () => ({ action: "continue" }),
    extractChatPrompt: () => "hello",
    routeChatActionProposal: () => ({ action: "continue" }),
    application: { config: {}, runtimeEnv: {} },
    gatewayService: { execute },
    idempotencyCoordinator: createIdempotencyCoordinator({ secret: "production-route-test" }),
    request: createRequest(key, body),
    response,
    url: new URL("http://127.0.0.1/chat"),
    startedAt: Date.now(),
  };
}

describe("production POST /chat idempotency contract", () => {
  it("replays through dispatchHttpRoutes06 without a second provider execution", async () => {
    const execute = vi.fn(async () => ({
      success: true,
      code: "OK",
      data: { text: "hello", selectedProvider: "fake" },
      meta: { requestId: "provider-request-1" },
    }));
    const body = { messages: [{ role: "user", content: "hello" }] };
    const first = createContext(execute, "idem-chat-1", body);
    const second = { ...createContext(execute, "idem-chat-1", body), idempotencyCoordinator: first.idempotencyCoordinator };

    await dispatchHttpRoutes06(first);
    await dispatchHttpRoutes06(second);
    first.idempotencyCoordinator.close();

    expect(first.response.statusCode).toBe(200);
    expect(second.response.statusCode).toBe(200);
    expect(first.response.headers.get("idempotency-status")).toBe("created");
    expect(second.response.headers.get("idempotency-status")).toBe("replayed");
    expect(second.response.headers.get("idempotency-replayed")).toBe("true");
    expect(second.response.headers.get("idempotency-replayable")).toBe("true");
    expect(second.response.payload).toEqual(first.response.payload);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rejects different payload reuse before the production provider call", async () => {
    const execute = vi.fn(async () => ({ success: true, code: "OK", data: {}, meta: { requestId: "request-1" } }));
    const firstBody = { messages: [{ role: "user", content: "first" }] };
    const first = createContext(execute, "idem-chat-2", firstBody);
    const conflict = {
      ...createContext(execute, "idem-chat-2", { messages: [{ role: "user", content: "different" }] }),
      idempotencyCoordinator: first.idempotencyCoordinator,
    };

    await dispatchHttpRoutes06(first);
    await dispatchHttpRoutes06(conflict);
    first.idempotencyCoordinator.close();

    expect(conflict.response.statusCode).toBe(409);
    expect((conflict.response.payload as { error: { code: string } }).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(conflict.response.headers.get("idempotency-status")).toBe("rejected");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
