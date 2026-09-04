import type { McpUpstreamConfig } from "./mcpUpstreamClient.ts";

export const MAX_MCP_UPSTREAMS = 16;

interface McpGovernancePolicy {
  /** Tool allowlist with exact or suffix-* matching; missing means deny all. */
  allowedTools?: string[];
  /** Operator-attested read-only tools. Every other allowed tool is fenced. */
  readOnlyTools?: string[];
  allowedTenants?: string[];
  allowedRoles?: string[];
  /** Operator-declared, per-tool top-level scalar fields safe to show in approval review. */
  approvalReviewFields?: Record<string, string[]>;
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
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const allowedTools = normalizePolicyList(candidate.allowedTools);
    const readOnlyTools = normalizePolicyList(candidate.readOnlyTools);
    const allowedTenants = normalizePolicyList(candidate.allowedTenants);
    const allowedRoles = normalizePolicyList(candidate.allowedRoles);
    const approvalReviewFields = normalizeApprovalReviewFields(candidate.approvalReviewFields);
    if (approvalReviewFields.error) {
      return { configs: [], error: `MCP upstream '${id || "<invalid>"}' ${approvalReviewFields.error}` };
    }
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
        allowedTools, readOnlyTools, allowedTenants, allowedRoles, approvalReviewFields: approvalReviewFields.value,
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
      }, candidate, {
        allowedTools, readOnlyTools, allowedTenants, allowedRoles, approvalReviewFields: approvalReviewFields.value,
      }));
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
      }, candidate, {
        allowedTools, readOnlyTools, allowedTenants, allowedRoles, approvalReviewFields: approvalReviewFields.value,
      }));
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

const SAFE_REVIEW_FIELD = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/u;
const FORBIDDEN_REVIEW_FIELD = /secret|token|password|authorization|credential|key|cookie|session|bearer/iu;
const FORBIDDEN_OBJECT_FIELD = new Set(["__proto__", "prototype", "constructor"]);

function normalizeApprovalReviewFields(value: unknown): {
  value?: Record<string, string[]>;
  error?: string;
} {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "approvalReviewFields must be an object keyed by exact tool name." };
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 128) return { error: "approvalReviewFields exceeds 128 tools." };
  const normalized: Record<string, string[]> = Object.create(null);
  for (const [toolName, fields] of entries) {
    if (!toolName || toolName.length > 256 || /[\u0000-\u001f\u007f*]/u.test(toolName)) {
      return { error: "approvalReviewFields contains an invalid exact tool name." };
    }
    if (!Array.isArray(fields) || fields.length === 0 || fields.length > 32) {
      return { error: `approvalReviewFields.${toolName} must contain 1 to 32 field names.` };
    }
    const safeFields = [...new Set(fields.map((field) => typeof field === "string" ? field.trim() : ""))];
    if (safeFields.length === 0 || safeFields.some((field) => (
      !SAFE_REVIEW_FIELD.test(field)
      || FORBIDDEN_REVIEW_FIELD.test(field)
      || FORBIDDEN_OBJECT_FIELD.has(field)
    ))) {
      return { error: `approvalReviewFields.${toolName} contains an unsafe field name.` };
    }
    normalized[toolName] = safeFields;
  }
  return Object.keys(normalized).length > 0 ? { value: normalized } : {};
}

function withPolicy<T extends Record<string, unknown>>(
  base: T,
  candidate: Partial<McpGovernedServerConfig>,
  policy: {
    allowedTools?: string[];
    readOnlyTools?: string[];
    allowedTenants?: string[];
    allowedRoles?: string[];
    approvalReviewFields?: Record<string, string[]>;
  },
) {
  return {
    ...base,
    ...(candidate.headers && typeof candidate.headers === "object" ? { headers: candidate.headers } : {}),
    ...(policy.allowedTools ? { allowedTools: policy.allowedTools } : {}),
    ...(policy.readOnlyTools ? { readOnlyTools: policy.readOnlyTools } : {}),
    ...(policy.allowedTenants ? { allowedTenants: policy.allowedTenants } : {}),
    ...(policy.allowedRoles ? { allowedRoles: policy.allowedRoles } : {}),
    ...(policy.approvalReviewFields ? { approvalReviewFields: policy.approvalReviewFields } : {}),
    ...(candidate.description ? { description: candidate.description } : {}),
  } as T & McpGovernancePolicy;
}
