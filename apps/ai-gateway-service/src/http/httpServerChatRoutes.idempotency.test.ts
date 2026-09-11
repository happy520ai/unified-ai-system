import { describe, expect, it, vi } from "vitest";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { createRouteFailureEnvelope } from "../core/gatewayService.js";
import { dispatchHttpRoutes06 as dispatchNativeRoutes } from "./httpServerRoutes06.js";
import { bindVirtualKeyTestGateway } from "./virtualKeyGateway.testHelper.ts";
import { createIdempotencyCoordinator } from "./idempotencyCoordinator.ts";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { createApiKeyManager } from "../enterprise/apiKeyManager.js";

function dispatchHttpRoutes06(context: any) {
  return dispatchNativeRoutes({ ...context, gatewayService: bindVirtualKeyTestGateway(context) });
}

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

function createRequest(key: string, body: unknown, virtualKey: boolean | { tenantId: string; userId: string; apiKeyFingerprint: string } = false) {
  return {
    method: "POST",
    body,
    headers: { "idempotency-key": key, authorization: "Bearer test-tenant" },
    socket: { remoteAddress: "127.0.0.1" },
    ...(virtualKey ? {
      enterpriseIdentity: typeof virtualKey === "object" ? virtualKey : {
        tenantId: "tenant-a",
        userId: "api-key:aaaaaaaaaaaa",
        apiKeyFingerprint: "aaaaaaaaaaaa",
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
    request: createRequest(key, body, manager?.identity ?? false),
    response,
    url: new URL("http://127.0.0.1/chat"),
    startedAt: Date.now(),
  };
}

describe("production POST /chat idempotency contract", () => {
  it("keeps real-manager counters unchanged across concurrent replay, exhausted replay and input conflict", async () => {
    const manager = createApiKeyManager({ storePath: null, now: () => Date.parse("2026-09-09T00:00:00Z") });
    const { key, record } = manager.create({ role: "operator", tenantId: "tenant-a",
      budget: { limitTokens: 9, window: "daily" }, rateLimit: { requestsPerMinute: 1 } });
    const validated = manager.validate(key);
    if (!validated.valid || !validated.record) throw new Error("Synthetic key did not authenticate.");
    const identity = { tenantId: validated.record.tenantId, userId: `api-key:${record.keyFingerprint}`,
      apiKeyFingerprint: record.keyFingerprint };
    const admission = vi.spyOn(manager, "authorizeUsage"); const charge = vi.spyOn(manager, "recordUsage");
    let finish!: (value: ReturnType<typeof successfulBudgetResult>) => void;
    const execute = vi.fn(() => new Promise<ReturnType<typeof successfulBudgetResult>>((resolve) => { finish = resolve; }));
    const body = { messages: [{ role: "user", content: "hello" }] };
    const base = createContext(execute, "real-key-replay", body);
    const context = (operationKey: string, payload: unknown = body) => ({ ...base, response: createResponse(),
      request: { ...createRequest(operationKey, payload), headers: { "idempotency-key": operationKey, authorization: `Bearer ${key}` }, enterpriseIdentity: identity },
      enterpriseGovernanceService: { getApiKeyManager: () => manager } });
    try {
      const first = context("real-key-replay"); const duplicate = context("real-key-replay");
      const running = dispatchHttpRoutes06(first);
      await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
      expect(manager.describeUsage({ keyId: record.keyId })!.usage).toMatchObject({ requestCount: 1, rateRequestCount: 1, tokensUsed: 0 });
      const concurrent = dispatchHttpRoutes06(duplicate); finish(successfulBudgetResult());
      await Promise.all([running, concurrent]);
      expect(duplicate.response.payload).toEqual(first.response.payload);
      const after = manager.describeUsage({ keyId: record.keyId })!.usage;
      expect(after).toMatchObject({ requestCount: 1, rateRequestCount: 1, tokensUsed: 9, tokensRemaining: 0 });
      const exhaustedReplay = context("real-key-replay"); await dispatchHttpRoutes06(exhaustedReplay);
      expect(exhaustedReplay.response.statusCode).toBe(200);
      expect(exhaustedReplay.response.payload).toEqual(first.response.payload);
      const conflict = context("real-key-replay", { messages: [{ role: "user", content: "changed" }] });
      await dispatchHttpRoutes06(conflict);
      expect(conflict.response.statusCode).toBe(409);
      expect(admission).toHaveBeenCalledOnce(); expect(charge).toHaveBeenCalledOnce();
      const distinct = context("real-key-new-request"); await dispatchHttpRoutes06(distinct);
      expect(distinct.response.statusCode).toBe(429);
      expect(admission).toHaveBeenCalledTimes(2); expect(charge).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledOnce();
      expect(manager.describeUsage({ keyId: record.keyId })!.usage).toEqual(after);
    } finally { base.idempotencyCoordinator.close(); }
  });

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
      keyId: manager.identity.apiKeyFingerprint,
      estimatedTokens: expect.any(Number),
    });
    expect(manager.recordUsage).toHaveBeenCalledWith({ keyId: manager.identity.apiKeyFingerprint, tokens: 9 });
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
    const replay = { ...first, response: createResponse(), request: createRequest("budget-replay", body, manager.identity) };
    try {
      await dispatchHttpRoutes06(first);
      await dispatchHttpRoutes06(replay);
      expect(replay.response.statusCode).toBe(200);
      expect(replay.response.headers.get("idempotency-replayed")).toBe("true");
      expect(execute).toHaveBeenCalledOnce();
      expect(manager.authorizeUsage).toHaveBeenCalledOnce();
      expect(manager.recordUsage).toHaveBeenCalledExactlyOnceWith({ keyId: manager.identity.apiKeyFingerprint, tokens: 9 });
    } finally { first.idempotencyCoordinator.close(); }
  });

  it("still replays a completed response after that key exhausts its budget", async () => {
    const manager = createAccountingManager();
    const execute = vi.fn(async () => successfulBudgetResult());
    const body = { messages: [{ role: "user", content: "last allowed request" }] };
    const first = createContext(execute, "budget-last-response", body, manager);
    const replay = { ...first, response: createResponse(), request: createRequest("budget-last-response", body, manager.identity) };
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
    const replay = { ...first, response: createResponse(), request: createRequest("budget-concurrent", body, manager.identity) };
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
    const conflict = { ...first, response: createResponse(), request: createRequest("budget-input-conflict", { messages: [{ role: "user", content: "changed" }] }, manager.identity) };
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
  const manager = createApiKeyManager({ storePath: null });
  const { key, record } = manager.create({ tenantId: "tenant-a", budget: { limitTokens: 1_000_000, window: "daily" } });
  if (!manager.validate(key).valid) throw new Error("Fixture authentication failed.");
  const authorizeUsage = vi.spyOn(manager, "authorizeUsage");
  const recordUsage = vi.spyOn(manager, "recordUsage");
  if (!authorization.allowed) {
    if (!authorization.code) throw new Error("Denied fixture authorization requires a code.");
    authorizeUsage.mockReturnValue({ ...authorization, code: authorization.code, budget: null, rate: null });
  }
  return Object.assign(manager, { authorizeUsage, recordUsage,
    identity: { tenantId: "tenant-a", userId: `api-key:${record.keyFingerprint}`, apiKeyFingerprint: record.keyFingerprint } });
}
