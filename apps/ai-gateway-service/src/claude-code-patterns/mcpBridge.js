/**
 * MCP Bridge - Model Context Protocol 协议桥接器
 *
 * 借鉴 Claude Code v2.1.88 的 MCP 系统模式:
 * - MCPServerConfig: 支持 stdio transport（command, args, env）和 HTTP/SSE transport（url）
 * - connectToServer(): 建立 MCP 服务器连接
 * - fetchToolsForClient(): 从 MCP 服务器获取工具列表与 schema
 * - MCPTool 包装: 将 MCP 工具适配为标准工具接口（覆盖 name, description, call）
 * - mcpServerApproval: MCP 服务器连接前的审批流程
 * - mcpValidation: 工具输出验证
 * - mcpOutputStorage: 工具结果存储与缓存
 * - toolSchemaCache: 工具 schema 缓存
 *
 * PME 适配:
 * - 支持注册外部 MCP 服务器（stdio 和 HTTP transport）
 * - 将 MCP 工具暴露给 AI Agent 使用
 * - 工具调用结果的标准化封装
 * - 连接健康检查和自动重连
 *
 * @module mcpBridge
 */

import { randomUUID } from "node:crypto";
import { validateServerConfig, createStdioTransport, createHttpTransport } from "./mcpTransports.js";
import { createMcpClient } from "./mcpClient.js";

// ============================================================
// 辅助函数
// ============================================================

/**
 * 存储工具调用结果（借鉴 mcpOutputStorage 模式）
 * 使用 LRU 策略，超出最大容量时移除最早的条目
 */
function storeOutput(cache, key, entry, maxSize) {
  if (cache.size >= maxSize) {
    // 移除最早的条目（Map 的迭代顺序是插入顺序）
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, entry);
}

// ============================================================
// MCP 桥接器 - 管理多个 MCP 服务器连接
// ============================================================

/**
 * 创建 MCP 桥接器
 *
 * 借鉴 Claude Code 的 MCP 管理模式:
 * - 多服务器注册与连接管理
 * - 工具合并（useMergedTools 模式）
 * - 审批感知的连接建立（mcpServerApproval 模式）
 * - 连接健康检查与自动重连
 * - 工具 schema 缓存（toolSchemaCache 模式）
 * - 输出存储（mcpOutputStorage 模式）
 *
 * @param {Object} options
 * @param {Object} [options.eventBus] - 事件总线
 * @param {Object} [options.permissionChecker] - 权限检查器
 * @param {number} [options.healthCheckIntervalMs] - 健康检查间隔（毫秒）
 * @param {number} [options.reconnectDelayMs] - 重连延迟（毫秒）
 * @param {number} [options.maxReconnectAttempts] - 最大重连次数
 * @returns {Object} MCP 桥接器实例
 */
export function createMcpBridge(options = {}) {
  const {
    eventBus = null,
    permissionChecker = null,
    healthCheckIntervalMs = 30_000,
    reconnectDelayMs = 5_000,
    maxReconnectAttempts = 3,
  } = options;

  /** 已注册的服务器配置映射 name -> config */
  const serverConfigs = new Map();

  /** 活跃的客户端连接映射 name -> client */
  const clients = new Map();

  /** 重连计数器 name -> count */
  const reconnectCounts = new Map();

  /** 健康检查定时器 */
  let healthCheckTimer = null;

  /** 工具调用结果缓存（借鉴 mcpOutputStorage 模式） */
  const outputCache = new Map();
  const OUTPUT_CACHE_MAX_SIZE = 500;

  /** 合并的工具列表缓存 */
  let mergedToolsCache = null;
  let mergedToolsTimestamp = 0;

  const bridge = {
    /**
     * 注册 MCP 服务器配置
     * 借鉴 Claude Code 的 MCP 配置注册模式
     *
     * @param {Object} config - 服务器配置
     * @param {string} config.name - 服务器名称
     * @param {string} config.transport - 传输类型 (stdio/http)
     * @param {string} [config.command] - stdio 命令
     * @param {string[]} [config.args] - stdio 参数
     * @param {Object} [config.env] - stdio 环境变量
     * @param {string} [config.url] - HTTP URL
     * @param {Object} [config.headers] - HTTP 请求头
     * @param {string} [config.scope] - 配置作用域 (user/project/global)
     */
    registerServer(config) {
      const validation = validateServerConfig(config);
      if (!validation.valid) {
        return { status: "error", errors: validation.errors };
      }

      serverConfigs.set(config.name, {
        ...config,
        scope: config.scope || "user",
        registeredAt: new Date().toISOString(),
      });

      if (eventBus) {
        eventBus.emit("mcp.server.registered", {
          serverName: config.name,
          transport: config.transport,
          scope: config.scope,
        });
      }

      return { status: "success", serverName: config.name };
    },

    /**
     * 注销 MCP 服务器
     */
    async unregisterServer(serverName) {
      const client = clients.get(serverName);
      if (client) {
        client.disconnect();
        clients.delete(serverName);
      }
      serverConfigs.delete(serverName);
      reconnectCounts.delete(serverName);
      mergedToolsCache = null; // 清除合并缓存
      return { status: "success", serverName };
    },

    /**
     * 连接到指定的 MCP 服务器
     * 借鉴 Claude Code 的连接审批模式:
     * - project 作用域的服务器需要审批
     * - global/user 作用域的服务器直接连接
     */
    async connectServer(serverName) {
      const config = serverConfigs.get(serverName);
      if (!config) {
        return { status: "error", error: `服务器 ${serverName} 未注册` };
      }

      // 如果已有连接，先断开
      if (clients.has(serverName)) {
        clients.get(serverName).disconnect();
      }

      // 权限检查（project 作用域需要审批）
      if (config.scope === "project" && permissionChecker) {
        const permResult = await permissionChecker.check("mcp:connect:project");
        if (!permResult.allowed) {
          return {
            status: "denied",
            error: "项目级 MCP 服务器连接需要审批",
            reason: permResult.reason,
          };
        }
      }

      const client = createMcpClient(config);
      const result = await client.connect();

      if (result.status === "connected") {
        clients.set(serverName, client);
        reconnectCounts.set(serverName, 0);
        mergedToolsCache = null;

        if (eventBus) {
          eventBus.emit("mcp.server.connected", {
            serverName,
            capabilities: result.serverCapabilities,
          });
        }
      }

      return result;
    },

    /**
     * 连接到所有已注册的服务器
     */
    async connectAll() {
      const results = {};
      for (const [name] of serverConfigs) {
        results[name] = await this.connectServer(name);
      }
      return results;
    },

    /**
     * 断开指定服务器连接
     */
    disconnectServer(serverName) {
      const client = clients.get(serverName);
      if (client) {
        client.disconnect();
        clients.delete(serverName);
        mergedToolsCache = null;
        if (eventBus) {
          eventBus.emit("mcp.server.disconnected", { serverName });
        }
      }
      return { status: "success", serverName };
    },

    /**
     * 断开所有服务器连接
     */
    disconnectAll() {
      for (const [name, client] of clients) {
        client.disconnect();
        if (eventBus) {
          eventBus.emit("mcp.server.disconnected", { serverName: name });
        }
      }
      clients.clear();
      mergedToolsCache = null;
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
      }
      return { status: "success" };
    },

    /**
     * 获取所有 MCP 工具（合并所有已连接服务器的工具）
     * 借鉴 Claude Code 的 useMergedTools 模式:
     * - 合并所有 MCP 服务器的工具
     * - 工具名前缀服务器名（mcp__serverName__toolName）
     * - 带缓存的工具列表
     */
    async listAllTools({ forceRefresh = false } = {}) {
      const now = Date.now();
      if (!forceRefresh && mergedToolsCache && now - mergedToolsTimestamp < 60_000) {
        return { status: "success", tools: mergedToolsCache, cached: true };
      }

      const allTools = [];
      for (const [name, client] of clients) {
        if (client.transport.isConnected()) {
          const result = await client.listTools({ forceRefresh });
          if (result.status === "success") {
            allTools.push(...result.tools);
          }
        }
      }

      mergedToolsCache = allTools;
      mergedToolsTimestamp = now;
      return { status: "success", tools: allTools, cached: false };
    },

    /**
     * 调用 MCP 工具
     * 借鉴 Claude Code 的 MCPTool.call() 模式:
     * - 根据工具名前缀路由到对应的 MCP 服务器
     * - 标准化结果封装
     * - 结果缓存存储
     *
     * @param {string} toolName - 工具名（格式: serverName__toolName）
     * @param {Object} params - 工具参数
     * @returns {Object} 标准化结果
     */
    async callTool(toolName, params = {}) {
      // 根据工具名前缀查找服务器
      const parts = toolName.split("__");
      const serverName = parts.length > 1 ? parts[0] : null;

      let client = null;
      if (serverName && clients.has(serverName)) {
        client = clients.get(serverName);
      } else {
        // 尝试在所有客户端中查找
        for (const [name, c] of clients) {
          const toolsResult = await c.listTools();
          if (toolsResult.status === "success") {
            const found = toolsResult.tools.find((t) => t.name === toolName);
            if (found) {
              client = c;
              break;
            }
          }
        }
      }

      if (!client) {
        return { status: "error", error: `找不到工具 ${toolName} 对应的 MCP 服务器` };
      }

      const callId = randomUUID();
      const startTime = Date.now();

      // 发布调用开始事件
      if (eventBus) {
        eventBus.emit("mcp.tool.call.started", {
          callId,
          toolName,
          serverName: client.serverName,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await client.callTool(toolName, params);
      const durationMs = Date.now() - startTime;

      // 存储结果到缓存（借鉴 mcpOutputStorage 模式）
      const outputEntry = {
        callId,
        toolName,
        serverName: client.serverName,
        result,
        durationMs,
        timestamp: new Date().toISOString(),
      };
      storeOutput(outputCache, toolName, outputEntry, OUTPUT_CACHE_MAX_SIZE);

      // 发布调用完成事件
      if (eventBus) {
        eventBus.emit("mcp.tool.call.completed", {
          ...outputEntry,
          status: result.status,
        });
      }

      return result;
    },

    /**
     * 启动健康检查定时器
     * 定期检查所有连接的状态，断开时尝试重连
     */
    startHealthCheck() {
      if (healthCheckTimer) clearInterval(healthCheckTimer);

      healthCheckTimer = setInterval(async () => {
        for (const [name, client] of clients) {
          if (!client.transport.isConnected()) {
            const count = reconnectCounts.get(name) || 0;
            if (count < maxReconnectAttempts) {
              reconnectCounts.set(name, count + 1);

              if (eventBus) {
                eventBus.emit("mcp.server.reconnecting", {
                  serverName: name,
                  attempt: count + 1,
                  maxAttempts: maxReconnectAttempts,
                });
              }

              // 延迟后重连
              setTimeout(async () => {
                try {
                  await bridge.connectServer(name);
                } catch {
                  // 重连失败，等待下次健康检查
                }
              }, reconnectDelayMs);
            } else {
              if (eventBus) {
                eventBus.emit("mcp.server.reconnect.exhausted", {
                  serverName: name,
                  attempts: count,
                });
              }
            }
          }
        }
      }, healthCheckIntervalMs);

      return { status: "success", intervalMs: healthCheckIntervalMs };
    },

    /**
     * 停止健康检查
     */
    stopHealthCheck() {
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
      }
      return { status: "success" };
    },

    /**
     * 获取桥接器状态摘要
     */
    getHealth() {
      const servers = [];
      for (const [name, config] of serverConfigs) {
        const client = clients.get(name);
        servers.push({
          name,
          transport: config.transport,
          scope: config.scope,
          connected: client ? client.transport.isConnected() : false,
          cachedToolCount: client ? client.getStatus().cachedToolCount : 0,
          reconnectCount: reconnectCounts.get(name) || 0,
        });
      }

      return {
        status: "ready",
        registeredServers: serverConfigs.size,
        connectedServers: clients.size,
        healthCheckActive: healthCheckTimer !== null,
        outputCacheSize: outputCache.size,
        mergedToolsCacheValid: mergedToolsCache !== null,
        servers,
      };
    },

    /**
     * 列出所有已注册的服务器配置
     */
    listServers() {
      const result = [];
      for (const [name, config] of serverConfigs) {
        const client = clients.get(name);
        result.push({
          name,
          transport: config.transport,
          scope: config.scope,
          connected: client ? client.transport.isConnected() : false,
          registeredAt: config.registeredAt,
        });
      }
      return result;
    },
  };

  return bridge;
}

// ============================================================
// 公共 API 导出
// ============================================================

export { createMcpClient, createStdioTransport, createHttpTransport, validateServerConfig };
