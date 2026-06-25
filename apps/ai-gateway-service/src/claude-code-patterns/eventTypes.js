/**
 * Event Types & PipelineEvent - 事件类型定义与增强型事件对象
 *
 * 从 eventDrivenPipeline.js 拆出的纯数据 / 纯类模块:
 * - EVENT_TYPES: AI 网关请求处理管线的标准事件类型常量
 * - PipelineEvent: 增强型事件对象，支持 stopImmediatePropagation
 *
 * @module eventTypes
 */

import { randomUUID } from "node:crypto";

// ============================================================
// 标准事件类型定义
// ============================================================

/**
 * AI 网关请求处理管线的标准事件类型
 * 借鉴 Claude Code 的事件分类:
 * - 请求生命周期: received -> classified -> model_selected -> called -> scored -> delivered
 * - 工具执行: tool.execution.started -> tool.execution.completed / tool.execution.failed
 * - MCP 交互: mcp.server.connected / mcp.tool.call.started / mcp.tool.call.completed
 * - 会话状态: session.state.changed (idle / running / requires_action)
 */
export const EVENT_TYPES = Object.freeze({
  // 请求生命周期事件
  REQUEST_RECEIVED: "request.received",
  REQUEST_CLASSIFIED: "request.classified",
  MODEL_SELECTED: "model.selected",
  MODEL_CALLED: "model.called",
  RESPONSE_SCORED: "response.scored",
  RESPONSE_DELIVERED: "response.delivered",

  // 工具执行事件
  TOOL_EXECUTION_STARTED: "tool.execution.started",
  TOOL_EXECUTION_COMPLETED: "tool.execution.completed",
  TOOL_EXECUTION_FAILED: "tool.execution.failed",

  // MCP 事件
  MCP_SERVER_REGISTERED: "mcp.server.registered",
  MCP_SERVER_CONNECTED: "mcp.server.connected",
  MCP_SERVER_DISCONNECTED: "mcp.server.disconnected",
  MCP_SERVER_RECONNECTING: "mcp.server.reconnecting",
  MCP_TOOL_CALL_STARTED: "mcp.tool.call.started",
  MCP_TOOL_CALL_COMPLETED: "mcp.tool.call.completed",

  // 会话状态事件
  SESSION_STATE_CHANGED: "session.state.changed",

  // 权限事件
  PERMISSION_CHECKED: "permission.checked",
  PERMISSION_DENIED: "permission.denied",
  PERMISSION_APPROVED: "permission.approved",

  // 错误事件
  ERROR_OCCURRED: "error.occurred",
});

// ============================================================
// 增强型事件对象（借鉴 Claude Code 的 Event 类）
// ============================================================

/**
 * 增强型事件对象
 * 借鉴 Claude Code 的 Event 类，支持:
 * - stopImmediatePropagation(): 阻止后续同事件监听器执行
 * - stopPropagation(): 标记事件已处理
 * - 结构化元数据（timestamp, sessionId, eventId）
 */
export class PipelineEvent {
  constructor(type, data = {}) {
    /** 事件类型 */
    this.type = type;
    /** 事件数据 */
    this.data = data;
    /** 事件唯一 ID */
    this.eventId = data.eventId || randomUUID();
    /** 事件时间戳 */
    this.timestamp = data.timestamp || new Date().toISOString();
    /** 会话 ID */
    this.sessionId = data.sessionId || null;
    /** 请求 ID（关联同一请求的所有事件） */
    this.requestId = data.requestId || null;
    /** 内部标记 */
    this._stopped = false;
    this._immediateStopped = false;
  }

  /**
   * 阻止事件冒泡（标记事件已被处理）
   */
  stopPropagation() {
    this._stopped = true;
  }

  /**
   * 立即阻止后续同事件监听器执行
   * 借鉴 Claude Code EventEmitter 中的 didStopImmediatePropagation 检查
   */
  stopImmediatePropagation() {
    this._stopped = true;
    this._immediateStopped = true;
  }

  /** 是否已阻止冒泡 */
  isPropagationStopped() {
    return this._stopped;
  }

  /** 是否已立即阻止 */
  isImmediatePropagationStopped() {
    return this._immediateStopped;
  }

  /** 序列化为可持久化的纯对象 */
  toJSON() {
    return {
      eventId: this.eventId,
      type: this.type,
      data: this.data,
      timestamp: this.timestamp,
      sessionId: this.sessionId,
      requestId: this.requestId,
    };
  }
}
