// =============================================================================
// liveSkillRegistry-utils.js
// Pure utility functions extracted from liveSkillRegistry.js
// =============================================================================

import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * 检查文件是否存在
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用 Node.js --check 验证 JavaScript 文件语法
 * @param {string} filePath - 待检查的文件路径
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export function syntaxCheck(filePath) {
  return new Promise((resolvePromise) => {
    execFile(
      process.execPath,
      ["--check", filePath],
      { timeout: 15000 },
      (error, _stdout, stderr) => {
        if (error) {
          resolvePromise({
            valid: false,
            error: stderr?.trim() || error.message || "syntax check failed",
          });
        } else {
          resolvePromise({ valid: true, error: null });
        }
      },
    );
  });
}

/**
 * 带超时的 Promise 包装
 * @param {Promise} promise - 原始 Promise
 * @param {number} timeoutMs - 超时毫秒数
 * @param {string} label - 超时错误标签
 * @returns {Promise}
 */
export function withTimeout(promise, timeoutMs, label = "operation") {
  let timer;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * 计算内容的 SHA-256 哈希
 * @param {string} content - 内容字符串
 * @returns {string} 十六进制哈希值
 */
export function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 获取当前 ISO-8601 时间戳
 * @returns {string}
 */
export function now() {
  return new Date().toISOString();
}
