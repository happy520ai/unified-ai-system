/**
 * MCP Client - manages interaction with a single MCP server
 *
 * Extracted from mcpBridge.js to keep the bridge module under 500 lines.
 *
 * @module mcpClient
 */

import { randomUUID } from "node:crypto";
import { createStdioTransport, createHttpTransport } from "./mcpTransports.js";

// ============================================================
// JSON-RPC 消息处理（MCP 基于 JSON-RPC 2.0）
// ============================================================

/**
 * 创建 JSON-RPC 请求消息
 */
function createJsonRpcRequest(method, params, id) {
  return {
    jsonrpc: "2.0",
    id: id || randomUUID(),
    method,
    params: params || {},
  };
}

/**
 * 创建 JSON-RPC 通知消息（无 id，不需要响应）
 */
function createJsonRpcNotification(method, params) {
  return {
    jsonrpc: "2.0",
    method,
    params: params || {},
  };
}

// ============================================================
// MCP 客户端 - 管理与单个 MCP 服务器的交互
// ============================================================

// Must match PROTOCOL_VERSION in ../mcpGateway/mcpUpstreamClient.ts. The revision this client puts
// on the wire is compared against that constant in mcpClient.test.js, because two MCP client paths
// inside one gateway disagreeing about the protocol is not visible from either path on its own.
const MCP_PROTOCOL_VERSION = "2025-06-18";

/**
 * 创建 MCP 客户端
 * 借鉴 Claude Code 的 mcpClient.ts 模式:
 * - 初始化连接
 * - 获取服务器能力（capabilities）
 * - 列出工具（tools/list）
 * - 调用工具（tools/call）
 * - 列出资源（resources/list）
 * - 读取资源（resources/read）
 */
export function createMcpClient(serverConfig) {
  const transport =
    serverConfig.transport === "stdio"
      ? createStdioTransport(serverConfig)
      : createHttpTransport(serverConfig);

  /** 待处理的请求回调映射 id -> { resolve, reject, timer } */
  const pendingRequests = new Map();

  /** 缓存的工具列表 */
  let cachedTools = null;
  let toolsCacheTimestamp = 0;
  const TOOLS_CACHE_TTL_MS = 60_000; // 工具列表缓存 60 秒
  const MAX_TOOL_LIST_PAGES = 20; // 与 mcpUpstreamClient 同一立场：分页必须走完，且必须能停下

  /** 服务器能力 */
  let serverCapabilities = null;

  // 监听来自 transport 的消息
  transport.on("message", (msg) => {
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject, timer } = pendingRequests.get(msg.id);
      clearTimeout(timer);
      pendingRequests.delete(msg.id);

      if (msg.error) {
        reject(new Error(msg.error.message || "MCP RPC 错误"));
      } else {
        resolve(msg.result);
      }
    }
  });

  /**
   * 发送 JSON-RPC 请求并等待响应
   */
  function rpcCall(method, params, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`MCP 请求超时: ${method} (${timeoutMs}ms)`));
      }, timeoutMs);

      pendingRequests.set(id, { resolve, reject, timer });

      const message = createJsonRpcRequest(method, params, id);
      try {
        transport.send(message);
      } catch (err) {
        clearTimeout(timer);
        pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  return {
    serverName: serverConfig.name,
    transport,

    /**
     * 连接到 MCP 服务器并初始化
     * 借鉴 Claude Code 的 connectToServer() 流程:
     * 1. 建立 transport 连接
     * 2. 发送 initialize 请求
     * 3. 发送 initialized 通知
     */
    async connect() {
      await transport.connect();

      // 发送初始化请求
      try {
        const initResult = await rpcCall("initialize", {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "pme-mcp-bridge",
            version: "1.0.0",
          },
        });

        serverCapabilities = initResult?.capabilities || {};

        // 发送 initialized 通知
        transport.send(createJsonRpcNotification("notifications/initialized"));

        return {
          status: "connected",
          serverName: serverConfig.name,
          serverCapabilities,
          protocolVersion: initResult?.protocolVersion,
        };
      } catch (err) {
        return {
          status: "error",
          serverName: serverConfig.name,
          error: err.message,
        };
      }
    },

    /**
     * 获取服务器提供的工具列表
     * 借鉴 Claude Code 的 fetchToolsForClient():
     * - 带缓存的 tools/list 调用
     * - 将 MCP 工具 schema 转换为标准工具定义格式
     */
    async listTools({ forceRefresh = false } = {}) {
      const now = Date.now();
      if (!forceRefresh && cachedTools && now - toolsCacheTimestamp < TOOLS_CACHE_TTL_MS) {
        return { status: "success", tools: cachedTools, cached: true };
      }

      try {
        // 一个带 nextCursor 的上游如果被当成一页读完，这里列出的"全部工具"其实是残缺的，
        // 而残缺的枚举既不会被允许也不会被拒绝——它只是不存在于策略的视野里。
        const collected = [];
        const names = new Set();
        let cursor;
        let complete = false;
        for (let page = 0; page <= MAX_TOOL_LIST_PAGES; page += 1) {
          const result = await rpcCall("tools/list", cursor === undefined ? {} : { cursor });
          for (const t of result?.tools || []) {
            if (!t || names.has(t.name)) continue;
            names.add(t.name);
            collected.push({
              name: `${serverConfig.name}__${t.name}`,
              originalName: t.name,
              serverName: serverConfig.name,
              description: t.description || "",
              inputSchema: t.inputSchema || { type: "object", properties: {} },
              source: "mcp",
            });
          }
          const next = typeof result?.nextCursor === "string" ? result.nextCursor : undefined;
          if (next === undefined) { complete = true; break; }
          if (next === cursor) {
            throw new Error(`MCP tools/list 返回了重复的 cursor (${next})，分页无法收敛`);
          }
          cursor = next;
        }
        if (!complete) {
          throw new Error(`MCP tools/list 在 ${MAX_TOOL_LIST_PAGES} 页之后仍有 cursor，拒绝把残缺的枚举当作完整列表`);
        }
        cachedTools = collected;
        toolsCacheTimestamp = now;
        return { status: "success", tools: cachedTools, cached: false };
      } catch (err) {
        return { status: "error", error: err.message };
      }
    },

    /**
     * 调用 MCP 工具
     * 借鉴 Claude Code MCPTool.call() 的模式:
     * - 将工具名映射回 MCP 原始名称
     * - 发送 tools/call 请求
     * - 标准化封装返回结果
     */
    async callTool(toolName, params = {}) {
      // 去掉服务器名前缀，获取 MCP 原始工具名
      const prefix = `${serverConfig.name}__`;
      const originalName = toolName.startsWith(prefix)
        ? toolName.slice(prefix.length)
        : toolName;

      try {
        const result = await rpcCall("tools/call", {
          name: originalName,
          arguments: params,
        });

        // 标准化封装结果（借鉴 Claude Code 的 MCPTool.mapToolResultToToolResultBlockParam）
        return {
          status: "success",
          serverName: serverConfig.name,
          toolName: originalName,
          content: result?.content || [],
          isError: result?.isError || false,
        };
      } catch (err) {
        return {
          status: "error",
          serverName: serverConfig.name,
          toolName: originalName,
          error: err.message,
        };
      }
    },

    /**
     * 列出服务器提供的资源
     */
    async listResources() {
      try {
        const result = await rpcCall("resources/list");
        return { status: "success", resources: result?.resources || [] };
      } catch (err) {
        return { status: "error", error: err.message };
      }
    },

    /**
     * 读取指定资源
     */
    async readResource(uri) {
      try {
        const result = await rpcCall("resources/read", { uri });
        return { status: "success", contents: result?.contents || [] };
      } catch (err) {
        return { status: "error", error: err.message };
      }
    },

    /**
     * 断开连接
     */
    disconnect() {
      // 清理所有待处理请求
      for (const [id, { reject, timer }] of pendingRequests) {
        clearTimeout(timer);
        reject(new Error("连接已断开"));
        pendingRequests.delete(id);
      }
      transport.disconnect();
      cachedTools = null;
      serverCapabilities = null;
    },

    /**
     * 获取客户端状态
     */
    getStatus() {
      return {
        serverName: serverConfig.name,
        connected: transport.isConnected(),
        transportType: transport.type,
        cachedToolCount: cachedTools?.length || 0,
        serverCapabilities,
      };
    },
  };
}
