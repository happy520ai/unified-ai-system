/**
 * executionLifecycleHelpers.js
 *
 * Extracted pure helpers for executionLifecycle module.
 * Keeps state machine constants, transition logic, persistence,
 * and result sanitization out of the main lifecycle file.
 */

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createLogRedactor } from "./logRedactor.js";

const MAX_LIFECYCLE_BYTES = 1024 * 1024;
const lifecycleWriteTails = new Map();
const lifecycleRedactor = createLogRedactor();

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
  const normalized = String(id ?? "").trim();
  if (!normalized || normalized.length > 512 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw Object.assign(new Error("The lifecycle plan identifier is invalid."), {
      code: "WORKFORCE_LIFECYCLE_ID_INVALID",
    });
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * 持久化状态到磁盘
 */
export async function persistState(lifecycleDir, planId, state) {
  const filePath = createLifecycleStatePath(lifecycleDir, planId);
  const persistedState = lifecycleRedactor.redactObject(state);
  const serialized = `${JSON.stringify(persistedState, null, 2)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > MAX_LIFECYCLE_BYTES) {
    throw Object.assign(new Error("The lifecycle state exceeds the bounded persistence limit."), {
      code: "WORKFORCE_LIFECYCLE_TOO_LARGE",
    });
  }
  const previous = lifecycleWriteTails.get(filePath) ?? Promise.resolve();
  const operation = previous.then(async () => {
    await mkdir(lifecycleDir, { recursive: true, mode: 0o700 });
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, serialized, { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, filePath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => {});
    }
  });
  const tail = operation.catch(() => undefined);
  lifecycleWriteTails.set(filePath, tail);
  try {
    await operation;
  } finally {
    if (lifecycleWriteTails.get(filePath) === tail) lifecycleWriteTails.delete(filePath);
  }
}

/**
 * 从磁盘加载状态
 */
export async function loadState(lifecycleDir, planId) {
  const filePath = createLifecycleStatePath(lifecycleDir, planId);
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid lifecycle object");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw Object.assign(new Error("The persisted lifecycle state is corrupt or unavailable."), {
      code: "WORKFORCE_LIFECYCLE_STATE_INVALID",
    });
  }
}

export function createLifecycleStatePath(lifecycleDir, planId) {
  return resolve(lifecycleDir, `plan-${sanitizePlanId(planId)}.json`);
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
      sanitized[key] = `${sanitized[key].slice(0, 10000)  }...[truncated]`;
    }
  }
  return sanitized;
}
