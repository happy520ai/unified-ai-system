/**
 * Claude Code 模式融合模块 - 统一入口
 *
 * 从 Claude Code v2.1.88 源码中提取的设计模式，独立重实现并融入 AI 网关系统。
 * 所有模块均为 PME 原创实现，仅借鉴架构层面的设计模式。
 *
 * 模块列表:
 * - agentToolRegistry: Agent 工具注册表（借鉴 AgentTool 模式）
 * - mcpBridge: MCP 协议桥接器（借鉴 MCP client/server 模式）
 * - eventDrivenPipeline: 事件驱动管线（借鉴 EventEmitter + sdkEventQueue 模式）
 * - permissionGate: 权限门控系统（借鉴 PermissionMode + bashClassifier 模式）
 *
 * @module claude-code-patterns
 */

export {
  createAgentToolRegistry,
  buildTool,
  createInputSchema,
  createToolUseContext,
  getBuiltInTools,
} from "./agentToolRegistry.js";

export {
  createMcpBridge,
  createMcpClient,
  createStdioTransport,
  createHttpTransport,
  validateServerConfig,
} from "./mcpBridge.js";

export {
  createEventDrivenPipeline,
  createEventBus,
  createEventPersistence,
  createEventReplayer,
  createEventQueue,
  PipelineEvent,
  EVENT_TYPES,
} from "./eventDrivenPipeline.js";

export {
  createPermissionGate,
  classifyCommand,
  parsePermissionRule,
  RISK_LEVELS,
  PERMISSION_BEHAVIORS,
  DANGEROUS_COMMAND_PATTERNS,
  SAFE_COMMAND_PATTERNS,
  DEFAULT_RISK_RULES,
} from "./permissionGate.js";
