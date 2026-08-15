// Minimal MCP client transports for upstream MCP servers (reverse governance).
//
// Implements just the protocol surface the gateway needs — initialize,
// tools/list, tools/call — over Streamable HTTP and stdio. No new
// dependencies: HTTP egress goes through the shared connection pool and the
// outbound URL policy; stdio spawns the operator-configured command.

import { spawn } from "node:child_process";
import { fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";

export interface McpUpstreamHttpConfig {
  transport: "http";
  id: string;
  url: string;
  headers?: Record<string, string>;
}

export interface McpUpstreamStdioConfig {
  transport: "stdio";
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export type McpUpstreamConfig = McpUpstreamHttpConfig | McpUpstreamStdioConfig;

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpCallResult {
  content?: unknown;
  isError?: boolean;
  [key: string]: unknown;
}

const JSONRPC_VERSION = "2.0";
const PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_CHARS = 1_000_000;

let nextRequestId = 1;

function createRequest(method: string, params?: Record<string, unknown>) {
  return { jsonrpc: JSONRPC_VERSION, id: nextRequestId++, method, ...(params ? { params } : {}) };
}

function extractMessage(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Parse a Streamable HTTP body: single JSON or text/event-stream frames. */
function parseHttpMessages(bodyText: string): Array<Record<string, unknown>> {
  const contentTypeIndependent = bodyText.trimStart();
  if (contentTypeIndependent.startsWith("{")) {
    const message = extractMessage(bodyText);
    return message ? [message] : [];
  }
  const messages: Array<Record<string, unknown>> = [];
  for (const frame of contentTypeIndependent.split(/\r?\n\r?\n/)) {
    for (const line of frame.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const message = extractMessage(line.slice(5).trim());
      if (message) messages.push(message);
    }
  }
  return messages;
}

export function createHttpMcpUpstream(config: McpUpstreamHttpConfig, options: {
  fetchImpl?: (url: string, init: Record<string, unknown>) => Promise<{ ok: boolean; status: number; headers: Record<string, string>; text: () => Promise<string> }>;
  timeoutMs?: number;
} = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? null;
  let sessionId: string | null = null;
  let initialized = false;

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`MCP upstream ${config.id} timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref?.();
    try {
      const destination = await resolveSafeOutboundUrl(config.url);
      const init = {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(config.headers ?? {}),
          ...(sessionId ? { "mcp-session-id": sessionId } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      };
      const response = fetchImpl
        ? await fetchImpl(destination.url, init)
        : await fetchWithAgent(destination.url, init);
      const sessionHeader = response.headers?.["mcp-session-id"];
      if (typeof sessionHeader === "string" && sessionHeader) {
        sessionId = sessionHeader;
      }
      const text = await response.text();
      if (!response.ok) {
        const error = new Error(`MCP upstream ${config.id} returned ${response.status}: ${text.slice(0, 300)}`);
        (error as Error & { code?: string }).code = `MCP_UPSTREAM_HTTP_${response.status}`;
        throw error;
      }
      if (text.length > MAX_RESPONSE_CHARS) {
        throw new Error(`MCP upstream ${config.id} response exceeds the size limit.`);
      }
      const messages = parseHttpMessages(text);
      const match = messages.find((message) => message.id === body.id) ?? messages[messages.length - 1];
      if (!match) throw new Error(`MCP upstream ${config.id} returned no JSON-RPC message.`);
      return match;
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureInitialized() {
    if (initialized) return;
    const response = await post(createRequest("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "unified-ai-gateway", version: "0.4.9" },
    }));
    if (response.error) {
      throw new Error(`MCP upstream ${config.id} initialize failed: ${JSON.stringify(response.error).slice(0, 300)}`);
    }
    await post(createRequest("notifications/initialized"));
    initialized = true;
  }

  return {
    id: config.id,
    transport: "http" as const,
    async listTools(): Promise<McpToolDescriptor[]> {
      await ensureInitialized();
      const response = await post(createRequest("tools/list", {}));
      if (response.error) {
        throw new Error(`MCP upstream ${config.id} tools/list failed: ${JSON.stringify(response.error).slice(0, 300)}`);
      }
      const tools = (response.result as { tools?: unknown } | undefined)?.tools;
      return Array.isArray(tools) ? tools.filter((tool) => tool && typeof tool === "object") : [];
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
      await ensureInitialized();
      const response = await post(createRequest("tools/call", { name, arguments: args }));
      if (response.error) {
        throw new Error(`MCP upstream ${config.id} tools/call failed: ${JSON.stringify(response.error).slice(0, 300)}`);
      }
      return (response.result ?? {}) as McpCallResult;
    },
    async close() {
      sessionId = null;
      initialized = false;
    },
  };
}

export function createStdioMcpUpstream(config: McpUpstreamStdioConfig, options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let child: ReturnType<typeof spawn> | null = null;
  let buffer = "";
  let initialized = false;
  const pending = new Map<number, { resolve: (message: Record<string, unknown>) => void; reject: (error: Error) => void }>();

  function ensureChild() {
    if (child) return child;
    // stdio 上游由运维通过受信环境配置（与 MCP 宿主配置同级信任），不接受请求输入。
    const spawned = spawn(config.command, config.args ?? [], {
      cwd: config.cwd,
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    spawned.stdout.setEncoding("utf8");
    spawned.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          const message = extractMessage(line);
          const id = Number(message?.id);
          const pendingRequest = Number.isFinite(id) ? pending.get(id) : null;
          if (pendingRequest) {
            pending.delete(id);
            pendingRequest.resolve(message!);
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    });
    spawned.on("error", (error) => {
      rejectAllPending(new Error(`MCP stdio upstream ${config.id} failed: ${error.message}`));
      child = null;
    });
    spawned.on("close", () => {
      rejectAllPending(new Error(`MCP stdio upstream ${config.id} exited unexpectedly.`));
      child = null;
      initialized = false;
    });
    child = spawned;
    return spawned;
  }

  function rejectAllPending(error: Error) {
    for (const [, request] of pending) request.reject(error);
    pending.clear();
  }

  function send(body: Record<string, unknown>) {
    const spawned = ensureChild();
    spawned.stdin!.write(`${JSON.stringify(body)}\n`);
  }

  function request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const message = createRequest(method, params);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(Number(message.id));
        reject(new Error(`MCP stdio upstream ${config.id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      timer.unref?.();
      pending.set(Number(message.id), {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      try {
        send(message);
      } catch (error) {
        clearTimeout(timer);
        pending.delete(Number(message.id));
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async function ensureInitialized() {
    if (initialized) return;
    const response = await request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "unified-ai-gateway", version: "0.4.9" },
    });
    if (response.error) {
      throw new Error(`MCP stdio upstream ${config.id} initialize failed: ${JSON.stringify(response.error).slice(0, 300)}`);
    }
    send({ jsonrpc: JSONRPC_VERSION, method: "notifications/initialized" });
    initialized = true;
  }

  return {
    id: config.id,
    transport: "stdio" as const,
    async listTools(): Promise<McpToolDescriptor[]> {
      await ensureInitialized();
      const response = await request("tools/list", {});
      if (response.error) {
        throw new Error(`MCP stdio upstream ${config.id} tools/list failed: ${JSON.stringify(response.error).slice(0, 300)}`);
      }
      const tools = (response.result as { tools?: unknown } | undefined)?.tools;
      return Array.isArray(tools) ? tools.filter((tool) => tool && typeof tool === "object") : [];
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
      await ensureInitialized();
      const response = await request("tools/call", { name, arguments: args });
      if (response.error) {
        throw new Error(`MCP stdio upstream ${config.id} tools/call failed: ${JSON.stringify(response.error).slice(0, 300)}`);
      }
      return (response.result ?? {}) as McpCallResult;
    },
    async close() {
      rejectAllPending(new Error(`MCP stdio upstream ${config.id} closed by the gateway.`));
      initialized = false;
      if (child) {
        child.kill("SIGTERM");
        child = null;
      }
    },
  };
}

export type McpUpstreamClient = ReturnType<typeof createHttpMcpUpstream> | ReturnType<typeof createStdioMcpUpstream>;

export function createMcpUpstreamFromConfig(
  config: McpUpstreamConfig,
  options: Parameters<typeof createHttpMcpUpstream>[1] & Parameters<typeof createStdioMcpUpstream>[1] = {},
): McpUpstreamClient {
  if (config.transport === "stdio") return createStdioMcpUpstream(config, options);
  return createHttpMcpUpstream(config, options);
}
