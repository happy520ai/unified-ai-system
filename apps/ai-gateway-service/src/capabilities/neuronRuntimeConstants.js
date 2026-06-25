// =============================================================================
// 神经元运行时常量 (Neuron Runtime Constants)
// 从 neuronRuntimeExecutor.js 提取的常量和路径定义
// =============================================================================

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// 路径常量
// ---------------------------------------------------------------------------

/** 当前模块所在目录 */
export const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 项目根目录（ai-gateway-service）
 * 从 src/capabilities/ 向上两级
 */
export const ROOT = resolve(__dirname, "../..");

/** 默认执行日志路径 */
export const DEFAULT_EXECUTION_LOG_PATH = join(ROOT, ".data", "capabilities", "execution-log.jsonl");

/** 默认性能统计路径 */
export const DEFAULT_PERFORMANCE_STATS_PATH = join(ROOT, ".data", "capabilities", "performance-stats.json");

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 神经元类型与其在请求生命周期中对应阶段的映射 */
export const TYPE_TO_HOOK_STAGE = {
  safety: "beforeChatExecute",
  planning: "beforeChatExecute",
  context: "onRoutingDecision",
  transform: "onRoutingDecision",
  review: "afterModelSelection",
  evidence: "beforeResponseReturn",
  analysis: "beforeResponseReturn",
  monitoring: "beforeResponseReturn",
  routing: "onRoutingDecision",
  generation: "beforeResponseReturn",
};

/** 最大执行超时（毫秒） */
export const MAX_EXECUTION_TIMEOUT_MS = 30000;

/** 默认单神经元超时（毫秒） */
export const DEFAULT_NEURON_TIMEOUT_MS = 15000;

/** 执行日志保留条数上限 */
export const MAX_LOG_ENTRIES_PER_SKILL = 200;
