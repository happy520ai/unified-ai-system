// Reverse MCP governance service: the gateway aggregates operator-declared
// upstream MCP servers, enforces tool-level ACLs per tenant/role, audits
// every call, and caps argument/result sizes. Upstreams come exclusively
// from the trusted operator configuration (MCP_UPSTREAM_SERVERS_JSON env or
// the createMcpGatewayService option) — never from request input.

import {
  createMcpUpstreamFromConfig,
  type McpCallResult,
  type McpToolDescriptor,
} from "./mcpUpstreamClient.ts";
import { createOpenApiRestBridge } from "./openApiRestBridge.ts";
import { resolvePlatformTenantId } from "../security/platformControlPlanePolicy.ts";
import type { ExternalEffectGate } from "../external-effects/externalEffectGate.ts";
import { reserveMcpExternalEffect } from "./mcpExternalEffectPolicy.ts";
import {
  MAX_MCP_UPSTREAMS,
  parseMcpRegistry,
  toolAllowed,
  type McpGovernedServerConfig,
} from "./mcpGatewayConfig.ts";

export type { McpGovernedServerConfig } from "./mcpGatewayConfig.ts";

const MAX_ARGUMENTS_CHARS = 100_000;
const MAX_RESULT_CHARS = 1_000_000;
const TOOL_LIST_CACHE_TTL_MS = 60_000;
interface McpGatewayClient {
  listTools(): Promise<McpToolDescriptor[]>;
  callTool(toolName: string, args: Record<string, unknown>): Promise<McpCallResult>;
  close(): void | Promise<void>;
}

interface GovernedUpstream {
  config: McpGovernedServerConfig;
  client: McpGatewayClient;
}

type McpGatewayError = Error & { code: string; category: string; statusCode?: number };

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
  readOnly: boolean;
  externalEffectRequired: boolean;
}

export function createMcpGatewayService(options: {
  env?: Record<string, string | undefined>;
  upstreamConfigs?: McpGovernedServerConfig[];
  /** 测试注入：预构建的上游客户端列表。 */
  upstreams?: GovernedUpstream[];
  /** 审计回调（由 application 接线到 enterpriseGovernanceService.recordAudit）。 */
  recordAudit?: (event: Record<string, unknown>) => void | Promise<void>;
  /** Durable attempt fence for every tool not explicitly operator-attested read-only. */
  externalEffectGate?: ExternalEffectGate;
} = {}) {
  const env = options.env ?? {};
  const platformTenantId = resolvePlatformTenantId(env);
  const parsed = options.upstreamConfigs
    ? { configs: options.upstreamConfigs.slice(0, MAX_MCP_UPSTREAMS), error: null as string | null }
    : parseMcpRegistry(env.MCP_UPSTREAM_SERVERS_JSON);
  const recordAudit = options.recordAudit ?? null;
  const externalEffectGate = options.externalEffectGate;

  const upstreams: GovernedUpstream[] = options.upstreams
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
        toolPolicy: config.allowedTools?.length ? "explicit-allowlist" : "deny-all",
        readOnlyPolicy: config.readOnlyTools?.length ? "explicit-allowlist" : "none",
        mutationPolicy: externalEffectGate?.status?.enabled === true
          ? "durable-external-effect-gate"
          : "fail-closed-gate-unavailable",
        tenantPolicy: config.allowedTenants?.length ? "explicit-allowlist" : "platform-tenant",
        rolePolicy: config.allowedRoles?.length ? "explicit-allowlist" : "route-rbac",
      })),
      boundaries: {
        source: "operator-trusted environment configuration",
        httpEgress: "outbound-url-policy",
        tools: "deny-by-default",
        tenants: "explicit allowlist or configured platform tenant",
        stdioEnvironment: "restricted inheritance plus explicit config",
        audit: "every tools/call recorded",
        externalEffects: "mutation-by-default; explicit operator read-only allowlist",
      },
      externalEffectGate: {
        enabled: externalEffectGate?.status?.enabled === true,
        mode: externalEffectGate?.status?.mode ?? "unavailable",
        distributed: externalEffectGate?.status?.distributed === true,
      },
    };
  }

  function requireIdentity(identity: McpGatewayIdentity | null | undefined): { tenantId: string; role: string } {
    const tenantId = typeof identity?.tenantId === "string" && identity.tenantId ? identity.tenantId : "";
    if (!tenantId) {
      throw createMcpGatewayError(
        "MCP_TENANT_CONTEXT_REQUIRED",
        "MCP tool access requires an authenticated tenant context.",
        "auth",
      );
    }
    const role = typeof identity?.role === "string" ? identity.role : "";
    return { tenantId, role };
  }

  async function rejectCall(
    error: McpGatewayError,
    identity: McpGatewayIdentity | null | undefined,
    details: Record<string, unknown>,
  ): Promise<never> {
    if (recordAudit) {
      await Promise.resolve(recordAudit({
        outcome: "denied",
        method: "POST",
        path: "/mcp/call",
        permission: "workflow:run",
        statusCode: normalizeStatusCode(error.statusCode, error.category === "auth" ? 403 : 400),
        code: error.code,
        identity,
        details,
      })).catch(() => {});
    }
    throw error;
  }

  function upstreamAllowed(config: McpGovernedServerConfig, identity: { tenantId: string; role: string }): boolean {
    const tenantAllowed = config.allowedTenants?.length
      ? config.allowedTenants.includes("*") || config.allowedTenants.includes(identity.tenantId)
      : identity.tenantId === platformTenantId;
    if (!tenantAllowed) return false;
    if (!config.allowedRoles?.length) return true;
    return config.allowedRoles.includes("*") || config.allowedRoles.includes(identity.role);
  }

  async function listTools(identity: McpGatewayIdentity | null | undefined): Promise<{ tools: AggregatedMcpTool[]; servers: Array<{ id: string; error?: string }> }> {
    const identityContext = requireIdentity(identity);
    const tools: AggregatedMcpTool[] = [];
    const servers: Array<{ id: string; error?: string }> = [];
    for (const { config, client } of upstreams) {
      if (!upstreamAllowed(config, identityContext)) continue;
      const cached = toolListCache.get(config.id);
      if (cached && Date.now() - cached.at < TOOL_LIST_CACHE_TTL_MS) {
        for (const tool of cached.tools) {
          if (toolAllowed(config.allowedTools, String(tool.name))) {
            tools.push(toAggregated(config, tool));
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
            tools.push(toAggregated(config, tool));
          }
        }
        servers.push({ id: config.id });
      } catch (error) {
        servers.push({ id: config.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { tools, servers };
  }

  function toAggregated(config: McpGovernedServerConfig, tool: McpToolDescriptor): AggregatedMcpTool {
    const toolName = String(tool.name);
    const readOnly = toolAllowed(config.readOnlyTools, toolName);
    return {
      serverId: config.id,
      toolName,
      namespacedName: `${config.id}__${toolName}`,
      readOnly,
      externalEffectRequired: !readOnly,
      ...(tool.description ? { description: tool.description } : {}),
      ...(tool.inputSchema && typeof tool.inputSchema === "object" ? { inputSchema: tool.inputSchema } : {}),
    };
  }

  async function callTool(
    identity: McpGatewayIdentity | null | undefined,
    request: {
      server: string;
      tool: string;
      arguments?: Record<string, unknown>;
      externalEffect?: { effectKeyHash?: unknown; effectKeyInvalid?: boolean };
    },
  ): Promise<{
    result: unknown;
    serverId: string;
    toolName: string;
    externalEffect: { required: boolean; reservationFingerprint: string | null };
  }> {
    const identityContext = requireIdentity(identity);
    const { tenantId } = identityContext;
    if (
      typeof request.server !== "string"
      || !/^[a-z0-9][a-z0-9-]{0,63}$/iu.test(request.server)
      || typeof request.tool !== "string"
      || !request.tool.trim()
      || request.tool.length > 256
      || /[\u0000-\u001f\u007f]/u.test(request.tool)
    ) {
      return rejectCall(createMcpGatewayError(
        "MCP_CALL_TARGET_INVALID",
        "MCP calls require a valid server id and a bounded tool name.",
        "validation",
        400,
      ), identity, {
        tenantId,
        serverProvided: typeof request.server === "string",
        toolProvided: typeof request.tool === "string",
      });
    }
    const upstream = upstreams.find(({ config }) => config.id === request.server);
    if (!upstream) {
      return rejectCall(createMcpGatewayError(
        "MCP_UPSTREAM_UNKNOWN",
        `Unknown MCP upstream '${request.server}'.`,
        "validation",
        400,
      ), identity, { tenantId, serverId: request.server, toolName: request.tool });
    }
    if (!upstreamAllowed(upstream.config, identityContext)) {
      const error = createMcpGatewayError(
        "MCP_UPSTREAM_NOT_ALLOWED",
        `MCP upstream '${request.server}' is not allowed for this identity.`,
        "auth",
      );
      return rejectCall(error, identity, {
        tenantId,
        serverId: upstream.config.id,
        toolName: request.tool,
      });
    }
    if (!toolAllowed(upstream.config.allowedTools, request.tool)) {
      return rejectCall(createMcpGatewayError(
        "MCP_TOOL_NOT_ALLOWED",
        `Tool '${request.tool}' is not allowed on upstream '${request.server}'.`,
        "auth",
        403,
      ), identity, { tenantId, serverId: upstream.config.id, toolName: request.tool });
    }

    const args = request.arguments ?? {};
    if (!args || typeof args !== "object" || Array.isArray(args)) {
      return rejectCall(createMcpGatewayError(
        "MCP_ARGUMENTS_INVALID",
        "MCP tool arguments must be a JSON object.",
        "validation",
        400,
      ), identity, { tenantId, serverId: upstream.config.id, toolName: request.tool });
    }
    let serializedArguments: string;
    try {
      serializedArguments = JSON.stringify(args);
    } catch {
      return rejectCall(createMcpGatewayError(
        "MCP_ARGUMENTS_INVALID",
        "MCP tool arguments must be JSON-serializable.",
        "validation",
        400,
      ), identity, { tenantId, serverId: upstream.config.id, toolName: request.tool });
    }
    if (serializedArguments.length > MAX_ARGUMENTS_CHARS) {
      return rejectCall(createMcpGatewayError(
        "MCP_ARGUMENTS_TOO_LARGE",
        "MCP tool arguments exceed the size limit.",
        "validation",
        400,
      ), identity, { tenantId, serverId: upstream.config.id, toolName: request.tool });
    }

    const externalEffectRequired = !toolAllowed(upstream.config.readOnlyTools, request.tool);
    let reservationFingerprint: string | null = null;
    try {
      if (externalEffectRequired) {
        reservationFingerprint = await reserveMcpExternalEffect({
          gate: externalEffectGate,
          config: upstream.config,
          tenantId,
          toolName: request.tool,
          args,
          keyContext: request.externalEffect,
        });
      }
      const result = await upstream.client.callTool(request.tool, args);
      const serializedResult = JSON.stringify(result);
      if (serializedResult && serializedResult.length > MAX_RESULT_CHARS) {
        throw createMcpGatewayError(
          "MCP_RESULT_TOO_LARGE",
          "MCP tool result exceeds the size limit.",
          "provider",
        );
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
            externalEffectRequired,
            reservationFingerprint,
          },
        });
      }
      return {
        result,
        serverId: upstream.config.id,
        toolName: request.tool,
        externalEffect: { required: externalEffectRequired, reservationFingerprint },
      };
    } catch (error) {
      if (recordAudit && (error as { code?: string }).code !== "MCP_TOOL_NOT_ALLOWED") {
        await Promise.resolve(recordAudit({
          outcome: "denied",
          method: "POST",
          path: "/mcp/call",
          permission: "workflow:run",
          statusCode: normalizeStatusCode((error as { statusCode?: unknown }).statusCode, 502),
          code: (error as { code?: string }).code ?? "mcp_tool_call_failed",
          identity,
          details: {
            tenantId,
            serverId: upstream.config.id,
            toolName: request.tool,
            externalEffectRequired,
          },
        })).catch(() => {});
      }
      throw error;
    }
  }

  async function close() {
    for (const { client } of upstreams) {
      await Promise.resolve(client.close()).catch(() => {});
    }
  }

  return { getReadiness, listTools, callTool, close };
}

export type McpGatewayService = ReturnType<typeof createMcpGatewayService>;

function createMcpGatewayError(
  code: string,
  message: string,
  category: string,
  statusCode?: number,
): McpGatewayError {
  const error = new Error(message) as McpGatewayError;
  error.code = code;
  error.category = category;
  if (statusCode !== undefined) error.statusCode = statusCode;
  return error;
}

function normalizeStatusCode(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599 ? parsed : fallback;
}
