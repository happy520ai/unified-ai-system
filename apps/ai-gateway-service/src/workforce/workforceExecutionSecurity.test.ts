import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { a2aGatewayInternals } from "../http/a2aGateway.js";
import { createWorkforceRoutes } from "../http/workforceRoutes.js";
import { createExecutionApprovalGate } from "./executionApprovalGate.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function permissiveTierGovernor() {
  return {
    getInfo: () => ({ module: "test-tier-governor" }),
    getCurrentTier: vi.fn(async () => ({ autonomyMode: "sandbox-merge-auto" })),
    passGate: vi.fn(),
    setTier: vi.fn(),
    fallBack: vi.fn(),
  };
}

async function executionDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "workforce-security-"));
  cleanupPaths.push(root);
  return root;
}

describe("controlled workforce execution security boundary", () => {
  it("does not enable execution merely because a provider adapter exists", async () => {
    const executor = createControlledExecutor({
      env: {},
      executionDir: await executionDir(),
      providerAdapter: { execute: vi.fn() },
      tierGovernor: permissiveTierGovernor(),
    });

    expect(executor.getInfo()).toEqual(expect.objectContaining({ executionEnabled: false, dryRun: true }));
  });

  it("binds one approval to the exact subject, plan, scopes, and a single execution", async () => {
    const sandboxMerger = { execute: vi.fn(async () => ({ success: true, executionStatus: "completed" })) };
    const executor = createControlledExecutor({
      env: { WORKFORCE_EXECUTION_ENABLED: "true" },
      executionDir: await executionDir(),
      sandboxMerger,
      tierGovernor: permissiveTierGovernor(),
    });
    const input = {
      planId: "plan-secure-1",
      goal: "Build a bounded test artifact",
      autonomyMode: "sandbox-merge",
      userId: "alice",
    };
    const descriptor = await executor.describeExecution(input);

    await expect(executor.approveExecution(input, "alice", ["workforce:execute"]))
      .rejects.toMatchObject({ code: "WORKFORCE_APPROVAL_SCOPE_MISMATCH" });
    await executor.approveExecution(input, "alice", descriptor.requiredScopes);

    const wrongSubject = await executor.execute({ ...input, userId: "mallory" });
    expect(wrongSubject).toEqual(expect.objectContaining({ code: "approval_required" }));
    expect(wrongSubject.approval.decisionCode).toBe("APPROVAL_SUBJECT_MISMATCH");

    const changedPlan = await executor.execute({ ...input, goal: "Changed after approval" });
    expect(changedPlan.approval.decisionCode).toBe("APPROVAL_PLAN_MISMATCH");

    await expect(executor.execute(input)).resolves.toEqual(expect.objectContaining({ success: true }));
    expect(sandboxMerger.execute).toHaveBeenCalledTimes(1);

    const replay = await executor.execute(input);
    expect(replay.approval.decisionCode).toBe("APPROVAL_NOT_FOUND");
    expect(sandboxMerger.execute).toHaveBeenCalledTimes(1);
  });

  it("rejects expired approvals", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    const gate = createExecutionApprovalGate({
      storePath: join(await executionDir(), "approvals.json"),
      ttlMs: 50,
    });
    const context = {
      planId: "plan-expiring",
      userId: "alice",
      planDigest: "b".repeat(64),
      requiredScopes: ["workforce:execute"],
    };
    await gate.approve({ ...context, approvedScopes: context.requiredScopes });
    vi.advanceTimersByTime(51);

    await expect(gate.consume(context)).resolves.toEqual(expect.objectContaining({
      approved: false,
      code: "APPROVAL_EXPIRED",
    }));
  });
});

describe("public workforce entrypoints", () => {
  it("forces HTTP execution to use the authenticated identity and controlled executor", async () => {
    const workforceExecutor = {
      execute: vi.fn(async () => ({ success: true, executionStatus: "dry_run_preview" })),
      approveExecution: vi.fn(),
      revokeApproval: vi.fn(),
    };
    const writeJson = vi.fn();
    const routes = createWorkforceRoutes(
      {
        workforceExecutor,
        workforceService: {},
        workflowService: {},
      },
      {
        readCapabilityJson: vi.fn(),
        writeJson,
        writeServiceLog: vi.fn(),
        writeErrorResponse: vi.fn(),
        createOkEnvelope: (value: unknown) => value,
        createErrorEnvelope: vi.fn(),
      },
    );
    const route = routes.handlers.get("POST /workforce/execute") as any;

    await route.handler(
      { enterpriseIdentity: { userId: "alice" } },
      {},
      { startedAt: new Date(), body: { goal: "preview", userId: "mallory" } },
    );

    expect(workforceExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({ userId: "alice" }));
    expect(route.permission).toBe("workflow:run");
    expect((routes.handlers.get("POST /workforce/execute/approve") as any).permission).toBe("workflow:approve");
    expect(writeJson).toHaveBeenCalled();
  });

  it("requires workflow permission and forces A2A workforce mode through preview-only controlled execution", async () => {
    const gatewayService = { execute: vi.fn() };
    const workforceExecutor = {
      execute: vi.fn(async () => ({
        success: true,
        goal: "preview",
        executionStatus: "dry_run_preview",
        preview: { totalRoles: 7 },
      })),
    };
    const executor = new a2aGatewayInternals.GatewayAgentExecutor(gatewayService, workforceExecutor);
    const eventBus = { publish: vi.fn() };

    await executor.execute({
      contextId: "ctx-1",
      taskId: "task-1",
      request: { metadata: { unifiedAi: { executionMode: "workforce" } } },
      context: {
        user: {
          isAuthenticated: true,
          userName: "alice",
          permissions: ["chat:use", "workflow:run"],
        },
      },
      userMessage: {
        parts: [{ content: { $case: "text", value: "preview" }, mediaType: "text/plain" }],
      },
    }, eventBus);

    expect(workforceExecutor.execute).toHaveBeenCalledWith(expect.objectContaining({ autonomyMode: "dry-run" }));
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });
});
