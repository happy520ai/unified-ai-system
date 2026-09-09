import { createHash } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
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

const restCleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const cleanup of restCleanups.splice(0).reverse()) await cleanup(); });
const REST_RESPONSE = { responses: { '200': { description: 'Fixture response' } } };
const restParameter = (name: string, location: string, extra = {}) => ({ name, in: location, schema: { type: 'string' }, ...extra });
const restDocument = (paths: Record<string, unknown>, extra = {}) => ({ openapi: '3.0.3', info: { title: 'Mapper fixture', version: '1.0.0' }, paths, ...extra });
const restGet = (parameters: unknown[]) => ({ get: { operationId: 'readWidget', parameters, ...REST_RESPONSE } });

async function restFixture(spec: unknown, options: { fetchSpec?: boolean; headers?: Record<string, string> } = {}) {
  const { fetchWithAgent } = await vi.importActual<typeof import('../http/connectionPool.js')>('../http/connectionPool.js');
  const seen: Array<{ url: string; headers: IncomingMessage['headers']; rawHeaders: string[]; body: string }> = [];
  const server = createServer(async (request, result) => {
    let body = ''; for await (const chunk of request) body += chunk.toString();
    seen.push({ url: request.url!, headers: request.headers, rawHeaders: request.rawHeaders, body });
    result.writeHead(200, { 'content-type': 'application/json' });
    result.end(request.url === '/openapi.json' ? JSON.stringify(spec) : '{"ok":true}');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  restCleanups.push(() => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing fixture address');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const bridge = createOpenApiRestBridge({ id: 'fixture', baseUrl,
    ...(options.fetchSpec ? { specUrl: baseUrl + '/openapi.json' } : { spec }), headers: { 'x-static': 'preserved', ...options.headers } }, {
    fetchImpl: async (url, init) => {
      const destination = new URL(url);
      if (destination.protocol !== "http:" || destination.hostname !== "127.0.0.1") throw new Error("Non-fixture egress rejected");
      const result = await fetchWithAgent(url, init);
      return { ok: result.ok, status: result.status, headers: result.headers as Record<string, string>, text: () => result.text() };
    },
  });
  restCleanups.push(() => bridge.close());
  return { bridge, seen };
}
async function restTool(spec: unknown) {
  return (await createOpenApiRestBridge({ id: 'fixture', baseUrl: 'http://127.0.0.1:1', spec }).listTools())[0];
}

describe('CORE010 actual OpenAPI mapper regressions', () => {
  it('retains the existing path/query/JSON body contract over a real loopback request', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets/{id}': { post: { operationId: 'writeWidget', ...REST_RESPONSE,
      parameters: [restParameter('id', 'path', { required: true }), restParameter('q', 'query')],
      requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { label: { type: 'string' } } } } } },
    } } }));
    await bridge.callTool('writeWidget', { id: 'a/b', query_q: 'two words', body: { label: 'fixture' } });
    expect(seen).toHaveLength(1); expect(seen[0].url).toBe('/widgets/a%2Fb?q=two+words');
    expect(seen[0].headers['x-static']).toBe('preserved'); expect(seen[0].body).toBe('{"label":"fixture"}');
  });

  it('sends an advertised custom header instead of silently dropping the argument', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': restGet([restParameter('X-View-Mode', 'header')]) }));
    expect((await bridge.listTools())[0].inputSchema?.properties).toHaveProperty('header_X-View-Mode');
    await bridge.callTool('readWidget', { 'header_X-View-Mode': 'compact' });
    expect(seen).toHaveLength(1); expect(seen[0].headers['x-view-mode']).toBe('compact');
    expect(seen[0].headers['x-static']).toBe('preserved');
  });

  it('sends an advertised cookie parameter in the Cookie header', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': restGet([restParameter('theme', 'cookie')]) }));
    expect((await bridge.listTools())[0].inputSchema?.properties).toHaveProperty('cookie_theme');
    await bridge.callTool('readWidget', { cookie_theme: 'dark' });
    expect(seen).toHaveLength(1); expect(seen[0].headers.cookie).toBe('theme=dark');
  });

  it('inherits path-item parameters and overrides the same name/location at operation scope', async () => {
    const selected = await restTool(restDocument({ '/widgets/{id}': { parameters: [restParameter('id', 'path', { required: true }), restParameter('mode', 'query')],
      get: { operationId: 'readWidget', parameters: [restParameter('mode', 'query', { required: true, schema: { type: 'string', enum: ['compact'] } })], ...REST_RESPONSE },
    } }));
    expect(selected.inputSchema).toMatchObject({ properties: { id: { type: 'string' }, query_mode: { type: 'string', enum: ['compact'] } }, required: ['id', 'query_mode'] });
  });

  it('resolves local Parameter and Schema references into self-contained tool input properties', async () => {
    const selected = await restTool(restDocument({ '/widgets': restGet([{ $ref: '#/components/parameters/Limit' }]) }, { components: {
      parameters: { Limit: { name: 'limit', in: 'query', required: true, schema: { $ref: '#/components/schemas/PageSize' } } },
      schemas: { PageSize: { type: 'integer', minimum: 1, maximum: 10 } },
    } }));
    expect(selected.inputSchema).toMatchObject({ properties: { query_limit: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['query_limit'] });
    expect(JSON.stringify(selected.inputSchema)).not.toContain('#/components/');
  });

  it('resolves a local JSON requestBody reference and its nested schema reference', async () => {
    const selected = await restTool(restDocument({ '/widgets': { post: { operationId: 'writeWidget', requestBody: { $ref: '#/components/requestBodies/CreateWidget' }, ...REST_RESPONSE } } }, { components: {
      requestBodies: { CreateWidget: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Widget' } } } } },
      schemas: { Widget: { type: 'object', properties: { label: { $ref: '#/components/schemas/Label' } } }, Label: { type: 'string' } },
    } }));
    expect(selected.inputSchema).toMatchObject({ properties: { body: { type: 'object', properties: { label: { type: 'string' } } } } });
    expect(JSON.stringify(selected.inputSchema)).not.toContain('#/components/');
  });

  it('resolves a local Path Item reference rather than silently omitting the operation', async () => {
    const selected = await restTool(restDocument({ '/widgets/{id}': { $ref: '#/x-path-items/Widget' } }, {
      'x-path-items': { Widget: restGet([restParameter('id', 'path', { required: true })]) },
    }));
    expect(selected).toMatchObject({ name: 'readWidget', inputSchema: { properties: { id: { type: 'string' } }, required: ['id'] } });
  });

  it('preserves required markers for query, custom header and cookie parameters', async () => {
    const selected = await restTool(restDocument({ '/widgets': restGet([restParameter('q', 'query', { required: true }), restParameter('X-View-Mode', 'header', { required: true }), restParameter('theme', 'cookie', { required: true })]) }));
    expect(selected.inputSchema?.required).toEqual(['query_q', 'header_X-View-Mode', 'cookie_theme']);
  });

  it.each(['query', 'header', 'cookie'])('rejects missing required %s values before any loopback HTTP request', async location => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': restGet([restParameter('mode', location, { required: true })]) }));
    const outcomes = await Promise.allSettled([{}, { [location + '_mode']: undefined }, { [location + '_mode']: null }]
      .map(args => bridge.callTool('readWidget', args)));
    expect(seen).toEqual([]);
    expect(outcomes.map(result => result.status)).toEqual(['rejected', 'rejected', 'rejected']);
  });

  it('rejects a missing required JSON body before any loopback HTTP request', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': { post: { operationId: 'writeWidget', ...REST_RESPONSE,
      requestBody: { required: true, content: { 'application/json': { schema: { nullable: true, type: 'object' } } } },
    } } }));
    const outcomes = await Promise.allSettled([{}, { body: undefined }].map(args => bridge.callTool('writeWidget', args)));
    expect(seen).toEqual([]); expect(outcomes.map(result => result.status)).toEqual(['rejected', 'rejected']);
  });

  it('preserves present false, zero and empty-string required parameter values', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': restGet([
      restParameter('mode', 'query', { required: true }), restParameter('count', 'header', { required: true }), restParameter('theme', 'cookie', { required: true }),
    ]) }));
    await bridge.callTool('readWidget', { query_mode: false, header_count: 0, cookie_theme: '' });
    expect(seen).toHaveLength(1); expect(seen[0].url).toBe('/widgets?mode=false');
    expect(seen[0].headers.count).toBe('0'); expect(seen[0].headers.cookie).toBe('theme=');
  });

  it('transmits the literal __proto__ custom header over loopback', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': restGet([restParameter('__proto__', 'header')]) }));
    await bridge.callTool('readWidget', { header___proto__: 'literal-value' });
    expect(seen).toHaveLength(1);
    const index = seen[0].rawHeaders.findIndex((value, position) => position % 2 === 0 && value.toLowerCase() === '__proto__');
    expect(index).toBeGreaterThanOrEqual(0); expect(seen[0].rawHeaders[index + 1]).toBe('literal-value');
  });

  it.each(['path', 'summary', 'schema property name'])('charges consumed %s strings against the inline expansion budget', async kind => {
    const oversized = 'x'.repeat(2_000_001);
    const operation = restGet(kind === 'schema property name' ? [restParameter('filter', 'query', {
      schema: { type: 'object', properties: { [oversized]: { type: 'string' } } },
    })] : []);
    const spec = restDocument({ [kind === 'path' ? '/' + oversized : '/widgets']:
      { get: { ...operation.get, ...(kind === 'summary' ? { summary: oversized } : {}) } } });
    const { bridge, seen } = await restFixture(spec);
    const outcome = await bridge.listTools().then(() => 'TOOL_PUBLISHED', error => error.code);
    expect(outcome).toBe('OPENAPI_INPUT_UNSUPPORTED'); expect(seen).toEqual([]);
  });

  it('does not expand unused response or operation example payloads', async () => {
    const oversized = 'x'.repeat(2_000_001);
    const selected = await restTool(restDocument({ '/widgets': { get: { operationId: 'readWidget',
      examples: { ignored: oversized }, responses: { '200': { content: { 'application/json': { example: oversized } } } },
    } } }));
    expect(selected.name).toBe('readWidget'); expect(selected.inputSchema?.properties).toEqual({});
  });

  it('ignores the OpenAPI-reserved Accept, Content-Type and Authorization header definitions', async () => {
    const selected = await restTool(restDocument({ '/widgets': restGet(['Accept', 'Content-Type', 'Authorization'].map(name => restParameter(name, 'header'))) }));
    expect(selected.inputSchema?.properties).toEqual({});
  });

  it('honors default form/explode serialization for a declared query array', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': restGet([restParameter('tag', 'query', { schema: { type: 'array', items: { type: 'string' } } })]) }));
    await bridge.callTool('readWidget', { query_tag: ['small', 'blue'] });
    expect(new URL(seen[0].url, 'http://127.0.0.1').searchParams.getAll('tag')).toEqual(['small', 'blue']);
  });

  it.each(['missing', 'cyclic', 'external'])('rejects an unsupported %s parameter reference before publishing a callable tool', async kind => {
    const spec = restDocument({ '/widgets': restGet([{ $ref: kind === 'external' ? 'https://outside.invalid/parameters.json#/Limit' : '#/components/parameters/Limit' }]) }, {
      components: { parameters: kind === 'cyclic' ? { Limit: { $ref: '#/components/parameters/Again' }, Again: { $ref: '#/components/parameters/Limit' } } : {} },
    });
    const fetchImpl = vi.fn(async () => { throw new Error('No HTTP is permitted while resolving a local reference'); });
    await expect(Promise.resolve().then(() => createOpenApiRestBridge({ id: 'fixture', baseUrl: 'http://127.0.0.1:1', spec }, { fetchImpl }).listTools())).rejects.toBeDefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('serializes flat simple/form values, cookie scalars and explicit explode settings over loopback', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets/{id}': restGet([
      restParameter('id', 'path', { required: true, schema: { type: 'array', items: { type: 'string' } } }),
      restParameter('filter', 'query', { schema: { type: 'object', properties: { size: { type: 'string' }, active: { type: 'boolean' } } } }),
      restParameter('tags', 'query', { explode: false, schema: { type: 'array', items: { type: 'string' } } }),
      restParameter('X-Fields', 'header', { explode: true, schema: { type: 'object', properties: { region: { type: 'string' } } } }),
      restParameter('theme', 'cookie'), restParameter('contrast', 'cookie'),
    ]) }));
    await bridge.callTool('readWidget', { id: ['a/b', 'c'], query_filter: { size: 'two words', active: false }, query_tags: ['a', 'b'],
      'header_X-Fields': { region: 'north zone' }, cookie_theme: 'dark mode', cookie_contrast: 'high' });
    expect(seen[0].url).toBe('/widgets/a%2Fb,c?size=two+words&active=false&tags=a%2Cb');
    expect(seen[0].headers['x-fields']).toBe('region=north%20zone');
    expect(seen[0].headers.cookie).toBe('theme=dark%20mode; contrast=high');
  });

  it('uses the same compilation for fetched specs, preserves literal examples and keeps cached bindings immutable', async () => {
    const spec = restDocument({ '/widgets': restGet([{ $ref: '#/x-params/limit~1per~0page' }]) }, {
      'x-params': { 'limit/per~page': restParameter('limit', 'query', { schema: { type: 'integer', example: { $ref: 'literal-data' } } }) },
    });
    const { bridge, seen } = await restFixture(spec, { fetchSpec: true });
    const tools = await bridge.listTools();
    expect(tools[0].inputSchema?.properties).toMatchObject({ query_limit: { type: 'integer', example: { $ref: 'literal-data' } } });
    tools.splice(0); expect((await bridge.listTools()).map(tool => tool.name)).toEqual(['readWidget']);
    await bridge.callTool('readWidget', { query_limit: 2 }); expect(seen.map(item => item.url)).toEqual(['/openapi.json', '/widgets?limit=2']);
  });

  it('retains required JSON bodies including null without changing configured JSON headers', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': { post: { operationId: 'writeWidget', ...REST_RESPONSE,
      requestBody: { required: true, content: { 'application/json': { schema: { nullable: true, type: 'object' } } } },
    } } }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    expect((await bridge.listTools())[0].inputSchema?.required).toEqual(['body']);
    await bridge.callTool('writeWidget', { body: null }); expect(seen[0].body).toBe('null');
    expect(seen[0].headers['content-type']).toBe('application/json; charset=utf-8');
  });

  it.each([
    { parameters: [restParameter('X-Mode', 'header')], headers: { 'x-mode': 'configured' } },
    { parameters: [restParameter('theme', 'cookie')], headers: { Cookie: 'fixed=fixture' } },
    { parameters: [restParameter('Host', 'header')] },
    { parameters: [restParameter('Content-Length', 'header')] },
    { parameters: [restParameter('Cookie', 'header')] },
    { parameters: [restParameter('x-mode', 'header'), restParameter('X-Mode', 'header')] },
    { parameters: [restParameter('filter', 'query', { style: 'deepObject', schema: { type: 'object' } })] },
    { parameters: [restParameter('filter', 'query', { schema: { type: 'array', items: { type: 'object' } } })] },
    { parameters: [restParameter('filter', 'query', { allowReserved: true })] },
    { parameters: [restParameter('theme', 'cookie', { schema: { type: 'array', items: { type: 'string' } } })] },
    { parameters: [restParameter('q', 'query', { content: { 'application/json': { schema: { type: 'object' } } } })] },
  ])('rejects unsupported or operator-header-conflicting bindings before listing (%j)', async entry => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets': restGet(entry.parameters) }), { headers: entry.headers as Record<string, string> | undefined });
    await expect(bridge.listTools()).rejects.toMatchObject({ code: 'OPENAPI_INPUT_UNSUPPORTED' }); expect(seen).toEqual([]);
  });

  it('refuses header injection, dot-segment path values, unknown arguments and exploded-query collisions before HTTP', async () => {
    const { bridge, seen } = await restFixture(restDocument({ '/widgets/{id}': restGet([restParameter('id', 'path', { required: true }),
      restParameter('X-Mode', 'header'), restParameter('mode', 'query'), restParameter('filter', 'query', { schema: { type: 'object' } }),
    ]) }));
    for (const args of [{ id: '1', 'header_X-Mode': 'x\r\ninjected: y' }, { id: '..' }, { id: '1', query_unknown: true },
      { id: '1', query_mode: 'first', query_filter: { mode: 'other' } }]) {
      await expect(bridge.callTool('readWidget', args)).rejects.toMatchObject({ code: 'OPENAPI_INPUT_UNSUPPORTED' });
    }
    expect(seen).toEqual([]);
  });

  it('refuses descriptor collisions, unsupported bodies and excessive local expansion without publishing a partial catalog', async () => {
    const cases = [
      restDocument({ '/widgets/{query_q}': restGet([restParameter('query_q', 'path', { required: true }), restParameter('q', 'query')]) }),
      restDocument({ '/a': restGet([]), '/b': restGet([]) }),
      restDocument({ '/widgets': { post: { operationId: 'writeWidget', requestBody: { content: { 'text/plain': { schema: { type: 'string' } } } } } } }),
      restDocument({ '/widgets': restGet([{ $ref: '#/components/parameters/Q' }]) }, { components: { parameters: { Q: { $ref: '#/components/parameters/Q' } } } }),
    ];
    let schema: any = { type: 'string' }; for (let index = 0; index < 40; index++) schema = { type: 'array', items: schema };
    cases.push(restDocument({ '/widgets': { post: { operationId: 'writeWidget', requestBody: { content: { 'application/json': { schema } } } } } }));
    cases.push(restDocument({ '/widgets': { post: { operationId: 'writeWidget', requestBody: { content: { 'application/json': { schema: { type: 'object',
      properties: Object.fromEntries(Array.from({ length: 12 }, (_, index) => ['p' + index, { $ref: '#/components/schemas/Large' }])) } } } } } } },
      { components: { schemas: { Large: { type: 'string', description: 'x'.repeat(200_000) } } } }));
    for (const spec of cases) await expect(restTool(spec)).rejects.toMatchObject({ code: 'OPENAPI_INPUT_UNSUPPORTED' });
    const badRegistry = createMcpGatewayService({ upstreamConfigs: [{ id: 'invalid', transport: 'openapi', baseUrl: 'https://example.invalid',
      spec: cases[0], allowedTools: ['*'], allowedTenants: ['tenant-a'] }] });
    expect((await badRegistry.listTools(TENANT)).tools).toEqual([]);
    expect((await badRegistry.listTools(TENANT)).servers[0].error).toContain('unsupported'); await badRegistry.close();
  });
});
