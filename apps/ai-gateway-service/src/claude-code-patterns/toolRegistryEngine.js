/**
 * toolRegistryEngine.js — Tool registry factory and helper utilities.
 *
 * Split from agentToolRegistry.js for 分层律 compliance.
 */

import { randomUUID } from "node:crypto";
import vm from "node:vm";
import { createToolUseContext } from "./toolCore.js";
import { createBuiltInTools } from "./developerTools.js";
import { createGitTools } from "../tools/gitTools.js";
import { createLspTools } from "../tools/lspTool.js";
import { createToolResultCache } from "./toolResultCache.js";
import { createAgentManager } from "./toolAgentManager.js";

// Agent 定义结构: agentType, whenToUse, tools (allowlist), disallowedTools (denylist), permissionMode, model

/**
 * 创建工具注册表 — 工具注册/发现、过滤、权限检查、工具链调用。
 * @param {Object} options
 * @param {Object} [options.permissionChecker] - 权限检查器
 * @param {Object} [options.eventBus] - 事件总线
 * @param {number} [options.maxChainDepth] - 工具链最大深度 (default 5)
 */
export function createAgentToolRegistry(options = {}) {
  const {
    permissionChecker = null,
    eventBus = null,
    maxChainDepth = 5,
  } = options;

  /** 已注册的工具映射 name -> tool */
  const tools = new Map();

  /** 已注册的 Agent 定义映射 agentType -> agentDef */
  const agents = new Map();

  /** 工具执行历史记录（审计用）— capped to prevent memory leak */
  const executionLog = [];
  const MAX_EXECUTION_LOG_SIZE = 1000;

  /** Cap the log to MAX_EXECUTION_LOG_SIZE by dropping oldest entries */
  function capExecutionLog() {
    if (executionLog.length > MAX_EXECUTION_LOG_SIZE) {
      const excess = executionLog.length - MAX_EXECUTION_LOG_SIZE;
      executionLog.splice(0, excess);
    }
  }

  // Tool result cache — extracted to toolResultCache.js for 分层律
  const resultCache = createToolResultCache();

  // 注册所有内置工具（传入 workingDirectory 确保文件操作正确解析路径）
  const builtInTools = createBuiltInTools(options.workingDirectory || process.cwd());
  for (const [name, tool] of Object.entries(builtInTools)) {
    tools.set(name, tool);
  }

  // 注册 Git 工具集 (7 个: status/diff/log/branch/commit/push/create_pr)
  const gitToolOptions = { workingDirectory: options.workingDirectory || process.cwd() };
  for (const gitTool of createGitTools(gitToolOptions)) {
    tools.set(gitTool.name, gitTool);
  }

  // 注册 LSP 工具集 (4 个: definition/references/hover/symbols)
  let _lspShutdownAll = null;
  try {
    const lspToolOptions = { workingDirectory: options.workingDirectory || process.cwd() };
    const lspResult = createLspTools(lspToolOptions);
    // createLspTools returns { tools: [], shutdownAll, getClientCount, getPoolStats }
    const lspToolList = Array.isArray(lspResult) ? lspResult : (lspResult.tools || []);
    for (const lspTool of lspToolList) {
      if (lspTool && lspTool.name) {
        tools.set(lspTool.name, lspTool);
      }
    }
    // Store shutdown callback for cleanup
    if (typeof lspResult?.shutdownAll === "function") {
      _lspShutdownAll = lspResult.shutdownAll;
    }
  } catch {
    // LSP server 不可用时跳过注册 — 非致命
  }

  /**
   * 工具过滤函数
   * 借鉴 Claude Code 的 filterToolsForAgent():
   * - 根据 allowlist（tools）和 denylist（disallowedTools）过滤
   * - 根据权限模式（permissionMode）调整可用工具
   */
  function filterToolsForAgent({ allowlist, denylist, permissionMode } = {}) {
    let availableTools = [...tools.values()];

    // 如果有 allowlist，只保留列表中的工具
    if (allowlist && allowlist.length > 0) {
      const allowSet = new Set(allowlist);
      availableTools = availableTools.filter((t) => allowSet.has(t.name));
    }

    // 如果有 denylist，移除列表中的工具
    if (denylist && denylist.length > 0) {
      const denySet = new Set(denylist);
      availableTools = availableTools.filter((t) => !denySet.has(t.name));
    }

    // 如果是只读权限模式，过滤掉写操作工具
    if (permissionMode === "readOnly") {
      availableTools = availableTools.filter((t) => t.isReadOnly);
    }

    return availableTools;
  }

  /**
   * 验证输入参数是否符合工具的 inputSchema
   * 简化版 JSON Schema 验证（无外部依赖）
   */
  /**
   * 强转工具参数类型 — LLM 经常将数字/布尔值以字符串形式返回。
   * 例如: "0" → 0, "true" → true, "100" → 100
   */
  function coerceParams(schema, params) {
    if (!schema?.properties || !params || typeof params !== "object") return params;
    const coerced = { ...params };
    for (const [key, value] of Object.entries(coerced)) {
      const prop = schema.properties[key];
      if (!prop || value === undefined || value === null) continue;
      if (prop.type === "integer" && typeof value === "string") {
        const parsed = Number(value);
        if (Number.isInteger(parsed)) coerced[key] = parsed;
      } else if (prop.type === "number" && typeof value === "string") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) coerced[key] = parsed;
      } else if (prop.type === "boolean" && typeof value === "string") {
        if (value === "true") coerced[key] = true;
        else if (value === "false") coerced[key] = false;
      }
    }
    return coerced;
  }

  function validateInput(tool, params) {
    const schema = tool.inputSchema;
    const errors = [];

    // 检查 required 字段
    if (schema.required) {
      for (const field of schema.required) {
        if (params[field] === undefined || params[field] === null) {
          errors.push(`缺少必填参数: ${field}`);
        }
      }
    }

    // 检查类型（简化验证）
    if (schema.properties) {
      for (const [key, value] of Object.entries(params)) {
        const prop = schema.properties[key];
        if (!prop) {
          if (schema.additionalProperties === false) {
            errors.push(`未知参数: ${key}`);
          }
          continue;
        }
        if (prop.type === "string" && typeof value !== "string") {
          errors.push(`参数 ${key} 应为字符串类型`);
        }
        if (prop.type === "integer" && (!Number.isInteger(value))) {
          errors.push(`参数 ${key} 应为整数类型`);
        }
        if (prop.enum && !prop.enum.includes(value)) {
          errors.push(`参数 ${key} 的值不在允许范围 [${prop.enum.join(", ")}] 内`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  const registry = {
    /**
     * 注册一个新工具
     *
     * @param {Object} toolDef - 工具定义（使用 buildTool 创建）
     * @returns {Object} 注册结果
     */
    registerTool(toolDef) {
      if (!toolDef.name || !toolDef.execute) {
        return { status: "error", error: "工具必须有 name 和 execute 属性" };
      }
      if (tools.has(toolDef.name) && toolDef.source === "built-in") {
        return { status: "error", error: `内置工具 ${toolDef.name} 已存在，不能覆盖` };
      }
      tools.set(toolDef.name, buildTool(toolDef));
      return { status: "success", toolName: toolDef.name };
    },

    /**
     * 注销一个工具
     */
    unregisterTool(toolName) {
      const tool = tools.get(toolName);
      if (!tool) return { status: "error", error: `工具 ${toolName} 不存在` };
      if (tool.source === "built-in") {
        return { status: "error", error: `不能注销内置工具 ${toolName}` };
      }
      tools.delete(toolName);
      return { status: "success", toolName };
    },

    /**
     * 获取工具信息
     */
    getTool(toolName) {
      return tools.get(toolName) || null;
    },

    /**
     * 列出所有已注册工具
     *
     * @param {Object} [filter] - 过滤条件（借鉴 filterToolsForAgent 模式）
     * @param {string[]} [filter.allowlist] - 允许的工具名列表
     * @param {string[]} [filter.denylist] - 禁止的工具名列表
     * @param {string} [filter.permissionMode] - 权限模式
     * @returns {Object[]} 工具信息数组
     */
    listTools(filter) {
      const filtered = filter ? filterToolsForAgent(filter) : [...tools.values()];
      return filtered.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        requiredPermissions: t.requiredPermissions,
        isReadOnly: t.isReadOnly,
        source: t.source,
        version: t.version,
      }));
    },

    /**
     * 执行工具
     *
     * 借鉴 Claude Code 的工具执行流程:
     * 1. 查找工具
     * 2. 验证输入
     * 3. 检查权限
     * 4. 检查工具链深度
     * 5. 执行工具
     * 6. 截断超长结果
     * 7. 记录执行日志
     *
     * @param {string} toolName - 工具名称
     * @param {Object} params - 输入参数
     * @param {Object} [contextOverride] - 上下文覆盖
     * @returns {Object} 执行结果
     */
    async executeTool(toolName, params = {}, contextOverride = null) {
      const tool = tools.get(toolName);
      if (!tool) {
        return { status: "error", error: `工具 ${toolName} 未注册` };
      }

      // 强转参数类型 (LLM 常将数字/布尔值以字符串形式返回)
      const coercedParams = coerceParams(tool.inputSchema, params);

      // 验证输入参数
      const validation = validateInput(tool, coercedParams);
      if (!validation.valid) {
        return { status: "error", error: "参数验证失败", details: validation.errors };
      }

      // 创建执行上下文
      const context = contextOverride || createToolUseContext({
        registry: this,
        permissionChecker,
        eventBus,
      });

      // 检查工具链深度
      if (context._chainDepth > maxChainDepth) {
        return {
          status: "error",
          error: `工具链深度超过最大限制 (${maxChainDepth})`,
        };
      }

      // Check cache for read-only tools
      const cachedResult = resultCache.get(toolName, coercedParams);
      if (cachedResult !== null) {
        const cacheRecord = {
          toolName,
          params: coercedParams,
          status: "cache_hit",
          durationMs: 0,
          timestamp: new Date().toISOString(),
        };
        executionLog.push(cacheRecord);
        capExecutionLog();
        return cachedResult;
      }

      // 权限检查
      if (permissionChecker && tool.requiredPermissions.length > 0) {
        for (const perm of tool.requiredPermissions) {
          const permResult = await permissionChecker.check(perm);
          if (!permResult.allowed) {
            const record = {
              id: randomUUID(),
              toolName,
              params,
              status: "denied",
              reason: permResult.reason || `缺少权限: ${perm}`,
              timestamp: new Date().toISOString(),
            };
            executionLog.push(record);
            capExecutionLog();
            return { status: "denied", error: record.reason, permission: perm };
          }
        }
      }

      // 执行工具
      const executionId = randomUUID();
      const startTime = Date.now();
      try {
        // 发布执行开始事件
        if (eventBus) {
          eventBus.emit("tool.execution.started", {
            executionId,
            toolName,
            params,
            timestamp: new Date().toISOString(),
          });
        }

        // Timeout wrapper: prevent hung tools from blocking the agent loop
        const TOOL_EXECUTION_TIMEOUT = tool.executionTimeoutMs || 60_000;
        let result = await Promise.race([
          tool.execute(coercedParams, context),
          new Promise((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error(`Tool "${toolName}" execution timed out after ${TOOL_EXECUTION_TIMEOUT}ms`)),
              TOOL_EXECUTION_TIMEOUT
            );
            // Allow the timer to not prevent process exit
            if (timer.unref) timer.unref();
          }),
        ]);
        const durationMs = Date.now() - startTime;

        // 截断超长结果（借鉴 Claude Code 的 maxResultSizeChars 模式）
        if (typeof result === "string" && result.length > tool.maxResultSizeChars) {
          result = result.slice(0, tool.maxResultSizeChars) + "\n...(结果已截断)";
        }

        // Cache invalidation: when a write tool modifies a file, invalidate
        // related read-tool cache entries to prevent stale reads.
        const WRITE_TOOLS = new Set(["file_write", "file_edit", "file_insert", "shell_exec"]);
        if (WRITE_TOOLS.has(toolName) && result && typeof result === "object" && result.status !== "error") {
          resultCache.invalidateForFileWrite(coercedParams);
        }

        // Cache the result for read-only tools
        resultCache.set(toolName, coercedParams, result);

        // 记录执行日志
        const record = {
          id: executionId,
          toolName,
          params: sanitizeParams(params),
          status: result.status || "success",
          durationMs,
          timestamp: new Date().toISOString(),
        };
        executionLog.push(record);
        capExecutionLog();

        // 发布执行完成事件
        if (eventBus) {
          eventBus.emit("tool.execution.completed", {
            ...record,
            resultSummary: summarizeResult(result),
          });
        }

        return result;
      } catch (err) {
        const durationMs = Date.now() - startTime;
        const record = {
          id: executionId,
          toolName,
          params: sanitizeParams(params),
          status: "error",
          error: err.message,
          durationMs,
          timestamp: new Date().toISOString(),
        };
        executionLog.push(record);
        capExecutionLog();

        if (eventBus) {
          eventBus.emit("tool.execution.failed", record);
        }

        return { status: "error", error: err.message };
      }
    },

    /**
     * 获取执行历史
     */
    getExecutionLog({ limit = 100, offset = 0 } = {}) {
      return executionLog.slice(-limit - offset, limit > 0 ? -offset || undefined : undefined);
    },

    /**
     * 获取注册表健康状态摘要
     */
    getHealth() {
      return {
        status: "ready",
        registeredTools: tools.size,
        builtInTools: [...tools.values()].filter((t) => t.source === "built-in").length,
        customTools: [...tools.values()].filter((t) => t.source !== "built-in").length,
        registeredAgents: agents.size,
        executionLogSize: executionLog.length,
        maxChainDepth,
        cacheSize: resultCache.size,
        cacheMaxSize: resultCache.maxSize,
        cacheableTools: [...resultCache.cacheableTools],
      };
    },
  };

  // Mix in agent management methods (extracted to toolAgentManager.js)
  Object.assign(registry, createAgentManager(agents, tools, filterToolsForAgent));

  registry.clearCache = () => resultCache.clear();

  registry.invalidateFileCache = (params) => resultCache.invalidateForFileWrite(params);

  registry.shutdownLsp = async () => {
    if (_lspShutdownAll) {
      await _lspShutdownAll();
      return { status: "shutdown" };
    }
    return { status: "no_lsp" };
  };

  return registry;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 脱敏参数（记录日志时不暴露敏感信息）
 */
export function sanitizeParams(params) {
  const sensitive = ["password", "token", "secret", "apiKey", "api_key", "authorization"];
  const result = {};
  for (const [key, value] of Object.entries(params)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      result[key] = "***REDACTED***";
    } else if (typeof value === "string" && value.length > 500) {
      result[key] = value.slice(0, 500) + "...(truncated)";
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 生成结果摘要（用于事件发布，不传输完整结果）
 */
export function summarizeResult(result) {
  if (typeof result === "string") {
    return { type: "string", length: result.length };
  }
  if (result && typeof result === "object") {
    return {
      type: "object",
      status: result.status || "unknown",
      keys: Object.keys(result).slice(0, 10),
    };
  }
  return { type: typeof result };
}
