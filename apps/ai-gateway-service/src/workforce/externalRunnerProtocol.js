/**
 * externalRunnerProtocol.js
 * 
 * 外部 Runner 协议模块
 * 
 * 功能：
 * - 定义 Runner 协议接口：start, status, cancel, getResult
 * - 实现 LocalRunner：在当前进程内执行（用于开发/测试）
 * - 实现 SubProcessRunner：在独立子进程中执行（用于生产）
 * - Runner 注册表：注册/查询/选择 Runner
 * - 每个 Runner 有唯一的 runnerId 和能力声明
 */

import { randomUUID } from "node:crypto";
import { fork } from "node:child_process";

import { RUNNER_STATUS, RUNNER_PROTOCOL, validateTask } from "./externalRunnerProtocolHelpers.js";

// Runner 注册表（单实例内存存储）
const runnerRegistry = new Map();

/**
 * 创建 LocalRunner（当前进程内执行，用于开发/测试）
 * @param {object} [config] - Runner 配置
 * @returns {object} LocalRunner 实例
 */
export function createLocalRunner(config = {}) {
  const runnerId = config.runnerId || `local_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  // 记录当前运行的任务
  const runs = new Map();

  return {
    runnerId,
    runnerType: "local",
    // 能力声明
    capabilities: {
      name: "LocalRunner",
      description: "在当前进程内执行任务（用于开发/测试环境）",
      supportsAsync: true,
      supportsCancel: true,
      supportsPause: false,
      maxConcurrency: config.maxConcurrency || 5,
      isolationLevel: "none",
      environment: "development",
    },

    /**
     * 启动本地任务执行
     */
    async start(task) {
      validateTask(task);
      const runId = `run_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const startedAt = new Date();

      // 检查并发限制
      const activeRuns = [...runs.values()].filter(
        (r) => r.status === RUNNER_STATUS.RUNNING || r.status === RUNNER_STATUS.STARTING,
      );
      if (activeRuns.length >= this.capabilities.maxConcurrency) {
        throw new Error(`LocalRunner 并发数已达上限（${this.capabilities.maxConcurrency}）`);
      }

      const runRecord = {
        runId,
        planId: task.planId,
        agentId: task.agentId,
        goal: task.goal,
        status: RUNNER_STATUS.STARTING,
        startedAt: startedAt.toISOString(),
        completedAt: null,
        result: null,
        error: null,
      };

      runs.set(runId, runRecord);

      // 模拟异步执行（本地 Runner 直接在当前进程中执行回调）
      try {
        runRecord.status = RUNNER_STATUS.RUNNING;

        // 执行用户提供的任务处理函数
        if (typeof task.handler === "function") {
          const result = await task.handler({
            planId: task.planId,
            agentId: task.agentId,
            goal: task.goal,
            context: task.context || {},
          });
          runRecord.result = result;
          runRecord.status = RUNNER_STATUS.COMPLETED;
        } else {
          // 没有处理函数时，标记为完成（占位执行）
          runRecord.result = { output: `本地执行完成: ${task.goal}`, executedLocally: true };
          runRecord.status = RUNNER_STATUS.COMPLETED;
        }
      } catch (error) {
        runRecord.status = RUNNER_STATUS.FAILED;
        runRecord.error = { message: error.message, code: error.code || "UNKNOWN" };
      } finally {
        runRecord.completedAt = new Date().toISOString();
      }

      return {
        runId,
        status: runRecord.status,
        startedAt: runRecord.startedAt,
      };
    },

    /**
     * 查询本地任务状态
     */
    async status(runId) {
      const run = runs.get(runId);
      if (!run) {
        return { runId, status: "not_found", reason: "未找到指定的执行记录" };
      }
      return {
        runId,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        error: run.error,
      };
    },

    /**
     * 取消本地任务
     */
    async cancel(runId) {
      const run = runs.get(runId);
      if (!run) {
        return { success: false, reason: "未找到指定的执行记录" };
      }
      if (run.status === RUNNER_STATUS.RUNNING || run.status === RUNNER_STATUS.STARTING) {
        run.status = RUNNER_STATUS.CANCELLED;
        run.completedAt = new Date().toISOString();
        return { success: true, runId, status: RUNNER_STATUS.CANCELLED };
      }
      return {
        success: false,
        reason: `任务状态为 ${run.status}，无法取消`,
        runId,
      };
    },

    /**
     * 获取本地任务结果
     */
    async getResult(runId) {
      const run = runs.get(runId);
      if (!run) {
        return { success: false, reason: "未找到指定的执行记录" };
      }
      return {
        success: true,
        runId,
        status: run.status,
        result: run.result,
        error: run.error,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      };
    },
  };
}

/**
 * 创建 SubProcessRunner（独立子进程执行，用于生产环境）
 * @param {object} [config] - Runner 配置
 * @returns {object} SubProcessRunner 实例
 */
export function createSubProcessRunner(config = {}) {
  const runnerId = config.runnerId || `subproc_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  // 记录子进程和运行状态
  const processes = new Map();
  const runs = new Map();

  // Orphan cleanup: kill all tracked child processes when parent exits
  let _orphanCleanupInstalled = false;
  function installOrphanCleanup() {
    if (_orphanCleanupInstalled) return;
    _orphanCleanupInstalled = true;
    function cleanupAll() {
      for (const [, child] of processes) {
        try {
          child.kill("SIGTERM");
          const timer = setTimeout(() => {
            try { child.kill("SIGKILL"); } catch (_) { /* ignore */ }
          }, 3000);
          child.once("exit", () => clearTimeout(timer));
        } catch (_) { /* process may have already exited */ }
      }
      processes.clear();
    }
    process.on("SIGTERM", cleanupAll);
    process.on("SIGINT", cleanupAll);
    process.on("exit", cleanupAll);
  }
  installOrphanCleanup();

  return {
    runnerId,
    runnerType: "subprocess",
    // 能力声明
    capabilities: {
      name: "SubProcessRunner",
      description: "在独立子进程中执行任务（用于生产环境，提供进程级隔离）",
      supportsAsync: true,
      supportsCancel: true,
      supportsPause: false,
      maxConcurrency: config.maxConcurrency || 10,
      isolationLevel: "process",
      environment: "production",
      scriptPath: config.scriptPath || null,
    },

    /**
     * 启动子进程任务执行
     */
    async start(task) {
      validateTask(task);
      const runId = `run_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const startedAt = new Date();

      // 检查并发限制
      const activeRuns = [...runs.values()].filter(
        (r) => r.status === RUNNER_STATUS.RUNNING || r.status === RUNNER_STATUS.STARTING,
      );
      if (activeRuns.length >= this.capabilities.maxConcurrency) {
        throw new Error(`SubProcessRunner 并发数已达上限（${this.capabilities.maxConcurrency}）`);
      }

      const runRecord = {
        runId,
        planId: task.planId,
        agentId: task.agentId,
        goal: task.goal,
        status: RUNNER_STATUS.STARTING,
        startedAt: startedAt.toISOString(),
        completedAt: null,
        result: null,
        error: null,
        childProcess: null,
      };

      runs.set(runId, runRecord);

      try {
        // 如果提供了脚本路径，则使用 fork 创建子进程
        if (this.capabilities.scriptPath) {
          const child = fork(this.capabilities.scriptPath, [], {
            stdio: ["pipe", "pipe", "pipe", "ipc"],
            env: {
              ...process.env,
              WORKFORCE_RUN_ID: runId,
              WORKFORCE_PLAN_ID: task.planId,
              WORKFORCE_AGENT_ID: task.agentId,
              WORKFORCE_GOAL: task.goal,
            },
          });

          runRecord.childProcess = child;
          processes.set(runId, child);

          // 发送任务数据给子进程
          child.send({
            type: "start_task",
            payload: {
              runId,
              planId: task.planId,
              agentId: task.agentId,
              goal: task.goal,
              context: task.context || {},
            },
          });

          // 监听子进程消息
          child.on("message", (msg) => {
            if (msg.type === "task_completed") {
              runRecord.status = RUNNER_STATUS.COMPLETED;
              runRecord.result = msg.result;
              runRecord.completedAt = new Date().toISOString();
            } else if (msg.type === "task_failed") {
              runRecord.status = RUNNER_STATUS.FAILED;
              runRecord.error = msg.error;
              runRecord.completedAt = new Date().toISOString();
            }
          });

          // 监听子进程退出
          child.on("exit", (code) => {
            if (runRecord.status === RUNNER_STATUS.RUNNING || runRecord.status === RUNNER_STATUS.STARTING) {
              runRecord.status = code === 0 ? RUNNER_STATUS.COMPLETED : RUNNER_STATUS.FAILED;
              runRecord.completedAt = new Date().toISOString();
              if (code !== 0) {
                runRecord.error = { message: `子进程异常退出，退出码: ${code}`, code: "PROCESS_EXIT" };
              }
            }
            processes.delete(runId);
          });

          child.on("error", (error) => {
            runRecord.status = RUNNER_STATUS.FAILED;
            runRecord.error = { message: error.message, code: "PROCESS_ERROR" };
            runRecord.completedAt = new Date().toISOString();
            processes.delete(runId);
          });

          runRecord.status = RUNNER_STATUS.RUNNING;
        } else {
          // 没有脚本路径时，记录为占位执行
          runRecord.status = RUNNER_STATUS.RUNNING;
          runRecord.result = {
            output: `子进程执行已启动（占位模式）: ${task.goal}`,
            subprocessMode: true,
            note: "未配置 scriptPath，请在生产环境中配置实际的任务执行脚本",
          };
          runRecord.status = RUNNER_STATUS.COMPLETED;
          runRecord.completedAt = new Date().toISOString();
        }
      } catch (error) {
        runRecord.status = RUNNER_STATUS.FAILED;
        runRecord.error = { message: error.message, code: error.code || "UNKNOWN" };
        runRecord.completedAt = new Date().toISOString();
      }

      return {
        runId,
        status: runRecord.status,
        startedAt: runRecord.startedAt,
      };
    },

    /**
     * 查询子进程任务状态
     */
    async status(runId) {
      const run = runs.get(runId);
      if (!run) {
        return { runId, status: "not_found", reason: "未找到指定的执行记录" };
      }
      return {
        runId,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        hasChildProcess: !!run.childProcess,
        error: run.error,
      };
    },

    /**
     * 取消子进程任务（杀死子进程）
     */
    async cancel(runId) {
      const run = runs.get(runId);
      if (!run) {
        return { success: false, reason: "未找到指定的执行记录" };
      }

      if (run.status === RUNNER_STATUS.RUNNING || run.status === RUNNER_STATUS.STARTING) {
        // 杀死子进程
        const child = processes.get(runId);
        if (child) {
          try {
            child.kill("SIGTERM");
            // 如果 5 秒后仍未退出，强制杀死
            const forceKillTimer = setTimeout(() => {
              try { child.kill("SIGKILL"); } catch (_) { /* 忽略 */ }
            }, 5000);
            child.once("exit", () => clearTimeout(forceKillTimer));
          } catch (_) {
            // 进程可能已退出
          }
          processes.delete(runId);
        }

        run.status = RUNNER_STATUS.CANCELLED;
        run.completedAt = new Date().toISOString();
        return { success: true, runId, status: RUNNER_STATUS.CANCELLED };
      }

      return {
        success: false,
        reason: `任务状态为 ${run.status}，无法取消`,
        runId,
      };
    },

    /**
     * 获取子进程任务结果
     */
    async getResult(runId) {
      const run = runs.get(runId);
      if (!run) {
        return { success: false, reason: "未找到指定的执行记录" };
      }
      return {
        success: true,
        runId,
        status: run.status,
        result: run.result,
        error: run.error,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      };
    },
  };
}

// ---- Runner 注册表 ----

/**
 * 注册 Runner 到全局注册表
 * @param {object} runner - Runner 实例
 * @returns {object} 注册结果
 */
export function registerRunner(runner) {
  if (!runner || !runner.runnerId) {
    throw new Error("Runner 必须具有 runnerId 属性");
  }
  if (!runner.capabilities) {
    throw new Error("Runner 必须声明 capabilities");
  }

  runnerRegistry.set(runner.runnerId, {
    runner,
    registeredAt: new Date().toISOString(),
  });

  return {
    success: true,
    runnerId: runner.runnerId,
    runnerType: runner.runnerType,
    capabilities: runner.capabilities,
  };
}

/**
 * 从注册表获取 Runner
 * @param {string} runnerId - Runner ID
 * @returns {object|null} Runner 实例或 null
 */
export function getRunner(runnerId) {
  const entry = runnerRegistry.get(runnerId);
  return entry ? entry.runner : null;
}

/**
 * 列出所有已注册的 Runner
 * @returns {object[]} Runner 列表
 */
export function listRunners() {
  return [...runnerRegistry.entries()].map(([id, entry]) => ({
    runnerId: id,
    runnerType: entry.runner.runnerType,
    capabilities: entry.runner.capabilities,
    registeredAt: entry.registeredAt,
  }));
}

/**
 * 根据能力选择合适的 Runner
 * @param {object} requirements - 需求描述
 * @param {string} [requirements.environment] - 目标环境
 * @param {string} [requirements.isolationLevel] - 所需隔离级别
 * @returns {object|null} 匹配的 Runner 或 null
 */
export function selectRunner(requirements = {}) {
  for (const [, entry] of runnerRegistry) {
    const caps = entry.runner.capabilities;
    if (requirements.environment && caps.environment !== requirements.environment) continue;
    if (requirements.isolationLevel && caps.isolationLevel !== requirements.isolationLevel) continue;
    return entry.runner;
  }
  return null;
}

/**
 * 从注册表移除 Runner
 * @param {string} runnerId - Runner ID
 * @returns {boolean} 是否成功移除
 */
export function unregisterRunner(runnerId) {
  return runnerRegistry.delete(runnerId);
}

