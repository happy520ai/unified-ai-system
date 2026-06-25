// =============================================================================
// 自进化管线工具函数 (Self-Evolution Pipeline Utilities)
// =============================================================================

import { stat } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";

/**
 * Sanitize capabilityId to prevent path traversal.
 * @param {string} id
 * @returns {string}
 */
export function sanitizeCapabilityId(id) {
  if (typeof id !== "string" || !/^[\w-]+$/.test(id)) {
    throw new Error(`[selfEvolutionPipeline] Invalid capabilityId: ${JSON.stringify(id)}. Only alphanumeric, underscore, and hyphen allowed.`);
  }
  return id;
}

/**
 * 检查文件是否存在
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * 获取当前 ISO-8601 时间戳
 * @returns {string}
 */
export function now() {
  return new Date().toISOString();
}

/**
 * 带超时的 Promise 包装
 * @param {Promise} promise
 * @param {number} timeoutMs
 * @param {string} label
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
 * 生成唯一的能力 ID
 * @param {string} [prefix="neuron"] - ID 前缀
 * @returns {string}
 */
export function generateCapabilityId(prefix = "neuron") {
  const uuid = randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}-${uuid}`;
}

/**
 * 计算内容的 SHA-256 哈希
 * @param {string} content
 * @returns {string}
 */
export function sha256(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 构造管线步骤失败时的返回结果
 *
 * @param {string} failedStep - 失败的步骤名
 * @param {Error} error - 错误对象
 * @param {Object[]} steps - 已执行的步骤记录
 * @param {number} startTime - 管线开始时间戳
 * @param {Object|null} spec - 规格（可能已生成）
 * @param {Object|null} codeResult - 代码生成结果（可能已生成）
 * @returns {Object}
 */
export function createFailureResult(failedStep, error, steps, startTime, spec = null, codeResult = null) {
  const durationMs = Date.now() - startTime;

  const result = {
    success: false,
    failedStep,
    error: error.message || String(error),
    capabilityId: spec?.capabilityId || null,
    type: spec?.type || null,
    filePath: codeResult?.filePath || null,
    steps,
    durationMs,
    completedAt: now(),
  };

  return result;
}
