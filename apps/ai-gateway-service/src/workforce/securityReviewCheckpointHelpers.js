/**
 * securityReviewCheckpointHelpers.js
 *
 * 安全审查检查点 — 常量、检测函数与审计辅助函数
 *
 * 从 securityReviewCheckpoint.js 拆分而出，保持单文件职责单一。
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

// 默认审计日志路径
export const DEFAULT_AUDIT_LOG_DIR = resolve(process.cwd(), ".data", "workforce", "audit");

// 输出大小限制：1MB
export const MAX_OUTPUT_SIZE_BYTES = 1 * 1024 * 1024;

// 敏感路径模式列表
export const FORBIDDEN_PATHS = [
  /\.ssh\//i,
  /\.aws\//i,
  /\.azure\//i,
  /\.gcloud\//i,
  /\.kube\//i,
  /\.docker\//i,
  /\.npmrc/i,
  /\.pypirc/i,
  /\.netrc/i,
  /credentials\.json/i,
  /service[_-]?account/i,
  /\.env(\.|$)/i,
  /\.git\/config/i,
  /\.git\/hooks/i,
  /shadow$/i,
  /passwd$/i,
];

// 危险命令模式列表
export const DANGEROUS_COMMANDS = [
  /\brm\s+(-rf?|--recursive)\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bcurl\b.*\|\s*(bash|sh|python|node)\b/i,
  /\bwget\b.*\|\s*(bash|sh|python|node)\b/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\bchmod\s+777\b/i,
  /\biptables\b/i,
  /\bsudo\b/i,
  /\bformat\b.*\bc:/i,
  /\breg\s+delete\b/i,
  /\bnetsh\s+firewall\b/i,
  /\btaskkill\b.*\/f/i,
  /\bnet\s+user\b.*\/add/i,
];

// API Key 检测模式
export const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  /nvapi-[A-Za-z0-9_-]{8,}/g,
  /AIza[A-Za-z0-9_-]{12,}/g,
  /gh[pousr]_[A-Za-z0-9_]{8,}/g,
  /AKIA[A-Z0-9]{12,}/g,
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

// 检查结果枚举
export const CHECK_RESULT = {
  PASS: "pass",   // 通过
  WARN: "warn",   // 警告（允许继续但记录）
  BLOCK: "block", // 阻止（必须停止执行）
};

// ---- 内部检查函数 ----

/**
 * 检查文本中是否包含密钥/令牌
 */
export function checkForSecrets(text, source) {
  if (!text || typeof text !== "string") {
    return { name: `secrets_in_${source}`, result: CHECK_RESULT.PASS, message: "无可检查文本" };
  }

  const findings = [];
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) {
      findings.push(...matches.map((m) => `${m.slice(0, 8)}...`));
    }
  }

  if (findings.length > 0) {
    return {
      name: `secrets_in_${source}`,
      result: CHECK_RESULT.BLOCK,
      message: `检测到 ${findings.length} 个疑似密钥/令牌: ${findings.slice(0, 5).join(", ")}`,
      details: { findingCount: findings.length, samples: findings.slice(0, 5) },
    };
  }

  return {
    name: `secrets_in_${source}`,
    result: CHECK_RESULT.PASS,
    message: "未检测到密钥/令牌",
  };
}

/**
 * 检查文本中是否包含禁止路径
 */
export function checkForForbiddenPaths(text, patterns) {
  if (!text || typeof text !== "string") {
    return { name: "forbidden_paths", result: CHECK_RESULT.PASS, message: "无可检查文本" };
  }

  const foundPaths = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      foundPaths.push(pattern.source);
    }
  }

  if (foundPaths.length > 0) {
    return {
      name: "forbidden_paths",
      result: CHECK_RESULT.BLOCK,
      message: `检测到 ${foundPaths.length} 个禁止路径引用`,
      details: { patterns: foundPaths.slice(0, 10) },
    };
  }

  return {
    name: "forbidden_paths",
    result: CHECK_RESULT.PASS,
    message: "未检测到禁止路径",
  };
}

/**
 * 检查文本中是否包含危险命令
 */
export function checkForDangerousCommands(text, patterns) {
  if (!text || typeof text !== "string") {
    return { name: "dangerous_commands", result: CHECK_RESULT.PASS, message: "无可检查文本" };
  }

  const foundCommands = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      foundCommands.push(pattern.source);
    }
  }

  if (foundCommands.length > 0) {
    return {
      name: "dangerous_commands",
      result: CHECK_RESULT.WARN, // 命令检查默认 warn，除非严格模式
      message: `检测到 ${foundCommands.length} 个危险命令模式`,
      details: { patterns: foundCommands.slice(0, 10) },
    };
  }

  return {
    name: "dangerous_commands",
    result: CHECK_RESULT.PASS,
    message: "未检测到危险命令",
  };
}

// ---- 审计日志辅助函数 ----

/**
 * 创建审计日志条目
 */
export function createAuditEntry({ planId, agentId, checkpoint, result, checks }) {
  return {
    timestamp: new Date().toISOString(),
    planId: planId?.trim() || "unknown",
    agentId: agentId?.trim() || "unknown",
    checkpoint,
    result,
    checks: checks.map((c) => ({
      name: c.name,
      result: c.result,
      message: c.message,
    })),
  };
}

/**
 * 写入审计日志
 */
export async function writeAuditLog(auditLogDir, planId, entry) {
  try {
    await mkdir(auditLogDir, { recursive: true });
    const logPath = resolve(auditLogDir, `${(planId || "unknown").trim()}.json`);

    // 读取现有日志
    let entries = [];
    try {
      const content = await readFile(logPath, "utf8");
      entries = JSON.parse(content);
      if (!Array.isArray(entries)) entries = [];
    } catch {
      entries = [];
    }

    entries.push(entry);

    // 限制日志大小（最多 1000 条）
    if (entries.length > 1000) {
      entries = entries.slice(-1000);
    }

    await writeFile(logPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  } catch (error) {
    // 审计日志写入失败不应阻塞执行
    console.error(`[securityReviewCheckpoint] 审计日志写入失败: ${error.message}`);
  }
}
