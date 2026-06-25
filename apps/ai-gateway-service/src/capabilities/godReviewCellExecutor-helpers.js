// =============================================================================
// GodReviewCellExecutor — Helpers, Constants & Utilities
// Extracted to keep the main executor module under 500 lines.
// =============================================================================

import path from "path";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 证据文件存储目录 */
export const EVIDENCE_DIR = path.join(process.cwd(), ".data", "capabilities", "god-review-evidence");

/** 网关调用默认超时（毫秒） */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** 评分维度定义 */
export const SCORING_CRITERIA = ["accuracy", "completeness", "clarity", "relevance", "formatting"];

/** 评分维度中文名（用于 prompt 构造） */
export const CRITERIA_LABELS = {
  accuracy: "准确性 (Accuracy)",
  completeness: "完整性 (Completeness)",
  clarity: "清晰度 (Clarity)",
  relevance: "相关性 (Relevance)",
  formatting: "格式规范 (Formatting)",
};

/** 每个维度的满分值 */
export const MAX_CRITERION_SCORE = 20;

/** 总分满分值 */
export const MAX_TOTAL_SCORE = 100;

/** 日志标签 */
export const LOG_PREFIX = "[GodReviewCell]";

// ---------------------------------------------------------------------------
// 类型定义 (JSDoc typedefs — re-exported for documentation only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ReviewModel
 * @property {string} role   - primary | critic | synthesizer
 * @property {string} provider - 供应商标识符
 * @property {number} weight - 评分权重 (0-1)
 */

/**
 * @typedef {Object} PrimaryResult
 * @property {string} text    - 生成的文本内容
 * @property {string} model   - 实际使用的模型
 * @property {number} latency - 请求延迟（毫秒）
 */

/**
 * @typedef {Object} CriticResult
 * @property {string[]} strengths    - 优点列表
 * @property {string[]} weaknesses   - 缺点列表
 * @property {string[]} suggestions  - 改进建议列表
 * @property {number}   score       - 评论者给出的总分 (0-100)
 */

/**
 * @typedef {Object} SynthesisResult
 * @property {string}   text         - 合成改进后的文本
 * @property {string[]} improvements - 本次改进点列表
 */

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} accuracy     - 准确性得分 (0-20)
 * @property {number} completeness - 完整性得分 (0-20)
 * @property {number} clarity      - 清晰度得分 (0-20)
 * @property {number} relevance    - 相关性得分 (0-20)
 * @property {number} formatting   - 格式规范得分 (0-20)
 */

/**
 * @typedef {Object} ScoreResult
 * @property {number}          totalScore - 总分 (0-100)
 * @property {ScoreBreakdown}  breakdown  - 各维度得分明细
 * @property {string}          grade      - 等级 (A/B/C/D/F)
 */

/**
 * @typedef {Object} ReviewContext
 * @property {string} prompt       - 用户原始 prompt
 * @property {string} [systemPrompt] - 系统提示词
 * @property {Object} [options]    - 附加选项
 */

/**
 * @typedef {Object} ReviewResult
 * @property {string}   id       - 审查唯一 ID
 * @property {string}   response - 最终响应文本
 * @property {number}   score    - 最终得分 (0-100)
 * @property {number}   rounds   - 实际迭代轮次
 * @property {string}   grade    - 最终等级
 * @property {Object[]} history  - 每轮详细记录
 * @property {boolean}  passed   - 是否达到最低分数要求
 * @property {number}   duration - 总耗时（毫秒）
 */

// ---------------------------------------------------------------------------
// 工具函数
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
  // Allow localhost for normal gateway operation
  if (ip === "127.0.0.1" || ip === "localhost" || ip === "::1") return false;
  // Block other private ranges
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;  // link-local / cloud metadata
  if (/^0\./.test(ip)) return true;
  if (ip === "metadata.google.internal" || ip === "metadata" || ip === "instance-data") return true;
  if (ip.endsWith(".local") || ip.endsWith(".internal")) return true;
  return false;
}

/**
 * 获取当前 ISO 时间戳字符串（安全处理文件系统非法字符）
 * @returns {string}
 */
export function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * 从 grade 字符串映射到中文描述
 * @param {string} grade
 * @returns {string}
 */
export function gradeDescription(grade) {
  const map = {
    A: "优秀 — 高质量响应，无需改进",
    B: "良好 — 质量较高，有小幅改进空间",
    C: "合格 — 基本满足要求，存在明显改进空间",
    D: "较差 — 未达标准，需要显著改进",
    F: "不合格 — 严重问题，需要重新生成",
  };
  return map[grade] || "未知等级";
}

/**
 * 根据总分计算等级
 * @param {number} totalScore
 * @returns {string}
 */
export function scoreToGrade(totalScore) {
  if (totalScore >= 90) return "A";
  if (totalScore >= 75) return "B";
  if (totalScore >= 60) return "C";
  if (totalScore >= 40) return "D";
  return "F";
}

/**
 * 安全地从 JSON 字符串中解析对象，失败时返回 fallback
 * @param {string} text
 * @param {*} fallback
 * @returns {*}
 */
export function safeJsonParse(text, fallback = null) {
  try {
    // 尝试提取 JSON 代码块
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1].trim());
    }
    // 尝试直接解析
    return JSON.parse(text);
  } catch {
    // 尝试找到第一个 { 或 [ 开头的 JSON
    const firstBrace = text.search(/[\[{]/);
    if (firstBrace !== -1) {
      try {
        const sub = text.slice(firstBrace);
        // 寻找匹配的结束括号
        let depth = 0;
        let end = -1;
        const open = sub[0];
        const close = open === "{" ? "}" : "]";
        for (let i = 0; i < sub.length; i++) {
          if (sub[i] === open) depth++;
          else if (sub[i] === close) depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
        if (end > 0) {
          return JSON.parse(sub.slice(0, end));
        }
      } catch {
        // 彻底失败
      }
    }
    return fallback;
  }
}

/**
 * 简单的日志输出辅助
 * @param {string} level
 * @param {string} message
 * @param {Object} [data]
 */
export function log(level, message, data) {
  const entry = { ts: new Date().toISOString(), level, msg: `${LOG_PREFIX} ${message}` };
  if (data !== undefined) entry.data = data;

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
