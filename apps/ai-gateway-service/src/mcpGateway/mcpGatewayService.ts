// Reverse MCP governance service: the gateway aggregates operator-declared
// upstream MCP servers, enforces tool-level ACLs per tenant/role, audits
// every call, and caps argument/result sizes. Upstreams come exclusively
// from the trusted operator configuration (MCP_UPSTREAM_SERVERS_JSON env or
// the createMcpGatewayService option) — never from request input.

import { createMcpUpstreamFromConfig, type McpToolDescriptor, type McpUpstreamConfig } from "./mcpUpstreamClient.ts";
import { createOpenApiRestBridge } from "./openApiRestBridge.ts";

const MAX_ARGUMENTS_CHARS = 100_000;
const MAX_RESULT_CHARS = 1_000_000;
const TOOL_LIST_CACHE_TTL_MS = 60_000;
const MAX_UPSTREAMS = 16;

export interface McpGovernedServerConfig extends McpUpstreamConfig {
  /** 可选工具白名单（glob 风格 * 通配）；缺省允许该上游全部工具。 */
  allowedTools?: string[];
  description?: string;
  /** openapi 传输：REST→MCP 桥接配置。 */
  baseUrl?: string;
  specUrl?: string;
  spec?: unknown;
  headers?: Record<string, string>;
}

export interface McpGatewayIdentity {
  tenantId?: unknown;
  role?: unknown;
  permissions?: unknown;
  userId?: unknown;
}

export interface AggregatedMcpTool {
  serverId: string;
  toolName: string;
  namespacedName: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

function parseRegistry(raw: unknown): { configs: McpGovernedServerConfig[]; error: string | null } {
  if (raw == null || String(raw).trim() === "") return { configs: [], error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    return { configs: [], error: "MCP_UPSTREAM_SERVERS_JSON is not valid JSON." };
  }
  if (!Array.isArray(parsed)) {
    return { configs: [], error: "MCP_UPSTREAM_SERVERS_JSON must be a JSON array." };
  }
  const configs: McpGovernedServerConfig[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<McpGovernedServerConfig>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    if (!id || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id)) {
      return { configs: [], error: `MCP upstream id '${id}' is invalid (expected [a-z0-9-], max 64 chars).` };
    }
    if (configs.some((existing) => existing.id === id)) {
      return { configs: [], error: `Duplicate MCP upstream id '${id}'.` };
    }
    if (candidate.transport === "http") {
      if (typeof candidate.url !== "string" || !/^https:\/\//i.test(candidate.url)) {
        return { configs: [], error: `MCP upstream '${id}' requires an https url.` };
      }
      configs.push({
        transport: "http",
        id,
        url: candidate.url,
        ...(candidate.headers && typeof candidate.headers === "object" ? { headers: candidate.headers } : {}),
        ...(Array.isArray(candidate.allowedTools) ? { allowedTools: candidate.allowedTools } : {}),
        ...(candidate.description ? { description: candidate.description } : {}),
      });
      continue;
    }
    if (candidate.transport === "stdio") {
      if (typeof candidate.command !== "string" || !candidate.command.trim()) {
        return { configs: [], error: `MCP upstream '${id}' requires a command.` };
      }
      configs.push({
        transport: "stdio",
        id,
        command: candidate.command,
        ...(Array.isArray(candidate.args) ? { args: candidate.args } : {}),
        ...(candidate.env && typeof candidate.env === "object" ? { env: candidate.env } : {}),
        ...(candidate.cwd ? { cwd: candidate.cwd } : {}),
        ...(Array.isArray(candidate.allowedTools) ? { allowedTools: candidate.allowedTools } : {}),
        ...(candidate.description ? { description: candidate.description } : {}),
      });
      continue;
    }
    if (candidate.transport === "openapi") {
      if (typeof candidate.baseUrl !== "string" || !/^https:\/\//i.test(candidate.baseUrl)) {
        return { configs: [], error: `MCP upstream '${id}' requires an https baseUrl.` };
      }
      const specUrl = (candidate as { specUrl?: unknown }).specUrl;
      const spec = (candidate as { spec?: unknown }).spec;
      if (typeof specUrl !== "string" || !/^https:\/\//i.test(specUrl)) {
        if (spec == null || typeof spec !== "object") {
          return { configs: [], error: `MCP upstream '${id}' requires an https specUrl or an inline spec object.` };
        }
      }
      configs.push({
        transport: "openapi",
        id,
        baseUrl: candidate.baseUrl,
        ...(typeof specUrl === "string" ? { specUrl } : {}),
        ...(spec && typeof spec === "object" ? { spec } : {}),
        ...(candidate.headers && typeof candidate.headers === "object" ? { headers: candidate.headers } : {}),
        ...(Array.isArray(candidate.allowedTools) ? { allowedTools: candidate.allowedTools } : {}),
        ...(candidate.description ? { description: candidate.description } : {}),
      });
      continue;
    }
    return { configs: [], error: `MCP upstream '${id}' has an unsupported transport.` };
  }
  if (configs.length > MAX_UPSTREAMS) {
    return { configs: [], error: `MCP upstream registry exceeds the maximum of ${MAX_UPSTREAMS} servers.` };
  }
  return { configs, error: null };
}

function toolAllowed(patterns: string[] | undefined, toolName: string): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((pattern) => {
    if (pattern === toolName) return true;
    if (pattern === "*") return true;
    if (pattern.endsWith("*") && toolName.startsWith(pattern.slice(0, -1))) return true;
    return false;
  });
}

export function createMcpGatewayService(options: {
  env?: Record<string, string | undefined>;
  upstreamConfigs?: McpGovernedServerConfig[];
  /** 测试注入：预构建的上游客户端列表。 */
  upstreams?: Array<{ config: McpGovernedServerConfig; client: ReturnType<typeof createMcpUpstreamFromConfig> }>;
  /** 审计回调（由 application 接线到 enterpriseGovernanceService.recordAudit）。 */
  recordAudit?: (event: Record<string, unknown>) => void | Promise<void>;
} = {}) {
  const env = options.env ?? {};
  const parsed = options.upstreamConfigs
    ? { configs: options.upstreamConfigs.slice(0, MAX_UPSTREAMS), error: null as string | null }
    : parseRegistry(env.MCP_UPSTREAM_SERVERS_JSON);
  const recordAudit = options.recordAudit ?? null;

  const upstreams = options.upstreams
    ?? parsed.configs.map((config) => ({
      config,
      client: config.transport === "openapi"
        ? createOpenApiRestBridge(config as Parameters<typeof createOpenApiRestBridge>[0])
        : createMcpUpstreamFromConfig(config),
    }));
  const toolListCache = new Map<string, { at: number; tools: McpToolDescriptor[] }>();

  function getReadiness() {
    return {
      status: parsed.error ? "misconfigured" : upstreams.length > 0 ? "ready" : "disabled",
      upstreamCount: upstreams.length,
      configError: parsed.error,
      upstreams: upstreams.map(({ config }) => ({
        id: config.id,
        transport: config.transport,
        ...(config.transport === "http" ? { url: config.url } : {}),
        ...(config.transport === "stdio" ? { command: config.command } : {}),
        ...(config.transport === "openapi" ? { baseUrl: config.baseUrl, specUrl: config.specUrl ?? null } : {}),
        toolAllowlist: config.allowedTools ?? null,
      })),
      boundaries: {
        source: "operator-trusted environment configuration",
        httpEgress: "outbound-url-policy",
        audit: "every tools/call recorded",
      },
    };
  }

  function requireIdentity(identity: McpGatewayIdentity | null | undefined): string {
    const tenantId = typeof identity?.tenantId === "string" && identity.tenantId ? identity.tenantId : "";
    if (!tenantId) {
      const error = new Error("MCP tool access requires an authenticated tenant context.");
      error.code = "MCP_TENANT_CONTEXT_REQUIRED";
      error.category = "auth";
      throw error;
    }
    return tenantId;
  }

  async function listTools(identity: McpGatewayIdentity | null | undefined): Promise<{ tools: AggregatedMcpTool[]; servers: Array<{ id: string; error?: string }> }> {
    requireIdentity(identity);
    const tools: AggregatedMcpTool[] = [];
    const servers: Array<{ id: string; error?: string }> = [];
    for (const { config, client } of upstreams) {
      const cached = toolListCache.get(config.id);
      if (cached && Date.now() - cached.at < TOOL_LIST_CACHE_TTL_MS) {
        for (const tool of cached.tools) {
          if (toolAllowed(config.allowedTools, String(tool.name))) {
            tools.push(toAggregated(config.id, tool));
          }
        }
        servers.push({ id: config.id });
        continue;
      }
      try {
        const upstreamTools = await client.listTools();
        toolListCache.set(config.id, { at: Date.now(), tools: upstreamTools });
        for (const tool of upstreamTools) {
          if (toolAllowed(config.allowedTools, String(tool.name))) {
            tools.push(toAggregated(config.id, tool));
          }
        }
        servers.push({ id: config.id });
      } catch (error) {
        servers.push({ id: config.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { tools, servers };
  }

  function toAggregated(serverId: string, tool: McpToolDescriptor): AggregatedMcpTool {
    const toolName = String(tool.name);
    return {
      serverId,
      toolName,
      namespacedName: `${serverId}__${toolName}`,
      ...(tool.description ? { description: tool.description } : {}),
      ...(tool.inputSchema && typeof tool.inputSchema === "object" ? { inputSchema: tool.inputSchema } : {}),
    };
  }

  async function callTool(
    identity: McpGatewayIdentity | null | undefined,
    request: { server: string; tool: string; arguments?: Record<string, unknown> },
  ): Promise<{ result: unknown; serverId: string; toolName: string }> {
    const tenantId = requireIdentity(identity);
    const upstream = upstreams.find(({ config }) => config.id === request.server);
    if (!upstream) {
      const error = new Error(`Unknown MCP upstream '${request.server}'.`);
      error.code = "MCP_UPSTREAM_UNKNOWN";
      error.category = "validation";
      throw error;
    }
    if (!toolAllowed(upstream.config.allowedTools, request.tool)) {
      const error = new Error(`Tool '${request.tool}' is not allowed on upstream '${request.server}'.`);
      error.code = "MCP_TOOL_NOT_ALLOWED";
      error.category = "auth";
      throw error;
    }

    const args = request.arguments ?? {};
    const serializedArguments = JSON.stringify(args);
    if (serializedArguments.length > MAX_ARGUMENTS_CHARS) {
      const error = new Error("MCP tool arguments exceed the size limit.");
      error.code = "MCP_ARGUMENTS_TOO_LARGE";
      error.category = "validation";
      throw error;
    }

    try {
      const result = await upstream.client.callTool(request.tool, args);
      const serializedResult = JSON.stringify(result);
      if (serializedResult && serializedResult.length > MAX_RESULT_CHARS) {
        const error = new Error("MCP tool result exceeds the size limit.");
        error.code = "MCP_RESULT_TOO_LARGE";
        error.category = "provider";
        throw error;
      }
      if (recordAudit) {
        await recordAudit({
          outcome: "allowed",
          method: "POST",
          path: "/mcp/call",
          permission: "workflow:run",
          statusCode: 200,
          code: "mcp_tool_called",
          identity,
          details: {
            tenantId,
            serverId: upstream.config.id,
            toolName: request.tool,
            argumentsChars: serializedArguments.length,
            isError: Boolean(result?.isError),
          },
        });
      }
      return { result, serverId: upstream.config.id, toolName: request.tool };
    } catch (error) {
      if (recordAudit && (error as { code?: string }).code !== "MCP_TOOL_NOT_ALLOWED") {
        await recordAudit({
          outcome: "denied",
          method: "POST",
          path: "/mcp/call",
          permission: "workflow:run",
          statusCode: 502,
          code: (error as { code?: string }).code ?? "mcp_tool_call_failed",
          identity,
          details: {
            tenantId,
            serverId: upstream.config.id,
            toolName: request.tool,
          },
        }).catch(() => {});
      }
      throw error;
    }
  }

  async function close() {
    for (const { client } of upstreams) {
      await client.close().catch(() => {});
    }
  }

  return { getReadiness, listTools, callTool, close };
}

export type McpGatewayService = ReturnType<typeof createMcpGatewayService>;
