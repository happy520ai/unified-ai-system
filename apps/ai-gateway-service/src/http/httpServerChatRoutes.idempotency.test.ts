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

function createRequest(key: string, body: unknown, virtualKey = false) {
  return {
    method: "POST",
    body,
    headers: { "idempotency-key": key, authorization: "Bearer test-tenant" },
    socket: { remoteAddress: "127.0.0.1" },
    ...(virtualKey ? {
      enterpriseIdentity: {
        tenantId: "tenant-a",
        userId: "api-key:vk-native",
        apiKeyFingerprint: "vk-native",
      },
    } : {}),
  };
}

function createContext(
  execute: ReturnType<typeof vi.fn>,
  key: string,
  body: unknown,
  manager?: ReturnType<typeof createAccountingManager>,
) {
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
    enterpriseGovernanceService: manager
      ? { getApiKeyManager: () => manager }
      : undefined,
    request: createRequest(key, body, Boolean(manager)),
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

  it("accounts a successful native chat against the authenticated virtual key", async () => {
    const manager = createAccountingManager();
    const execute = vi.fn(async () => ({
      success: true,
      code: "OK",
      data: {
        text: "shared answer",
        selectedProvider: "local-fake-provider",
        usage: { totalTokens: 9 },
      },
      meta: { requestId: "native-budget-success" },
    }));
    const context = createContext(
      execute,
      "idem-chat-budget-1",
      { messages: [{ role: "user", content: "hello" }] },
      manager,
    );

    await dispatchHttpRoutes06(context);
    context.idempotencyCoordinator.close();

    expect(context.response.statusCode).toBe(200);
    expect(manager.authorizeUsage).toHaveBeenCalledWith({
      keyId: "vk-native",
      estimatedTokens: expect.any(Number),
    });
    expect(manager.recordUsage).toHaveBeenCalledWith({ keyId: "vk-native", tokens: 9 });
  });

  it("blocks native chat before provider execution when the shared virtual-key budget is exhausted", async () => {
    const manager = createAccountingManager({ allowed: false, code: "VIRTUAL_KEY_BUDGET_EXHAUSTED" });
    const execute = vi.fn();
    const context = createContext(
      execute,
      "idem-chat-budget-2",
      { messages: [{ role: "user", content: "blocked" }] },
      manager,
    );

    await dispatchHttpRoutes06(context);
    context.idempotencyCoordinator.close();

    expect(context.response.statusCode).toBe(429);
    expect(execute).not.toHaveBeenCalled();
    expect(manager.recordUsage).not.toHaveBeenCalled();
  });

  it("does not charge budget admission or tokens again for an idempotent replay", async () => {
    const manager = createAccountingManager();
    const execute = vi.fn(async () => successfulBudgetResult());
    const body = { messages: [{ role: "user", content: "shared budget" }] };
    const first = createContext(execute, "budget-replay", body, manager);
    const replay = { ...first, response: createResponse(), request: createRequest("budget-replay", body, true) };
    try {
      await dispatchHttpRoutes06(first);
      await dispatchHttpRoutes06(replay);
      expect(replay.response.statusCode).toBe(200);
      expect(replay.response.headers.get("idempotency-replayed")).toBe("true");
      expect(execute).toHaveBeenCalledOnce();
      expect(manager.authorizeUsage).toHaveBeenCalledOnce();
      expect(manager.recordUsage).toHaveBeenCalledExactlyOnceWith({ keyId: "vk-native", tokens: 9 });
    } finally { first.idempotencyCoordinator.close(); }
  });

  it("still replays a completed response after that key exhausts its budget", async () => {
    const manager = createAccountingManager();
    const execute = vi.fn(async () => successfulBudgetResult());
    const body = { messages: [{ role: "user", content: "last allowed request" }] };
    const first = createContext(execute, "budget-last-response", body, manager);
    const replay = { ...first, response: createResponse(), request: createRequest("budget-last-response", body, true) };
    try {
      await dispatchHttpRoutes06(first);
      manager.authorizeUsage.mockReturnValue({ allowed: false, code: "VIRTUAL_KEY_BUDGET_EXHAUSTED", budget: null, rate: null });
      await dispatchHttpRoutes06(replay);
      expect(replay.response.statusCode).toBe(200);
      expect(replay.response.payload).toEqual(first.response.payload);
      expect(manager.authorizeUsage).toHaveBeenCalledOnce();
      expect(manager.recordUsage).toHaveBeenCalledOnce();
    } finally { first.idempotencyCoordinator.close(); }
  });

  it("accounts concurrent duplicate native calls only once", async () => {
    const manager = createAccountingManager();
    let finish!: (value: ReturnType<typeof successfulBudgetResult>) => void;
    const execute = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const body = { messages: [{ role: "user", content: "concurrent shared request" }] };
    const first = createContext(execute, "budget-concurrent", body, manager);
    const replay = { ...first, response: createResponse(), request: createRequest("budget-concurrent", body, true) };
    try {
      const running = dispatchHttpRoutes06(first);
      await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
      const duplicate = dispatchHttpRoutes06(replay);
      finish(successfulBudgetResult());
      await Promise.all([running, duplicate]);
      expect(replay.response.payload).toEqual(first.response.payload);
      expect(manager.authorizeUsage).toHaveBeenCalledOnce();
      expect(manager.recordUsage).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledOnce();
    } finally { first.idempotencyCoordinator.close(); }
  });

  it("rejects changed-input key reuse without consuming another budget admission", async () => {
    const manager = createAccountingManager();
    const execute = vi.fn(async () => successfulBudgetResult());
    const first = createContext(execute, "budget-input-conflict", { messages: [{ role: "user", content: "first" }] }, manager);
    const conflict = { ...first, response: createResponse(), request: createRequest("budget-input-conflict", { messages: [{ role: "user", content: "changed" }] }, true) };
    try {
      await dispatchHttpRoutes06(first);
      await dispatchHttpRoutes06(conflict);
      expect(conflict.response.statusCode).toBe(409);
      expect(manager.authorizeUsage).toHaveBeenCalledOnce();
      expect(manager.recordUsage).toHaveBeenCalledOnce();
    } finally { first.idempotencyCoordinator.close(); }
  });

  it("blocks an authenticated virtual-key request when its accounting manager is unavailable", async () => {
    const execute = vi.fn(async () => successfulBudgetResult());
    const body = { messages: [{ role: "user", content: "shared budget" }] };
    const context = createContext(execute, "budget-manager-missing", body);
    context.request = createRequest("budget-manager-missing", body, true);
    try {
      await dispatchHttpRoutes06(context);
      expect(context.response.statusCode).toBe(503);
      expect((context.response.payload as { error: { code: string } }).error.code).toBe("VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE");
      expect(execute).not.toHaveBeenCalled();
    } finally { context.idempotencyCoordinator.close(); }
  });

  it("returns safe 503 without provider execution when admission storage fails", async () => {
    const manager = createAccountingManager();
    manager.authorizeUsage.mockImplementation(() => { throw new Error("synthetic-private-store-path"); });
    const execute = vi.fn(async () => successfulBudgetResult());
    const body = { messages: [{ role: "user", content: "blocked accounting" }] };
    const context = createContext(execute, "budget-storage-failure", body, manager);
    try {
      await dispatchHttpRoutes06(context);
      expect(context.response.statusCode).toBe(503);
      expect((context.response.payload as { error: { code: string } }).error.code).toBe("VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE");
      expect(JSON.stringify(context.response.payload)).not.toContain("synthetic-private-store-path");
      expect(execute).not.toHaveBeenCalled();
    } finally { context.idempotencyCoordinator.close(); }
  });
});

function successfulBudgetResult() {
  return { success: true, code: "OK", data: { text: "shared answer", usage: { totalTokens: 9 } }, meta: { requestId: "budget-fixture" } };
}

function createAccountingManager(authorization = { allowed: true, code: null as string | null }) {
  return {
    authorizeUsage: vi.fn(() => ({ ...authorization, budget: null, rate: null })),
    recordUsage: vi.fn(() => ({ recorded: true, budget: null, softBudgetExceeded: false })),
  };
}
