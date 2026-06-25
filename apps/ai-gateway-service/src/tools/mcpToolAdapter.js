/**
 * MCP Tool Adapter — MCP Bridge 到 AgentToolRegistry 的桥接层
 *
 * 将已连接的 MCP server 的工具自动注册到 agentToolRegistry,
 * 使 LLM 可以通过 function calling 调用外部 MCP 工具。
 *
 * @module mcpToolAdapter
 */

import { buildTool, createInputSchema } from "../claude-code-patterns/agentToolRegistry.js";

const MCP_TOOL_PREFIX = "mcp";
const SYNC_INTERVAL_MS = 60_000;

/**
 * 创建 MCP 工具适配器。
 *
 * @param {Object} mcpBridge - createMcpBridge 的实例
 * @param {Object} [options]
 * @param {boolean} [options.autoSync=true] - 是否自动定期同步工具
 * @param {number} [options.syncIntervalMs=60000]
 * @returns {Object} MCP 工具适配器实例
 */
export function createMcpToolAdapter(mcpBridge, options = {}) {
  const autoSync = options.autoSync ?? true;
  const syncIntervalMs = options.syncIntervalMs ?? SYNC_INTERVAL_MS;
  let syncTimer = null;
  const registeredToolNames = new Set();

  /**
   * 扫描所有已连接 MCP server,将工具注册到 agentToolRegistry。
   *
   * @param {Object} toolRegistry - createAgentToolRegistry 的实例
   * @returns {Promise<Object>} 同步结果
   */
  async function syncTools(toolRegistry) {
    const added = [];
    const removed = [];
    const errors = [];

    try {
      const mcpTools = await mcpBridge.listAllTools({ forceRefresh: true });

      if (!Array.isArray(mcpTools)) {
        return { added: [], removed: [], errors: ["listAllTools returned non-array"], total: 0 };
      }

      const currentNames = new Set(mcpTools.map((t) => t.prefixedName || t.name));

      // Register new tools
      for (const mcpTool of mcpTools) {
        const toolName = mcpTool.prefixedName || mcpTool.name;
        if (!toolName) continue;

        if (!registeredToolNames.has(toolName)) {
          try {
            const tool = convertMcpTool(mcpTool, mcpBridge);
            toolRegistry.registerTool(tool);
            registeredToolNames.add(toolName);
            added.push(toolName);
          } catch (error) {
            errors.push(`Failed to register ${toolName}: ${error.message}`);
          }
        }
      }

      // Unregister tools that no longer exist
      for (const oldName of registeredToolNames) {
        if (!currentNames.has(oldName)) {
          try {
            toolRegistry.unregisterTool(oldName);
            registeredToolNames.delete(oldName);
            removed.push(oldName);
          } catch (error) {
            errors.push(`Failed to unregister ${oldName}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      errors.push(`MCP sync failed: ${error.message}`);
    }

    return {
      added,
      removed,
      errors,
      total: registeredToolNames.size,
    };
  }

  /**
   * 启动自动定期同步。
   */
  function startAutoSync(toolRegistry) {
    if (syncTimer) return;
    syncTimer = setInterval(async () => {
      try {
        await syncTools(toolRegistry);
      } catch {
        // Auto-sync errors are non-fatal
      }
    }, syncIntervalMs);

    if (syncTimer.unref) syncTimer.unref();
  }

  /**
   * 停止自动同步。
   */
  function stopAutoSync() {
    if (syncTimer) {
      clearInterval(syncTimer);
      syncTimer = null;
    }
  }

  /**
   * 获取当前同步状态。
   */
  function getStatus() {
    return {
      registeredToolCount: registeredToolNames.size,
      registeredTools: [...registeredToolNames],
      autoSyncRunning: syncTimer !== null,
      mcpBridgeHealth: mcpBridge.getHealth?.() || null,
    };
  }

  // Auto-start sync if enabled
  if (autoSync) {
    // Will start when first toolRegistry is provided
  }

  return {
    syncTools,
    startAutoSync,
    stopAutoSync,
    getStatus,
    getRegisteredNames: () => [...registeredToolNames],
  };
}

/**
 * 将单个 MCP 工具转为 agentToolRegistry 格式。
 */
function convertMcpTool(mcpTool, mcpBridge) {
  const toolName = mcpTool.prefixedName || mcpTool.name;
  const description = mcpTool.description || `MCP tool from ${mcpTool.serverName || "unknown server"}`;

  // Convert MCP input schema to agentToolRegistry format
  const inputSchema = normalizeMcpSchema(mcpTool.inputSchema);

  return buildTool({
    name: toolName,
    description,
    inputSchema,
    requiredPermissions: ["mcp:call"],
    isReadOnly: true,
    maxResultSizeChars: 100_000,

    async execute(params) {
      const result = await mcpBridge.callTool(toolName, params);
      return formatMcpResult(result);
    },
  });
}

/**
 * 规范化 MCP 工具的 input schema。
 */
function normalizeMcpSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return createInputSchema({});
  }

  const properties = {};
  const required = [];

  if (schema.properties && typeof schema.properties === "object") {
    for (const [key, value] of Object.entries(schema.properties)) {
      properties[key] = normalizeSchemaProperty(value);
    }
  }

  if (Array.isArray(schema.required)) {
    required.push(...schema.required);
  }

  return createInputSchema(properties, required);
}

function normalizeSchemaProperty(prop) {
  if (!prop || typeof prop !== "object") {
    return { type: "string" };
  }

  const normalized = { type: prop.type || "string" };
  if (prop.description) normalized.description = prop.description;
  if (prop.enum) normalized.enum = prop.enum;
  if (prop.default !== undefined) normalized.default = prop.default;

  return normalized;
}

/**
 * 格式化 MCP 工具调用结果。
 */
function formatMcpResult(result) {
  if (!result) return { success: true, result: null };

  // MCP returns structured content (text, image, resource)
  if (result.content) {
    if (Array.isArray(result.content)) {
      const textParts = result.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return { success: !result.isError, result: textParts || JSON.stringify(result.content) };
    }
    return { success: !result.isError, result: result.content };
  }

  return { success: !result.isError, result };
}
