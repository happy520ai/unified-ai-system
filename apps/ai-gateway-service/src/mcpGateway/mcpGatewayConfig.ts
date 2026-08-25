import type { McpUpstreamConfig } from "./mcpUpstreamClient.ts";

export const MAX_MCP_UPSTREAMS = 16;

interface McpGovernancePolicy {
  /** Tool allowlist with exact or suffix-* matching; missing means deny all. */
  allowedTools?: string[];
  /** Operator-attested read-only tools. Every other allowed tool is fenced. */
  readOnlyTools?: string[];
  allowedTenants?: string[];
  allowedRoles?: string[];
  description?: string;
  baseUrl?: string;
  specUrl?: string;
  spec?: unknown;
  headers?: Record<string, string>;
}

interface McpOpenApiServerConfig {
  transport: "openapi";
  id: string;
  baseUrl: string;
  specUrl?: string;
  spec?: unknown;
  headers?: Record<string, string>;
}

export type McpGovernedServerConfig = (McpUpstreamConfig | McpOpenApiServerConfig) & McpGovernancePolicy;

export function parseMcpRegistry(raw: unknown): { configs: McpGovernedServerConfig[]; error: string | null } {
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
    const allowedTools = normalizePolicyList(candidate.allowedTools);
    const readOnlyTools = normalizePolicyList(candidate.readOnlyTools);
    const allowedTenants = normalizePolicyList(candidate.allowedTenants);
    const allowedRoles = normalizePolicyList(candidate.allowedRoles);
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
      configs.push(withPolicy({ transport: "http" as const, id, url: candidate.url }, candidate, {
        allowedTools, readOnlyTools, allowedTenants, allowedRoles,
      }));
      continue;
    }
    if (candidate.transport === "stdio") {
      if (typeof candidate.command !== "string" || !candidate.command.trim()) {
        return { configs: [], error: `MCP upstream '${id}' requires a command.` };
      }
      configs.push(withPolicy({
        transport: "stdio" as const,
        id,
        command: candidate.command,
        ...(Array.isArray(candidate.args) ? { args: candidate.args } : {}),
        ...(candidate.env && typeof candidate.env === "object" ? { env: candidate.env } : {}),
        ...(candidate.cwd ? { cwd: candidate.cwd } : {}),
      }, candidate, { allowedTools, readOnlyTools, allowedTenants, allowedRoles }));
      continue;
    }
    if (candidate.transport === "openapi") {
      if (typeof candidate.baseUrl !== "string" || !/^https:\/\//i.test(candidate.baseUrl)) {
        return { configs: [], error: `MCP upstream '${id}' requires an https baseUrl.` };
      }
      const specUrl = candidate.specUrl;
      const spec = candidate.spec;
      if ((typeof specUrl !== "string" || !/^https:\/\//i.test(specUrl)) && (spec == null || typeof spec !== "object")) {
        return { configs: [], error: `MCP upstream '${id}' requires an https specUrl or an inline spec object.` };
      }
      configs.push(withPolicy({
        transport: "openapi" as const,
        id,
        baseUrl: candidate.baseUrl,
        ...(typeof specUrl === "string" ? { specUrl } : {}),
        ...(spec && typeof spec === "object" ? { spec } : {}),
      }, candidate, { allowedTools, readOnlyTools, allowedTenants, allowedRoles }));
      continue;
    }
    return { configs: [], error: `MCP upstream '${id}' has an unsupported transport.` };
  }
  if (configs.length > MAX_MCP_UPSTREAMS) {
    return { configs: [], error: `MCP upstream registry exceeds the maximum of ${MAX_MCP_UPSTREAMS} servers.` };
  }
  return { configs, error: null };
}

export function toolAllowed(patterns: string[] | undefined, toolName: string): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((pattern) => pattern === toolName
    || pattern === "*"
    || (pattern.endsWith("*") && toolName.startsWith(pattern.slice(0, -1))));
}

function normalizePolicyList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = [...new Set(value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean))].slice(0, 128);
  return normalized.length > 0 ? normalized : undefined;
}

function withPolicy<T extends Record<string, unknown>>(
  base: T,
  candidate: Partial<McpGovernedServerConfig>,
  policy: {
    allowedTools?: string[];
    readOnlyTools?: string[];
    allowedTenants?: string[];
    allowedRoles?: string[];
  },
) {
  return {
    ...base,
    ...(candidate.headers && typeof candidate.headers === "object" ? { headers: candidate.headers } : {}),
    ...(policy.allowedTools ? { allowedTools: policy.allowedTools } : {}),
    ...(policy.readOnlyTools ? { readOnlyTools: policy.readOnlyTools } : {}),
    ...(policy.allowedTenants ? { allowedTenants: policy.allowedTenants } : {}),
    ...(policy.allowedRoles ? { allowedRoles: policy.allowedRoles } : {}),
    ...(candidate.description ? { description: candidate.description } : {}),
  } as T & McpGovernancePolicy;
}
