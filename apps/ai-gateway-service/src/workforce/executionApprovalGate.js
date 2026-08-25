/**
 * executionApprovalGate.js
 *
 * 显式用户审批模块
 *
 * 功能：
 * - 在执行任何 Workforce 计划前，要求用户显式审批
 * - 审批记录包含：planId, userId, timestamp, approvedScopes
 * - 审批存储到 .data/workforce/approvals.json
 * - 支持审批过期（24小时后自动过期）
 * - 提供 HTTP API 集成点（供 httpServer.js 调用）
 */

import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename as renameAsync,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";

// 默认审批过期时间：24小时（毫秒）
const DEFAULT_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

// 默认存储路径
const DEFAULT_APPROVALS_PATH = resolve(process.cwd(), ".data", "workforce", "approvals.json");

/**
 * 创建审批网关管理器
 * @param {object} options - 配置选项
 * @param {string} [options.storePath] - 审批记录存储路径
 * @param {number} [options.ttlMs] - 审批过期时间（毫秒）
 * @returns {object} 审批网关管理器实例
 */
export function createExecutionApprovalGate(options = {}) {
  const storePath = resolve(options.storePath || DEFAULT_APPROVALS_PATH);
  const ttlMs = options.ttlMs || DEFAULT_APPROVAL_TTL_MS;
  let mutationTail = Promise.resolve();

  function withMutationLock(operation) {
    const current = mutationTail.then(operation, operation);
    mutationTail = current.then(() => undefined, () => undefined);
    return current;
  }

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "executionApprovalGate",
        version: "1.0.0",
        storePath,
        ttlMs,
        description: "显式用户审批模块：执行前必须获得用户明确批准",
      };
    },

    /**
     * 提交审批请求
     * @param {object} params - 审批参数
     * @param {string} params.planId - 计划 ID
     * @param {string} params.userId - 审批用户 ID
     * @param {string[]} [params.approvedScopes] - 批准的作用域列表
     * @param {string} [params.note] - 审批备注
     * @returns {Promise<object>} 审批记录
     */
    async approve({ planId, userId, planDigest, approvedScopes = [], note = "" }) {
      if (!planId || typeof planId !== "string") {
        throw createApprovalError("APPROVAL_PLAN_ID_REQUIRED", "计划 ID 是必填项");
      }
      if (!userId || typeof userId !== "string") {
        throw createApprovalError("APPROVAL_USER_ID_REQUIRED", "用户 ID 是必填项");
      }
      if (typeof planDigest !== "string" || !/^[a-f0-9]{64}$/.test(planDigest)) {
        throw createApprovalError("APPROVAL_PLAN_DIGEST_REQUIRED", "有效的 SHA-256 计划摘要是必填项");
      }
      const normalizedScopes = normalizeScopes(approvedScopes);
      if (normalizedScopes.length === 0) {
        throw createApprovalError("APPROVAL_SCOPES_REQUIRED", "至少需要一个明确的批准范围");
      }

      return withMutationLock(async () => {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + ttlMs);
        const approval = {
          schemaVersion: 2,
          approvalId: `appr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
          planId: planId.trim(),
          userId: userId.trim(),
          planDigest,
          approvedScopes: normalizedScopes,
          note: String(note || "").trim().slice(0, 2000),
          status: "approved",
          approvedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          revoked: false,
          revokedAt: null,
          revokedBy: null,
          consumedAt: null,
          consumedBy: null,
        };
        const store = await readApprovalStore(storePath);
        const filteredApprovals = store.approvals.filter((a) => a.planId !== approval.planId);
        filteredApprovals.unshift(approval);
        await writeApprovalStore(storePath, {
          version: 2,
          updatedAt: now.toISOString(),
          approvals: filteredApprovals,
        });
        return { success: true, status: "approved", approval };
      });
    },

    /**
     * 检查指定计划是否已获得有效审批
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 检查结果
     */
    async check(context) {
      const normalized = normalizeApprovalContext(context);
      if (!normalized.valid) {
        return {
          success: false,
          approved: false,
          code: normalized.code,
          reason: normalized.reason,
        };
      }

      const store = await readApprovalStore(storePath);
      const approval = store.approvals.find(
        (a) => a.planId === normalized.context.planId && a.status === "approved" && !a.revoked,
      );
      if (!approval) {
        return {
          success: true,
          approved: false,
          code: "APPROVAL_NOT_FOUND",
          reason: "未找到该计划的有效审批记录",
          planId: normalized.context.planId,
        };
      }
      return evaluateApproval(approval, normalized.context, new Date());
    },

    async consume(context) {
      const normalized = normalizeApprovalContext(context);
      if (!normalized.valid) {
        return { success: false, approved: false, code: normalized.code, reason: normalized.reason };
      }
      return withMutationLock(async () => {
        const store = await readApprovalStore(storePath);
        const index = store.approvals.findIndex(
          (a) => a.planId === normalized.context.planId && a.status === "approved" && !a.revoked,
        );
        if (index < 0) {
          return {
            success: true,
            approved: false,
            code: "APPROVAL_NOT_FOUND",
            reason: "未找到该计划的有效审批记录",
            planId: normalized.context.planId,
          };
        }
        const validation = evaluateApproval(store.approvals[index], normalized.context, new Date());
        if (!validation.approved) return validation;

        const now = new Date();
        const consumedApproval = {
          ...store.approvals[index],
          status: "consumed",
          consumedAt: now.toISOString(),
          consumedBy: normalized.context.userId,
        };
        const approvals = [...store.approvals];
        approvals[index] = consumedApproval;
        await writeApprovalStore(storePath, {
          version: 2,
          updatedAt: now.toISOString(),
          approvals,
        });
        return {
          ...validation,
          consumed: true,
          approval: consumedApproval,
        };
      });
    },

    /**
     * 吊销指定计划的审批
     * @param {string} planId - 计划 ID
     * @param {string} revokedBy - 吊销操作者
     * @param {string} [reason] - 吊销原因
     * @returns {Promise<object>} 吊销结果
     */
    async revoke(planId, revokedBy, reason = "") {
      if (!planId || typeof planId !== "string") {
        throw createApprovalError("APPROVAL_PLAN_ID_REQUIRED", "计划 ID 是必填项");
      }

      return withMutationLock(async () => {
        const store = await readApprovalStore(storePath);
        const now = new Date();
        let revoked = false;
        const updatedApprovals = store.approvals.map((a) => {
          if (a.planId === planId.trim() && a.status === "approved" && !a.revoked) {
            revoked = true;
            return {
              ...a,
              status: "revoked",
              revoked: true,
              revokedAt: now.toISOString(),
              revokedBy: String(revokedBy || "system").trim(),
              revokeReason: String(reason || "").trim().slice(0, 1000),
            };
          }
          return a;
        });
        if (!revoked) {
          return { success: false, reason: "未找到可吊销的有效审批记录", planId: planId.trim() };
        }
        await writeApprovalStore(storePath, {
          version: 2,
          updatedAt: now.toISOString(),
          approvals: updatedApprovals,
        });
        return { success: true, status: "revoked", planId: planId.trim(), revokedAt: now.toISOString() };
      });
    },

    /**
     * 列出所有审批记录
     * @param {object} [filter] - 过滤条件
     * @param {string} [filter.planId] - 按计划 ID 过滤
     * @param {string} [filter.status] - 按状态过滤
     * @returns {Promise<object>} 审批记录列表
     */
    async list(filter = {}) {
      const store = await readApprovalStore(storePath);
      let approvals = [...store.approvals];

      // 应用过滤条件
      if (filter.planId) {
        approvals = approvals.filter((a) => a.planId === filter.planId.trim());
      }
      if (filter.status) {
        approvals = approvals.filter((a) => a.status === filter.status);
      }

      // 标注过期状态
      const now = new Date();
      approvals = approvals.map((a) => {
        const isExpired = a.status === "approved" && !a.revoked && now >= new Date(a.expiresAt);
        return { ...a, isExpired };
      });

      return {
        success: true,
        count: approvals.length,
        approvals,
      };
    },

    /**
     * 清理过期的审批记录
     * @returns {Promise<object>} 清理结果
     */
    async cleanup() {
      return withMutationLock(async () => {
        const store = await readApprovalStore(storePath);
        const now = new Date();
        const before = store.approvals.length;
        const activeApprovals = store.approvals.filter((a) => {
          if (a.status !== "approved" || a.revoked) return true;
          return now < new Date(a.expiresAt);
        });
        await writeApprovalStore(storePath, {
          version: 2,
          updatedAt: now.toISOString(),
          approvals: activeApprovals,
        });
        return {
          success: true,
          removedCount: before - activeApprovals.length,
          remainingCount: activeApprovals.length,
        };
      });
    },
  };
}

// ---- 内部辅助函数 ----

/**
 * 读取审批存储文件
 */
async function readApprovalStore(storePath) {
  try {
    const parsed = JSON.parse(await readFile(storePath, "utf8"));
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || null,
      approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { version: 1, updatedAt: null, approvals: [] };
    }
    throw error;
  }
}

/**
 * 写入审批存储文件
 */
async function writeApprovalStore(storePath, store) {
  await mkdir(dirname(storePath), { recursive: true });
  const tmpPath = `${storePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    await renameAsync(tmpPath, storePath);
  } catch (error) {
    try {
      await rm(tmpPath, { force: true });
    } catch (cleanupError) {
      error.cleanupError = cleanupError.message;
    }
    throw error;
  }
}

/**
 * 创建审批错误对象
 */
function createApprovalError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "approval";
  error.statusCode = 400;
  error.details = details;
  return error;
}

function normalizeScopes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((scope) => String(scope).trim()).filter(Boolean))].sort();
}

function normalizeApprovalContext(input) {
  if (!input || typeof input !== "object") {
    return { valid: false, code: "APPROVAL_CONTEXT_REQUIRED", reason: "完整的执行审批上下文是必填项" };
  }
  const planId = typeof input.planId === "string" ? input.planId.trim() : "";
  const userId = typeof input.userId === "string" ? input.userId.trim() : "";
  const planDigest = typeof input.planDigest === "string" ? input.planDigest.trim() : "";
  const requiredScopes = normalizeScopes(input.requiredScopes);
  if (!planId || !userId || !/^[a-f0-9]{64}$/.test(planDigest) || requiredScopes.length === 0) {
    return { valid: false, code: "APPROVAL_CONTEXT_INVALID", reason: "审批校验必须绑定 planId、userId、planDigest 和 requiredScopes" };
  }
  return { valid: true, context: { planId, userId, planDigest, requiredScopes } };
}

function evaluateApproval(approval, context, now) {
  if (now >= new Date(approval.expiresAt)) {
    return {
      success: true,
      approved: false,
      code: "APPROVAL_EXPIRED",
      reason: `审批已过期（过期时间: ${approval.expiresAt}）`,
      approval,
      planId: context.planId,
    };
  }
  if (approval.userId !== context.userId) {
    return { success: true, approved: false, code: "APPROVAL_SUBJECT_MISMATCH", reason: "审批主体与执行主体不匹配", planId: context.planId };
  }
  if (approval.planDigest !== context.planDigest) {
    return { success: true, approved: false, code: "APPROVAL_PLAN_MISMATCH", reason: "计划内容已改变，原审批不可复用", planId: context.planId };
  }
  const approvedScopes = new Set(normalizeScopes(approval.approvedScopes));
  const missingScopes = context.requiredScopes.filter((scope) => !approvedScopes.has(scope));
  if (missingScopes.length > 0) {
    return { success: true, approved: false, code: "APPROVAL_SCOPE_MISMATCH", reason: "审批范围不足", missingScopes, planId: context.planId };
  }
  return { success: true, approved: true, code: "APPROVAL_VALID", reason: "审批有效", approval, planId: context.planId };
}
