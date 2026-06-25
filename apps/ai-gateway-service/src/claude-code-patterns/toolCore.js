/**
 * toolCore.js — Schema factories and tool-use context primitives.
 *
 * Split from agentToolRegistry.js for 分层律 compliance (single file ≤ 500 lines).
 */

import { randomUUID } from "node:crypto";

// ============================================================
// 工具定义类型
// ============================================================

/**
 * 工具输入 Schema（JSON Schema 格式）
 * 借鉴 Claude Code 的 ToolInputJSONSchema 模式
 */
export function createInputSchema(properties, required = []) {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * 工具执行上下文
 * 借鉴 Claude Code 的 ToolUseContext 模式:
 * - 工具可以访问注册表以调用其他工具（工具链）
 * - 工具可以查询权限系统
 * - 工具可以发布事件
 */
export function createToolUseContext({ registry, permissionChecker, eventBus, agentId, sessionId }) {
  return {
    agentId: agentId || "unknown",
    sessionId: sessionId || randomUUID(),
    /**
     * 调用另一个工具（工具链模式）
     * 借鉴 Claude Code 中 Agent 内部可以调用其他工具的模式
     */
    async callTool(toolName, params) {
      return registry.executeTool(toolName, params, {
        ...this,
        _chainDepth: (this._chainDepth || 0) + 1,
      });
    },
    /** 检查权限 */
    async checkPermission(action) {
      if (!permissionChecker) return { allowed: true };
      return permissionChecker.check(action);
    },
    /** 发布事件 */
    emitEvent(eventType, data) {
      if (eventBus) {
        eventBus.emit(eventType, data);
      }
    },
    _chainDepth: 0,
  };
}

// ============================================================
// 工具定义工厂
// ============================================================

/**
 * 构建一个工具定义
 * 借鉴 Claude Code 的 buildTool() 工厂模式
 *
 * @param {Object} def - 工具定义
 * @param {string} def.name - 工具名称
 * @param {string} def.description - 工具描述
 * @param {Object} def.inputSchema - JSON Schema 格式的输入定义
 * @param {Function} def.execute - 执行函数 async (params, context) => result
 * @param {string[]} def.requiredPermissions - 需要的权限列表
 * @param {number} [def.maxResultSizeChars] - 结果最大字符数
 * @param {boolean} [def.isReadOnly] - 是否只读操作
 * @returns {Object} 标准化的工具定义
 */
export function buildTool(def) {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema || createInputSchema({}),
    execute: def.execute,
    requiredPermissions: def.requiredPermissions || [],
    maxResultSizeChars: def.maxResultSizeChars || 100_000,
    isReadOnly: def.isReadOnly ?? false,
    /** 来源标记，区分内置工具 vs 外部注册工具 */
    source: def.source || "built-in",
    /** 工具版本号 */
    version: def.version || "1.0.0",
  };
}
