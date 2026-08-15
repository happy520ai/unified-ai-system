import { describe, expect, it, vi } from "vitest";
import {
  createMcpGatewayService,
  type McpGovernedServerConfig,
} from "./mcpGatewayService.ts";
import { createHttpMcpUpstream } from "./mcpUpstreamClient.ts";
import { createOpenApiRestBridge, operationToMcpTool, parseOpenApiOperations } from "./openApiRestBridge.ts";

vi.mock("../security/outboundUrlPolicy.ts", () => ({
  resolveSafeOutboundUrl: vi.fn(async (url: unknown) => ({ url: String(url), lookup: undefined })),
}));
vi.mock("../http/connectionPool.js", () => ({
  fetchWithAgent: vi.fn(),
}));

const TENANT = { tenantId: "tenant-a", role: "operator" };

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

function httpConfig(overrides: Partial<McpGovernedServerConfig> = {}): McpGovernedServerConfig {
  return { transport: "http", id: "weather", url: "https://mcp.example.com/mcp", ...overrides };
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
          { id: "weather", transport: "http", url: "https://mcp.example.com/mcp" },
          { id: "local", transport: "stdio", command: "node", args: ["server.js"] },
        ]),
      },
    });
    expect(service.getReadiness().status).toBe("ready");
    expect(service.getReadiness().upstreamCount).toBe(2);
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

    await expect(service.callTool(TENANT, { server: "weather", tool: "internal_admin" }))
      .rejects.toMatchObject({ code: "MCP_TOOL_NOT_ALLOWED" });
    await expect(service.callTool(TENANT, { server: "nope", tool: "get_forecast" }))
      .rejects.toMatchObject({ code: "MCP_UPSTREAM_UNKNOWN" });
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
        }]),
      },
      upstreams: [{
        config: { transport: "openapi" as never, id: "pets", baseUrl: "https://api.example.com", spec: openApiSpec, allowedTools: ["getPet"] },
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
        config: { transport: "openapi" as never, id: "pets", baseUrl: "https://api.example.com", spec: openApiSpec, allowedTools: ["getPet"] },
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
