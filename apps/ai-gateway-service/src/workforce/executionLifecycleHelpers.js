/**
 * executionLifecycleHelpers.js
 *
 * Extracted pure helpers for executionLifecycle module.
 * Keeps state machine constants, transition logic, persistence,
 * and result sanitization out of the main lifecycle file.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// 有效的状态转换映射 (依赖 EXECUTION_STATUS，由主模块注入)
export function buildValidTransitions(EXECUTION_STATUS) {
  return {
    [EXECUTION_STATUS.PENDING]: [EXECUTION_STATUS.RUNNING, EXECUTION_STATUS.CANCELLED],
    [EXECUTION_STATUS.RUNNING]: [
      EXECUTION_STATUS.PAUSED,
      EXECUTION_STATUS.COMPLETED,
      EXECUTION_STATUS.FAILED,
      EXECUTION_STATUS.CANCELLED,
      EXECUTION_STATUS.FORCE_STOPPED,
    ],
    [EXECUTION_STATUS.PAUSED]: [
      EXECUTION_STATUS.RUNNING,
      EXECUTION_STATUS.CANCELLED,
      EXECUTION_STATUS.FORCE_STOPPED,
    ],
    [EXECUTION_STATUS.COMPLETED]: [],
    [EXECUTION_STATUS.FAILED]: [EXECUTION_STATUS.PENDING], // 允许重试
    [EXECUTION_STATUS.CANCELLED]: [EXECUTION_STATUS.PENDING], // 允许重试
    [EXECUTION_STATUS.FORCE_STOPPED]: [EXECUTION_STATUS.PENDING], // 允许重试
  };
}

/**
 * 验证状态转换是否合法
 */
export function validateTransition(state, targetStatus, VALID_TRANSITIONS) {
  const allowed = VALID_TRANSITIONS[state.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `无效的状态转换: ${state.status} -> ${targetStatus}。允许的目标状态: ${allowed.join(", ") || "无"}`,
    );
  }
}

/**
 * 执行状态转换
 */
export function transition(state, targetStatus, reason) {
  const now = new Date();
  state.transitions.push({
    from: state.status,
    to: targetStatus,
    at: now.toISOString(),
    reason: reason || `状态转换: ${state.status} -> ${targetStatus}`,
  });
  state.status = targetStatus;
}

/**
 * 清理 planId 中的非法字符，防止路径穿越 / 超长文件名
 */
export function sanitizePlanId(id) {
  return String(id).replace(/[^a-zA-Z0-9_.\-]/g, "_").replace(/^\.+/, "").slice(0, 128);
}

/**
 * 持久化状态到磁盘
 */
export async function persistState(lifecycleDir, planId, state) {
  try {
    await mkdir(lifecycleDir, { recursive: true });
    const filePath = resolve(lifecycleDir, `${sanitizePlanId(planId)}.json`);
    await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch (error) {
    // 持久化失败不阻塞执行
    console.error(`[executionLifecycle] 持久化状态失败: ${error.message}`);
  }
}

/**
 * 从磁盘加载状态
 */
export async function loadState(lifecycleDir, planId) {
  try {
    const filePath = resolve(lifecycleDir, `${sanitizePlanId(planId)}.json`);
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 清理 Agent 结果中的大字段
 */
export function sanitizeResult(result) {
  if (!result || typeof result !== "object") return result;
  const sanitized = { ...result };
  // 限制大文本字段
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === "string" && sanitized[key].length > 10000) {
      sanitized[key] = sanitized[key].slice(0, 10000) + "...[truncated]";
    }
  }
  return sanitized;
}
