import { describe, expect, it, vi } from "vitest";
import { createTaskClaimTokenService } from "./taskClaimTokenService.js";
import { createExecutionLifecycleService } from "./executionLifecycleService.js";
import { createWorkflowRunHandoff } from "./workflowRunHandoff.js";

describe("taskClaimTokenService", () => {
  it("issues single-use tokens bound to (planId, taskId)", () => {
    const service = createTaskClaimTokenService();
    const claim = service.issueTaskClaimToken({ planId: "plan-1", taskId: "task-1", issuedBy: "owner" });
    expect(claim.issued).toBe(true);
    expect(claim.token).toMatch(/^tct_/);
    expect(claim.singleUse).toBe(true);

    const consumed = service.consumeTaskClaimToken({ planId: "plan-1", taskId: "task-1", token: claim.token });
    expect(consumed.valid).toBe(true);

    const replay = service.consumeTaskClaimToken({ planId: "plan-1", taskId: "task-1", token: claim.token });
    expect(replay.valid).toBe(false);
    expect(replay.code).toBe("CLAIM_NOT_FOUND");
  });

  it("rejects mismatched tokens without leaking the real one", () => {
    const service = createTaskClaimTokenService();
    const claim = service.issueTaskClaimToken({ planId: "p", taskId: "t" });
    const wrong = service.consumeTaskClaimToken({ planId: "p", taskId: "t", token: "tct_deadbeef" });
    expect(wrong.valid).toBe(false);
    expect(wrong.code).toBe("CLAIM_TOKEN_MISMATCH");
    // 错误尝试不烧毁真令牌。
    const correct = service.consumeTaskClaimToken({ planId: "p", taskId: "t", token: claim.token });
    expect(correct.valid).toBe(true);
  });

  it("expires tokens by TTL and supports revocation", () => {
    let now = 1_000_000;
    const service = createTaskClaimTokenService({ ttlMs: 1000, clock: () => now });
    const claim = service.issueTaskClaimToken({ planId: "p", taskId: "t" });
    now += 2000;
    expect(service.consumeTaskClaimToken({ planId: "p", taskId: "t", token: claim.token }).code).toBe("CLAIM_EXPIRED");

    const claim2 = service.issueTaskClaimToken({ planId: "p2", taskId: "t2" });
    expect(service.revokeTaskClaimToken({ planId: "p2", taskId: "t2" }).revoked).toBe(true);
    expect(service.consumeTaskClaimToken({ planId: "p2", taskId: "t2", token: claim2.token }).code).toBe("CLAIM_NOT_FOUND");
    expect(service.getStatus().implemented).toBe(true);
  });

  it("refuses double issue for the same task", () => {
    const service = createTaskClaimTokenService();
    service.issueTaskClaimToken({ planId: "p", taskId: "t" });
    const second = service.issueTaskClaimToken({ planId: "p", taskId: "t" });
    expect(second.issued).toBe(false);
    expect(second.code).toBe("CLAIM_ALREADY_ACTIVE");
  });
});

describe("executionLifecycleService", () => {
  it("starts, cancels, and finishes executions with real abort signals", async () => {
    const events = [];
    const service = createExecutionLifecycleService({ onExecutionEvent: (event) => events.push(event) });
    const execution = service.startExecution({ planId: "p", taskId: "t" });
    expect(execution.started).toBe(true);
    expect(execution.signal.aborted).toBe(false);
    expect(service.listActiveExecutions()).toHaveLength(1);

    let abortReason = null;
    execution.signal.addEventListener("abort", () => {
      abortReason = execution.signal.reason?.message ?? "aborted";
    });
    const cancelled = service.cancelExecution(execution.runId, "operator_stop");
    expect(cancelled.cancelled).toBe(true);
    await Promise.resolve();
    expect(abortReason).toContain("operator_stop");
    expect(service.listActiveExecutions()).toHaveLength(0);

    const finished = service.finishExecution("missing");
    expect(finished.finished).toBe(false);
    expect(events.map((event) => event.type)).toEqual(["execution_started", "execution_cancelled"]);
  });

  it("finishes executions and reports status", () => {
    const service = createExecutionLifecycleService();
    const execution = service.startExecution({ planId: "p", taskId: "t" });
    expect(service.finishExecution(execution.runId, { status: "completed", result: { ok: true } }))
      .toMatchObject({ finished: true, status: "completed" });
    expect(service.getStatus().cancellable).toBe(true);
    expect(service.getExecution(execution.runId)).toBeNull();
  });
});

describe("workflowRunHandoff", () => {
  function createFixture({ runImpl } = {}) {
    const claimTokens = createTaskClaimTokenService();
    const lifecycle = createExecutionLifecycleService();
    const workflowService = {
      run: runImpl ?? vi.fn(async (request, context) => ({ ok: true, requestId: request.taskId, signalHandled: context.signal instanceof AbortSignal })),
    };
    const handoff = createWorkflowRunHandoff({ workflowService, claimTokens, lifecycle });
    return { handoff, claimTokens, lifecycle, workflowService };
  }

  it("executes workflowService.run when the claim token is valid", async () => {
    const { handoff, claimTokens } = createFixture();
    const claim = claimTokens.issueTaskClaimToken({ planId: "plan-1", taskId: "task-1" });
    const result = await handoff.handoff({
      planId: "plan-1",
      taskId: "task-1",
      claimToken: claim.token,
      workflowRequest: { goal: "do it" },
    });
    expect(result.handedOff).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.result.ok).toBe(true);
  });

  it("refuses handoff without consuming a token and never calls run", async () => {
    const { handoff, claimTokens, workflowService } = createFixture();
    const claim = claimTokens.issueTaskClaimToken({ planId: "p", taskId: "t" });
    const refused = await handoff.handoff({ planId: "p", taskId: "t", claimToken: "tct_invalid" });
    expect(refused.handedOff).toBe(false);
    expect(refused.status).toBe("refused");
    expect(refused.code).toBe("CLAIM_TOKEN_MISMATCH");
    expect(workflowService.run).not.toHaveBeenCalled();

    // 单次使用：第二次同令牌请求被拒。
    await handoff.handoff({ planId: "p", taskId: "t", claimToken: claim.token });
    const replay = await handoff.handoff({ planId: "p", taskId: "t", claimToken: claim.token });
    expect(replay.code).toBe("CLAIM_NOT_FOUND");
    expect(workflowService.run).toHaveBeenCalledTimes(1);
  });

  it("reports cancelled when the execution is aborted mid-run", async () => {
    const { handoff, claimTokens, lifecycle } = createFixture({
      runImpl: (request, context) => new Promise((_resolve, reject) => {
        context.signal.addEventListener("abort", () => reject(context.signal.reason));
      }),
    });
    const claim = claimTokens.issueTaskClaimToken({ planId: "p", taskId: "t" });
    const pending = handoff.handoff({ planId: "p", taskId: "t", claimToken: claim.token });
    await Promise.resolve();
    const active = lifecycle.listActiveExecutions();
    expect(active).toHaveLength(1);
    lifecycle.cancelExecution(active[0].runId, "test-cancel");
    const result = await pending;
    expect(result.status).toBe("cancelled");
    expect(result.error.message).toContain("test-cancel");
  });

  it("refuses honestly when dependencies are missing", async () => {
    const handoff = createWorkflowRunHandoff({});
    const result = await handoff.handoff({ planId: "p", taskId: "t", claimToken: "x" });
    expect(result.code).toBe("HANDOFF_NO_WORKFLOW_SERVICE");
    expect(handoff.implemented).toBe(true);
  });
});
