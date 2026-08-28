// Execution lifecycle service.
//
// 真实的可取消执行生命周期：每次执行注册一个 runId 与 AbortController，
// 取消即触发信号、执行方响应中止；支持完成/失败收尾与活跃执行查询。
// 不做任何进程外调度——它给既有 runner（local/subprocess）提供统一的
// 生命周期骨架。

import { randomUUID } from "node:crypto";

const MAX_ACTIVE_EXECUTIONS = 64;

export function createExecutionLifecycleService({
  maxActiveExecutions = MAX_ACTIVE_EXECUTIONS,
  onExecutionEvent = null,
} = {}) {
  const active = new Map(); // runId → { runId, planId, taskId, controller, startedAt, meta }

  function emit(event) {
    if (typeof onExecutionEvent === "function") {
      try {
        onExecutionEvent(event);
      } catch {
        // 事件回调失败绝不影响生命周期本身。
      }
    }
  }

  return {
    startExecution({ planId, taskId, meta = {} } = {}) {
      if (!planId || !taskId) {
        return { started: false, code: "EXECUTION_INPUT_INVALID", reason: "planId and taskId are required." };
      }
      if (active.size >= maxActiveExecutions) {
        return { started: false, code: "EXECUTION_CAPACITY_REACHED", reason: "Too many active executions." };
      }
      const runId = `exec_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const controller = new AbortController();
      active.set(runId, {
        runId,
        planId,
        taskId,
        controller,
        startedAt: new Date().toISOString(),
        meta,
      });
      emit({ type: "execution_started", runId, planId, taskId });
      return {
        started: true,
        runId,
        signal: controller.signal,
        cancel: () => this.cancelExecution(runId),
      };
    },

    cancelExecution(runId, reason = "cancelled_by_operator") {
      const execution = active.get(runId);
      if (!execution) {
        return { cancelled: false, code: "EXECUTION_NOT_FOUND", runId };
      }
      execution.controller.abort(new Error(`Execution cancelled: ${reason}`));
      active.delete(runId);
      emit({ type: "execution_cancelled", runId, planId: execution.planId, taskId: execution.taskId, reason });
      return { cancelled: true, runId, status: "cancelled", reason };
    },

    finishExecution(runId, { status = "completed", result = null, error = null } = {}) {
      const execution = active.get(runId);
      if (!execution) {
        return { finished: false, code: "EXECUTION_NOT_FOUND", runId };
      }
      active.delete(runId);
      emit({
        type: "execution_finished",
        runId,
        planId: execution.planId,
        taskId: execution.taskId,
        status,
      });
      return { finished: true, runId, status, result, error };
    },

    getExecution(runId) {
      const execution = active.get(runId);
      if (!execution) return null;
      const { controller, ...rest } = execution;
      return { ...rest, abortState: controller.signal.aborted ? "aborted" : "live" };
    },

    listActiveExecutions() {
      return [...active.values()].map(({ controller, ...rest }) => ({
        ...rest,
        abortState: controller.signal.aborted ? "aborted" : "live",
      }));
    },

    getStatus() {
      return {
        implemented: true,
        cancellable: true,
        activeExecutions: active.size,
        maxActiveExecutions,
      };
    },
  };
}
