import { TASK_STATUS } from "./taskQueueConstants.js";
import { createWorkforceExecutionWaves, getWorkforceRoleDependencies } from "./workforceRoleGraph.ts";

interface DagTask {
  queueTaskId: string;
  roleId: string;
  dependsOnRoleIds?: string[];
}

interface DagExecutorOptions {
  tasks: DagTask[];
  taskQueue: any;
  executeRole: (roleId: string, context: Record<string, unknown>, task: DagTask) => unknown | Promise<unknown>;
  context?: Record<string, unknown>;
  maxConcurrent?: number;
  claimTtlMs?: number;
  signal?: AbortSignal;
}

function dagError(code: string, message: string, details: Record<string, unknown> = {}) {
  const error = new Error(message);
  Object.assign(error, { code, details });
  return error;
}

function abortReason(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  return dagError("WORKFORCE_EXECUTION_ABORTED", "Workforce execution was aborted.");
}

async function runAbortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) throw abortReason(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function cancelRemaining(taskQueue: any, tasks: DagTask[], completed: Set<string>, reason: string) {
  await Promise.allSettled(tasks
    .filter((task) => !completed.has(task.roleId))
    .map((task) => taskQueue.cancelTask(task.queueTaskId, reason)));
}

export async function executeWorkforceDag(options: DagExecutorOptions) {
  if (!Array.isArray(options?.tasks) || options.tasks.length === 0) {
    return { roleOutputs: {}, executionWaves: [], peakConcurrency: 0, claimEnforced: true };
  }
  if (!options.taskQueue || typeof options.taskQueue.claimTask !== "function") {
    throw dagError("WORKFORCE_TASK_QUEUE_REQUIRED", "A claim-enforcing task queue is required.");
  }
  if (typeof options.executeRole !== "function") {
    throw dagError("WORKFORCE_ROLE_EXECUTOR_REQUIRED", "A role executor is required.");
  }
  const tasks = options.tasks.map((task) => ({
    queueTaskId: String(task.queueTaskId),
    roleId: String(task.roleId),
    dependsOnRoleIds: Array.isArray(task.dependsOnRoleIds)
      ? [...new Set(task.dependsOnRoleIds.map(String))]
      : getWorkforceRoleDependencies(String(task.roleId)),
  }));
  const taskByRole = new Map<string, DagTask>();
  for (const task of tasks) {
    if (!task.queueTaskId || !task.roleId || taskByRole.has(task.roleId)) {
      throw dagError("WORKFORCE_DAG_TASK_INVALID", "Every DAG task needs a unique role and queue task id.");
    }
    taskByRole.set(task.roleId, task);
  }
  const maxConcurrent = Math.min(16, Math.max(1, Math.floor(Number(options.maxConcurrent) || 1)));
  const waves = createWorkforceExecutionWaves(tasks.map((task) => task.roleId), maxConcurrent);
  const roleOutputs: Record<string, unknown> = {};
  const completedRoleIds = new Set<string>();
  const executionWaves: Array<Record<string, unknown>> = [];
  let activeExecutions = 0;
  let peakConcurrency = 0;

  for (let waveIndex = 0; waveIndex < waves.length; waveIndex += 1) {
    if (options.signal?.aborted) throw abortReason(options.signal);
    const waveRoleIds = waves[waveIndex];
    const priorOutputs = { ...roleOutputs };
    const waveStartedAt = Date.now();
    const preparedSettled = await Promise.allSettled(waveRoleIds.map(async (roleId) => {
      const task = taskByRole.get(roleId);
      if (!task) throw dagError("WORKFORCE_DAG_TASK_MISSING", `No queue task exists for role ${roleId}.`);
      const claimed = await options.taskQueue.claimTask(roleId, {
        taskId: task.queueTaskId,
        maxConcurrent: 1,
        ttlMs: options.claimTtlMs,
      });
      if (!claimed?.claimToken) {
        throw dagError("WORKFORCE_TASK_CLAIM_FAILED", `Role ${roleId} could not claim its task.`);
      }
      const ownership = { claimToken: claimed.claimToken, agentId: roleId };
      await options.taskQueue.updateTaskStatus(task.queueTaskId, TASK_STATUS.IN_PROGRESS, undefined, ownership);
      return { roleId, task, ownership };
    }));

    const preparationFailures: Array<{ roleId: string; message: string }> = [];
    const prepared: Array<{
      roleId: string;
      task: DagTask;
      ownership: { claimToken: string; agentId: string };
    }> = [];
    for (let index = 0; index < preparedSettled.length; index += 1) {
      const result = preparedSettled[index];
      if (result.status === "fulfilled") {
        prepared.push(result.value);
      } else {
        preparationFailures.push({
          roleId: waveRoleIds[index],
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
    if (preparationFailures.length > 0) {
      await Promise.allSettled(prepared.map(({ task }) => (
        options.taskQueue.cancelTask(task.queueTaskId, "dependency_wave_prepare_failed")
      )));
      await cancelRemaining(options.taskQueue, tasks, completedRoleIds, "dependency_wave_prepare_failed");
      throw dagError(
        "WORKFORCE_DAG_EXECUTION_FAILED",
        `Workforce dependency wave ${waveIndex} could not acquire every task claim.`,
        { waveIndex, failures: preparationFailures },
      );
    }

    const settled = await Promise.allSettled(prepared.map(async ({ roleId, task, ownership }) => {
      activeExecutions += 1;
      peakConcurrency = Math.max(peakConcurrency, activeExecutions);
      try {
        const output = await runAbortable(Promise.resolve(options.executeRole(roleId, {
          ...(options.context ?? {}),
          priorOutputs,
          signal: options.signal,
        }, task)), options.signal);
        await options.taskQueue.completeTask(task.queueTaskId, {
          roleId,
          completed: true,
          output,
        }, ownership);
        return { roleId, output };
      } catch (error) {
        try {
          await options.taskQueue.failTask(task.queueTaskId, error, ownership);
        } catch {
          await options.taskQueue.cancelTask(task.queueTaskId, "claim_lost_during_failure");
        }
        throw error;
      } finally {
        activeExecutions -= 1;
      }
    }));

    const failures: Array<{ roleId: string; message: string }> = [];
    for (let index = 0; index < settled.length; index += 1) {
      const roleId = waveRoleIds[index];
      const result = settled[index];
      if (result.status === "fulfilled") {
        roleOutputs[roleId] = result.value.output;
        completedRoleIds.add(roleId);
      } else {
        failures.push({ roleId, message: result.reason instanceof Error ? result.reason.message : String(result.reason) });
      }
    }
    executionWaves.push({
      index: waveIndex,
      roleIds: [...waveRoleIds],
      durationMs: Date.now() - waveStartedAt,
      success: failures.length === 0,
    });
    if (failures.length > 0) {
      await cancelRemaining(options.taskQueue, tasks, completedRoleIds, "dependency_wave_failed");
      throw dagError(
        "WORKFORCE_DAG_EXECUTION_FAILED",
        `Workforce dependency wave ${waveIndex} failed.`,
        { waveIndex, failures },
      );
    }
  }
  return {
    roleOutputs,
    executionWaves,
    peakConcurrency,
    maxConcurrent,
    claimEnforced: true,
    scheduler: "dependency-waves",
  };
}
