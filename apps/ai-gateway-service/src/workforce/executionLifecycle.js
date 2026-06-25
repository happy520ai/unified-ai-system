/**
 * executionLifecycle.js — 可取消/可恢复执行生命周期模块
 * 状态机：pending -> running -> paused -> completed/failed/cancelled
 * 支持 cancel/pause/resume/forceStop，每次转换持久化到 .data/workforce/lifecycle/{planId}.json
 */

import { resolve } from "node:path";
import {
  buildValidTransitions,
  validateTransition as validateTransitionImpl,
  transition as transitionImpl,
  persistState,
  loadState,
  sanitizeResult,
} from "./executionLifecycleHelpers.js";

// 默认生命周期记录目录
const DEFAULT_LIFECYCLE_DIR = resolve(process.cwd(), ".data", "workforce", "lifecycle");

// 执行状态枚举
export const EXECUTION_STATUS = {
  PENDING: "pending",       // 等待执行
  RUNNING: "running",       // 正在执行
  PAUSED: "paused",         // 已暂停
  COMPLETED: "completed",   // 执行完成
  FAILED: "failed",         // 执行失败
  CANCELLED: "cancelled",   // 已取消
  FORCE_STOPPED: "force_stopped", // 强制终止
};

// 有效的状态转换映射
const VALID_TRANSITIONS = buildValidTransitions(EXECUTION_STATUS);

// 内存中的执行状态（快速访问）
const executionStates = new Map();

/**
 * 创建执行生命周期管理器
 * @param {object} [options] - 配置选项
 * @param {string} [options.lifecycleDir] - 生命周期记录目录
 * @returns {object} 执行生命周期管理器实例
 */
export function createExecutionLifecycle(options = {}) {
  const lifecycleDir = options.lifecycleDir || DEFAULT_LIFECYCLE_DIR;

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "executionLifecycle",
        version: "1.0.0",
        lifecycleDir,
        activeExecutions: executionStates.size,
        statusValues: Object.values(EXECUTION_STATUS),
        description: "可取消/可恢复执行生命周期管理模块",
      };
    },

    /**
     * 初始化一个新的执行生命周期
     * @param {string} planId - 计划 ID
     * @param {object} [metadata] - 附加元数据
     * @returns {Promise<object>} 初始化结果
     */
    async initialize(planId, metadata = {}) {
      if (!planId || typeof planId !== "string") {
        throw new Error("planId 是必填项");
      }

      const now = new Date();
      const state = {
        planId: planId.trim(),
        status: EXECUTION_STATUS.PENDING,
        currentAgentId: null,
        completedAgents: [],
        pendingAgents: [],
        startedAt: null,
        completedAt: null,
        createdAt: now.toISOString(),
        transitions: [
          {
            from: null,
            to: EXECUTION_STATUS.PENDING,
            at: now.toISOString(),
            reason: "执行生命周期已初始化",
          },
        ],
        cancelRequested: false,
        pauseRequested: false,
        forceStopRequested: false,
        metadata,
      };

      executionStates.set(planId, state);
      await persistState(lifecycleDir, planId, state);

      return {
        success: true,
        planId,
        status: EXECUTION_STATUS.PENDING,
        message: "执行生命周期已初始化",
      };
    },

    /**
     * 启动执行
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 启动结果
     */
    async start(planId) {
      const state = getState(planId);
      validateTransition(state, EXECUTION_STATUS.RUNNING);

      const now = new Date();
      transition(state, EXECUTION_STATUS.RUNNING, "执行已启动");
      state.startedAt = now.toISOString();

      await persistState(lifecycleDir, planId, state);

      return {
        success: true,
        planId,
        status: EXECUTION_STATUS.RUNNING,
        startedAt: state.startedAt,
      };
    },

    /**
     * 请求取消执行（在当前 Agent 完成后停止）
     * @param {string} planId - 计划 ID
     * @param {string} [reason] - 取消原因
     * @returns {Promise<object>} 取消请求结果
     */
    async cancel(planId, reason = "") {
      const state = getState(planId);
      validateTransition(state, EXECUTION_STATUS.CANCELLED);

      // 如果正在执行中，设置取消标志（优雅取消）
      if (state.status === EXECUTION_STATUS.RUNNING) {
        state.cancelRequested = true;
        state.cancelReason = String(reason || "用户请求取消").trim();
        state.cancelRequestedAt = new Date().toISOString();

        await persistState(lifecycleDir, planId, state);

        return {
          success: true,
          planId,
          status: state.status,
          cancelRequested: true,
          message: "取消请求已设置，将在当前 Agent 完成后停止",
        };
      }

      // 如果处于其他可转换状态，直接取消
      transition(state, EXECUTION_STATUS.CANCELLED, reason || "执行已取消");
      state.completedAt = new Date().toISOString();
      state.cancelRequested = false;

      await persistState(lifecycleDir, planId, state);

      return {
        success: true,
        planId,
        status: EXECUTION_STATUS.CANCELLED,
        message: "执行已取消",
      };
    },

    /**
     * 请求暂停执行（在当前 Agent 完成后暂停）
     * @param {string} planId - 计划 ID
     * @param {string} [reason] - 暂停原因
     * @returns {Promise<object>} 暂停请求结果
     */
    async pause(planId, reason = "") {
      const state = getState(planId);
      validateTransition(state, EXECUTION_STATUS.PAUSED);

      if (state.status === EXECUTION_STATUS.RUNNING) {
        state.pauseRequested = true;
        state.pauseReason = String(reason || "用户请求暂停").trim();
        state.pauseRequestedAt = new Date().toISOString();

        await persistState(lifecycleDir, planId, state);

        return {
          success: true,
          planId,
          status: state.status,
          pauseRequested: true,
          message: "暂停请求已设置，将在当前 Agent 完成后暂停",
        };
      }

      return {
        success: false,
        planId,
        reason: `当前状态 ${state.status} 不支持暂停`,
      };
    },

    /**
     * 从暂停状态恢复执行
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 恢复结果
     */
    async resume(planId) {
      const state = getState(planId);
      validateTransition(state, EXECUTION_STATUS.RUNNING);

      if (state.status !== EXECUTION_STATUS.PAUSED) {
        return {
          success: false,
          planId,
          reason: `当前状态 ${state.status} 不支持恢复（仅 paused 状态可恢复）`,
        };
      }

      transition(state, EXECUTION_STATUS.RUNNING, "执行已从暂停状态恢复");
      state.pauseRequested = false;
      state.pauseReason = null;

      await persistState(lifecycleDir, planId, state);

      return {
        success: true,
        planId,
        status: EXECUTION_STATUS.RUNNING,
        message: "执行已恢复",
      };
    },

    /**
     * 标记当前 Agent 完成，并检查是否需要暂停/取消
     * @param {string} planId - 计划 ID
     * @param {string} agentId - Agent ID
     * @param {object} [result] - Agent 执行结果
     * @returns {Promise<object>} 检查结果
     */
    async onAgentCompleted(planId, agentId, result = {}) {
      const state = getState(planId);

      // 记录完成的 Agent
      if (agentId) {
        state.completedAgents.push({
          agentId,
          completedAt: new Date().toISOString(),
          result: result ? sanitizeResult(result) : null,
        });
        state.currentAgentId = null;
      }

      // 检查取消请求
      if (state.cancelRequested) {
        transition(state, EXECUTION_STATUS.CANCELLED, `Agent ${agentId} 完成后执行已取消`);
        state.completedAt = new Date().toISOString();
        state.cancelRequested = false;

        await persistState(lifecycleDir, planId, state);

        return {
          success: true,
          planId,
          action: "cancelled",
          status: EXECUTION_STATUS.CANCELLED,
          message: `Agent ${agentId} 完成后执行已取消`,
        };
      }

      // 检查暂停请求
      if (state.pauseRequested) {
        transition(state, EXECUTION_STATUS.PAUSED, `Agent ${agentId} 完成后执行已暂停`);
        state.pauseRequested = false;

        await persistState(lifecycleDir, planId, state);

        return {
          success: true,
          planId,
          action: "paused",
          status: EXECUTION_STATUS.PAUSED,
          message: `Agent ${agentId} 完成后执行已暂停`,
        };
      }

      await persistState(lifecycleDir, planId, state);

      return {
        success: true,
        planId,
        action: "continue",
        status: state.status,
        message: "继续执行下一个 Agent",
      };
    },

    /**
     * 标记执行完成
     * @param {string} planId - 计划 ID
     * @param {string} [finalStatus] - 最终状态（默认 completed）
     * @param {object} [summary] - 执行摘要
     * @returns {Promise<object>} 完成结果
     */
    async complete(planId, finalStatus, summary = {}) {
      const state = getState(planId);
      const targetStatus = finalStatus || EXECUTION_STATUS.COMPLETED;

      validateTransition(state, targetStatus);
      transition(state, targetStatus, `执行已结束: ${targetStatus}`);
      state.completedAt = new Date().toISOString();
      state.summary = summary;

      await persistState(lifecycleDir, planId, state);

      return {
        success: true,
        planId,
        status: targetStatus,
        completedAt: state.completedAt,
        completedAgents: state.completedAgents.length,
      };
    },

    /**
     * 强制终止执行（不等待当前 Agent 完成）
     * @param {string} planId - 计划 ID
     * @param {string} [reason] - 终止原因
     * @returns {Promise<object>} 终止结果
     */
    async forceStop(planId, reason = "") {
      const state = getState(planId);
      validateTransition(state, EXECUTION_STATUS.FORCE_STOPPED);

      transition(state, EXECUTION_STATUS.FORCE_STOPPED, reason || "执行已强制终止");
      state.completedAt = new Date().toISOString();
      state.forceStopRequested = true;
      state.cancelRequested = false;
      state.pauseRequested = false;

      await persistState(lifecycleDir, planId, state);

      return {
        success: true,
        planId,
        status: EXECUTION_STATUS.FORCE_STOPPED,
        message: "执行已强制终止",
      };
    },

    /**
     * 查询当前执行状态
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 执行状态
     */
    async getStatus(planId) {
      // 先查内存
      const memState = executionStates.get(planId.trim());
      if (memState) {
        return {
          success: true,
          planId: planId.trim(),
          status: memState.status,
          currentAgentId: memState.currentAgentId,
          completedAgents: memState.completedAgents.length,
          cancelRequested: memState.cancelRequested,
          pauseRequested: memState.pauseRequested,
          startedAt: memState.startedAt,
          completedAt: memState.completedAt,
          transitions: memState.transitions,
        };
      }

      // 再查磁盘
      const diskState = await loadState(lifecycleDir, planId.trim());
      if (diskState) {
        executionStates.set(planId.trim(), diskState);
        return {
          success: true,
          planId: planId.trim(),
          status: diskState.status,
          currentAgentId: diskState.currentAgentId,
          completedAgents: diskState.completedAgents.length,
          cancelRequested: diskState.cancelRequested,
          pauseRequested: diskState.pauseRequested,
          startedAt: diskState.startedAt,
          completedAt: diskState.completedAt,
          transitions: diskState.transitions,
        };
      }

      return {
        success: false,
        planId: planId.trim(),
        reason: "未找到该计划的执行记录",
      };
    },

    /**
     * 列出所有活跃的执行
     * @returns {object} 活跃执行列表
     */
    listActive() {
      const active = [];
      for (const [planId, state] of executionStates) {
        if ([EXECUTION_STATUS.PENDING, EXECUTION_STATUS.RUNNING, EXECUTION_STATUS.PAUSED].includes(state.status)) {
          active.push({
            planId,
            status: state.status,
            currentAgentId: state.currentAgentId,
            completedAgents: state.completedAgents.length,
            startedAt: state.startedAt,
          });
        }
      }
      return { success: true, count: active.length, executions: active };
    },

    // 导出状态枚举供外部使用
    EXECUTION_STATUS,
  };
}

// ---- 内部辅助函数 ----

/**
 * 获取执行状态（从内存）
 */
function getState(planId) {
  const key = planId.trim();
  const state = executionStates.get(key);
  if (!state) {
    throw new Error(`未找到计划 ${key} 的执行记录，请先调用 initialize()`);
  }
  return state;
}

// 以下函数委托给 executionLifecycleHelpers.js，保留本地签名以避免改动调用点
function validateTransition(state, targetStatus) {
  return validateTransitionImpl(state, targetStatus, VALID_TRANSITIONS);
}
function transition(state, targetStatus, reason) {
  return transitionImpl(state, targetStatus, reason);
}
