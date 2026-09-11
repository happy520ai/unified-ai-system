import { once } from "node:events";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { expect, it, vi } from "vitest";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
const remote = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("../security/safeOutboundFetch.ts", () => ({ safeOutboundFetch: remote.fetch }));
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";
import { createImConnectorRuntime } from "../connectors/imConnectorRuntime.ts";
import { createExternalEffectGate } from "../external-effects/externalEffectGate.ts";

function environment(root: string) {
  return {
    NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"), AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: "fixture-owner-token", PME_AUTH_USER_ID: "owner", PME_AUTH_TENANT_ID: "tenant-a",
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant-a", PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
    PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([{ token: "fixture-other-token", userId: "other", tenantId: "tenant-b", role: "admin" },
      { token: "fixture-client-token", userId: "limited", tenantId: "tenant-a", role: "local_client" }]),
    AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite", AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
    AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "fixture-effect-hmac".padEnd(64, "x"),
    FEISHU_CONNECTOR_MODE: "api", FEISHU_APP_ID: "fixture-app", FEISHU_APP_SECRET_REF: "env_key_name:IM_FIXTURE_SECRET",
    IM_FIXTURE_SECRET: "fixture-app-secret-private", FEISHU_API_TARGETS_JSON: JSON.stringify([{ tenantId: "tenant-a", receiveIdType: "chat_id", targetId: "oc_allowed" }]),
  };
}

it("uses the real HTTP application for API identity, target, durable key, unknown and restart boundaries", async () => {
  const temporaryRoot = await realpath(tmpdir()), root = await mkdtemp(join(temporaryRoot, "uai-im-http-"));
  const env = environment(root), calls: Array<{ url: string; body: any }> = [];
  let outcome = "accepted", server: any, application: any;
  let authReached: (() => void) | undefined, finishAuth: ((response: Response) => void) | undefined, authSignal: AbortSignal | undefined;
  remote.fetch.mockImplementation(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    if (url.includes("tenant_access_token")) {
      if (outcome === "abort-auth") {
        authSignal = init.signal as AbortSignal; authReached?.();
        return new Promise<Response>(resolve => { finishAuth = resolve; });
      }
      return Response.json({ code: 0, tenant_access_token: "fixture-access-token-private", expire: 3600 });
    }
    if (outcome === "unknown") return Response.json({ code: 0, data: {} });
    if (outcome === "rejected") return Response.json({ code: 77, msg: env.IM_FIXTURE_SECRET });
    return Response.json({ code: 0, data: { message_id: "om_actual_fixture" } });
  });
  async function start() {
    application = createGatewayApplication(env);
    server = createGatewayHttpServer(application);
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (!server) return;
    await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    await server.shutdownResources(); server = null;
  }
  try {
    let base = await start();
    const body = { body: "**approved content**", format: "markdown", targetId: "oc_allowed", receiveIdType: "chat_id" };
    async function send(payload: unknown, key?: string, token = "fixture-owner-token", additional = {}) {
      const response = await fetch(base + "/connectors/feishu/send", { method: "POST", headers: {
        "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(key ? { "external-effect-key": key } : {}), ...additional,
      }, body: JSON.stringify(payload) });
      return { status: response.status, payload: await response.json() as any };
    }
    expect((await send(body, "no-auth", "")).status).toBe(401);
    expect((await send(body, "limited", "fixture-client-token")).status).toBe(403);
    expect((await send(body, "cross-tenant", "fixture-other-token")).status).toBe(403);
    expect((await send({ ...body, targetId: "oc_unapproved" }, "unapproved")).status).toBe(403);
    for (const invalid of [{ receiveIdType: 12 }, { title: null }, { requiresResponse: {} }, { riskLevel: "arbitrary" }]) {
      expect((await send({ ...body, ...invalid }, "malformed")).status).toBe(400);
    }
    expect((await send(body)).status).toBe(400);
    expect((await send(body, "dual", "fixture-owner-token", { "idempotency-key": "dual" })).status).toBe(400);
    expect(calls).toHaveLength(0);
    const client = createGatewayClient({ baseUrl: base, headers: { authorization: "Bearer fixture-owner-token" } });
    const accepted = await client.sendConnectorMessage("feishu", { ...body, format: "markdown", receiveIdType: "chat_id" }, { externalEffectKey: "accepted-one" });
    expect(accepted).toMatchObject({ data: { status: "accepted", delivered: true, externalMessageId: "om_actual_fixture" } });
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[1].body.content).elements[0].content).toBe(body.body);
    expect((await send(body, "accepted-one")).payload.error.code).toBe("EXTERNAL_EFFECT_ALREADY_RESERVED");
    expect((await send({ ...body, body: "different" }, "accepted-one")).payload.error.code).toBe("EXTERNAL_EFFECT_KEY_REUSED");
    expect(calls).toHaveLength(2);
    outcome = "unknown";
    const unknown = await send(body, "unknown-one");
    expect(unknown).toMatchObject({ status: 502, payload: { error: { code: "IM_SEND_OUTCOME_UNKNOWN" } } });
    expect(calls).toHaveLength(3);
    outcome = "rejected";
    const rejected = await send(body, "rejected-one");
    expect(rejected).toMatchObject({ status: 200, payload: { data: { status: "rejected", delivered: false } } });
    expect(JSON.stringify(rejected)).not.toContain(env.IM_FIXTURE_SECRET);
    const health = await client.connectors();
    expect(JSON.stringify(health)).not.toMatch(/oc_allowed|fixture-app-secret-private|fixture-access-token-private/u);
    const priorCalls = calls.length;
    await stop(); base = await start();
    expect((await send(body, "unknown-one")).payload.error.code).toBe("EXTERNAL_EFFECT_ALREADY_RESERVED");
    expect(calls).toHaveLength(priorCalls);
    // The restarted application has no token cache: abort a real inbound HTTP
    // connection while authentication is pending and let the remote answer late.
    outcome = "abort-auth";
    const reached = new Promise<void>(resolve => { authReached = resolve; });
    const cancel = new AbortController();
    const interrupted = fetch(base + "/connectors/feishu/send", { method: "POST", signal: cancel.signal,
      headers: { authorization: "Bearer fixture-owner-token", "content-type": "application/json", "external-effect-key": "aborted-auth" },
      body: JSON.stringify(body) }).then(() => "unexpected-response", () => "aborted");
    await reached; cancel.abort();
    expect(await interrupted).toBe("aborted");
    await vi.waitFor(() => expect(authSignal?.aborted).toBe(true), { timeout: 1000 });
    finishAuth!(Response.json({ code: 0, tenant_access_token: "fixture-late-token", expire: 3600 }));
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    expect(calls).toHaveLength(priorCalls + 1);
    expect((await send(body, "aborted-auth")).payload.error.code).toBe("EXTERNAL_EFFECT_ALREADY_RESERVED");
    expect(calls).toHaveLength(priorCalls + 1);
    await stop();
    const stored = await readFile(join(root, "effects.sqlite"));
    expect(stored.includes(Buffer.from(env.IM_FIXTURE_SECRET))).toBe(false);
    expect(stored.includes(Buffer.from("fixture-access-token-private"))).toBe(false);
    expect(stored.includes(Buffer.from(body.body))).toBe(false);
  } finally {
    await stop(); remote.fetch.mockReset();
    const owned = relative(temporaryRoot, root);
    if (!owned.startsWith("uai-im-http-") || owned.startsWith("..") || isAbsolute(owned)) throw new Error("Unsafe IM fixture cleanup.");
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

it("refuses an API send with a disabled gate before credential materialization or transport", async () => {
  const env = environment("unused-owned-fixture"), gate = createExternalEffectGate({ enabled: false });
  let reads = 0;
  Object.defineProperty(env, "IM_FIXTURE_SECRET", { get() { reads++; return "fixture-secret"; } });
  const runtime = createImConnectorRuntime({ env, gate });
  try {
    await expect(runtime.send("feishu", { body: "x", targetId: "oc_allowed", receiveIdType: "chat_id" }, {
      headers: { "external-effect-key": "disabled-one" }, enterpriseIdentity: { tenantId: "tenant-a", userId: "owner" },
    } as any)).rejects.toMatchObject({ code: "EXTERNAL_EFFECT_STORE_UNAVAILABLE" });
    expect(reads).toBe(0); expect(remote.fetch).not.toHaveBeenCalled();
  } finally { await runtime.close(); await gate.close(); remote.fetch.mockReset(); }
});
