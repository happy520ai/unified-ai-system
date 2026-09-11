import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { dispatchHttpRoutes04 } from "../http/httpServerRoutes04.js";
import { readJson } from "../http/utils/responseUtils.js";
import * as connectionPool from "../http/connectionPool.js";
import { resolvePermission } from "../http/utils/enterpriseUtils.js";
import { HttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";
import { createRuntimeCredentialStore } from "./runtimeCredentialStore.js";
import { clearRuntimeProviderCredential } from "./clearRuntimeProviderCredential.ts";

const ROOT_PREFIX = "provider-clear-fixture-";
const PRIVATE_FIXTURE = "synthetic-private-runtime-credential";
const CONFIG_FIXTURE = "synthetic-private-config-credential";
const ACTOR = { tenantId: "platform", userId: "operator", role: "admin", permissions: ["*"] };
const resources: Array<() => unknown> = [];
const roots: string[] = [];

// The legacy JS setter's inferred type omits providerId/apiKey from destructuring.
type FixtureCredentialStore = Omit<ReturnType<typeof createRuntimeCredentialStore>, "set"> & {
  set(input: { providerId: string; apiKey: string }): unknown;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const close of resources.splice(0).reverse()) close();
  for (const root of roots.splice(0)) {
    if (dirname(root) !== resolve(tmpdir()) || !basename(root).startsWith(ROOT_PREFIX)) {
      throw new Error("Refusing to remove a directory outside the synthetic fixture root.");
    }
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(mode = "memory") {
  const root = mkdtempSync(join(tmpdir(), ROOT_PREFIX));
  roots.push(root);
  const env = {
    PME_RUNTIME_CREDENTIAL_STORE_MODE: mode,
    PME_RUNTIME_CREDENTIAL_STORE_PATH: join(root, mode === "sqlite" ? "credentials.sqlite" : "credentials.json"),
    PME_RUNTIME_CREDENTIAL_MASTER_KEY: Buffer.alloc(32, 0x34).toString("base64"),
  };
  const store = createRuntimeCredentialStore({ env }) as FixtureCredentialStore;
  let closed = false;
  const close = () => { if (!closed) { store.close(); closed = true; } };
  resources.push(close);
  store.set({ providerId: "bai", apiKey: PRIVATE_FIXTURE });
  store.set({ providerId: "openai", apiKey: "synthetic-other-provider" });
  const recordAudit = vi.fn(async (_event: Record<string, unknown>) => undefined);
  const application = {
    runtimeCredentialStore: store,
    providerRegistry: { get: (id: string) => ["bai", "openai"].includes(id) ? {} : undefined },
    enterpriseGovernanceService: { recordAudit },
  };
  return { root, env, store, application, recordAudit, close };
}

describe("clear one runtime Provider credential", () => {
  it.each(["memory", "local-file", "sqlite"])("isolates the operation and restart state in %s", async (mode) => {
    const f = fixture(mode);
    const result = await clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR);
    expect(result).toMatchObject({ providerId: "bai", removed: true, scope: "runtime-credential-store",
      inFlightRequestsCancelled: false, providerKeyRevoked: false,
      otherCredentialSourcesModified: false, otherProcessesInvalidated: false });
    expect(f.store.has("bai")).toBe(false);
    expect(f.store.getApiKey("openai")).toBe("synthetic-other-provider");
    expect((await clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR)).removed).toBe(false);
    expect(JSON.stringify([result, f.recordAudit.mock.calls])).not.toContain(PRIVATE_FIXTURE);
    f.close();
    const reopened = createRuntimeCredentialStore({ env: f.env });
    resources.push(() => reopened.close());
    expect(reopened.has("bai")).toBe(false);
    expect(reopened.has("openai")).toBe(mode !== "memory");
  });

  it.each([null, [], {}, { providerId: "../bai" }, { providerId: "BAI" },
    { providerId: "bai", apiKey: PRIVATE_FIXTURE }, { providerId: "bai", tenantId: "other" },
  ])("rejects malformed or secret-bearing inputs before storage/audit", async (body) => {
    const f = fixture();
    const clear = vi.spyOn(f.store, "clear");
    await expect(clearRuntimeProviderCredential(f.application, body, ACTOR)).rejects.toMatchObject({
      code: "provider_runtime_credential_clear_invalid_request", statusCode: 400,
    });
    expect(clear).not.toHaveBeenCalled();
    expect(f.recordAudit).not.toHaveBeenCalled();
  });

  it("allows orphan cleanup but does not echo an unknown provider value", async () => {
    const f = fixture();
    f.application.providerRegistry.get = () => undefined;
    expect((await clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR)).removed).toBe(true);
    await expect(clearRuntimeProviderCredential(f.application, { providerId: PRIVATE_FIXTURE }, ACTOR))
      .rejects.toMatchObject({ code: "provider_runtime_credential_clear_provider_unavailable", statusCode: 404 });
    expect(JSON.stringify(f.recordAudit.mock.calls)).not.toContain(PRIVATE_FIXTURE);
  });

  it("fails before mutation if its authorization audit cannot commit", async () => {
    const f = fixture();
    f.recordAudit.mockRejectedValueOnce(new Error(PRIVATE_FIXTURE));
    await expect(clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR)).rejects.toMatchObject({
      code: "provider_runtime_credential_clear_audit_unavailable", details: { operationStarted: false },
    });
    expect(f.store.has("bai")).toBe(true);
  });

  it("reports a committed clear separately from a failed result audit", async () => {
    const f = fixture();
    f.recordAudit.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error(PRIVATE_FIXTURE));
    await expect(clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR)).rejects.toMatchObject({
      code: "provider_runtime_credential_clear_result_audit_unconfirmed", retryable: false,
      details: { operationCommitted: true, removed: true, reconciliationRequired: true },
    });
    expect(f.store.has("bai")).toBe(false);
    expect(f.store.has("openai")).toBe(true);
  });

  it("does not claim success or lose the in-memory record after SQLite persistence fails", async () => {
    const f = fixture("sqlite");
    f.close();
    await expect(clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR)).rejects.toMatchObject({
      code: "provider_runtime_credential_clear_unconfirmed", retryable: false,
      details: { reconciliationRequired: true },
    });
    expect(f.store.has("bai")).toBe(true);
    const reopened = createRuntimeCredentialStore({ env: f.env });
    resources.push(() => reopened.close());
    expect(reopened.has("bai")).toBe(true);
    expect(reopened.has("openai")).toBe(true);
  });

  it("preserves both records when the encrypted-file commit is blocked", async () => {
    const f = fixture("local-file");
    const backup = join(f.root, "before-clear.json");
    renameSync(f.env.PME_RUNTIME_CREDENTIAL_STORE_PATH, backup);
    mkdirSync(f.env.PME_RUNTIME_CREDENTIAL_STORE_PATH);
    await expect(clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR)).rejects.toMatchObject({
      code: "provider_runtime_credential_clear_unconfirmed", details: { reconciliationRequired: true },
    });
    expect(f.store.has("bai")).toBe(true);
    expect(f.store.has("openai")).toBe(true);
    const previous = createRuntimeCredentialStore({ env: { ...f.env, PME_RUNTIME_CREDENTIAL_STORE_PATH: backup } });
    resources.push(() => previous.close());
    expect(previous.has("bai")).toBe(true);
    expect(previous.has("openai")).toBe(true);
  });

  it("keeps a captured request alive and applies configuration fallback only to later lookups", async () => {
    const f = fixture();
    let release!: () => void;
    let started!: () => void;
    let capturedSignal: AbortSignal | undefined;
    const dispatched = new Promise<void>((resolveStarted) => { started = resolveStarted; });
    const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
    const transport = vi.spyOn(connectionPool, "fetchWithAgent").mockImplementation(async (_url, options) => {
      const sent = options as { headers: { authorization: string }; signal: AbortSignal };
      expect(sent.headers.authorization).toBe(`Bearer ${PRIVATE_FIXTURE}`);
      capturedSignal = sent.signal;
      started();
      await held;
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "fixture complete" } }] }),
        { status: 200, headers: { "content-type": "application/json" } });
    });
    const model = { providerId: "bai", modelId: "fixture-model", providerType: "bai", enabled: true,
      endpoint: "https://provider.example.test/v1", apiKey: CONFIG_FIXTURE };
    const adapter = new HttpLLMProviderAdapter(model, { runtimeCredentialStore: f.store, maxRetries: 1,
      resolveOutboundUrl: async (url: string) => ({ url, lookup: () => { throw new Error("No DNS in fixture."); } }),
    });
    const pending = adapter.generate({ target: { providerId: "bai", modelId: "fixture-model" },
      request: { messages: [{ role: "user", content: "fixture" }], context: { requestId: "fixture" }, metadata: {} },
    });
    try {
      await Promise.race([dispatched, pending]);
      await clearRuntimeProviderCredential(f.application, { providerId: "bai" }, ACTOR);
      expect(capturedSignal?.aborted).toBe(false);
      expect(adapter.resolveApiKey()).toBe(CONFIG_FIXTURE);
      const unconfigured = new HttpLLMProviderAdapter({ ...model, apiKey: "" }, { runtimeCredentialStore: f.store });
      expect(unconfigured.resolveApiKey()).toBe("");
    } finally { release(); }
    expect((await pending).text).toBe("fixture complete");
    expect(transport).toHaveBeenCalledOnce();
    connectionPool.destroyAllPools();
  });
});

describe("credential clearing HTTP and SDK authorization", () => {
  it("preserves body-limit errors without clearing a credential or echoing the body", async () => {
    const f = fixture();
    const request = Object.assign(Readable.from([Buffer.from(JSON.stringify({ providerId: "bai", secret: PRIVATE_FIXTURE }))]),
      { method: "DELETE", headers: {}, maxBodyBytes: 16, enterpriseIdentity: ACTOR });
    const reply = vi.fn();
    await dispatchHttpRoutes04({ application: f.application, request, response: {},
      url: new URL("http://127.0.0.1/providers/runtime-credential"), startedAt: Date.now(),
      readJson, writeJson: reply, createErrorEnvelope, createOkEnvelope });
    expect(reply.mock.calls[0]?.[1]).toBe(413);
    expect(reply.mock.calls[0]?.[2].error).toMatchObject({ code: "request_payload_too_large", retryable: false });
    expect(JSON.stringify(reply.mock.calls)).not.toContain(PRIVATE_FIXTURE);
    expect(f.store.has("bai")).toBe(true);
    expect(f.recordAudit).not.toHaveBeenCalled();
  });

  it("refuses a 307 without forwarding DELETE or authorization to its target", async () => {
    const received: Array<{ method?: string; authorizationPresent: boolean }> = [];
    const server = createServer((request, response) => {
      request.resume();
      if (request.url === "/providers/runtime-credential") {
        response.writeHead(307, { location: "/redirect-target" });
      } else received.push({ method: request.method, authorizationPresent: Boolean(request.headers.authorization) });
      response.end(JSON.stringify({ data: { removed: true } }));
    });
    try {
      await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Redirect fixture did not listen.");
      const client = createGatewayClient({ baseUrl: `http://127.0.0.1:${address.port}`,
        headers: { authorization: "Bearer synthetic-redirect-token" } });
      const outcome = await client.clearRuntimeProviderCredential({ providerId: "bai" }).catch((error: unknown) => error);
      expect(received).toEqual([]);
      expect(outcome).toBeInstanceOf(Error);
      expect(outcome).toMatchObject({ retryable: false });
    } finally {
      await new Promise<void>((closed) => { server.close(() => closed()); server.closeAllConnections(); });
    }
  });

  it("uses platform RBAC, safe audits and the additive SDK DELETE path", async () => {
    const f = fixture();
    const token = "synthetic-platform-clear-token-at-least-32";
    const viewerToken = "synthetic-viewer-clear-token-at-least-32";
    const otherToken = "synthetic-other-clear-token-at-least-32";
    const env = { ...f.env, AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: ACTOR.userId,
      PME_AUTH_TENANT_ID: ACTOR.tenantId, PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: ACTOR.tenantId,
      PME_ENTERPRISE_USER_STORE_PATH: join(f.root, "users.json"), PME_API_KEY_STORE_PATH: join(f.root, "virtual-keys.json"),
      PME_AUDIT_LOG_PATH: join(f.root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(f.root, "audit-chain.jsonl"),
      AI_GATEWAY_USAGE_LOG_DIR: join(f.root, "usage"), WORKFORCE_PLAN_STORE_PATH: join(f.root, "plans.json"),
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(f.root, "clients.json"), KNOWLEDGE_STORAGE_MODE: "memory",
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
      PME_ENTERPRISE_USERS_JSON: JSON.stringify([
        { token: viewerToken, userId: "viewer", tenantId: "platform", role: "viewer" },
        { token: otherToken, userId: "other-admin", tenantId: "other", role: "admin" },
      ]),
    };
    const app = createGatewayApplication(env);
    const appStore = app.runtimeCredentialStore as FixtureCredentialStore;
    appStore.set({ providerId: "bai", apiKey: PRIVATE_FIXTURE });
    appStore.set({ providerId: "openai", apiKey: "synthetic-other-provider" });
    const server = createGatewayHttpServer(app);
    try {
      await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Fixture server did not listen.");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const request = (auth?: string, body: unknown = { providerId: "bai" }) => fetch(`${baseUrl}/providers/runtime-credential`, {
        method: "DELETE", headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
        body: JSON.stringify(body),
      });
      expect(resolvePermission("DELETE", "/providers/runtime-credential")).toBe("provider:write");
      expect((await request()).status).toBe(401);
      expect((await request(viewerToken)).status).toBe(403);
      const crossTenant = await request(otherToken);
      expect(crossTenant.status).toBe(403);
      expect((await crossTenant.json() as any).error.code).toBe("platform_tenant_mismatch");
      expect(app.runtimeCredentialStore.has("bai")).toBe(true);
      const malformed = await request(token, { providerId: "bai", apiKey: PRIVATE_FIXTURE });
      expect(malformed.status).toBe(400);
      expect(await malformed.text()).not.toContain(PRIVATE_FIXTURE);
      const client = createGatewayClient({ baseUrl, headers: { authorization: `Bearer ${token}` } });
      const result = await client.clearRuntimeProviderCredential({ providerId: "bai" });
      expect(result.data).toMatchObject({ providerId: "bai", removed: true, providerKeyRevoked: false });
      expect(app.runtimeCredentialStore.has("bai")).toBe(false);
      expect(app.runtimeCredentialStore.has("openai")).toBe(true);
      expect((await client.clearRuntimeProviderCredential({ providerId: "bai" })).data?.removed).toBe(false);
      expect(() => client.clearRuntimeProviderCredential({ providerId: "bai", apiKey: PRIVATE_FIXTURE } as any))
        .toThrow("exactly one canonical providerId");
      appStore.set({ providerId: "bai", apiKey: PRIVATE_FIXTURE });
      const originalAudit = app.enterpriseGovernanceService.recordAudit.bind(app.enterpriseGovernanceService);
      vi.spyOn(app.enterpriseGovernanceService, "recordAudit")
        .mockImplementation(async (event) => {
          if ((event as { code?: string } | undefined)?.code === "provider_runtime_credential_cleared") throw new Error(PRIVATE_FIXTURE);
          return originalAudit(event);
        });
      const auditFailure = await request(token);
      expect(auditFailure.status).toBe(503);
      const auditFailureText = await auditFailure.text();
      expect(auditFailureText).not.toContain(PRIVATE_FIXTURE);
      expect(JSON.parse(auditFailureText).error).toMatchObject({
        code: "provider_runtime_credential_clear_result_audit_unconfirmed", retryable: false,
        details: { operationCommitted: true, removed: true, reconciliationRequired: true },
      });
      expect(app.runtimeCredentialStore.has("bai")).toBe(false);
      const audit = readFileSync(env.PME_AUDIT_LOG_PATH, "utf8");
      expect(audit).toContain("provider_runtime_credential_cleared");
      expect(audit).not.toContain(PRIVATE_FIXTURE);
      expect(audit).not.toContain(token);
      expect(audit).not.toContain("synthetic-other-provider");
    } finally {
      await new Promise<void>((closed) => { server.close(() => closed()); server.closeAllConnections?.(); });
      await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
    }
  });
});
