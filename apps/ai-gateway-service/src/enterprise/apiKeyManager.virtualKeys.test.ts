import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  createApiKeyManager,
  type ApiKeyManager,
  type ApiKeyManagerOptions,
} from "./apiKeyManager.js";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";
import { dispatchOpenAiCompatibilityRoutes } from "../http/openAiCompatibilityRoutes.js";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [{ id: "local-fake-model", enabled: true, capabilities: ["chat"] }],
  },
];

interface TestRequest extends Readable {
  method: string;
  enterpriseIdentity?: unknown;
}

interface TestResponse extends EventEmitter {
  statusCode: number | null;
  headers: Record<string, unknown>;
  body: any;
  text: string;
  writableEnded: boolean;
  headersSent: boolean;
  writeHead(statusCode: number, headers?: Record<string, unknown>): void;
  flushHeaders(): void;
  write(chunk: unknown): boolean;
  end(body?: unknown): void;
}

interface TestGatewayService {
  getProviderDescriptors(): typeof descriptors;
  execute: Mock<(input: any) => Promise<any>>;
  executeStream(input?: any): AsyncGenerator<any>;
}

function createManager(overrides: Partial<ApiKeyManagerOptions> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "api-key-manager-test-"));
  const clock = { now: 1_000_000_000_000 };
  const manager = createApiKeyManager({
    storePath: join(dir, "api-keys.json"),
    now: () => clock.now,
    ...overrides,
  });
  return { manager, dir, clock };
}

function createGatewayService(): TestGatewayService {
  return {
    getProviderDescriptors: () => descriptors,
    execute: vi.fn(async (_input: any): Promise<any> => ({
      success: true,
      data: {
        id: "request-123",
        message: { role: "assistant", content: "[fake] completed" },
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        executionMode: "fake",
        executionStatus: "success",
        finishReason: "stop",
        usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
      },
      meta: { requestId: "request-123" },
    })),
    async *executeStream() {
      const common = { requestId: "request-123", selectedModel: "local-fake-model", executionMode: "fake" };
      yield { ...common, type: "start" };
      yield { ...common, type: "chunk", textDelta: "Hello" };
      yield { ...common, type: "done" };
    },
  };
}

function createJsonRequest(
  body: any,
  { method = "POST", enterpriseIdentity }: { method?: string; enterpriseIdentity?: unknown } = {},
): TestRequest {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]) as TestRequest;
  request.method = method;
  if (enterpriseIdentity) request.enterpriseIdentity = enterpriseIdentity;
  return request;
}

function createResponseRecorder(): TestResponse {
  const response = new EventEmitter() as TestResponse;
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.text = "";
  response.writableEnded = false;
  response.headersSent = false;
  response.writeHead = (statusCode: number, headers: Record<string, unknown> = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
    response.headersSent = true;
  };
  response.flushHeaders = () => {};
  response.write = (chunk: unknown) => {
    response.text += String(chunk);
    return true;
  };
  response.end = (body?: unknown) => {
    if (body !== undefined) {
      response.text += String(body);
      response.body = JSON.parse(String(body));
    }
    response.writableEnded = true;
  };
  return response;
}

const cleanup: string[] = [];
afterEach(() => {
  for (const dir of cleanup.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("api key manager virtual keys", () => {
  it("creates, validates, and lists keys without exposing secrets", () => {
    const { manager } = createManager();
    const { key, record } = manager.create({
      role: "operator",
      tenantId: "tenant-a",
      budget: { limitTokens: 1000, window: "daily" },
      rateLimit: { requestsPerMinute: 10 },
    });

    expect(key).toMatch(/^uai-[0-9a-f]{64}$/);
    expect(record.keyHashExposed).toBe(false);
    expect(record.budget).toEqual({ limitTokens: 1000, windowMs: 86_400_000, softThreshold: 0.8 });
    expect(record.rateLimit).toEqual({ requestsPerMinute: 10 });

    const validated = manager.validate(key);
    expect(validated.valid).toBe(true);
    if (!validated.record) throw new Error("Expected a validated API key record.");
    expect(validated.record.keyId).toBe(record.keyId);

    const listed = manager.list({ tenantId: "tenant-a" });
    expect(listed.totalCount).toBe(1);
    expect(listed.keys[0].usage.budgetEnabled).toBe(true);
    expect(listed.keys[0].keyHash).toBeUndefined();
    expect(listed.keys[0].keyHashExposed).toBe(false);
    expect(manager.list({ tenantId: "tenant-b" }).totalCount).toBe(0);
  });

  it("enforces the token budget within a window and rolls it over", () => {
    const { manager, clock, dir } = createManager();
    cleanup.push(dir);
    const { record } = manager.create({
      role: "operator",
      tenantId: "tenant-a",
      budget: { limitTokens: 100, windowMs: 60_000 },
    });

    expect(manager.authorizeUsage({ keyId: record.keyId, estimatedTokens: 10 }).allowed).toBe(true);
    manager.recordUsage({ keyId: record.keyId, tokens: 90 });

    const exhausted = manager.authorizeUsage({ keyId: record.keyId, estimatedTokens: 11 });
    expect(exhausted.allowed).toBe(false);
    expect(exhausted.code).toBe("VIRTUAL_KEY_BUDGET_EXHAUSTED");

    // 下一个窗口重置预算。
    clock.now += 61_000;
    expect(manager.authorizeUsage({ keyId: record.keyId, estimatedTokens: 50 }).allowed).toBe(true);
  });

  it("enforces the per-key request rate limit", () => {
    const { manager, dir } = createManager();
    cleanup.push(dir);
    const { record } = manager.create({
      role: "operator",
      rateLimit: { requestsPerMinute: 2 },
    });

    expect(manager.authorizeUsage({ keyId: record.keyId }).allowed).toBe(true);
    expect(manager.authorizeUsage({ keyId: record.keyId }).allowed).toBe(true);
    const limited = manager.authorizeUsage({ keyId: record.keyId });
    expect(limited.allowed).toBe(false);
    expect(limited.code).toBe("VIRTUAL_KEY_RATE_LIMITED");
    if (!limited.rate) throw new Error("Expected rate-limit details.");
    expect(limited.rate.requestsPerMinute).toBe(2);
  });

  it("reports a soft-budget crossing exactly once", () => {
    const { manager, dir } = createManager();
    cleanup.push(dir);
    const { record } = manager.create({
      role: "operator",
      budget: { limitTokens: 100, windowMs: 60_000, softThreshold: 0.5 },
    });

    expect(manager.recordUsage({ keyId: record.keyId, tokens: 40 }).softBudgetExceeded).toBe(false);
    expect(manager.recordUsage({ keyId: record.keyId, tokens: 15 }).softBudgetExceeded).toBe(true);
    expect(manager.recordUsage({ keyId: record.keyId, tokens: 10 }).softBudgetExceeded).toBe(false);
  });

  it("persists keys and usage across restarts and drops revoked keys", () => {
    const { manager, dir, clock } = createManager();
    cleanup.push(dir);
    const { key, record } = manager.create({
      role: "operator",
      tenantId: "tenant-a",
      budget: { limitTokens: 1000, window: "daily" },
    });
    manager.recordUsage({ keyId: record.keyId, tokens: 120 });

    const revoked = manager.create({ role: "viewer", tenantId: "tenant-a" });
    manager.revoke({ keyId: revoked.record.keyId });

    const restarted = createApiKeyManager({ storePath: join(dir, "api-keys.json"), now: () => clock.now });
    expect(restarted.validate(key).valid).toBe(true);
    const restartedUsage = restarted.describeUsage({ keyId: record.keyId });
    if (!restartedUsage) throw new Error("Expected persisted usage.");
    expect(restartedUsage.usage.tokensUsed).toBe(120);
    expect(restarted.validate(revoked.key).valid).toBe(false);
    expect(restarted.list({ tenantId: "tenant-a" }).totalCount).toBe(1);
  });

  it("rejects invalid budget and rate limit inputs", () => {
    const { manager } = createManager();
    const expectErrorCode = (fn: () => unknown, code: string) => {
      try {
        fn();
      } catch (error) {
        expect((error as { code?: string }).code).toBe(code);
        return;
      }
      throw new Error(`Expected create() to throw ${code}.`);
    };
    expectErrorCode(() => manager.create({ budget: { limitTokens: 0, window: "daily" } }), "api_key_invalid_budget_limit");
    expectErrorCode(() => manager.create({ budget: { limitTokens: 10, window: "weekly" } }), "api_key_invalid_budget_window");
    expectErrorCode(() => manager.create({ rateLimit: { requestsPerMinute: -1 } }), "api_key_invalid_rate_limit_rpm");
    expectErrorCode(() => manager.create({ role: "superuser" }), "api_key_invalid_role");
  });
});

describe("governance authentication with virtual keys", () => {
  it("authenticates a uai- key into a scoped identity", () => {
    const dir = mkdtempSync(join(tmpdir(), "governance-vk-"));
    cleanup.push(dir);
    const service = createEnterpriseGovernanceService({
      env: {
        PME_AUTH_TOKEN: "admin-token",
        PME_API_KEY_STORE_PATH: join(dir, "keys.json"),
      },
      auditLogPath: join(dir, "audit.jsonl"),
    });

    const { key, record } = service.getApiKeyManager().create({
      role: "operator",
      tenantId: "tenant-a",
    });

    const decision = service.authenticate({
      headers: { authorization: `Bearer ${key}` },
      socket: { remoteAddress: "127.0.0.1" },
    });
    expect(decision.authenticated).toBe(true);
    if (!decision.identity) throw new Error("Expected an authenticated identity.");
    expect(decision.identity.role).toBe("operator");
    expect(decision.identity.tenantId).toBe("tenant-a");
    expect(decision.identity.apiKeyFingerprint).toBe(record.keyFingerprint);
    expect(decision.identity.permissions).toContain("chat:use");

    // 吊销后立刻失效。
    service.getApiKeyManager().revoke({ keyId: record.keyId });
    const revokedDecision = service.authenticate({
      headers: { authorization: `Bearer ${key}` },
      socket: { remoteAddress: "127.0.0.1" },
    });
    expect(revokedDecision.authenticated).toBe(false);
    expect(revokedDecision.code).toBe("enterprise_api_key_revoked");
  });
});

describe("chat completions virtual key enforcement", () => {
  function createContext({
    body,
    manager,
    enterpriseIdentity,
  }: {
    body: any;
    manager: ApiKeyManager;
    enterpriseIdentity: unknown;
  }) {
    return {
      request: createJsonRequest(body, { enterpriseIdentity }),
      response: createResponseRecorder(),
      startedAt: Date.now(),
      url: new URL("http://127.0.0.1/v1/chat/completions"),
      gatewayService: createGatewayService(),
      writeServiceLog: vi.fn(),
      enterpriseGovernanceService: manager
        ? { getApiKeyManager: () => manager }
        : undefined,
    };
  }

  const chatBody = {
    model: "local-fake-model",
    messages: [{ role: "user", content: "Say hello" }],
  };

  it("rejects with 429 when the key budget is exhausted and skips the provider", async () => {
    const { manager, dir } = createManager();
    cleanup.push(dir);
    const { record } = manager.create({
      role: "operator",
      budget: { limitTokens: 1, window: "daily" },
    });
    manager.recordUsage({ keyId: record.keyId, tokens: 1 });

    const context = createContext({
      body: chatBody,
      manager,
      enterpriseIdentity: { tenantId: "tenant-a", apiKeyFingerprint: record.keyId },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(429);
    expect(context.response.body.error.code).toBe("VIRTUAL_KEY_BUDGET_EXHAUSTED");
    expect(context.gatewayService.execute).not.toHaveBeenCalled();
  });

  it("records actual usage after a successful non-streaming call", async () => {
    const { manager, dir } = createManager();
    cleanup.push(dir);
    const { record } = manager.create({
      role: "operator",
      budget: { limitTokens: 1000, window: "daily" },
    });

    const context = createContext({
      body: chatBody,
      manager,
      enterpriseIdentity: { tenantId: "tenant-a", apiKeyFingerprint: record.keyId },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(200);
    const usage = manager.describeUsage({ keyId: record.keyId });
    if (!usage) throw new Error("Expected recorded usage.");
    expect(usage.usage.tokensUsed).toBe(12);
  });

  it("does not touch the manager when the identity is not a virtual key", async () => {
    const { manager, dir } = createManager();
    cleanup.push(dir);
    const context = createContext({
      body: chatBody,
      manager,
      enterpriseIdentity: { tenantId: "tenant-a" },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(200);
    expect(manager.list().totalCount).toBe(0);
  });
});
