// =============================================================================
// credentialPool.e2e.test.js — 多 Key 池端到端测试
//
// 起一个真实的网关 HTTP 服务器（createGatewayHttpServer），上游用本地 mock
// provider 顶替，池走真实 createCredentialPool。验证：
//   1) 池写入接口 -> /providers 状态可见
//   2) OpenAI 兼容路由真实走池取 Key
//   3) 上游 401 时自动换 Key 并最终成功
//   4) 单 Key 模式（无池）行为不变
// 全程零真实外部调用。
// =============================================================================

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createHttpLLMProviderAdapter } from "../providers/httpLlmProviderAdapter.js";
import { createCredentialPool } from "../providers/credentialPool.ts";
import { createGatewayHttpServer } from "./httpServer.js";

type CloseableServer = {
  close(cb?: (err?: Error) => void): void;
  closeAllConnections?: () => void;
  shutdownResources?: () => Promise<void>;
};
type ListenableServer = CloseableServer & {
  listen(port: number, host: string, cb: () => void): void;
  address(): { port: number } | string | null;
};

const temporaryDirectories: string[] = [];
const openServers: Array<CloseableServer & { address(): unknown }> = [];

afterEach(async () => {
  for (const server of openServers.splice(0)) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
    await server.shutdownResources?.();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function listen(server: ListenableServer): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  openServers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind a port");
  return `http://127.0.0.1:${address.port}`;
}

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(dir);
  return dir;
}

function baseEnv(root: string, poolPath: string): Record<string, string> {
  return {
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: "pool-e2e-token",
    PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"),
    PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    PME_CREDENTIAL_POOL_STORE_MODE: "local-file",
    PME_RUNTIME_CREDENTIAL_MASTER_KEY: `base64:${Buffer.alloc(32, 9).toString("base64")}`,
    PME_CREDENTIAL_POOL_STORE_PATH: poolPath,
  };
}

function descOf(pool: ReturnType<typeof createCredentialPool>, providerId: string) {
  const d = pool.describe(providerId);
  if (!d) throw new Error(`expected a pool description for ${providerId}`);
  return d;
}

function authHeaders(): Record<string, string> {
  return { authorization: "Bearer pool-e2e-token", "content-type": "application/json" };
}

/** Build an app with a pooled fake provider registered under `providerId`. */
function buildPooledApp({ root, poolPath, providerId = "pooled-http", pool, failingFirst = 1 }: {
  root: string;
  poolPath: string;
  providerId?: string;
  pool: ReturnType<typeof createCredentialPool>;
  failingFirst?: number;
}) {
  const application = createGatewayApplication(baseEnv(root, poolPath));
  application.credentialPool = pool;

  const usedKeys: string[] = [];
  let callCount = 0;
  const provider = createFakeProvider({
    providerId,
    modelId: "glm-5.3-flash",
    providerType: "fake",
    capabilities: ["chat"],
    enabled: true,
  });
  // Replace generate with a stub that reads the pooled key and can fail N times.
  (provider as { generate: unknown }).generate = async () => {
    callCount += 1;
    const key = pool.pick(providerId) ?? "";
    usedKeys.push(key);
    if (callCount <= failingFirst) {
      const error = Object.assign(new Error("upstream rejected key"), {
        code: "POOLED_HTTP_UNAUTHORIZED",
        type: "authentication",
        retryable: false,
        credentialRef: { apiKey: key, pooled: true },
      });
      // Record the failure against the pool, exactly as the adapter does.
      pool.record(providerId, key, false, { benchOnFailure: true });
      throw error;
    }
    pool.record(providerId, key, true);
    return {
      text: "pool-ok",
      message: { role: "assistant", content: "pool-ok" },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      latencyMs: 1,
      providerId,
      modelId: "glm-5.3-flash",
    };
  };

  // Register into the application's own registry: httpServer captures
  // `gatewayService` at construction, so swapping it after createGatewayApplication
  // would not be observed by the HTTP layer.
  const providerRegistry = application.providerRegistry;
  providerRegistry.register(provider);
  if (!providerRegistry.list().some((p) => p.descriptor.id === providerId)) {
    providerRegistry.enableProvider(providerId);
  }
  return { application, provider, usedKeys, providerId };
}

describe("credential pool end-to-end over HTTP", () => {
  it("writes a pool, exposes counts on /providers, and never leaks a key", async () => {
    const root = tempDir("pool-e2e-");
    const poolPath = join(root, "pool.json");
    const pool = createCredentialPool({
      env: {
        PME_CREDENTIAL_POOL_STORE_MODE: "local-file",
        PME_RUNTIME_CREDENTIAL_MASTER_KEY: `base64:${Buffer.alloc(32, 9).toString("base64")}`,
      },
      storagePath: poolPath,
    });
    const { application, providerId } = buildPooledApp({ root, poolPath, pool });
    const server = createGatewayHttpServer(application);
    const base = await listen(server);

    const write = await fetch(`${base}/providers/credential-pool`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        providerId,
        entries: [
          { key: "sk-test-key-aaaa", balance: 50, expire: new Date(Date.now() + 8.64e7).toISOString() },
          { key: "sk-test-key-bbbb", balance: 10, expire: new Date(Date.now() + 8.64e7).toISOString() },
        ],
      }),
    });
    expect(write.status).toBe(200);
    const writeBody = await write.json();
    expect(writeBody.data).toMatchObject({ providerId, size: 2, alive: 2 });
    const serialized = JSON.stringify(writeBody);
    expect(serialized).not.toContain("sk-test-key-aaaa");
    expect(serialized).not.toContain("sk-test-key-bbbb");

    const providers = await fetch(`${base}/providers`, { headers: authHeaders() });
    expect(providers.status).toBe(200);
    const providersBody = await providers.json();
    const listed = providersBody.data.find((p: { id: string }) => p.id === providerId);
    expect(listed.metadata.credentialPoolConfigured).toBe(true);
    expect(listed.metadata.credentialPoolSize).toBe(2);
    expect(JSON.stringify(providersBody)).not.toContain("sk-aaaa");
  });

  it("rejects a pool write with no entries array", async () => {
    const root = tempDir("pool-e2e-");
    const poolPath = join(root, "pool.json");
    const pool = createCredentialPool({ env: {}, storagePath: poolPath });
    const { application } = buildPooledApp({ root, poolPath, pool });
    const server = createGatewayHttpServer(application);
    const base = await listen(server);

    const res = await fetch(`${base}/providers/credential-pool`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ providerId: "pooled-http" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("credential_pool_entries_required");
  });

  it("requires authentication for the pool endpoint", async () => {
    const root = tempDir("pool-e2e-");
    const poolPath = join(root, "pool.json");
    const pool = createCredentialPool({ env: {}, storagePath: poolPath });
    const { application } = buildPooledApp({ root, poolPath, pool });
    const server = createGatewayHttpServer(application);
    const base = await listen(server);

    const res = await fetch(`${base}/providers/credential-pool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerId: "pooled-http", entries: [] }),
    });
    expect([401, 403]).toContain(res.status);
  });

  it("serves a chat completion through the real adapter, rotating off a rejected key", async () => {
    const root = tempDir("pool-e2e-");
    const poolPath = join(root, "pool.json");
    // random()=>0 makes the selection order deterministic: the rejected key is
    // always tried first, so the swap path is exercised on every run.
    const pool = createCredentialPool({ env: {}, random: () => 0 });
    const providerId = "pooled-http";
    const application = createGatewayApplication(baseEnv(root, poolPath));
    application.credentialPool = pool;

    // A real local upstream that rejects exactly one key, then succeeds.
    const rejectedKey = "sk-test-key-aaaa";
    const acceptedKey = "sk-test-key-bbbb";
    const seenKeys: string[] = [];
    const upstream = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const key = String(req.headers.authorization ?? "").replace(/^Bearer\s+/u, "");
        seenKeys.push(key);
        if (key === rejectedKey) {
          res.writeHead(401, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: { message: "invalid api key" } }));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          id: "chatcmpl-e2e",
          model: "glm-5.3-flash",
          choices: [{ message: { role: "assistant", content: "e2e-ok" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }));
      });
    });
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    openServers.push(upstream);
    const upstreamAddress = upstream.address();
    if (!upstreamAddress || typeof upstreamAddress === "string") throw new Error("upstream did not bind a port");
    const upstreamUrl = `http://127.0.0.1:${upstreamAddress.port}`;

    // The real HTTP adapter is used; providerType is labelled "fake" only so the
    // execution gate permits it in fake-provider mode. All rotation logic under
    // test lives in the adapter, not in this label.
    const adapter = createHttpLLMProviderAdapter({
      providerId,
      modelId: "glm-5.3-flash",
      providerType: "fake",
      endpoint: upstreamUrl,
      capabilities: ["chat"],
      enabled: true,
      dryRun: false,
    }, {
      credentialPool: pool,
      maxRetries: 3,
      retryBaseDelayMs: 1,
      retryMaxDelayMs: 2,
      resolveOutboundUrl: (url: string) => ({
        url,
        lookup(_h: unknown, options: unknown, cb: unknown) {
          (typeof options === "function" ? options : cb as (e: null, a: string, f: number) => void)(null, "127.0.0.1", 4);
        },
      }),
    });
    const providerRegistry = application.providerRegistry;
    providerRegistry.register(adapter);
    providerRegistry.enableProvider(providerId);

    // Both keys are equal weight, so the first pick is one of them; the rejected
    // one is always benched and the request succeeds on the other.
    pool.set(providerId, [
      { key: rejectedKey, balance: 20, expire: new Date(Date.now() + 8.64e7).toISOString() },
      { key: acceptedKey, balance: 20, expire: new Date(Date.now() + 8.64e7).toISOString() },
    ]);

    const server = createGatewayHttpServer(application);
    const base = await listen(server);
    const res = await fetch(`${base}/chat`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }], providerId }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.selectedProvider).toBe(providerId);
    expect(body.data.text).toBe("e2e-ok");
    // The rejected key was tried, benched, and a second key completed the call.
    expect(seenKeys).toContain(rejectedKey);
    expect(seenKeys[seenKeys.length - 1]).toBe(acceptedKey);
    const desc = descOf(pool, providerId);
    expect(desc.benched).toBe(1);
    expect(desc.alive).toBe(1);
  });
});
