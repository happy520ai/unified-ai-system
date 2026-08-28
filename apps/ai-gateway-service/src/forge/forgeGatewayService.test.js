import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { callLLMWithUsage } from "@unified-ai-system/forge-core";
import { createForgeGatewayService } from "./forgeGatewayService.js";
import { dispatchForgeRoutes } from "../http/forgeRoutes.js";

function createFakeGatewayService() {
  return {
    execute: vi.fn(async (input) => ({
      success: true,
      data: {
        message: { role: "assistant", content: `[polished] ${String(input.messages?.at(-1)?.content ?? "").slice(0, 80)}` },
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      },
      meta: { requestId: "forge-1" },
    })),
  };
}

function createService() {
  return createForgeGatewayService({ gatewayService: createFakeGatewayService(), env: {} });
}

describe("forgeGatewayService — 桥与惰性", () => {
  it("routes forge LLM calls through the gateway provider lane", async () => {
    const gatewayService = createFakeGatewayService();
    const forge = createForgeGatewayService({ gatewayService, env: {} });
    const result = await forge.polish({ content: "draft api design", task: { type: "design" } });
    // 至少一次 LLM 调用经过了网关 lane(fake provider)。
    expect(gatewayService.execute).toHaveBeenCalled();
    expect(String(gatewayService.execute.mock.calls[0][0].metadata.source)).toBe("forge-lane");
    expect(result.ok).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("constructs engines lazily and reports honest status", () => {
    const forge = createService();
    const statusBefore = forge.getStatus();
    expect(statusBefore.enabled).toBe(true);
    expect(statusBefore.lazyLoaded.memoryEngine).toBe(false);
    forge.memoryRemember({ content: "remember me" });
    expect(forge.getStatus().lazyLoaded.memoryEngine).toBe(true);
  });

  it("validates polish/quality/memory inputs honestly", async () => {
    const forge = createService();
    expect((await forge.polish({ content: "" })).code).toBe("FORGE_INPUT_INVALID");
    expect((await forge.quality({ code: "" })).code).toBe("FORGE_INPUT_INVALID");
    expect(forge.memoryRemember({ content: " " }).code).toBe("FORGE_INPUT_INVALID");
    expect(forge.memoryRecall({ query: "" }).code).toBe("FORGE_INPUT_INVALID");
  });

  it("quality gate evaluates code and returns a structured verdict", async () => {
    const forge = createService();
    const result = await forge.quality({ code: "export function add(a,b){return a+b}", task: { type: "util" } });
    expect(result.ok).toBe(true);
    expect(result.evaluation).toBeTruthy();
  });

  it("memory remember → recall round-trips through working and semantic layers", () => {
    const forge = createService();
    forge.memoryRemember({ content: "网关默认运行在 fake provider 模式", metadata: { topic: "gateway" } });
    forge.memoryRemember({ content: "虚拟 key 按日预算限流", metadata: { topic: "keys" } });
    const recall = forge.memoryRecall({ query: "fake provider 模式" });
    expect(recall.ok).toBe(true);
    const allText = JSON.stringify(recall);
    expect(allText.length).toBeGreaterThan(10);
    const stats = forge.memoryStats();
    expect(stats.ok).toBe(true);
  });

  it("isolates working and semantic memory by authenticated tenant", () => {
    const forge = createService();
    const tenantA = { tenantId: "tenant-a" };
    const tenantB = { tenantId: "tenant-b" };
    forge.memoryRemember({
      content: "tenant-a-confidential-marker",
      tenantIdentity: tenantA,
    });

    const tenantAResult = forge.memoryRecall({ query: "confidential marker", tenantIdentity: tenantA });
    const tenantBResult = forge.memoryRecall({ query: "confidential marker", tenantIdentity: tenantB });
    expect(JSON.stringify(tenantAResult)).toContain("tenant-a-confidential-marker");
    expect(JSON.stringify(tenantBResult)).not.toContain("tenant-a-confidential-marker");
    expect(forge.memoryStats({ tenantIdentity: tenantA }).working.operations.remembers).toBe(1);
    expect(forge.memoryStats({ tenantIdentity: tenantB }).working.operations.remembers).toBe(0);
  });

  it("can be disabled via FORGE_LANE_ENABLED=false", async () => {
    const forge = createForgeGatewayService({
      gatewayService: createFakeGatewayService(),
      env: { FORGE_LANE_ENABLED: "false" },
    });
    expect(forge.enabled()).toBe(false);
    expect((await forge.polish({ content: "x" })).code).toBe("FORGE_LANE_DISABLED");
  });

  it("orchestrate validates the goal and records runs", async () => {
    const forge = createService();
    const invalid = await forge.orchestrate({ goal: "" });
    expect(invalid.code).toBe("FORGE_INPUT_INVALID");
    const runs = forge.listRuns();
    expect(runs.ok).toBe(true);
    expect(Array.isArray(runs.runs)).toBe(true);
  });

  it("binds orchestrate LLM calls to the governed in-process gateway lane", async () => {
    const gatewayService = createFakeGatewayService();
    const close = vi.fn();
    const run = vi.fn(async () => callLLMWithUsage("system", "tenant task"));
    const forge = createForgeGatewayService({
      gatewayService,
      env: {},
      forgeFactory: () => ({ run, close }),
    });

    const result = await forge.orchestrate({
      goal: "prepare a governed plan",
      tenantIdentity: { tenantId: "tenant-a" },
    });

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(gatewayService.execute).toHaveBeenCalledOnce();
    expect(gatewayService.execute.mock.calls[0][0].metadata.forge.tenantId).toBe("tenant-a");
    expect(forge.listRuns({ tenantIdentity: { tenantId: "tenant-a" } }).runs).toHaveLength(1);
    expect(forge.listRuns({ tenantIdentity: { tenantId: "tenant-b" } }).runs).toHaveLength(0);
    expect(forge.getStatus({ tenantIdentity: { tenantId: "tenant-a" } }).activeRuns).toBe(1);
    expect(forge.getStatus({ tenantIdentity: { tenantId: "tenant-b" } }).activeRuns).toBe(0);
  });
});

describe("forgeRoutes dispatcher", () => {
  function createContext({ method = "POST", path, body, application, gatewayService } = {}) {
    const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
    request.method = method;
    const response = new EventEmitter();
    response.statusCode = null;
    response.headers = {};
    response.body = null;
    response.writableEnded = false;
    response.destroyed = false;
    response.headersSent = false;
    response.writeHead = (statusCode, headers = {}) => {
      response.statusCode = statusCode;
      response.headers = headers;
      response.headersSent = true;
    };
    response.write = () => true;
    response.end = (payload) => {
      if (payload !== undefined) {
        try { response.body = JSON.parse(String(payload)); } catch { response.body = payload; }
      }
      response.writableEnded = true;
    };
    const app = application ?? { runtimeEnv: {}, gatewayService: createFakeGatewayService() };
    return { application: app, request, response, startedAt: Date.now(), url: new URL(`http://127.0.0.1:4010${path}`), writeServiceLog: vi.fn(), gatewayService: gatewayService ?? app.gatewayService };
  }

  it("serves status and handles polish end to end", async () => {
    const statusContext = createContext({ method: "GET", path: "/forge/status" });
    await dispatchForgeRoutes(statusContext);
    expect(statusContext.response.statusCode).toBe(200);
    expect(statusContext.response.body.data.enabled).toBe(true);

    const polishContext = createContext({ path: "/forge/polish", body: { content: "smooth this out" } });
    await dispatchForgeRoutes(polishContext);
    expect(polishContext.response.statusCode).toBe(200);
  });

  it("uses each request-bound gateway without retaining the first request context", async () => {
    const rawGateway = createFakeGatewayService();
    const requestGatewayA = createFakeGatewayService();
    const requestGatewayB = createFakeGatewayService();
    const application = { runtimeEnv: {}, gatewayService: rawGateway };

    await dispatchForgeRoutes(createContext({
      path: "/forge/polish",
      body: { content: "request a" },
      application,
      gatewayService: requestGatewayA,
    }));
    await dispatchForgeRoutes(createContext({
      path: "/forge/polish",
      body: { content: "request b" },
      application,
      gatewayService: requestGatewayB,
    }));

    expect(requestGatewayA.execute).toHaveBeenCalled();
    expect(requestGatewayB.execute).toHaveBeenCalled();
    expect(rawGateway.execute).not.toHaveBeenCalled();
    expect(requestGatewayA.execute.mock.calls.flat().some((input) => JSON.stringify(input).includes("request b"))).toBe(false);
  });

  it("rejects invalid memory actions and unknown forge paths honestly", async () => {
    const badAction = createContext({ path: "/forge/memory", body: { action: "delete" } });
    await dispatchForgeRoutes(badAction);
    expect(badAction.response.statusCode).toBe(400);

    const unknown = createContext({ method: "GET", path: "/forge/nope" });
    await dispatchForgeRoutes(unknown);
    expect(unknown.response.statusCode).toBe(404);

    const wrongMethod = createContext({ method: "GET", path: "/forge/polish" });
    await dispatchForgeRoutes(wrongMethod);
    expect(wrongMethod.response.statusCode).toBe(405);
  });

  it("passes non-forge paths through untouched", async () => {
    const result = await dispatchForgeRoutes(createContext({ path: "/v1/chat/completions" }));
    expect(result).toBeTruthy(); // ROUTE_NOT_HANDLED symbol
  });
});

describe("vision routes (taiji compile + workforce preview)", () => {
  function ctx(method, path, body) {
    const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
    request.method = method;
    const response = new EventEmitter();
    response.statusCode = null; response.headers = {}; response.body = null;
    response.writableEnded = false; response.destroyed = false; response.headersSent = false;
    response.writeHead = (s, h = {}) => { response.statusCode = s; response.headers = h; response.headersSent = true; };
    response.write = () => true;
    response.end = (p) => { if (p !== undefined) { try { response.body = JSON.parse(String(p)); } catch { response.body = p; } } response.writableEnded = true; };
    return { application: { runtimeEnv: {}, gatewayService: createFakeGatewayService() }, request, response, startedAt: Date.now(), url: new URL(`http://127.0.0.1:4010${path}`), writeServiceLog: vi.fn() };
  }

  it("compiles a taiji capability spec with risk classification and manifest", async () => {
    const c = ctx("POST", "/taiji/compile", { capabilityId: "cap_report", displayName: "Report Generator", description: "生成内部报表,读取数据库" });
    await dispatchForgeRoutes(c);
    expect(c.response.statusCode).toBe(200);
    expect(c.response.body.data.spec.capabilityId).toBe("cap_report");
    expect(c.response.body.data.risk).toBeTruthy();
    expect(c.response.body.data.manifest).toBeTruthy();
  });

  it("runs the workforce dry-run preview for a task", async () => {
    const c = ctx("POST", "/workforce/preview", { task: "为网关写一份 UX 修复计划" });
    await dispatchForgeRoutes(c);
    expect(c.response.statusCode).toBe(200);
    expect(c.response.body.data.route).toBe("/workforce/preview");
    expect(c.response.body.data.preview).toBeTruthy();
  });
});
