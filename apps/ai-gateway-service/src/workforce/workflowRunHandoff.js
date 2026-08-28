// Workflow run handoff.
//
// 真实的 workforce → workflow 交接：凭有效的一次性 task claim token，把
// 已批准的计划任务交给 workflowService.run 执行，全程挂在可取消的执行
// 生命周期上。缺令牌、令牌无效、或执行被取消都会如实返回；没有任何
// “占位成功”。默认仍需显式调用（governance：不改变任何默认行为）。

export function createWorkflowRunHandoff({
  workflowService,
  claimTokens,
  lifecycle,
} = {}) {
  return {
    implemented: true,
    enabledByDefault: false,
    requires: ["validTaskClaimToken", "workflowService", "cancellableExecution"],

    getStatus() {
      return {
        implemented: true,
        workflowServiceAvailable: Boolean(workflowService),
        claimTokens: claimTokens?.getStatus?.() ?? null,
        lifecycle: lifecycle?.getStatus?.() ?? null,
      };
    },

    async handoff({
      planId,
      taskId,
      claimToken,
      workflowRequest = {},
      requestContext = {},
    } = {}) {
      if (!workflowService || typeof workflowService.run !== "function") {
        return handoffRefused("HANDOFF_NO_WORKFLOW_SERVICE", "workflowService is not available.");
      }
      if (!claimTokens || typeof claimTokens.consumeTaskClaimToken !== "function") {
        return handoffRefused("HANDOFF_NO_CLAIM_SERVICE", "task claim token service is not available.");
      }
      if (!lifecycle || typeof lifecycle.startExecution !== "function") {
        return handoffRefused("HANDOFF_NO_LIFECYCLE", "execution lifecycle service is not available.");
      }

      const claim = claimTokens.consumeTaskClaimToken({ planId, taskId, token: claimToken });
      if (!claim.valid) {
        return handoffRefused(claim.code, `Task claim rejected: ${claim.reason}`);
      }

      const execution = lifecycle.startExecution({ planId, taskId, meta: { via: "workflow-run-handoff" } });
      if (!execution.started) {
        return handoffRefused(execution.code, execution.reason);
      }

      try {
        const result = await workflowService.run(
          {
            ...workflowRequest,
            planId,
            taskId,
          },
          { ...requestContext, signal: execution.signal, runId: execution.runId },
        );
        lifecycle.finishExecution(execution.runId, { status: "completed", result });
        return {
          handedOff: true,
          runId: execution.runId,
          status: "completed",
          result,
        };
      } catch (error) {
        const cancelled = execution.signal.aborted;
        lifecycle.finishExecution(execution.runId, {
          status: cancelled ? "cancelled" : "failed",
          error,
        });
        return {
          handedOff: true,
          runId: execution.runId,
          status: cancelled ? "cancelled" : "failed",
          error: {
            message: error?.message ?? String(error),
            code: error?.code ?? null,
          },
        };
      }
    },
  };
}

function handoffRefused(code, reason) {
  return { handedOff: false, status: "refused", code, reason };
}
