/**
 * Command Classifier - 命令分类器
 *
 * 从 permissionGate.js 提取的纯函数:
 * - classifyCommand: 分类 shell 命令的风险级别
 *
 * 借鉴 Claude Code 的 bashClassifier + readOnlyCommandValidation 模式:
 * 1. 先检查是否匹配危险模式 -> 提升风险
 * 2. 再检查是否匹配安全模式 -> 标记为 safe
 * 3. 默认标记为 cautious
 *
 * @module commandClassifier
 */

import { RISK_LEVELS, DANGEROUS_COMMAND_PATTERNS, SAFE_COMMAND_PATTERNS } from "./permissionConstants.js";

/**
 * 分类 shell 命令的风险级别
 *
 * @param {string} command - shell 命令
 * @returns {Object} 分类结果 { level, reason, pattern?, isReadOnly }
 */
export function classifyCommand(command) {
  if (!command || typeof command !== "string") {
    return { level: RISK_LEVELS.FORBIDDEN, reason: "空命令" };
  }

  const trimmed = command.trim();

  // 1. 检查危险模式（优先级最高）
  for (const { pattern, description, level } of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level,
        reason: `匹配危险命令模式: ${description}`,
        pattern: pattern.toString(),
        isReadOnly: false,
      };
    }
  }

  // 2. 检查安全只读模式
  for (const pattern of SAFE_COMMAND_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        level: RISK_LEVELS.SAFE,
        reason: "匹配只读命令模式",
        isReadOnly: true,
      };
    }
  }

  // 3. 默认: 未识别的命令视为 cautious
  return {
    level: RISK_LEVELS.CAUTIOUS,
    reason: "未识别的命令模式，默认为 cautious",
    isReadOnly: false,
  };
}
