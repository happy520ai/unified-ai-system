// =============================================================================
// 安全检查器 (Safety Scanner)
// =============================================================================

import { now } from "./selfEvolutionPipelineUtils.js";

/**
 * 内置的安全扫描规则
 * 检查生成代码中是否存在危险模式
 */
export const SAFETY_RULES = [
  {
    id: "no_eval",
    pattern: /\beval\s*\(/,
    severity: "critical",
    message: "Code contains eval() which is a security risk",
  },
  {
    id: "no_function_constructor",
    pattern: /new\s+Function\s*\(/,
    severity: "critical",
    message: "Code uses Function constructor which is equivalent to eval",
  },
  {
    id: "no_process_exit",
    pattern: /process\.exit\s*\(/,
    severity: "high",
    message: "Code calls process.exit() which would terminate the gateway",
  },
  {
    id: "no_child_process",
    pattern: /require\s*\(\s*["']child_process["']\s*\)|import\s+.*from\s+["']node:child_process["']/,
    severity: "high",
    message: "Code attempts to spawn child processes",
  },
  {
    id: "no_fs_write",
    pattern: /fs\.write(?:File)?\s*\(|fs\.unlink\s*\(|fs\.rmdir\s*\(/,
    severity: "medium",
    message: "Code attempts filesystem write operations",
  },
  {
    id: "no_network_access",
    pattern: /\bfetch\s*\(|http\.request\s*\(|https\.request\s*\(|net\.connect\s*\(/,
    severity: "medium",
    message: "Code attempts network access",
  },
  {
    id: "no_env_access",
    pattern: /process\.env\b/,
    severity: "low",
    message: "Code accesses environment variables",
  },
  {
    id: "no_global_mutation",
    pattern: /globalThis\s*\[|global\s*\[/,
    severity: "high",
    message: "Code attempts to mutate global state",
  },
];

/**
 * 执行安全扫描
 * @param {string} code - 源代码字符串
 * @param {Object} [options={}] - 扫描选项
 * @param {string[]} [options.allowedPatterns] - 允许的安全规则 ID（跳过检查）
 * @returns {Object} 扫描结果
 */
export function scanGeneratedCode(code, options = {}) {
  const allowedPatterns = new Set(options.allowedPatterns || []);
  const findings = [];

  for (const rule of SAFETY_RULES) {
    if (allowedPatterns.has(rule.id)) continue;

    if (rule.pattern.test(code)) {
      findings.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.message,
      });
    }
  }

  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");

  return {
    safe: !hasCritical && !hasHigh,
    findings,
    criticalCount: findings.filter((f) => f.severity === "critical").length,
    highCount: findings.filter((f) => f.severity === "high").length,
    mediumCount: findings.filter((f) => f.severity === "medium").length,
    lowCount: findings.filter((f) => f.severity === "low").length,
    scannedAt: now(),
  };
}
