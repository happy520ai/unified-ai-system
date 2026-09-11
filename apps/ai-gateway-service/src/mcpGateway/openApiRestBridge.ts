// REST → MCP bridge: generates governed MCP tools from an OpenAPI 3 spec and
// executes them as REST calls through the outbound policy. This turns any
// existing HTTPS API into an ACL'd, audited MCP tool surface.

import { fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";
import type { McpCallResult, McpToolDescriptor } from "./mcpUpstreamClient.ts";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";

const MAX_SPEC_CHARS = 2_000_000;
const MAX_RESPONSE_CHARS = 1_000_000;
const HTTP_METHODS = new Set(["get", "put", "post", "patch", "delete"]);

export interface OpenApiOperation {
  method: string;
  path: string;
  operationId: string;
  summary?: string;
  parameters: Array<{ name: string; in: string; required?: boolean; schema?: Record<string, unknown> }>;
  bodySchema?: Record<string, unknown>;
}

export function parseOpenApiOperations(spec: unknown): OpenApiOperation[] {
  if (!spec || typeof spec !== "object") return [];
  const paths = (spec as { paths?: Record<string, Record<string, unknown>> }).paths;
  if (!paths || typeof paths !== "object") return [];

  const operations: OpenApiOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!operation || typeof operation !== "object") continue;
      const record = operation as Record<string, unknown>;
      const operationId = typeof record.operationId === "string" && record.operationId.trim()
        ? record.operationId.trim()
        : `${method.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      const rawParameters = Array.isArray(record.parameters) ? record.parameters : [];
      const parameters = rawParameters
        .filter((parameter): parameter is Record<string, unknown> => Boolean(parameter) && typeof parameter === "object")
        .map((parameter) => ({
          name: String(parameter.name ?? ""),
          in: String(parameter.in ?? "query"),
          required: parameter.required === true,
          schema: parameter.schema && typeof parameter.schema === "object"
            ? parameter.schema as Record<string, unknown>
            : undefined,
        }))
        .filter((parameter) => parameter.name);
      const requestBody = record.requestBody as { content?: Record<string, { schema?: Record<string, unknown> }> } | undefined;
      const bodySchema = requestBody?.content?.["application/json"]?.schema ?? undefined;
      operations.push({
        method: method.toUpperCase(),
        path,
        operationId,
        ...(typeof record.summary === "string" ? { summary: record.summary } : {}),
        parameters,
        ...(bodySchema ? { bodySchema } : {}),
      });
    }
  }
  return operations;
}

export function operationToMcpTool(operation: OpenApiOperation): McpToolDescriptor & { __rest: { method: string; path: string } } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const parameter of operation.parameters) {
    properties[parameter.in === "path" ? parameter.name : `${parameter.in}_${parameter.name}`] = parameter.schema ?? { type: "string" };
    if (parameter.required && parameter.in === "path") required.push(parameter.name);
  }
  if (operation.bodySchema && (operation.bodySchema as { type?: string }).type === "object") {
    const bodyProperties = (operation.bodySchema as { properties?: Record<string, unknown> }).properties;
    if (bodyProperties && typeof bodyProperties === "object") {
      properties.body = operation.bodySchema;
    } else {
      properties.body = { type: "object" };
    }
  } else if (operation.bodySchema) {
    properties.body = operation.bodySchema;
  }
  return {
    name: operation.operationId,
    ...(operation.summary ? { description: operation.summary } : {}),
    inputSchema: {
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
    },
    __rest: { method: operation.method, path: operation.path },
  };
}

export function createOpenApiRestBridge(config: {
  id: string;
  baseUrl: string;
  specUrl?: string;
  spec?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}, options: {
  fetchImpl?: (url: string, init: Record<string, unknown>) => Promise<{ ok: boolean; status: number; headers: Record<string, string>; text: () => Promise<string> }>;
} = {}) {
  const timeoutMs = config.timeoutMs ?? 20_000;
  const fetchImpl = options.fetchImpl ?? null;
  let cachedTools: Array<McpToolDescriptor & { __rest: { method: string; path: string } }> | null = config.spec
    ? parseOpenApiOperations(config.spec).map(operationToMcpTool)
    : null;

  async function loadSpecText(signal?: AbortSignal): Promise<string> {
    throwIfExecutionAborted(signal);
    const destination = await resolveSafeOutboundUrl(config.specUrl!);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`OpenAPI spec fetch timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref?.();
    try {
      const effectiveSignal = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;
      const response = fetchImpl
        ? await fetchImpl(destination.url, { method: "GET", signal: effectiveSignal })
        : await fetchWithAgent(destination.url, {
            method: "GET",
            signal: effectiveSignal,
            maxResponseBytes: MAX_SPEC_CHARS + 1,
          });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`OpenAPI spec fetch returned ${response.status}.`);
      }
      if (text.length > MAX_SPEC_CHARS) {
        throw new Error("OpenAPI spec exceeds the size limit.");
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureTools(signal?: AbortSignal) {
    if (cachedTools) return cachedTools;
    const specText = await loadSpecText(signal);
    cachedTools = parseOpenApiOperations(JSON.parse(specText)).map(operationToMcpTool);
    return cachedTools;
  }

  function fillPathTemplate(path: string, args: Record<string, unknown>): string {
    return path.replace(/\{([^}]+)\}/g, (_match, parameterName: string) => {
      const value = args[String(parameterName)];
      if (value === undefined || value === null) {
        throw new Error(`Missing path parameter '${parameterName}'.`);
      }
      return encodeURIComponent(String(value));
    });
  }

  return {
    id: config.id,
    transport: "openapi-rest" as const,
    async listTools(): Promise<McpToolDescriptor[]> {
      await ensureTools();
      return cachedTools!;
    },
    async callTool(
      name: string,
      args: Record<string, unknown>,
      execution: { signal?: AbortSignal } = {},
    ): Promise<McpCallResult> {
      await ensureTools(execution.signal);
      throwIfExecutionAborted(execution.signal);
      const tool = cachedTools!.find((candidate) => candidate.name === name);
      if (!tool) {
        throw new Error(`Unknown generated tool '${name}'.`);
      }
      const remaining = { ...args };
      const path = fillPathTemplate(tool.__rest.path, remaining);
      for (const key of Object.keys(remaining)) {
        if (key.startsWith("path_")) delete remaining[key];
      }
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(remaining)) {
        if (key.startsWith("query_")) {
          query.set(key.slice("query_".length), String(value));
          delete remaining[key];
        }
      }
      const hasBody = "body" in remaining;
      const body = hasBody ? JSON.stringify(remaining.body ?? {}) : undefined;
      delete remaining.body;

      const destination = await resolveSafeOutboundUrl(
        `${config.baseUrl.replace(/\/+$/, "")}${path}${query.size ? `?${query}` : ""}`,
      );
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error(`REST bridge call timed out after ${timeoutMs}ms`)), timeoutMs);
      timer.unref?.();
      try {
        const effectiveSignal = execution.signal
          ? AbortSignal.any([controller.signal, execution.signal])
          : controller.signal;
        const init = {
          method: tool.__rest.method,
          headers: {
            ...(config.headers ?? {}),
            ...(body ? { "content-type": "application/json" } : {}),
          },
          ...(body ? { body } : {}),
          signal: effectiveSignal,
        };
        const response = fetchImpl
          ? await fetchImpl(destination.url, init)
          : await fetchWithAgent(destination.url, {
              ...init,
              maxResponseBytes: MAX_RESPONSE_CHARS + 1,
            });
        const text = await response.text();
        if (text.length > MAX_RESPONSE_CHARS) {
          const error = new Error("OpenAPI bridge response exceeds the size limit.");
          (error as Error & { code?: string }).code = "OPENAPI_RESPONSE_TOO_LARGE";
          throw error;
        }
        return {
          content: [{ type: "text", text }],
          isError: !response.ok,
          httpStatus: response.status,
        };
      } finally {
        clearTimeout(timer);
      }
    },
    async close() {
      cachedTools = null;
    },
  };
}
