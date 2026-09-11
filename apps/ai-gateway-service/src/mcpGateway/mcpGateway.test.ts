import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMcpGatewayService,
  type McpGovernedServerConfig,
} from "./mcpGatewayService.ts";
import { parseMcpRegistry } from "./mcpGatewayConfig.ts";
import { createHttpMcpUpstream, createStdioMcpUpstream } from "./mcpUpstreamClient.ts";
import { createOpenApiRestBridge, operationToMcpTool, parseOpenApiOperations } from "./openApiRestBridge.ts";
import { createExternalEffectGate } from "../external-effects/externalEffectGate.ts";

vi.mock("../security/outboundUrlPolicy.ts", () => ({
  resolveSafeOutboundUrl: vi.fn(async (url: unknown) => ({ url: String(url), lookup: undefined })),
}));
vi.mock("../http/connectionPool.js", () => ({
  fetchWithAgent: vi.fn(),
}));

const TENANT = { tenantId: "tenant-a", role: "operator" };
const temporaryDirectories: string[] = [];
type HttpGovernedConfig = Extract<McpGovernedServerConfig, { transport: "http" }>;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createFakeClient(tools: Array<{ name: string }>, calls: Array<{ name: string; arguments?: Record<string, unknown> }> = []) {
  return {
    id: "fake",
    transport: "http" as const,
    listTools: vi.fn(async () => tools),
    callTool: vi.fn(async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, arguments: args });
      return { content: [{ type: "text", text: `called ${name}` }] };
    }),
    close: vi.fn(async () => {}),
  };
}

function httpConfig(overrides: Partial<HttpGovernedConfig> = {}): HttpGovernedConfig {
  return {
    transport: "http",
    id: "weather",
    url: "https://mcp.example.com/mcp",
    allowedTools: ["get_forecast"],
    readOnlyTools: ["get_forecast"],
    allowedTenants: ["tenant-a"],
    ...overrides,
  };
}

describe("mcp gateway registry", () => {
  it("is disabled without configuration", () => {
    const service = createMcpGatewayService({ env: {} });
    expect(service.getReadiness().status).toBe("disabled");
    expect(service.getReadiness().upstreamCount).toBe(0);
  });

  it("rejects invalid registry JSON and non-https http upstreams", () => {
    expect(createMcpGatewayService({ env: { MCP_UPSTREAM_SERVERS_JSON: "{oops" } }).getReadiness().status).toBe("misconfigured");
    const insecure = createMcpGatewayService({
      env: { MCP_UPSTREAM_SERVERS_JSON: JSON.stringify([{ id: "x", transport: "http", url: "http://mcp.example.com" }]) },
    });
    expect(insecure.getReadiness().configError).toContain("https");
  });

  it("accepts a valid registry", () => {
    const service = createMcpGatewayService({
      env: {
        MCP_UPSTREAM_SERVERS_JSON: JSON.stringify([
          {
            id: "weather",
            transport: "http",
            url: "https://mcp.example.com/mcp",
            allowedTools: ["get_forecast"],
            readOnlyTools: ["get_forecast"],
          },
          { id: "local", transport: "stdio", command: "node", args: ["server.js"] },
        ]),
      },
    });
    expect(service.getReadiness().status).toBe("ready");
    expect(service.getReadiness().upstreamCount).toBe(2);
    expect(service.getReadiness().upstreams[0]).toMatchObject({
      toolPolicy: "explicit-allowlist",
      readOnlyPolicy: "explicit-allowlist",
    });
  });

  it("accepts only exact, non-sensitive approval review field declarations", () => {
    const valid = parseMcpRegistry(JSON.stringify([{
      id: "ops",
      transport: "http",
      url: "https://mcp.example.test/mcp",
      allowedTools: ["send_message"],
      approvalReviewFields: { send_message: ["channel", "recipient"] },
    }]));
    expect(valid.error).toBeNull();
    expect(valid.configs[0].approvalReviewFields).toEqual({
      send_message: ["channel", "recipient"],
    });

    for (const field of ["credential", "api_key", "Authorization", "sessionToken", "nested.value", "constructor"]) {
      const rejected = parseMcpRegistry(JSON.stringify([{
        id: "ops",
        transport: "http",
        url: "https://mcp.example.test/mcp",
        allowedTools: ["send_message"],
        approvalReviewFields: { send_message: [field] },
      }]));
      expect(rejected.error).toContain("unsafe field name");
      expect(rejected.configs).toEqual([]);
    }
  });
});

describe("mcp gateway governance", () => {
  it("aggregates tools with namespace prefixes and caches the listing", async () => {
    const client = createFakeClient([{ name: "get_forecast" }, { name: "internal_admin" }]);
    const service = createMcpGatewayService({
      upstreams: [{ config: { ...httpConfig({ allowedTools: ["get_*"] }) }, client }],
    });

    const result = await service.listTools(TENANT);
    expect(result.tools.map((tool) => tool.namespacedName)).toEqual(["weather__get_forecast"]);
    expect(result.tools[0]).toMatchObject({ readOnly: true, externalEffectRequired: false });
    expect(result.servers).toEqual([{ id: "weather" }]);

    // Second listing served from cache: upstream asked once.
    await service.listTools(TENANT);
    expect(client.listTools).toHaveBeenCalledTimes(1);
  });

  it("requires an authenticated tenant for listing and calls", async () => {
    const service = createMcpGatewayService({ upstreams: [] });
    await expect(service.listTools({})).rejects.toMatchObject({ code: "MCP_TENANT_CONTEXT_REQUIRED" });
    await expect(service.callTool(null, { server: "weather", tool: "get_forecast" }))
      .rejects.toMatchObject({ code: "MCP_TENANT_CONTEXT_REQUIRED" });
  });

  it("rejects malformed call targets and non-object arguments", async () => {
    const client = createFakeClient([{ name: "get_forecast" }]);
    const service = createMcpGatewayService({
      upstreams: [{ config: httpConfig(), client }],
    });
    await expect(service.callTool(TENANT, {
      server: "weather",
      tool: "bad\u0000tool",
    })).rejects.toMatchObject({ code: "MCP_CALL_TARGET_INVALID", statusCode: 400 });
    await expect(service.callTool(TENANT, {
      server: "weather",
      tool: "get_forecast",
      arguments: [] as never,
    })).rejects.toMatchObject({ code: "MCP_ARGUMENTS_INVALID", statusCode: 400 });
    expect(client.callTool).not.toHaveBeenCalled();
  });

  it("denies tools by default and isolates upstreams by tenant and role", async () => {
    const client = createFakeClient([{ name: "get_forecast" }]);
    const service = createMcpGatewayService({
      upstreams: [{
        config: httpConfig({ allowedTools: undefined, allowedRoles: ["operator"] }),
        client,
      }],
    });
    expect((await service.listTools(TENANT)).tools).toEqual([]);
    await expect(service.callTool(TENANT, { server: "weather", tool: "get_forecast" }))
      .rejects.toMatchObject({ code: "MCP_TOOL_NOT_ALLOWED" });
    await expect(service.callTool(
      { tenantId: "tenant-b", role: "operator" },
      { server: "weather", tool: "get_forecast" },
    )).rejects.toMatchObject({ code: "MCP_UPSTREAM_NOT_ALLOWED" });
    await expect(service.callTool(
      { tenantId: "tenant-a", role: "viewer" },
      { server: "weather", tool: "get_forecast" },
    )).rejects.toMatchObject({ code: "MCP_UPSTREAM_NOT_ALLOWED" });
  });

  it("enforces the tool allowlist on calls and audits allowed calls", async () => {
    const client = createFakeClient([{ name: "get_forecast" }]);
    const audit = vi.fn();
    const service = createMcpGatewayService({
      upstreams: [{ config: { ...httpConfig({ allowedTools: ["get_*"] }) }, client }],
      recordAudit: audit,
    });

    const result = await service.callTool(TENANT, {
      server: "weather",
      tool: "get_forecast",
      arguments: { city: "Oslo" },
    });
    expect(result.result).toMatchObject({ content: expect.any(Array) });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      code: "mcp_tool_called",
      details: expect.objectContaining({ serverId: "weather", toolName: "get_forecast", tenantId: "tenant-a" }),
    }));
    expect(JSON.stringify(audit.mock.calls)).not.toContain("Oslo");

    await expect(service.callTool(TENANT, { server: "weather", tool: "internal_admin" }))
      .rejects.toMatchObject({ code: "MCP_TOOL_NOT_ALLOWED" });
    await expect(service.callTool(TENANT, { server: "nope", tool: "get_forecast" }))
      .rejects.toMatchObject({ code: "MCP_UPSTREAM_UNKNOWN" });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "denied",
      code: "MCP_TOOL_NOT_ALLOWED",
      statusCode: 403,
    }));
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "denied",
      code: "MCP_UPSTREAM_UNKNOWN",
      statusCode: 400,
    }));
  });

  it("caps argument and result sizes", async () => {
    const hugeClient = {
      ...createFakeClient([{ name: "get_forecast" }]),
      callTool: vi.fn(async () => ({ content: [{ type: "text", text: "x".repeat(2_000_000) }] })),
    };
    const service = createMcpGatewayService({
      upstreams: [{ config: httpConfig(), client: hugeClient }],
    });

    await expect(service.callTool(TENANT, {
      server: "weather",
      tool: "get_forecast",
      arguments: { blob: "y".repeat(200_000) },
    })).rejects.toMatchObject({ code: "MCP_ARGUMENTS_TOO_LARGE" });

    await expect(service.callTool(TENANT, { server: "weather", tool: "get_forecast" }))
      .rejects.toMatchObject({ code: "MCP_RESULT_TOO_LARGE" });
  });

  it("fences every allowed tool not explicitly attested read-only", async () => {
    const unguardedClient = createFakeClient([{ name: "create_alert" }]);
    const mutationConfig = httpConfig({
      allowedTools: ["create_alert"],
      readOnlyTools: undefined,
    });
    const unguarded = createMcpGatewayService({
      upstreams: [{ config: mutationConfig, client: unguardedClient }],
    });
    expect(unguarded.getReadiness()).toMatchObject({
      upstreams: [{ mutationPolicy: "fail-closed-gate-unavailable" }],
      externalEffectGate: { enabled: false, mode: "unavailable" },
    });
    await expect(unguarded.callTool(TENANT, {
      server: "weather",
      tool: "create_alert",
      arguments: { severity: "high" },
      externalEffect: { effectKeyHash: digest("mcp-call-1") },
    })).rejects.toMatchObject({ code: "MCP_EXTERNAL_EFFECT_GATE_REQUIRED", statusCode: 503 });
    expect(unguardedClient.callTool).not.toHaveBeenCalled();

    const root = mkdtempSync(join(tmpdir(), "mcp-external-effect-"));
    temporaryDirectories.push(root);
    const gate = createExternalEffectGate({
      enabled: true,
      env: {
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "mcp-external-effect-test-secret".padEnd(64, "x"),
        AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS: "60000",
      },
    });
    const client = createFakeClient([{ name: "create_alert" }]);
    const audit = vi.fn();
    const service = createMcpGatewayService({
      upstreams: [{ config: mutationConfig, client }],
      externalEffectGate: gate,
      recordAudit: audit,
    });

    try {
      expect(service.getReadiness()).toMatchObject({
        upstreams: [{ mutationPolicy: "durable-external-effect-gate" }],
        externalEffectGate: { enabled: true, mode: "sqlite" },
      });
      const tools = await service.listTools(TENANT);
      expect(tools.tools[0]).toMatchObject({ readOnly: false, externalEffectRequired: true });
      await expect(service.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "high" },
      })).rejects.toMatchObject({ code: "EXTERNAL_EFFECT_KEY_REQUIRED", statusCode: 400 });
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({
        outcome: "denied",
        code: "EXTERNAL_EFFECT_KEY_REQUIRED",
        statusCode: 400,
      }));
      await expect(service.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "high" },
        externalEffect: { effectKeyInvalid: true },
      })).rejects.toMatchObject({ code: "EXTERNAL_EFFECT_KEY_INVALID", statusCode: 400 });
      expect(client.callTool).not.toHaveBeenCalled();

      const first = await service.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "high" },
        externalEffect: { effectKeyHash: digest("mcp-call-1") },
      });
      expect(first.externalEffect).toMatchObject({
        required: true,
        reservationFingerprint: expect.stringMatching(/^[a-f0-9]{16}$/u),
      });
      expect(client.callTool).toHaveBeenCalledOnce();

      await expect(service.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "high" },
        externalEffect: { effectKeyHash: digest("mcp-call-1") },
      })).rejects.toMatchObject({ code: "EXTERNAL_EFFECT_ALREADY_RESERVED", statusCode: 409 });
      await expect(service.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "critical" },
        externalEffect: { effectKeyHash: digest("mcp-call-1") },
      })).rejects.toMatchObject({ code: "EXTERNAL_EFFECT_KEY_REUSED", statusCode: 409 });
      expect(client.callTool).toHaveBeenCalledOnce();
      expect(JSON.stringify(audit.mock.calls)).not.toContain("critical");

      const uncertainClient = createFakeClient([{ name: "create_alert" }]);
      uncertainClient.callTool.mockRejectedValueOnce(new Error("connection closed after dispatch"));
      const uncertainService = createMcpGatewayService({
        upstreams: [{ config: mutationConfig, client: uncertainClient }],
        externalEffectGate: gate,
        recordAudit: audit,
      });
      await expect(uncertainService.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "medium" },
        externalEffect: { effectKeyHash: digest("mcp-call-uncertain") },
      })).rejects.toMatchObject({
        code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
        outcomeUnknown: true,
        retryable: false,
        reservationFingerprint: expect.stringMatching(/^[a-f0-9]{16}$/u),
        details: expect.objectContaining({ outcomeUnknown: true }),
      });
      expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({
        outcome: "unknown",
        code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
        details: expect.objectContaining({ outcomeUnknown: true }),
      }));

      const protocolErrorClient = createFakeClient([{ name: "create_alert" }]);
      protocolErrorClient.callTool.mockResolvedValueOnce({
        isError: true,
        content: [{ type: "text", text: "upstream reported an error" }],
      } as any);
      const protocolErrorService = createMcpGatewayService({
        upstreams: [{ config: mutationConfig, client: protocolErrorClient }],
        externalEffectGate: gate,
        recordAudit: audit,
      });
      await expect(protocolErrorService.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "low" },
        externalEffect: { effectKeyHash: digest("mcp-call-protocol-error") },
      })).rejects.toMatchObject({
        code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
        outcomeUnknown: true,
        retryable: false,
      });
      expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({
        outcome: "unknown",
        code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
      }));

      const malformedResultClient = createFakeClient([{ name: "create_alert" }]);
      malformedResultClient.callTool.mockResolvedValueOnce({
        isError: "true",
        content: [{ type: "text", text: "malformed error flag" }],
      } as any);
      const malformedResultService = createMcpGatewayService({
        upstreams: [{ config: mutationConfig, client: malformedResultClient }],
        externalEffectGate: gate,
        recordAudit: audit,
      });
      await expect(malformedResultService.callTool(TENANT, {
        server: "weather",
        tool: "create_alert",
        arguments: { severity: "malformed" },
        externalEffect: { effectKeyHash: digest("mcp-call-malformed-result") },
      })).rejects.toMatchObject({
        code: "MCP_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
        outcomeUnknown: true,
        retryable: false,
      });
    } finally {
      await gate.close();
    }
  });
});

describe("http mcp upstream client", () => {
  it("performs the initialize handshake, tracks the session, and parses SSE or JSON bodies", async () => {
    const requests: Array<{ url: string; init: Record<string, unknown> }> = [];
    const fetchImpl = vi.fn(async (url: string, init: Record<string, unknown>) => {
      requests.push({ url, init });
      const body = JSON.parse(String(init.body));
      if (body.method === "initialize") {
        return respond({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18", capabilities: {} } }, "sess-1");
      }
      if (body.method === "tools/list") {
        // SSE-framed response to exercise the event-stream parser.
        return respondSse(`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "get_forecast" }] } })}\n\n`);
      }
      return respond({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "ok" }] } });
    });

    const upstream = createHttpMcpUpstream(httpConfig() as never, { fetchImpl: fetchImpl as never });
    const tools = await upstream.listTools();
    expect(tools).toEqual([{ name: "get_forecast" }]);

    // 会话头必须在后续请求中回传。
    const toolsListRequest = requests.find((entry) => JSON.parse(String(entry.init.body)).method === "tools/list");
    expect(toolsListRequest?.init.headers).toMatchObject({ "mcp-session-id": "sess-1" });

    const call = await upstream.callTool("get_forecast", { city: "Oslo" });
    expect(call).toMatchObject({ content: [{ type: "text", text: "ok" }] });
    expect(requests[0].url).toBe("https://mcp.example.com/mcp");
  });

  it("maps non-OK responses to upstream error codes", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      headers: {},
      text: async () => "upstream down",
    }));
    const upstream = createHttpMcpUpstream(httpConfig() as never, { fetchImpl: fetchImpl as never });
    await expect(upstream.listTools()).rejects.toMatchObject({ code: "MCP_UPSTREAM_HTTP_503" });
  });

  it("propagates the caller AbortSignal into Streamable HTTP requests", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: Record<string, unknown>) => new Promise((_resolve, reject) => {
      const signal = init.signal as AbortSignal;
      const onAbort = () => reject(signal.reason);
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }));
    const upstream = createHttpMcpUpstream(httpConfig() as never, { fetchImpl: fetchImpl as never });
    const controller = new AbortController();
    const pending = upstream.callTool("get_forecast", { city: "Oslo" }, { signal: controller.signal });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    controller.abort(Object.assign(new Error("client disconnected"), { code: "CLIENT_DISCONNECTED" }));

    await expect(pending).rejects.toMatchObject({ code: "CLIENT_DISCONNECTED" });
  });
});

describe("stdio mcp upstream client cancellation", () => {
  it("rejects a pre-aborted call before spawning the configured command", async () => {
    const upstream = createStdioMcpUpstream({
      transport: "stdio",
      id: "never-spawn",
      command: "this-command-must-never-run",
    });
    const controller = new AbortController();
    controller.abort(Object.assign(new Error("client disconnected"), { code: "CLIENT_DISCONNECTED" }));

    await expect(upstream.callTool("create_ticket", {}, { signal: controller.signal }))
      .rejects.toMatchObject({ code: "CLIENT_DISCONNECTED" });
    await upstream.close();
  });
});

const openApiSpec = {
  openapi: "3.0.0",
  paths: {
    "/pets/{petId}": {
      get: {
        operationId: "getPet",
        summary: "Get a pet by id",
        parameters: [{ name: "petId", in: "path", required: true, schema: { type: "string" } }],
      },
    },
    "/pets": {
      post: {
        operationId: "createPet",
        parameters: [{ name: "verbose", in: "query", schema: { type: "boolean" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } } },
      },
    },
  },
};

describe("openapi rest bridge", () => {
  it("generates MCP tools from an OpenAPI spec", () => {
    const operations = parseOpenApiOperations(openApiSpec);
    expect(operations.map((operation) => operation.operationId)).toEqual(["getPet", "createPet"]);
    const getPet = operationToMcpTool(operations[0]);
    expect(getPet.name).toBe("getPet");
    expect(getPet.inputSchema).toMatchObject({
      type: "object",
      properties: { petId: { type: "string" } },
      required: ["petId"],
    });
  });

  it("executes generated tools as REST calls with path, query, and body mapping", async () => {
    const calls: Array<{ url: string; init: Record<string, unknown> }> = [];
    const fetchImpl = vi.fn(async (url: string, init: Record<string, unknown>) => {
      calls.push({ url: String(url), init });
      return { ok: true, status: 200, headers: {}, text: async () => '{"name":"Rex"}' };
    });
    const bridge = createOpenApiRestBridge({
      id: "pets",
      baseUrl: "https://api.example.com",
      spec: openApiSpec,
    }, { fetchImpl: fetchImpl as never });

    const tools = await bridge.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["getPet", "createPet"]);

    const getResult = await bridge.callTool("getPet", { petId: "42" });
    expect(getResult).toMatchObject({ isError: false, httpStatus: 200 });
    expect(calls[0].url).toBe("https://api.example.com/pets/42");
    expect(calls[0].init.method).toBe("GET");

    await bridge.callTool("createPet", { query_verbose: "true", body: { name: "Rex" } });
    expect(calls[1].url).toBe("https://api.example.com/pets?verbose=true");
    expect(calls[1].init.method).toBe("POST");
    expect(calls[1].init.body).toBe(JSON.stringify({ name: "Rex" }));
  });

  it("rejects oversized REST bridge responses instead of truncating them", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {},
      text: async () => "x".repeat(1_000_001),
    }));
    const bridge = createOpenApiRestBridge({
      id: "pets",
      baseUrl: "https://api.example.com",
      spec: openApiSpec,
    }, { fetchImpl: fetchImpl as never });
    await expect(bridge.callTool("getPet", { petId: "42" }))
      .rejects.toMatchObject({ code: "OPENAPI_RESPONSE_TOO_LARGE" });
  });

  it("propagates the caller AbortSignal into generated REST calls", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: Record<string, unknown>) => new Promise((_resolve, reject) => {
      const signal = init.signal as AbortSignal;
      const onAbort = () => reject(signal.reason);
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }));
    const bridge = createOpenApiRestBridge({
      id: "pets",
      baseUrl: "https://api.example.com",
      spec: openApiSpec,
    }, { fetchImpl: fetchImpl as never });
    const controller = new AbortController();
    const pending = bridge.callTool("createPet", { body: { name: "Rex" } }, { signal: controller.signal });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());
    controller.abort(Object.assign(new Error("gateway deadline"), { code: "GATEWAY_DEADLINE_EXCEEDED" }));

    await expect(pending).rejects.toMatchObject({ code: "GATEWAY_DEADLINE_EXCEEDED" });
  });

  it("registers openapi upstreams through the governed registry", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, headers: {}, text: async () => '{"name":"Rex"}' }));
    const service = createMcpGatewayService({
      env: {
        MCP_UPSTREAM_SERVERS_JSON: JSON.stringify([{
          id: "pets",
          transport: "openapi",
          baseUrl: "https://api.example.com",
           spec: openApiSpec,
           allowedTools: ["getPet"],
           readOnlyTools: ["getPet"],
        }]),
      },
      upstreams: [{
        config: { transport: "openapi" as never, id: "pets", baseUrl: "https://api.example.com", spec: openApiSpec, allowedTools: ["getPet"], readOnlyTools: ["getPet"], allowedTenants: ["tenant-a"] },
        client: createOpenApiRestBridge({ id: "pets", baseUrl: "https://api.example.com", spec: openApiSpec }, { fetchImpl: fetchImpl as never }),
      }],
    });

    const readiness = service.getReadiness();
    expect(readiness.status).toBe("ready");
    expect(readiness.upstreams[0]).toMatchObject({ id: "pets", transport: "openapi" });

    const tools = await service.listTools(TENANT);
    expect(tools.tools.map((tool) => tool.namespacedName)).toEqual(["pets__getPet"]);

    const audit = vi.fn();
    // 直接走服务 ACL 与审计路径验证一次真实调用。
    const governed = createMcpGatewayService({
      upstreams: [{
        config: { transport: "openapi" as never, id: "pets", baseUrl: "https://api.example.com", spec: openApiSpec, allowedTools: ["getPet"], readOnlyTools: ["getPet"], allowedTenants: ["tenant-a"] },
        client: createOpenApiRestBridge({ id: "pets", baseUrl: "https://api.example.com", spec: openApiSpec }, { fetchImpl: fetchImpl as never }),
      }],
      recordAudit: audit,
    });
    const result = await governed.callTool(TENANT, { server: "pets", tool: "getPet", arguments: { petId: "7" } });
    expect(result.result).toMatchObject({ isError: false });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ code: "mcp_tool_called" }));
  });
});

function respond(payload: Record<string, unknown>, sessionId?: string) {
  return {
    ok: true,
    status: 200,
    headers: sessionId ? { "mcp-session-id": sessionId } : {},
    text: async () => JSON.stringify(payload),
  };
}

function respondSse(body: string) {
  return { ok: true, status: 200, headers: {}, text: async () => body };
}
