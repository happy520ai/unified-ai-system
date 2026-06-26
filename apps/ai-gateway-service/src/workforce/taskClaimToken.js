/**
 * taskClaimToken.js
 *
 * 任务认领令牌模块
 *
 * 功能：
 * - 为每个任务生成唯一的 claim token（UUID v4）
 * - Agent 必须持有有效的 claim token 才能开始执行
 * - token 绑定到特定的 agentId + planId
 * - token 有过期时间（默认 1 小时）
 * - 支持 token 续期（在执行期间自动延长）
 * - 支持 token 吊销（当任务被取消时）
 * - 存储在内存 Map 中（单实例模式）
 */

import { randomUUID } from "node:crypto";

// 默认 token 过期时间：1小时（毫秒）
const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000;

// 续期间隔：每次续期延长 30 分钟
const DEFAULT_RENEWAL_MS = 30 * 60 * 1000;

// Token 存储（内存 Map，单实例模式）
const tokenStore = new Map();

// 续期定时器引用
const renewalTimers = new Map();

/**
 * 创建任务认领令牌管理器
 * @param {object} [options] - 配置选项
 * @param {number} [options.ttlMs] - token 过期时间（毫秒）
 * @param {number} [options.renewalMs] - 续期延长时长（毫秒）
 * @param {boolean} [options.autoRenewal] - 是否启用自动续期
 * @returns {object} 令牌管理器实例
 */
export function createTaskClaimTokenManager(options = {}) {
  const ttlMs = options.ttlMs || DEFAULT_TOKEN_TTL_MS;
  const renewalMs = options.renewalMs || DEFAULT_RENEWAL_MS;
  const autoRenewal = options.autoRenewal !== false;

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "taskClaimToken",
        version: "1.0.0",
        ttlMs,
        renewalMs,
        autoRenewal,
        activeTokens: tokenStore.size,
        description: "任务认领令牌模块：确保只有持有有效令牌的 Agent 才能执行",
      };
    },

    /**
     * 生成新的认领令牌
     * @param {object} params - 参数
     * @param {string} params.planId - 计划 ID
     * @param {string} params.agentId - Agent ID
     * @param {string} [params.taskId] - 任务 ID
     * @param {object} [params.metadata] - 附加元数据
     * @returns {object} 生成的令牌信息
     */
    issue({ planId, agentId, taskId, metadata = {} }) {
      if (!planId || typeof planId !== "string") {
        throw new Error("planId 是必填项");
      }
      if (!agentId || typeof agentId !== "string") {
        throw new Error("agentId 是必填项");
      }

      const token = randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + ttlMs);

      const record = {
        token,
        planId: planId.trim(),
        agentId: agentId.trim(),
        taskId: taskId ? String(taskId).trim() : null,
        status: "active",
        issuedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        lastRenewedAt: null,
        renewalCount: 0,
        revoked: false,
        revokedAt: null,
        revokeReason: null,
        metadata,
      };

      tokenStore.set(token, record);

      // 如果启用了自动续期，设置定时续期
      if (autoRenewal) {
        startAutoRenewal(token, renewalMs, ttlMs);
      }

      return {
        success: true,
        token,
        record: sanitizeRecord(record),
      };
    },

    /**
     * 验证令牌是否有效
     * @param {string} token - 令牌值
     * @param {object} [context] - 验证上下文
     * @param {string} [context.planId] - 期望的 planId
     * @param {string} [context.agentId] - 期望的 agentId
     * @returns {object} 验证结果
     */
    validate(token, context = {}) {
      if (!token || typeof token !== "string") {
        return {
          valid: false,
          reason: "令牌值无效",
        };
      }

      const record = tokenStore.get(token);
      if (!record) {
        return {
          valid: false,
          reason: "令牌不存在",
        };
      }

      // 检查是否已吊销
      if (record.revoked) {
        return {
          valid: false,
          reason: `令牌已被吊销（原因: ${record.revokeReason || "未说明"}）`,
          record: sanitizeRecord(record),
        };
      }

      // 检查是否过期
      const now = new Date();
      if (now >= new Date(record.expiresAt)) {
        return {
          valid: false,
          reason: `令牌已过期（过期时间: ${record.expiresAt}）`,
          record: sanitizeRecord(record),
        };
      }

      // 检查绑定关系
      if (context.planId && record.planId !== context.planId.trim()) {
        return {
          valid: false,
          reason: `令牌绑定的 planId 不匹配（期望: ${context.planId}，实际: ${record.planId}）`,
          record: sanitizeRecord(record),
        };
      }

      if (context.agentId && record.agentId !== context.agentId.trim()) {
        return {
          valid: false,
          reason: `令牌绑定的 agentId 不匹配（期望: ${context.agentId}，实际: ${record.agentId}）`,
          record: sanitizeRecord(record),
        };
      }

      return {
        valid: true,
        reason: "令牌有效",
        record: sanitizeRecord(record),
      };
    },

    /**
     * 手动续期令牌
     * @param {string} token - 令牌值
     * @param {number} [extendMs] - 延长时长（毫秒）
     * @returns {object} 续期结果
     */
    renew(token, extendMs) {
      const record = tokenStore.get(token);
      if (!record) {
        return { success: false, reason: "令牌不存在" };
      }
      if (record.revoked) {
        return { success: false, reason: "令牌已被吊销，无法续期" };
      }

      const extension = extendMs || renewalMs;
      const now = new Date();
      const currentExpiry = new Date(record.expiresAt);
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), now.getTime()) + extension);

      record.expiresAt = newExpiry.toISOString();
      record.lastRenewedAt = now.toISOString();
      record.renewalCount += 1;

      return {
        success: true,
        token,
        previousExpiresAt: currentExpiry.toISOString(),
        newExpiresAt: newExpiry.toISOString(),
        renewalCount: record.renewalCount,
      };
    },

    /**
     * 吊销令牌
     * @param {string} token - 令牌值
     * @param {string} [reason] - 吊销原因
     * @returns {object} 吊销结果
     */
    revoke(token, reason = "") {
      const record = tokenStore.get(token);
      if (!record) {
        return { success: false, reason: "令牌不存在" };
      }
      if (record.revoked) {
        return { success: false, reason: "令牌已被吊销" };
      }

      const now = new Date();
      record.revoked = true;
      record.status = "revoked";
      record.revokedAt = now.toISOString();
      record.revokeReason = String(reason || "").trim().slice(0, 1000);

      // 停止自动续期
      stopAutoRenewal(token);

      return {
        success: true,
        token,
        revokedAt: now.toISOString(),
      };
    },

    /**
     * 按 planId 吊销所有关联令牌
     * @param {string} planId - 计划 ID
     * @param {string} [reason] - 吊销原因
     * @returns {object} 吊销结果
     */
    revokeByPlanId(planId, reason = "") {
      const revoked = [];
      for (const [token, record] of tokenStore) {
        if (record.planId === planId.trim() && !record.revoked) {
          const result = this.revoke(token, reason || `计划 ${planId} 被取消`);
          if (result.success) revoked.push(token);
        }
      }

      return {
        success: true,
        planId: planId.trim(),
        revokedCount: revoked.length,
        revokedTokens: revoked,
      };
    },

    /**
     * 查询指定计划的令牌列表
     * @param {string} planId - 计划 ID
     * @returns {object} 令牌列表
     */
    listByPlan(planId) {
      const tokens = [];
      for (const [, record] of tokenStore) {
        if (record.planId === planId.trim()) {
          tokens.push(sanitizeRecord(record));
        }
      }
      return {
        success: true,
        planId: planId.trim(),
        count: tokens.length,
        tokens,
      };
    },

    /**
     * 清理所有已过期的令牌
     * @returns {object} 清理结果
     */
    cleanup() {
      const now = new Date();
      let removedCount = 0;

      for (const [token, record] of tokenStore) {
        if (record.revoked || now >= new Date(record.expiresAt)) {
          stopAutoRenewal(token);
          tokenStore.delete(token);
          removedCount++;
        }
      }

      return {
        success: true,
        removedCount,
        remainingCount: tokenStore.size,
      };
    },
  };
}

// ---- 内部辅助函数 ----

/**
 * 启动自动续期定时器
 */
function startAutoRenewal(token, renewalMs, ttlMs) {
  // 清除旧的定时器
  stopAutoRenewal(token);

  // 每 renewalMs 间隔续期一次
  const interval = Math.min(renewalMs, ttlMs / 2);
  const timer = setInterval(() => {
    const record = tokenStore.get(token);
    if (!record || record.revoked) {
      stopAutoRenewal(token);
      return;
    }

    const now = new Date();
    const newExpiry = new Date(now.getTime() + ttlMs);
    record.expiresAt = newExpiry.toISOString();
    record.lastRenewedAt = now.toISOString();
    record.renewalCount += 1;
  }, interval);

  // 允许定时器不阻止进程退出
  if (timer.unref) timer.unref();
  renewalTimers.set(token, timer);
}

/**
 * 停止自动续期定时器
 */
function stopAutoRenewal(token) {
  const timer = renewalTimers.get(token);
  if (timer) {
    clearInterval(timer);
    renewalTimers.delete(token);
  }
}

/**
 * 清理记录中的敏感字段，返回安全副本
 */
function sanitizeRecord(record) {
  return {
    token: record.token ? `${record.token.slice(0, 8)}...` : null,
    planId: record.planId,
    agentId: record.agentId,
    taskId: record.taskId,
    status: record.status,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    lastRenewedAt: record.lastRenewedAt,
    renewalCount: record.renewalCount,
    revoked: record.revoked,
    revokedAt: record.revokedAt,
  };
}
