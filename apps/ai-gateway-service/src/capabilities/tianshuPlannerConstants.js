// =============================================================================
// 天枢规划器 — 常量、类型与纯工具函数
// Tianshu Planner — Constants, types, and pure utility helpers
// =============================================================================

import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// 路径与常量
// ---------------------------------------------------------------------------

/** 计划持久化目录 */
export const PLANS_DIR = join(process.cwd(), ".data", "capabilities", "tianshu-plans");

/** 单次网关调用默认超时 (ms) */
export const DEFAULT_GATEWAY_TIMEOUT = 30_000;

/** 子任务执行默认超时 (ms) */
export const SUB_TASK_TIMEOUT = 60_000;

/** 任务状态枚举 */
export const STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  SKIPPED: "skipped",
});

/** 复杂度等级描述 */
export const COMPLEXITY_LABELS = {
  1: "trivial",
  2: "simple",
  3: "moderate",
  4: "complex",
  5: "highly-complex",
};

/**
 * 任务类型 → 推荐提供者映射
 * 根据子任务描述中检测到的类型关键字选择最合适的模型提供者
 */
export const PROVIDER_MAPPING = {
  code: ["qwen-coder", "deepseek-coder", "gpt-4o"],
  reasoning: ["deepseek-reasoner", "qwen-max", "o1-preview"],
  translation: ["qwen-max", "gpt-4o", "claude-3-5-sonnet"],
  analysis: ["qwen-max", "deepseek-chat", "gpt-4o"],
  creative: ["claude-3-5-sonnet", "gpt-4o", "qwen-max"],
  summarization: ["qwen-turbo", "gpt-4o-mini", "deepseek-chat"],
  data_extraction: ["qwen-max", "gpt-4o", "deepseek-chat"],
  general: ["auto"],
};

// ---------------------------------------------------------------------------
// 类型定义 (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SubTask
 * @property {string} id                  - 唯一任务标识 (UUID)
 * @property {string} name                - 可读名称
 * @property {string} description         - 详细描述
 * @property {string[]} dependencies      - 前置依赖任务 id 列表
 * @property {string} assignedProvider    - 分配的执行提供者
 * @property {string} status              - pending|running|completed|failed|skipped
 * @property {Object|null} result         - 执行结果
 * @property {number} duration            - 执行耗时 (ms)
 * @property {string} taskType            - 检测到的任务类型
 * @property {number} estimatedDuration   - 预估耗时 (ms)
 */

/**
 * @typedef {Object} ComplexityAnalysis
 * @property {number} complexity          - 复杂度等级 1-5
 * @property {number} estimatedSubTasks   - 预估子任务数
 * @property {string[]} riskFactors       - 风险因素列表
 * @property {string[]} capabilities      - 所需能力列表
 */

/**
 * @typedef {Object} ExecutionDAG
 * @property {string[][]} executionOrder  - 拓扑排序后的并行执行分组
 * @property {number} maxDepth            - DAG 最大深度
 * @property {number} parallelismFactor   - 平均并行度
 */

/**
 * @typedef {Object} Plan
 * @property {string} planId              - 计划唯一标识
 * @property {string} taskDescription     - 原始任务描述
 * @property {ComplexityAnalysis} analysis - 复杂度分析结果
 * @property {SubTask[]} subTasks         - 子任务列表
 * @property {ExecutionDAG} dag           - 执行 DAG
 * @property {string} status              - 计划状态
 * @property {number} estimatedDuration   - 预估总耗时 (ms)
 * @property {number|null} actualDuration - 实际总耗时 (ms)
 * @property {string} createdAt           - 创建时间 ISO 字符串
 * @property {string|null} completedAt    - 完成时间 ISO 字符串
 */

// ---------------------------------------------------------------------------
// 纯工具函数
// ---------------------------------------------------------------------------

/**
 * Check if a hostname resolves to a private/reserved network address (SSRF protection).
 * Allows localhost (127.0.0.1) since the gateway normally runs locally.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isUnsafeGatewayHost(hostname) {
  if (!hostname) return true;
  const ip = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (ip === "127.0.0.1" || ip === "localhost" || ip === "::1") return false;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  if (ip === "metadata.google.internal" || ip === "metadata" || ip === "instance-data") return true;
  if (ip.endsWith(".local") || ip.endsWith(".internal")) return true;
  return false;
}

/**
 * 生成短 UUID（取前 8 位）
 * @returns {string}
 */
export function shortId() {
  return randomUUID().split("-")[0];
}

/**
 * 安全解析 JSON，失败时返回 fallback
 * @param {string} text
 * @param {*} fallback
 * @returns {*}
 */
export function safeJsonParse(text, fallback = null) {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }
    return JSON.parse(text);
  } catch {
    const braceMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[1]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

/**
 * 计算两个时间戳之间的差值 (ms)
 * @param {[number, number]} hrtime
 * @returns {number}
 */
export function elapsedMs(hrtime) {
  const [sec, nsec] = process.hrtime(hrtime);
  return Math.round(sec * 1000 + nsec / 1_000_000);
}

// ---------------------------------------------------------------------------
// Prompt 构建器
// ---------------------------------------------------------------------------

/** @returns {string} 复杂度分析系统提示词 */
export function buildComplexitySystemPrompt() {
  return [
    "You are a task complexity analyzer for an AI planning system.",
    "Evaluate the given task and respond ONLY with valid JSON (no markdown).",
    "Return exactly this schema:",
    '{',
    '  "complexity": <integer 1-5>,',
    '  "estimatedSubTasks": <integer 1-20>,',
    '  "riskFactors": ["<string>", ...],',
    '  "capabilities": ["<string>", ...]',
    '}',
    "",
    "Complexity levels:",
    "  1 = trivial (single step, no ambiguity)",
    "  2 = simple (2-3 steps, well-defined)",
    "  3 = moderate (4-8 steps, some uncertainty)",
    "  4 = complex (8-15 steps, multiple domains)",
    "  5 = highly-complex (15+ steps, high uncertainty, cross-domain)",
  ].join("\n");
}

/**
 * @param {Object} analysis
 * @param {number} maxSubTasks
 * @returns {string} 任务分解系统提示词
 */
export function buildDecomposeSystemPrompt(analysis, maxSubTasks) {
  return [
    "You are a task decomposition engine for an AI planning system.",
    "Break down the given task into specific, actionable sub-tasks.",
    "Respond ONLY with valid JSON (no markdown).",
    `Return an array of EXACTLY ${analysis.estimatedSubTasks} sub-tasks.`,
    "",
    "Each sub-task schema:",
    '{',
    '  "name": "<short name>",',
    '  "description": "<detailed description of what to do>",',
    '  "dependencies": [<0-based indices of prerequisite tasks>],',
    '  "taskType": "<one of: code|reasoning|translation|analysis|creative|summarization|data_extraction|general>",',
    '  "estimatedDuration": <estimated milliseconds>',
    '}',
    "",
    "Rules:",
    "- Dependencies reference task indices (0-based). First task should have empty dependencies.",
    "- Keep each sub-task focused and independently executable.",
    "- Order tasks logically — earlier tasks should not depend on later ones.",
    `- Return exactly ${analysis.estimatedSubTasks} tasks (minimum 1, maximum ${maxSubTasks}).`,
  ].join("\n");
}

/**
 * @param {Object} analysis
 * @param {string} taskDescription
 * @returns {string} 任务分解用户消息
 */
export function buildDecomposeUserMsg(analysis, taskDescription) {
  return [
    `Task: ${taskDescription}`,
    "",
    `Complexity: ${analysis.complexity} (${COMPLEXITY_LABELS[analysis.complexity] || "moderate"})`,
    `Required capabilities: ${analysis.capabilities.join(", ")}`,
    `Risk factors: ${analysis.riskFactors.join(", ")}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 任务解析与提供者分配
// ---------------------------------------------------------------------------

/**
 * 解析 AI 返回的子任务列表，构建带 ID 映射的 SubTask[]
 * @param {*} parsed - AI 返回的原始解析结果
 * @param {string} taskDescription
 * @param {number} maxSubTasks
 * @returns {Object[]} 解析后的子任务列表（可能为 fallback 单任务）
 */
export function parseDecomposedTasks(parsed, taskDescription, maxSubTasks) {
  const fallbackTasks = [{
    id: shortId(), name: "Execute task", description: taskDescription,
    dependencies: [], taskType: "general", estimatedDuration: 30_000,
  }];

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
    parsed = arrayKey ? parsed[arrayKey] : null;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return fallbackTasks;

  const idMap = parsed.map(() => shortId());
  const validTypes = Object.keys(PROVIDER_MAPPING);

  return parsed.slice(0, maxSubTasks).map((raw, index) => {
    const rawDeps = Array.isArray(raw.dependencies) ? raw.dependencies : [];
    const resolvedDeps = rawDeps
      .filter((d) => typeof d === "number" && d >= 0 && d < index && d < idMap.length)
      .map((d) => idMap[d]);

    return {
      id: idMap[index],
      name: String(raw.name || `Task ${index + 1}`).slice(0, 100),
      description: String(raw.description || ""),
      dependencies: resolvedDeps,
      taskType: validTypes.includes(raw.taskType) ? raw.taskType : "general",
      estimatedDuration: Math.max(1000, Number(raw.estimatedDuration) || 10_000),
      assignedProvider: "",
      status: STATUS.PENDING,
      result: null,
      duration: 0,
    };
  });
}

/**
 * 为每个子任务选择最优执行提供者（纯函数）
 * @param {Object[]} subTasks
 * @returns {Object[]} 带有 assignedProvider 的子任务列表
 */
export function assignProvidersToTasks(subTasks) {
  for (const task of subTasks) {
    const candidates = PROVIDER_MAPPING[task.taskType] || PROVIDER_MAPPING.general;
    const desc = task.description.toLowerCase();
    let selected = candidates[0];

    if (task.taskType === "general") {
      if (/\b(code|function|api|script|debug|refactor|implement)\b/.test(desc)) {
        selected = PROVIDER_MAPPING.code[0];
      } else if (/\b(translat|i18n|locali[sz]|中文|english|翻译)\b/.test(desc)) {
        selected = PROVIDER_MAPPING.translation[0];
      } else if (/\b(analy[sz]e|evaluate|compare|review)\b/.test(desc)) {
        selected = PROVIDER_MAPPING.analysis[0];
      } else if (/\b(creat|writ|story|design|brainstorm)\b/.test(desc)) {
        selected = PROVIDER_MAPPING.creative[0];
      } else if (/\b(summar|brief|tldr|摘要|总结)\b/.test(desc)) {
        selected = PROVIDER_MAPPING.summarization[0];
      }
    }

    task.assignedProvider = selected;
  }
  return subTasks;
}

// ---------------------------------------------------------------------------
// 进度监控
// ---------------------------------------------------------------------------

/**
 * 计算计划执行进度（纯函数）
 * @param {Object} plan
 * @returns {{ planId: string, status: string, progress: Object, failedTasks: Object[], blockedTasks: Object[] }}
 */
export function computePlanProgress(plan) {
  const total = plan.subTasks.length;
  const completed = plan.subTasks.filter((t) => t.status === STATUS.COMPLETED).length;
  const failed = plan.subTasks.filter((t) => t.status === STATUS.FAILED).length;
  const running = plan.subTasks.filter((t) => t.status === STATUS.RUNNING).length;
  const pending = plan.subTasks.filter((t) => t.status === STATUS.PENDING).length;
  const skipped = plan.subTasks.filter((t) => t.status === STATUS.SKIPPED).length;

  const failedTasks = plan.subTasks.filter((t) => t.status === STATUS.FAILED);
  const blockedTasks = plan.subTasks.filter((t) =>
    t.status === STATUS.PENDING &&
    t.dependencies.some((depId) => {
      const dep = plan.subTasks.find((s) => s.id === depId);
      return dep && (dep.status === STATUS.FAILED || dep.status === STATUS.SKIPPED);
    })
  );

  return {
    planId: plan.planId,
    status: plan.status,
    progress: {
      total, completed, failed, running, pending, skipped,
      percent: total > 0 ? Math.round(((completed + skipped) / total) * 100) : 0,
    },
    failedTasks,
    blockedTasks,
  };
}
