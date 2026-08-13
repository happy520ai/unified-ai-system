import { describe, expect, it, vi } from "vitest";
import { createChatRoutes } from "./httpServerChatRoutes.js";

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

function createRequest(key: string) {
  return {
    method: "POST",
    headers: { "idempotency-key": key, authorization: "Bearer test-tenant" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function createContext(execute: ReturnType<typeof vi.fn>) {
  return {
    application: {
      config: {
        aiGatewayService: {
          providerSelection: { mode: "fixed", defaultProviderId: "fake", defaultModelId: "fake-model" },
          providerModels: [],
        },
      },
      runtimeEnv: {},
    },
    gatewayService: { execute, executeStream: vi.fn() },
    circuitBreakerRegistry: null,
    metricsCollector: null,
    wsServer: { getConnectionCount: () => 0 },
  };
}

describe("POST /chat idempotency contract", () => {
  it("replays the first gateway result without a second provider execution", async () => {
    const execute = vi.fn(async () => ({
      success: true,
      code: "OK",
      data: { text: "hello", selectedProvider: "fake" },
      meta: { requestId: "provider-request-1" },
    }));
    const handler = createChatRoutes(createContext(execute)).handlers.get("POST /chat");
    const body = { messages: [{ role: "user", content: "hello" }] };
    const first = createResponse();
    const second = createResponse();

    await handler!(createRequest("idem-chat-1"), first, { startedAt: Date.now(), body });
    await handler!(createRequest("idem-chat-1"), second, { startedAt: Date.now(), body });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.headers.get("idempotency-status")).toBe("created");
    expect(second.headers.get("idempotency-status")).toBe("replayed");
    expect(second.headers.get("idempotency-replayed")).toBe("true");
    expect(second.headers.get("access-control-expose-headers")).toContain("Idempotency-Replayed");
    expect(second.payload).toEqual(first.payload);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the same key is reused with a different body", async () => {
    const execute = vi.fn(async () => ({ success: true, code: "OK", data: {}, meta: { requestId: "request-1" } }));
    const handler = createChatRoutes(createContext(execute)).handlers.get("POST /chat");
    const first = createResponse();
    const conflict = createResponse();

    await handler!(createRequest("idem-chat-2"), first, {
      startedAt: Date.now(),
      body: { messages: [{ role: "user", content: "first" }] },
    });
    await handler!(createRequest("idem-chat-2"), conflict, {
      startedAt: Date.now(),
      body: { messages: [{ role: "user", content: "different" }] },
    });

    expect(conflict.statusCode).toBe(409);
    expect((conflict.payload as { error: { code: string } }).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(conflict.headers.get("idempotency-status")).toBe("rejected");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
