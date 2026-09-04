import { afterEach, describe, expect, it, vi } from "vitest";

import { createControlledExecutor } from "./workforceControlledExecutor.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function controlledFixture(input: { providerAdapter?: any; approval?: any } = {}) {
  let lifecycleStatus = "created";
  let fenceSequence = 0;
  const approvalGate = {
    getInfo: () => ({ mode: "test" }),
    consume: input.approval ?? vi.fn(async () => ({
      approved: true,
      approval: { approvalId: "approval-1" },
    })),
    approve: vi.fn(),
    check: vi.fn(),
    revoke: vi.fn(),
  };
  const lifecycle = {
    getInfo: () => ({ mode: "test" }),
    initialize: vi.fn(async () => { lifecycleStatus = "initialized"; }),
    start: vi.fn(async () => { lifecycleStatus = "running"; }),
    getStatus: vi.fn(async () => ({ success: true, status: lifecycleStatus })),
    onAgentCompleted: vi.fn(async () => ({ action: "continue" })),
    complete: vi.fn(async (...args: any[]) => { lifecycleStatus = args[1]; }),
  };
  const taskQueue = {
    getInfo: () => ({ mode: "test" }),
    init: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    enqueueMany: vi.fn(async (tasks) => tasks.map((task: any, index: number) => ({
      ...task,
      taskId: `task-${index}`,
    }))),
    claimTask: vi.fn(async () => ({
      claimToken: `claim-${++fenceSequence}`,
      claim: { fencingToken: String(fenceSequence) },
    })),
    updateTaskStatus: vi.fn(async () => undefined),
    assertTaskClaimActive: vi.fn(async (_taskId, ownership) => ({
      active: true,
      fencingToken: ownership.claimToken,
    })),
    completeTask: vi.fn(async () => undefined),
    failTask: vi.fn(async () => undefined),
    cancelTask: vi.fn(async () => undefined),
  };
  const worktree = {
    getInfo: () => ({ mode: "test" }),
    create: vi.fn(async () => ({
      success: true,
      worktree: { worktreeId: "worktree-1", path: "test-worktree" },
    })),
    remove: vi.fn(async () => ({ success: true })),
  };
  const sandboxMerger = {
    getInfo: () => ({ mode: "test" }),
    execute: vi.fn(async () => ({ success: true })),
  };
  const executor = createControlledExecutor({
    env: {
      WORKFORCE_EXECUTION_ENABLED: "true",
      WORKFORCE_MAX_CONCURRENT: "16",
      WORKFORCE_EXECUTION_TIMEOUT_MS: "5000",
      AI_GATEWAY_WORKFORCE_CONTROL_POLL_MS: "5000",
    },
    providerAdapter: input.providerAdapter,
    executionLifecycle: lifecycle,
    approvalGate,
    taskQueueManager: taskQueue,
    worktreeIsolation: worktree,
    workspaceGuard: { check: vi.fn(async () => ({ clean: true })) },
    securityCheckpoint: {
      preExecutionCheck: vi.fn(async () => ({ result: "pass", findings: [] })),
      postExecutionCheck: vi.fn(async () => ({ result: "pass", findings: [] })),
      getInfo: () => ({ mode: "test" }),
    },
    evidenceCapture: {
      getInfo: () => ({ mode: "test" }),
      startCapture: vi.fn(() => null),
    },
    sandboxMerger,
    tierGovernor: {
      getInfo: () => ({ mode: "test" }),
      getCurrentTier: vi.fn(async () => ({ autonomyMode: "sandbox-merge-auto" })),
    },
  });
  return { approvalGate, executor, lifecycle, sandboxMerger, taskQueue, worktree };
}

function governedOptions(controller: AbortController, overrides: Record<string, any> = {}) {
  const assertActive = vi.fn(async () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    return true;
  });
  const reserveStep = vi.fn(async () => ({ allowed: true }));
  return {
    assertActive,
    reserveStep,
    options: {
      agentGovernance: {
        context: { agentId: "agt_root_1", tenantId: "tenant-a", userId: "alice" },
        policy: {
          limits: {
            maxRuntimeSeconds: 1,
            maxSteps: 20,
            maxWorkforceRoles: 7,
            ...(overrides.limits ?? {}),
          },
        },
        executionLease: {
          signal: controller.signal,
          fingerprint: "agent-run-fingerprint",
          assertActive,
        },
        remainingSteps: overrides.remainingSteps ?? 7,
        reserveStep,
      },
    },
  };
}

const EXECUTE_INPUT = {
  planId: "governed-plan-1",
  goal: "Build a bounded governed Workforce artifact",
  autonomyMode: "controlled-execution",
  userId: "alice",
  tenantId: "tenant-a",
};

describe("governed controlled Workforce executor", () => {
  it("rejects maxWorkforceRoles=2 before approval, worktree, queue, or role execution", async () => {
    const fixture = controlledFixture();
    const governed = governedOptions(new AbortController(), {
      limits: { maxWorkforceRoles: 2 },
    });

    await expect(fixture.executor.execute(EXECUTE_INPUT, governed.options)).rejects.toMatchObject({
      code: "AGENT_GOVERNANCE_WORKFORCE_ROLE_LIMIT_REACHED",
      details: { roleCount: 7, maxWorkforceRoles: 2 },
    });
    expect(fixture.approvalGate.consume).not.toHaveBeenCalled();
    expect(fixture.worktree.create).not.toHaveBeenCalled();
    expect(fixture.taskQueue.claimTask).not.toHaveBeenCalled();
  });

  it("allows maxWorkforceRoles=7, clamps runtime/concurrency, and atomically reserves all seven steps", async () => {
    const fixture = controlledFixture();
    const governed = governedOptions(new AbortController());
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const result = await fixture.executor.execute(EXECUTE_INPUT, governed.options);

    expect(result).toMatchObject({ success: true, rolesExecuted: 7, totalRoles: 7 });
    expect(fixture.approvalGate.consume).toHaveBeenCalledOnce();
    expect(governed.reserveStep).toHaveBeenCalledTimes(7);
    expect(fixture.taskQueue.claimTask).toHaveBeenCalledTimes(7);
    expect(timeoutSpy.mock.calls.some((call) => call[1] === 1000)).toBe(true);
    expect(fixture.lifecycle.complete).toHaveBeenCalled();
    expect(fixture.lifecycle.complete.mock.calls[0]?.[2]?.executionGraph.maxConcurrent).toBe(7);
    expect(fixture.taskQueue.assertTaskClaimActive).toHaveBeenCalledTimes(7);
    expect(governed.assertActive).toHaveBeenCalled();
  });

  it("still requires the existing exact Workforce plan approval after Agent Governance allows the root", async () => {
    const approval = vi.fn(async () => ({ approved: false, code: "APPROVAL_NOT_FOUND" }));
    const fixture = controlledFixture({ approval });
    const governed = governedOptions(new AbortController());

    await expect(fixture.executor.execute(EXECUTE_INPUT, governed.options)).resolves.toMatchObject({
      success: false,
      code: "approval_required",
      approval: { decisionCode: "APPROVAL_NOT_FOUND" },
    });
    expect(approval).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      userId: "alice",
      planDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
      requiredScopes: ["workforce:execute"],
    }));
    expect(fixture.worktree.create).not.toHaveBeenCalled();
    expect(fixture.taskQueue.claimTask).not.toHaveBeenCalled();
  });

  it("aborts and drains an in-flight role on Agent revocation before cleanup and lease return", async () => {
    const controller = new AbortController();
    let signalRoleStarted!: () => void;
    const roleStarted = new Promise<void>((resolve) => { signalRoleStarted = resolve; });
    let providerSettled = false;
    const providerAdapter = {
      governedProviderOperation: true,
      generate: vi.fn(async ({ execution }) => new Promise((_resolve, reject) => {
        signalRoleStarted();
        execution.signal.addEventListener("abort", () => {
          setTimeout(() => {
            providerSettled = true;
            reject(execution.signal.reason);
          }, 10);
        }, { once: true });
      })),
    };
    const fixture = controlledFixture({ providerAdapter });
    const governed = governedOptions(controller);

    const execution = fixture.executor.execute(EXECUTE_INPUT, governed.options);
    await roleStarted;
    controller.abort(Object.assign(new Error("revoked"), { code: "AGENT_EXECUTION_FENCED" }));
    expect(fixture.worktree.remove).not.toHaveBeenCalled();
    const result = await execution;

    expect(providerSettled).toBe(true);
    expect(result).toMatchObject({ success: false, rolesExecuted: 0 });
    expect(fixture.worktree.remove).toHaveBeenCalledOnce();
    expect(fixture.lifecycle.complete).toHaveBeenCalled();
  });

  it("denies governed sandbox merge modes before consuming plan approval or reaching the sink", async () => {
    const fixture = controlledFixture();
    const governed = governedOptions(new AbortController());

    await expect(fixture.executor.execute({
      ...EXECUTE_INPUT,
      autonomyMode: "sandbox-merge",
    }, governed.options)).rejects.toMatchObject({
      code: "WORKFORCE_GOVERNED_SANDBOX_MODE_UNSUPPORTED",
    });
    expect(fixture.approvalGate.consume).not.toHaveBeenCalled();
    expect(fixture.sandboxMerger.execute).not.toHaveBeenCalled();
  });
});
