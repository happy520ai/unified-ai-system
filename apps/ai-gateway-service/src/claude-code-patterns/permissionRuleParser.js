/**
 * Permission Rule Parser - 权限规则解析器
 *
 * 从 permissionGate.js 提取的纯函数:
 * - resolvePermissionMode: 将 Codex 风格模式解析为 PME 内部模式
 * - parsePermissionRule: 解析权限规则字符串为结构化对象
 * - matchesRule: 检查操作是否匹配权限规则
 *
 * 借鉴 Claude Code 的 permissionRuleParser 模式:
 * - "allow:Bash(npm test)" -> 允许执行 npm test
 * - "deny:Bash(rm *)" -> 禁止执行 rm 命令
 * - "allow:Read(/tmp/**)" -> 允许读取 /tmp 下文件
 * - "allow:mcp__server__tool" -> 允许特定 MCP 工具
 *
 * @module permissionRuleParser
 */

import { PERMISSION_BEHAVIORS, CODEX_MODE_ALIASES } from "./permissionConstants.js";

/**
 * 将 Codex 风格模式解析为 PME 内部模式
 *
 * @param {string} modeOrAlias - 模式标识（支持 PME 原生 + Codex 别名）
 * @returns {{ mode: string, confirmEachStep: boolean, isCodexAlias: boolean }}
 */
export function resolvePermissionMode(modeOrAlias) {
  // Codex 别名
  const alias = CODEX_MODE_ALIASES[modeOrAlias];
  if (alias) {
    return {
      mode: alias.pmeMode,
      confirmEachStep: alias.confirmEachStep || false,
      isCodexAlias: true,
    };
  }

  // PME 原生模式
  const nativeModes = ["default", "readOnly", "bypass", "dontAsk", "strict"];
  if (nativeModes.includes(modeOrAlias)) {
    return { mode: modeOrAlias, confirmEachStep: false, isCodexAlias: false };
  }

  // 默认 fallback
  return { mode: "default", confirmEachStep: false, isCodexAlias: false };
}

/**
 * 解析权限规则字符串
 *
 * @param {string} ruleStr - 规则字符串
 * @returns {Object} 解析后的规则对象
 */
export function parsePermissionRule(ruleStr) {
  const trimmed = ruleStr.trim();

  // 格式: behavior:type(pattern)
  const match = trimmed.match(/^(allow|deny):(\w+)(?:\((.+)\))?$/);
  if (match) {
    return {
      behavior: match[1] === "allow" ? PERMISSION_BEHAVIORS.ALLOW : PERMISSION_BEHAVIORS.DENY,
      type: match[2],
      pattern: match[3] || "*",
      raw: trimmed,
    };
  }

  // 格式: behavior:toolName（简写，无模式）
  const simpleMatch = trimmed.match(/^(allow|deny):(.+)$/);
  if (simpleMatch) {
    return {
      behavior: simpleMatch[1] === "allow" ? PERMISSION_BEHAVIORS.ALLOW : PERMISSION_BEHAVIORS.DENY,
      type: "tool",
      pattern: simpleMatch[2],
      raw: trimmed,
    };
  }

  return null;
}

/**
 * 检查操作是否匹配权限规则
 *
 * @param {Object} rule - 解析后的规则对象
 * @param {string} action - 操作标识（如 "shell:exec", "file:read"）
 * @param {Object} [context] - 操作上下文（如命令内容、文件路径）
 * @returns {boolean} 是否匹配
 */
export function matchesRule(rule, action, context = {}) {
  // 类型匹配
  const actionType = action.split(":")[0];
  if (rule.type !== actionType && rule.type !== "tool" && rule.type !== "*") {
    return false;
  }

  // 通配符匹配
  if (rule.pattern === "*") return true;

  // 具体模式匹配
  if (context.command && rule.type === "Bash") {
    // 简单的通配符匹配（支持 * 和 **）
    const escaped = rule.pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      "^" + escaped.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    );
    return regex.test(context.command);
  }

  if (context.path && (rule.type === "Read" || rule.type === "Write" || rule.type === "Edit")) {
    const escaped = rule.pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      "^" + escaped.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$"
    );
    return regex.test(context.path);
  }

  // 工具名匹配
  if (rule.type === "tool") {
    return rule.pattern === action || action.startsWith(rule.pattern);
  }

  return rule.pattern === action;
}
