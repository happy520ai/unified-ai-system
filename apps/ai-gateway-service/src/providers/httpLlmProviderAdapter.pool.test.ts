// =============================================================================
// httpLlmProviderAdapter.pool.test.js — 适配器多 Key 池集成测试
//
// 覆盖：池取 Key 优先、401/403 换 Key 重试、池耗尽显式报错、无池时行为回归。
// 用本地 mock provider + 既有的 resolveOutboundUrl 注入（与 e2e 测试同款），
// 零真实外部调用、零真实凭据。
// =============================================================================

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import * as connectionPool from "../http/connectionPool.js";
import { createHttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";
import { createCredentialPool } from "./credentialPool.ts";

let server: import("node:http").Server;
let baseUrl = "";
/** 记录每次请求携带的 bearer key，供断言使用。 */
let seenKeys: string[] = [];
/** 由每个用例设置的响应队列。 */
let responseQueue: Array<{ status: number; body: unknown }> = [];
/** 每个用例进入 mock 前可挂钩子。 */
let onRequest: ((info: { key: string; body: string }) => void) | null = null;

function resolveLocalTestUrl(url: string) {
  return {
    url,
    lookup(_hostname: unknown, options: unknown, callback: unknown) {
      const resolvedCallback = (typeof options === "function" ? options : callback) as (e: null, a: string, f: number) => void;
      resolvedCallback(null, "127.0.0.1", 4);
    },
  };
}

function okBody(text = "ok") {
  return {
    id: "chatcmpl-1",
    model: "glm-5.3-flash",
    choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
  };
}

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

beforeAll(async () => {
  server = await new Promise((resolve) => {
    const srv = createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        const auth = req.headers.authorization ?? "";
        const key = auth.replace(/^Bearer\s+/u, "");
        seenKeys.push(key);
        if (onRequest) onRequest({ key, body: raw });
        const next = responseQueue.shift() ?? { status: 200, body: okBody() };
        res.writeHead(next.status, { "content-type": "application/json" });
        res.end(JSON.stringify(next.body));
      });
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("mock server did not bind a port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  if (server) server.close();
});

afterEach(() => {
  seenKeys = [];
  responseQueue = [];
  onRequest = null;
  connectionPool.destroyAllPools();
});

function createRequest(providerId = "pooled") {
  return {
    target: { providerId, modelId: "glm-5.3-flash" },
    request: { messages: [{ role: "user", content: "hello" }], options: {} },
  };
}

function descOf(pool: ReturnType<typeof createCredentialPool>, providerId: string) {
  const d = pool.describe(providerId);
  if (!d) throw new Error(`expected a pool description for ${providerId}`);
  return d;
}

function createPooledAdapter(
  pool: ReturnType<typeof createCredentialPool>,
  providerId = "pooled",
  options: Record<string, unknown> = {},
) {
  return createHttpLLMProviderAdapter({
    providerId,
    modelId: "glm-5.3-flash",
    endpoint: baseUrl,
    enabled: true,
    dryRun: false,
  }, {
    credentialPool: pool,
    maxRetries: 3,
    retryBaseDelayMs: 1,
    retryMaxDelayMs: 2,
    resolveOutboundUrl: resolveLocalTestUrl,
    ...options,
  });
}

describe("http LLM adapter with a credential pool", () => {
  it("sends a key taken from the pool", async () => {
    const pool = createCredentialPool({ env: {} });
    pool.set("pooled", [{ key: "sk-from-pool", balance: 50, expire: futureDate(10) }]);
    responseQueue = [{ status: 200, body: okBody("hi") }];

    const adapter = createPooledAdapter(pool);
    const response = await adapter.generate(createRequest());

    expect(response.text).toBe("hi");
    expect(seenKeys).toEqual(["sk-from-pool"]);
  });

  it("swaps to another pool key when the first is rejected with 401", async () => {
    const pool = createCredentialPool({ env: {}, random: () => 0 });
    // random 0 稳定选中首个可用 Key，便于断言顺序。
    pool.set("pooled", [
      { key: "sk-bad", balance: 100, expire: futureDate(10) },
      { key: "sk-good", balance: 1, expire: futureDate(10) },
    ]);
    responseQueue = [
      { status: 401, body: { error: { message: "invalid api key" } } },
      { status: 200, body: okBody("recovered") },
    ];

    const adapter = createPooledAdapter(pool);
    const response = await adapter.generate(createRequest());

    expect(response.text).toBe("recovered");
    expect(seenKeys).toHaveLength(2);
    expect(new Set(seenKeys)).toEqual(new Set(["sk-bad", "sk-good"]));
    expect(descOf(pool, "pooled").benched).toBe(1);
    expect(descOf(pool, "pooled").alive).toBe(1);
  });

  it("swaps key on 403 as well", async () => {
    const pool = createCredentialPool({ env: {}, random: () => 0 });
    pool.set("pooled", [
      { key: "sk-bad", balance: 100, expire: futureDate(10) },
      { key: "sk-good", balance: 1, expire: futureDate(10) },
    ]);
    responseQueue = [
      { status: 403, body: { error: { message: "forbidden" } } },
      { status: 200, body: okBody("ok403") },
    ];

    const adapter = createPooledAdapter(pool);
    const response = await adapter.generate(createRequest());

    expect(response.text).toBe("ok403");
    expect(seenKeys).toHaveLength(2);
  });

  it("raises an explicit pool-exhausted error instead of sending an empty key", async () => {
    const pool = createCredentialPool({ env: {}, benchMs: 60_000 });
    pool.set("pooled", [{ key: "sk-only", balance: 5, expire: futureDate(3) }]);
    pool.record("pooled", "sk-only", false, { benchOnFailure: true });

    const adapter = createPooledAdapter(pool);
    await expect(adapter.generate(createRequest())).rejects.toMatchObject({
      code: "POOLED_CREDENTIAL_POOL_EXHAUSTED",
      retryable: false,
    });
    expect(seenKeys).toEqual([]);
  });

  it("keeps the single-key path unchanged when no pool is configured", async () => {
    responseQueue = [{ status: 200, body: okBody("single") }];
    const adapter = createHttpLLMProviderAdapter({
      providerId: "plain",
      modelId: "glm-5.3-flash",
      endpoint: baseUrl,
      apiKey: "sk-static",
      enabled: true,
      dryRun: false,
    }, { maxRetries: 1, retryBaseDelayMs: 1, resolveOutboundUrl: resolveLocalTestUrl });

    const response = await adapter.generate(createRequest("plain"));
    expect(response.text).toBe("single");
    expect(seenKeys).toEqual(["sk-static"]);
  });

  it("rotates on 401 even when maxRetries is 1 (production config)", async () => {
    // Regression: the rotation budget must outlast the plain retry budget.
    // With maxRetries=1 the previous loop bound made key rotation unreachable,
    // so a rejected key failed the call instead of trying another one.
    const pool = createCredentialPool({ env: {}, random: () => 0 });
    pool.set("pooled", [
      { key: "sk-bad", balance: 100, expire: futureDate(10) },
      { key: "sk-good", balance: 100, expire: futureDate(10) },
    ]);
    responseQueue = [
      { status: 401, body: { error: { message: "nope" } } },
      { status: 200, body: okBody("rotated-despite-maxRetries-1") },
    ];

    const adapter = createPooledAdapter(pool, "pooled", { maxRetries: 1 });
    const response = await adapter.generate(createRequest());

    expect(response.text).toBe("rotated-despite-maxRetries-1");
    expect(new Set(seenKeys)).toEqual(new Set(["sk-bad", "sk-good"]));
    expect(descOf(pool, "pooled").benched).toBe(1);
  });

  it("does not bench a key on a server error, and still fails after the budget is spent", async () => {
    const pool = createCredentialPool({ env: {}, random: () => 0 });
    pool.set("pooled", [{ key: "sk-only", balance: 100, expire: futureDate(10) }]);
    responseQueue = [
      { status: 500, body: { error: { message: "boom" } } },
      { status: 500, body: { error: { message: "boom" } } },
      { status: 500, body: { error: { message: "boom" } } },
    ];

    const adapter = createPooledAdapter(pool);
    await expect(adapter.generate(createRequest())).rejects.toMatchObject({
      code: "POOLED_HTTP_ERROR",
      retryable: true,
    });
    expect(new Set(seenKeys)).toEqual(new Set(["sk-only"]));
    expect(descOf(pool, "pooled").benched).toBe(0);
  });

  it("rotates through many keys until one succeeds", async () => {
    const pool = createCredentialPool({ env: {} });
    // 每个 Key 权重相等（balance/expiry 相同），随机选择即等价于轮换。
    pool.set("pooled", Array.from({ length: 6 }, (_, i) => ({
      key: `sk-k${i}`, balance: 10, expire: futureDate(10),
    })));
    // 前 5 个恒失败（401），第 6 次成功——无论选中顺序如何，最多 6 次内必成功。
    responseQueue = [
      { status: 401, body: { error: { message: "nope" } } },
      { status: 401, body: { error: { message: "nope" } } },
      { status: 401, body: { error: { message: "nope" } } },
      { status: 401, body: { error: { message: "nope" } } },
      { status: 401, body: { error: { message: "nope" } } },
      { status: 200, body: okBody("finally") },
    ];
    // 保证每次换 Key 后仍能选到不同的可用 Key（拉黑后重选）。
    const adapter = createPooledAdapter(pool, "pooled", { maxRetries: 8 });
    const response = await adapter.generate(createRequest());

    expect(response.text).toBe("finally");
    expect(seenKeys.length).toBeGreaterThanOrEqual(2);
    // 5 次 401 各自拉黑一个 Key，仅最后成功的那个存活。
    const desc = descOf(pool, "pooled");
    expect(desc.alive).toBe(1);
    expect(desc.benched).toBe(5);
  });

  it("attributes 401 to the pool even when the failure message mentions the upstream", async () => {
    const pool = createCredentialPool({ env: {}, random: () => 0 });
    pool.set("pooled", [
      { key: "sk-one", balance: 10, expire: futureDate(5) },
      { key: "sk-two", balance: 10, expire: futureDate(5) },
    ]);
    responseQueue = [
      { status: 401, body: { error: { message: "鉴权服务请求失败: Invalid api_key format" } } },
      { status: 200, body: okBody("ok-after-auth-fail") },
    ];

    const adapter = createPooledAdapter(pool);
    const response = await adapter.generate(createRequest());

    expect(response.text).toBe("ok-after-auth-fail");
    expect(descOf(pool, "pooled").benched).toBe(1);
  });
});
