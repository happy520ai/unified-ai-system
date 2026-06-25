/**
 * externalRunnerProtocolHelpers.js
 *
 * 外部 Runner 协议辅助模块
 *
 * 提取自 externalRunnerProtocol.js：
 * - RUNNER_STATUS 状态枚举
 * - RUNNER_PROTOCOL 接口定义
 * - validateTask 参数校验
 */

// Runner 状态枚举
export const RUNNER_STATUS = {
  IDLE: "idle",           // 空闲，等待任务
  STARTING: "starting",   // 正在启动
  RUNNING: "running",     // 正在执行
  COMPLETED: "completed", // 执行完成
  FAILED: "failed",       // 执行失败
  CANCELLED: "cancelled", // 已取消
};

/**
 * Runner 协议接口定义
 * 所有 Runner 实现都必须遵循此接口
 */
export const RUNNER_PROTOCOL = {
  /**
   * 启动执行
   * @param {object} task - 任务描述
   * @param {string} task.planId - 计划 ID
   * @param {string} task.agentId - Agent ID
   * @param {string} task.goal - 任务目标
   * @param {object} task.context - 任务上下文
   * @returns {Promise<object>} 执行结果 { runId, status }
   */
  start: "function",

  /**
   * 查询执行状态
   * @param {string} runId - 执行 ID
   * @returns {Promise<object>} 状态信息
   */
  status: "function",

  /**
   * 取消执行
   * @param {string} runId - 执行 ID
   * @returns {Promise<object>} 取消结果
   */
  cancel: "function",

  /**
   * 获取执行结果
   * @param {string} runId - 执行 ID
   * @returns {Promise<object>} 执行结果
   */
  getResult: "function",
};

/**
 * 验证任务参数
 */
export function validateTask(task) {
  if (!task || typeof task !== "object") {
    throw new Error("任务参数必须是对象");
  }
  if (!task.planId || typeof task.planId !== "string") {
    throw new Error("任务必须包含 planId");
  }
  if (!task.agentId || typeof task.agentId !== "string") {
    throw new Error("任务必须包含 agentId");
  }
  if (!task.goal || typeof task.goal !== "string") {
    throw new Error("任务必须包含 goal");
  }
}
