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
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
    async approve({ planId, userId, approvedScopes = [], note = "" }) {
      // 参数验证
      if (!planId || typeof planId !== "string") {
        throw createApprovalError("APPROVAL_PLAN_ID_REQUIRED", "计划 ID 是必填项");
      }
      if (!userId || typeof userId !== "string") {
        throw createApprovalError("APPROVAL_USER_ID_REQUIRED", "用户 ID 是必填项");
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlMs);

      // 构建审批记录
      const approval = {
        approvalId: `appr_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        planId: planId.trim(),
        userId: userId.trim(),
        approvedScopes: Array.isArray(approvedScopes)
          ? approvedScopes.map((s) => String(s).trim()).filter(Boolean)
          : [],
        note: String(note || "").trim().slice(0, 2000),
        status: "approved",
        approvedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        revoked: false,
        revokedAt: null,
        revokedBy: null,
      };

      // 存储审批记录
      const store = await readApprovalStore(storePath);
      // 移除同一 planId 的旧审批（保留最新）
      const filteredApprovals = store.approvals.filter((a) => a.planId !== approval.planId);
      filteredApprovals.unshift(approval);
      await writeApprovalStore(storePath, {
        version: store.version,
        updatedAt: now.toISOString(),
        approvals: filteredApprovals,
      });

      return {
        success: true,
        status: "approved",
        approval,
      };
    },

    /**
     * 检查指定计划是否已获得有效审批
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 检查结果
     */
    async check(planId) {
      if (!planId || typeof planId !== "string") {
        return {
          success: false,
          approved: false,
          reason: "计划 ID 无效",
        };
      }

      const store = await readApprovalStore(storePath);
      const now = new Date();

      // 查找最新的有效审批记录
      const approval = store.approvals.find(
        (a) => a.planId === planId.trim() && a.status === "approved" && !a.revoked,
      );

      if (!approval) {
        return {
          success: true,
          approved: false,
          reason: "未找到该计划的有效审批记录",
          planId: planId.trim(),
        };
      }

      // 检查是否过期
      const expiresAt = new Date(approval.expiresAt);
      if (now >= expiresAt) {
        return {
          success: true,
          approved: false,
          reason: `审批已过期（过期时间: ${approval.expiresAt}）`,
          approval,
          planId: planId.trim(),
        };
      }

      return {
        success: true,
        approved: true,
        reason: "审批有效",
        approval,
        planId: planId.trim(),
      };
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
        return {
          success: false,
          reason: "未找到可吊销的有效审批记录",
          planId: planId.trim(),
        };
      }

      await writeApprovalStore(storePath, {
        version: store.version,
        updatedAt: now.toISOString(),
        approvals: updatedApprovals,
      });

      return {
        success: true,
        status: "revoked",
        planId: planId.trim(),
        revokedAt: now.toISOString(),
      };
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
      const store = await readApprovalStore(storePath);
      const now = new Date();
      const before = store.approvals.length;

      const activeApprovals = store.approvals.filter((a) => {
        if (a.status !== "approved" || a.revoked) return true; // 保留非活跃记录
        return now < new Date(a.expiresAt);
      });

      await writeApprovalStore(storePath, {
        version: store.version,
        updatedAt: now.toISOString(),
        approvals: activeApprovals,
      });

      return {
        success: true,
        removedCount: before - activeApprovals.length,
        remainingCount: activeApprovals.length,
      };
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
  // Atomic write: write to temp file then rename to prevent corruption on crash
  const tmpPath = `${storePath  }.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  const { rename: renameAsync } = await import("node:fs/promises");
  await renameAsync(tmpPath, storePath);
}

/**
 * 创建审批错误对象
 */
function createApprovalError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.category = "approval";
  error.details = details;
  return error;
}
