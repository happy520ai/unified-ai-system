// @test-isolation process
import { once } from "node:events";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { expect, it, vi } from "vitest";
import { resolveGovernedWebTaskRequest, createGovernedWebTaskExecution, readGovernedWebTaskReview } from "./governedWebTaskRuntime.ts";
import { meterGovernedToolResult } from "../agent-governance/governedRecordMeter.ts";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const launched = vi.hoisted(() => ({ browser: null as any }));
vi.mock("@unified-ai-system/web-agent", async original => {
  const actual = await original<any>();
  return { ...actual, launchBrowser: async (options: any) => { launched.browser = await actual.launchBrowser(options); return launched.browser; } };
});
const chromium = createRequire(import.meta.resolve("@unified-ai-system/web-agent"))("playwright").chromium;
const channel = existsSync(chromium.executablePath()) ? {} : { browserChannel: "chrome" };
async function listen(server: Server) { server.listen(0, "127.0.0.1"); await once(server, "listening"); return `http://127.0.0.1:${(server.address() as any).port}`; }
async function stop(server: Server) { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); }

async function sites(attack = "", wrongItem = false) {
  let blockedHits = 0, upgrades = 0;
  const denied = createServer((_request, response) => { blockedHits++; response.end("unexpected"); });
  denied.on("upgrade", (_request, socket) => { upgrades++; socket.destroy(); });
  const deniedOrigin = await listen(denied);
  const requests: string[] = [];
  const injections: Record<string, string> = {
    subresource: `<img src="${deniedOrigin}/image">`,
    popup: `<script>window.open('${deniedOrigin}/popup')</script>`,
    websocket: `<script>new WebSocket('${deniedOrigin.replace("http:", "ws:")}/socket')</script>`,
    userinfo: `<script>const link=document.createElement('a');link.id='search';link.href='http://127.0.0.1:80@${deniedOrigin.slice(7)}/image';link.textContent='Search';document.querySelector('#search').replaceWith(link)</script>`,
    serviceworker: `<script>navigator.serviceWorker.register('/worker.js').catch(()=>{})</script>`,
    "premature-query": `<script>fetch('/search?q=approved-item').catch(()=>{})</script>`,
  };
  const site = createServer((request, response) => {
    // Headless Chrome fetches /favicon.ico by itself on some platforms; it is
    // browser-automatic traffic, not page logic, so keep it out of the record.
    if (request.url !== "/favicon.ico") requests.push(request.url!);
    if (request.url === "/catalog" && attack === "redirect") { response.writeHead(302, { location: deniedOrigin + "/redirected" }); response.end(); return; }
    if (request.url === "/catalog") {
      response.setHeader("content-type", "text/html");
      response.end(`<input id="query"><button id="search" type="button">Search</button><div id="results"></div><div id="result"></div>
        <script>document.querySelector('#search').onclick=async()=>{ const q=document.querySelector('#query').value;
          await fetch('/search?q='+encodeURIComponent(q)); const button=document.createElement('button'); button.id='details'; button.textContent='Open details';
          button.onclick=async()=>{const data=await fetch('/detail?id='+encodeURIComponent(q)).then(r=>r.json()); const result=document.querySelector('#result');result.dataset.itemId=data.id;result.textContent=data.text;};
          document.querySelector('#results').replaceChildren(button); };</script>${injections[attack] ?? ""}`); return;
    }
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(request.url?.startsWith("/detail") ? { id: wrongItem ? "wrong-item" : "approved-item", text: "Approved details" } : { found: true }));
  });
  const origin = await listen(site);
  const profile = { id: "catalog", tenantId: "tenant-a", origin, startPath: "/catalog", searchPath: "/search", detailPath: "/detail",
    targets: { query: "query", search: "search", details: "details", result: "result" }, ...channel };
  return { profile, requests, deniedOrigin, deniedCounts: () => ({ blockedHits, upgrades }),
    async close() { await stop(site); await stop(denied); } };
}
function modelResponse(request: any) {
  const snapshot = JSON.parse(request.messages[1].content).snapshot;
  const index = request.metadata.fixtureIndex;
  const actions = [{ type: "fill", targetId: "query", value: "approved-item" }, { type: "click", targetId: "search" },
    { type: "click", targetId: "details" }, { type: "extractText", targetId: "result" }, { type: "done" }];
  const action = actions[index];
  if (action.targetId) expect(snapshot.records.some((row: any) => row.targetId === action.targetId)).toBe(true);
  return { success: true, data: { message: { content: JSON.stringify({ ...action, observationId: snapshot.observationId }) },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } } };
}
function runtime(profile: object, overrides: { deny?: string; maxRecords?: number; policyHash?: string; signal?: AbortSignal; maxTokens?: number;
  model?: (request: any, index: number, signal: AbortSignal) => Promise<any> } = {}) {
  let modelCalls = 0, released = 0;
  const calls: string[] = [], policy = { policyHash: "fixture-policy" } as any;
  const request = resolveGovernedWebTaskRequest({ AI_GATEWAY_FORGE_WEB_PROFILES_JSON: JSON.stringify([profile]) },
    { profileId: "catalog", itemId: "approved-item", expectedText: "Approved details" }, "tenant-a")!;
  const port = createGovernedWebTaskExecution({ request, context: { agentId: "agt_fixture", tenantId: "tenant-a", userId: "owner" },
    signal: overrides.signal, executionLease: { async assertActive() { overrides.signal?.throwIfAborted(); } }, policyHash: overrides.policyHash ?? policy.policyHash,
    maxTokens: overrides.maxTokens, toolProxy: {
      async enforce(input: any) { calls.push(input.toolName); return { outcome: input.toolName === overrides.deny ? "deny" : "allow", policy,
        executionLease: { release() { released++; } } }; },
      async enforceResult(input: any) { return meterGovernedToolResult({ result: input.result, descriptor: input.descriptor, maxRecords: overrides.maxRecords ?? 100 }); },
    } as any,
    gatewayService: { async execute(input: any, options: { signal: AbortSignal }) { const index = modelCalls++;
      expect(input.metadata.forge).toMatchObject({ agentId: "agt_fixture", taskId: "web-lookup", tenantId: "tenant-a" });
      return overrides.model ? overrides.model(input, index, options.signal) : modelResponse({ ...input, metadata: { ...input.metadata, fixtureIndex: index } }); } },
  });
  return { port, calls, counts: () => ({ modelCalls, released }), run: () => port.execute({ id: "web-lookup", goal_id: "goal_fixture", agent_role: "web" }) };
}

it("rejects invalid or cross-tenant profiles without accessing a browser", () => {
  const profile = { id: "catalog", tenantId: "tenant-a", origin: "http://127.0.0.1:23456", startPath: "/catalog", searchPath: "/search", detailPath: "/detail", targets: { query: "query", search: "search", details: "details", result: "result" } };
  const input = { profileId: "catalog", itemId: "approved-item", expectedText: "Approved details" };
  for (const origin of ["http://localhost:23456", "https://example.com", "http://127.0.0.1:23456/", "http://127.0.0.1:65536", "http://user@127.0.0.1:23456"]) {
    expect(() => resolveGovernedWebTaskRequest({ AI_GATEWAY_FORGE_WEB_PROFILES_JSON: JSON.stringify([{ ...profile, origin }]) }, input, "tenant-a")).toThrow();
  }
  const env = { AI_GATEWAY_FORGE_WEB_PROFILES_JSON: JSON.stringify([profile]) };
  expect(() => resolveGovernedWebTaskRequest(env, input, "tenant-b")).toThrow("FORGE_WEB_PROFILE_UNAVAILABLE");
  expect(() => resolveGovernedWebTaskRequest(env, { ...input, selector: "body" }, "tenant-a")).toThrow("FORGE_WEB_INPUT_INVALID");
  const request = resolveGovernedWebTaskRequest(env, input, "tenant-a")!;
  expect(Object.isFrozen(request.profile.targets)).toBe(true);
  expect(readGovernedWebTaskReview(request)).toEqual(request);
  expect(() => readGovernedWebTaskReview({ ...request, profile: { ...request.profile, timeoutMs: 60000 } })).toThrow("FORGE_WEB_REVIEW_INVALID");
  expect(() => readGovernedWebTaskReview({ ...request, profileHash: "0".repeat(64) })).toThrow("FORGE_WEB_REVIEW_INVALID");
});

it("runs real browser actions and independent DOM verification through every tool lease", async () => {
  const site = await sites();
  try {
    const fixture = runtime(site.profile), result = await fixture.run(), report = fixture.port.getResult();
    expect(result.success).toBe(true);
    expect(report).toMatchObject({ goalVerified: true, browserClosed: true, actionsCompleted: 4, outcomeUnknown: false,
      tokenUsage: { llmCalls: 5, totalTokens: 75 } });
    expect(report.records[0].text).toBe("Approved details");
    expect(site.requests).toEqual(["/catalog", "/search?q=approved-item", "/detail?id=approved-item"]);
    expect(fixture.calls).toContain("browser_navigate"); expect(fixture.calls.filter(name => name === "browser_interact")).toHaveLength(3);
    expect(fixture.counts()).toEqual({ modelCalls: 5, released: fixture.calls.length });
    expect(launched.browser.isConnected()).toBe(false);
    await expect(fixture.run()).rejects.toThrow("FORGE_WEB_CAPABILITY_INVALID");
  } finally { await site.close(); }
}, 20000);

it.each(["subresource", "redirect", "popup", "websocket", "userinfo"])("blocks %s before any request reaches the other local port", async attack => {
  const site = await sites(attack);
  try { const fixture = runtime(site.profile); expect((await fixture.run()).success).toBe(false);
    expect(site.deniedCounts()).toEqual({ blockedHits: 0, upgrades: 0 }); expect(launched.browser.isConnected()).toBe(false);
    if (attack === "userinfo") { expect(fixture.port.getResult().error).toBe("FORGE_WEB_TARGET_INVALID"); expect(fixture.port.getResult().actionsCompleted).toBe(1); }
  } finally { await site.close(); }
}, 15000);

it("service workers remain disabled even while an otherwise valid lookup completes", async () => {
  const site = await sites("serviceworker");
  try { const fixture = runtime(site.profile); expect((await fixture.run()).success).toBe(true);
    expect(site.requests.some(url => url.includes("worker"))).toBe(false); expect(site.deniedCounts()).toEqual({ blockedHits: 0, upgrades: 0 });
  } finally { await site.close(); }
}, 15000);

it("a page cannot issue an approved-looking query before its interaction is authorized", async () => {
  const site = await sites("premature-query");
  try { const fixture = runtime(site.profile); expect((await fixture.run()).success).toBe(false);
    expect(site.requests).toEqual(["/catalog"]); expect(launched.browser.isConnected()).toBe(false);
  } finally { await site.close(); }
}, 15000);

it("wrong item, absent tool authority, changed policy, record ceilings and token ceilings never succeed", async () => {
  const site = await sites("", true);
  try {
    for (const options of [{}, { deny: "browser_interact" }, { policyHash: "old-policy" }, { maxRecords: 1 }, { maxTokens: 1 }]) {
      const fixture = runtime(site.profile, options); expect((await fixture.run()).success).toBe(false);
      expect(launched.browser.isConnected()).toBe(false);
      if (options.policyHash || options.maxRecords || options.maxTokens) expect(fixture.counts().modelCalls).toBe(0);
      expect(fixture.port.getResult().records).toEqual([]);
    }
  } finally { await site.close(); }
}, 30000);

it.each(["replace", "hide", "duplicate", "change-type"])("%s DOM targets are rejected after the model wait and before interaction", async mutation => {
  const site = await sites();
  try {
    const fixture = runtime(site.profile, { model: async (input, index) => {
      await launched.browser.contexts()[0].pages()[0].evaluate((change: string) => {
        const old = document.querySelector("#query") as HTMLInputElement;
        if (change === "replace") old.replaceWith(old.cloneNode(true));
        else if (change === "hide") old.hidden = true;
        else if (change === "duplicate") old.after(old.cloneNode(true));
        else old.type = "password";
      }, mutation);
      return modelResponse({ ...input, metadata: { fixtureIndex: index } });
    } });
    expect((await fixture.run()).success).toBe(false); expect(fixture.port.getResult().error).toBe("FORGE_WEB_TARGET_CHANGED");
    expect(site.requests).toEqual(["/catalog"]); expect(fixture.port.getResult().actionsCompleted).toBe(0);
  } finally { await site.close(); }
}, 15000);

it("cancellation during the model wait drains the browser and prevents a late effect", async () => {
  const site = await sites(), controller = new AbortController(); let entered!: () => void, finish!: (value: unknown) => void;
  const reached = new Promise<void>(resolve => { entered = resolve; });
  try {
    const fixture = runtime(site.profile, { signal: controller.signal, model: async () => { entered(); return new Promise(resolve => { finish = resolve; }); } });
    const pending = fixture.run(); await reached; controller.abort(new Error("cancel-fixture"));
    expect((await pending).success).toBe(false); expect(launched.browser.isConnected()).toBe(false);
    finish({ success: true, data: { message: { content: "{}" } } });
    expect(site.requests).toEqual(["/catalog"]); expect(fixture.port.getResult().outcomeUnknown).toBe(true);
    expect(fixture.port.getResult().tokenUsage).toMatchObject({ llmCalls: 1, totalTokens: null });
  } finally { await site.close(); }
}, 15000);

it.each(["failure", "cancel"])("browser close %s prevents a late completed result", async scenario => {
  const site = await sites(), controller = new AbortController(); let closeSpy: any;
  try {
    const fixture = runtime(site.profile, { signal: controller.signal, model: async (input, index) => {
      if (index === 4) {
        const originalClose = launched.browser.close.bind(launched.browser);
        closeSpy = vi.spyOn(launched.browser, "close").mockImplementationOnce(async () => {
          if (scenario === "failure") throw new Error("injected-browser-close-failure");
          await originalClose(); controller.abort(new Error("cancel-during-close"));
        });
      }
      return modelResponse({ ...input, metadata: { fixtureIndex: index } });
    } });
    expect((await fixture.run()).success).toBe(false);
    const report = fixture.port.getResult();
    expect(report).toMatchObject({ goalVerified: false, outcomeUnknown: true, records: [], actionsCompleted: 4, networkRequests: 3 });
    expect(report.cleanupFailed).toBe(scenario === "failure");
    expect(report.browserClosed).toBe(scenario !== "failure");
  } finally {
    closeSpy?.mockRestore(); await launched.browser?.close();
    expect(launched.browser.isConnected()).toBe(false); await site.close();
  }
}, 15000);

it("executes actual HTTP approval, Forge DAG, Tool Proxy and scoped fake Provider through to the browser result", async () => {
  const temporaryRoot = await realpath(tmpdir()), root = await mkdtemp(join(temporaryRoot, "uai-web-http-"));
  const site = await sites(), identity = { tenantId: "tenant-a", userId: "owner", role: "admin", permissions: ["*"] };
  let server: any, app: any, providerCalls = 0, decisionMode = "valid", decisionIndex = 0;
  let modelReached!: () => void, heldSignal: AbortSignal | undefined;
  const heldModel = new Promise<void>(resolve => { modelReached = resolve; });
  const env: Record<string, string> = {
    NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: root, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "web-http-fixture-signing-0123456789",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: "web-http-fixture-owner", PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId,
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
    PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    PME_ENTERPRISE_USERS_JSON: JSON.stringify([{ token: "web-http-fixture-other", userId: "other", tenantId: "tenant-b", role: "admin" }]),
    AI_GATEWAY_FORGE_WEB_PROFILES_JSON: JSON.stringify([site.profile]),
  };
  try {
    app = createGatewayApplication(env);
    const service = app.agentGovernance.service;
    const tools = ["forge_orchestrate", "browser_navigate", "browser_observe", "browser_interact"];
    await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution",
      content: { capabilityCeiling: tools, toolRules: { ...Object.fromEntries(tools.map(tool => [tool, "allow"])), forge_orchestrate: "require_approval" },
        limits: { maxSteps: 50, maxToolCalls: 80, maxRuntimeSeconds: 120 },
        permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: true, canExecuteCode: false } } }, identity);
    await service.activatePolicyVersion("execution-family", 3, identity);
    const agent = await service.generateAgent({ name: "catalog-root", task: "Search an approved local catalog", requestedTools: tools,
      ttlSeconds: 3600, proposedTraits: ["write_capable", "external_communication", "subagent_creator"], proposedRiskLevel: "high" }, identity);
    const policy = await service.getEffectivePolicy(agent.agentId, identity.tenantId);
    expect(policy.toolDecisions.browser_interact).toBe("allow");
    const provider = app.providerRegistry.get("local-fake-provider"), originalGenerate = provider.generate.bind(provider);
    vi.spyOn(provider, "generate").mockImplementation(async (request: any) => {
      const base = await originalGenerate(request);
      providerCalls++; const index = decisionIndex++;
      if (decisionMode === "hold") {
        heldSignal = request.execution.signal;
        await new Promise<void>(resolve => {
          heldSignal!.addEventListener("abort", () => resolve(), { once: true }); modelReached();
          if (heldSignal!.aborted) resolve();
        });
      }
      const response = decisionMode === "valid" ? modelResponse({ ...request.request, metadata: { fixtureIndex: index } })
        : { data: { message: { content: "not JSON" }, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } } };
      return { ...base, text: response.data.message.content, message: { role: "assistant", content: response.data.message.content }, usage: response.data.usage };
    });
    server = createGatewayHttpServer(app);
    const base = await listen(server);
    async function send(path: string, payload: object, token = env.PME_AUTH_TOKEN) {
      const response = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
      return { status: response.status, payload: await response.json() as any };
    }
    const body = { agentId: agent.agentId, goal: "Search approved-item in the local catalog", options: {
      webTask: { profileId: "catalog", itemId: "approved-item", expectedText: "Approved details" } } };
    expect((await send("/forge/orchestrate", body, "")).status).toBe(401);
    expect((await send("/forge/orchestrate", body, "web-http-fixture-other")).status).toBe(403);
    const pending = await send("/forge/orchestrate", body);
    expect(pending.status, JSON.stringify(pending.payload)).toBe(202);
    expect(providerCalls).toBe(0); expect(site.requests).toEqual([]);
    const approved = await send("/v1/approvals/decide", { approvalId: pending.payload.data.approvalId, decision: "approve" });
    expect(approved.status, JSON.stringify(approved.payload)).toBe(200);
    env.AI_GATEWAY_FORGE_WEB_PROFILES_JSON = JSON.stringify([{ ...site.profile, maxSteps: 9 }]);
    const changed = await send("/forge/orchestrate", body);
    expect(changed.status).toBe(202); expect(changed.payload.data.approvalId).not.toBe(pending.payload.data.approvalId);
    expect(providerCalls).toBe(0); expect(site.requests).toEqual([]);
    env.AI_GATEWAY_FORGE_WEB_PROFILES_JSON = JSON.stringify([site.profile]);
    const result = await send("/forge/orchestrate", body);
    expect(result.status, JSON.stringify(result.payload)).toBe(200);
    expect(result.payload.data, JSON.stringify(result.payload)).toMatchObject({ ok: true, result: { status: "completed", completedTasks: 1, failedTasks: 0,
      web: { goalVerified: true, browserClosed: true, actionsCompleted: 4, agentId: agent.agentId } } });
    expect(result.payload.data.result.web.records[0].text).toBe("Approved details");
    expect(providerCalls).toBe(5);
    expect(site.requests).toEqual(["/catalog", "/search?q=approved-item", "/detail?id=approved-item"]);
    expect(launched.browser.isConnected()).toBe(false);
    const replay = await send("/forge/orchestrate", body);
    expect(replay.status).toBe(202); expect(providerCalls).toBe(5);
    expect((await send("/v1/approvals/decide", { approvalId: replay.payload.data.approvalId, decision: "approve" })).status).toBe(200);
    decisionMode = "invalid";
    const failed = await send("/forge/orchestrate", body);
    expect(failed.status, JSON.stringify(failed.payload)).toBe(503);
    expect(failed.payload.error).toMatchObject({ code: "FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN", retryable: false });
    expect(providerCalls).toBe(6); expect(site.requests).toEqual(["/catalog", "/search?q=approved-item", "/detail?id=approved-item", "/catalog"]);
    expect(launched.browser.isConnected()).toBe(false);
    decisionMode = "valid"; decisionIndex = 0;
    const wrongGoal = { ...body, options: { webTask: { ...body.options.webTask, expectedText: "Unmatched detail" } } };
    const wrongPending = await send("/forge/orchestrate", wrongGoal); expect(wrongPending.status).toBe(202);
    expect((await send("/v1/approvals/decide", { approvalId: wrongPending.payload.data.approvalId, decision: "approve" })).status).toBe(200);
    const wrongResult = await send("/forge/orchestrate", wrongGoal);
    expect(wrongResult.status, JSON.stringify(wrongResult.payload)).toBe(422);
    expect(wrongResult.payload.data).toMatchObject({ ok: false, code: "FORGE_WEB_GOAL_NOT_VERIFIED", web: { goalVerified: false, outcomeUnknown: false, browserClosed: true } });
    expect(providerCalls).toBe(11); expect(launched.browser.isConnected()).toBe(false);
    const revokePending = await send("/forge/orchestrate", body); expect(revokePending.status).toBe(202);
    expect((await send("/v1/approvals/decide", { approvalId: revokePending.payload.data.approvalId, decision: "approve" })).status).toBe(200);
    decisionMode = "hold";
    const inFlight = send("/forge/orchestrate", body);
    await heldModel;
    await service.revokeAgent(agent.agentId, { cascade: false, reason: "fixture-revocation" }, identity);
    const revokedResult = await inFlight;
    expect(revokedResult.status, JSON.stringify(revokedResult.payload)).toBe(503);
    expect(revokedResult.payload.error.code).toBe("FORGE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN");
    expect(heldSignal?.aborted).toBe(true); expect(providerCalls).toBe(12); expect(launched.browser.isConnected()).toBe(false);
    expect(site.requests).toHaveLength(8);
    expect((await send("/forge/orchestrate", body)).status).toBe(403); expect(providerCalls).toBe(12);
  } finally {
    if (server) { await stop(server); await server.shutdownResources(); }
    await site.close();
    expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(temporaryRoot); expect(basename(root).startsWith("uai-web-http-")).toBe(true);
    await rm(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  }
}, 30000);
