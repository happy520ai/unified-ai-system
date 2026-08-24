import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createExecutionLifecycle } from "./executionLifecycle.js";
import { createLifecycleStatePath } from "./executionLifecycleHelpers.js";
import { createSecurityReviewCheckpoint } from "./securityReviewCheckpoint.js";
import { createSecurityAuditLogPath } from "./securityReviewCheckpointHelpers.js";
import { createTaskEvidenceCapture } from "./taskEvidenceCapture.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";

const cleanupPaths: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function temporaryRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  cleanupPaths.push(root);
  return root;
}

function tierGovernor() {
  return {
    getInfo: () => ({ module: "test-tier" }),
    getCurrentTier: vi.fn(async () => ({ autonomyMode: "sandbox-merge-auto" })),
    passGate: vi.fn(),
    setTier: vi.fn(),
    fallBack: vi.fn(),
  };
}

function securityCheckpoint() {
  return {
    getInfo: () => ({ module: "test-security" }),
    preExecutionCheck: vi.fn(async () => ({ result: "pass", findings: [] })),
    postExecutionCheck: vi.fn(async () => ({ result: "pass", findings: [] })),
  };
}

async function approvedInput(executor: any) {
  const input = {
    planId: "same-public-plan",
    goal: "Produce a bounded deterministic architecture review",
    autonomyMode: "controlled-execution",
    userId: "alice",
    tenantId: "tenant-a",
  };
  const descriptor = await executor.describeExecution(input);
  await executor.approveExecution(input, input.userId, descriptor.requiredScopes);
  return input;
}

describe("controlled execution worktree and tenant isolation", () => {
  it("blocks when the worktree adapter returns an unsuccessful result", async () => {
    const executionDir = await temporaryRoot("workforce-worktree-fail-");
    const executor = createControlledExecutor({
      env: { WORKFORCE_EXECUTION_ENABLED: "true" },
      executionDir,
      tierGovernor: tierGovernor(),
      workspaceGuard: { getInfo: () => ({}), checkWorkspace: vi.fn(async () => ({ clean: true })) },
      securityCheckpoint: securityCheckpoint(),
      worktreeIsolation: {
        getInfo: () => ({}),
        create: vi.fn(async () => ({ success: false, reason: "git worktree unavailable" })),
        remove: vi.fn(),
      },
    });
    try {
      const result = await executor.execute(await approvedInput(executor));
      expect(result).toMatchObject({
        success: false,
        code: "worktree_creation_failed",
        executionStatus: "blocked",
      });
    } finally {
      await executor.close();
    }
  });

  it("uses the real checkpoint contract and blocks before worktree creation", async () => {
    const executionDir = await temporaryRoot("workforce-security-block-");
    const create = vi.fn();
    const checkpoint = {
      getInfo: () => ({}),
      preExecutionCheck: vi.fn(async () => ({ result: "block", findings: ["denied"] })),
      postExecutionCheck: vi.fn(),
    };
    const executor = createControlledExecutor({
      env: { WORKFORCE_EXECUTION_ENABLED: "true" },
      executionDir,
      tierGovernor: tierGovernor(),
      securityCheckpoint: checkpoint,
      workspaceGuard: { getInfo: () => ({}), checkWorkspace: vi.fn(async () => ({ clean: true })) },
      worktreeIsolation: { getInfo: () => ({}), create, remove: vi.fn() },
    });
    try {
      const result = await executor.execute(await approvedInput(executor));
      expect(result).toMatchObject({ success: false, code: "security_pre_scan_blocked" });
      expect(checkpoint.preExecutionCheck).toHaveBeenCalledWith(expect.objectContaining({
        agentId: "workforce-orchestrator",
        planId: expect.stringMatching(/^wf-scope-[a-f0-9]{64}$/u),
      }));
      expect(create).not.toHaveBeenCalled();
    } finally {
      await executor.close();
    }
  });

  it("uses an opaque tenant scope everywhere internal and captures evidence", async () => {
    const executionDir = await temporaryRoot("workforce-worktree-success-");
    const create = vi.fn(async ({ planId }) => ({
      success: true,
      worktree: { worktreeId: `wt-${planId}`, planId, path: "isolated" },
    }));
    const remove = vi.fn(async () => ({ success: true }));
    const lifecycle = {
      getInfo: () => ({}),
      initialize: vi.fn(async () => ({ success: true })),
      start: vi.fn(async () => ({ success: true })),
      onAgentCompleted: vi.fn(async () => ({ success: true })),
      complete: vi.fn(async () => ({ success: true })),
      getStatus: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    const captures: Array<{ planId: string; agentId: string; finish: ReturnType<typeof vi.fn> }> = [];
    const evidenceCapture = {
      getInfo: () => ({}),
      startCapture: vi.fn(({ planId, agentId }) => {
        const session = {
          planId,
          agentId,
          setOutput: vi.fn().mockReturnThis(),
          finish: vi.fn(async () => ({ success: true })),
        };
        captures.push(session);
        return session;
      }),
    };
    const checkpoint = securityCheckpoint();
    const executor = createControlledExecutor({
      env: { WORKFORCE_EXECUTION_ENABLED: "true" },
      executionDir,
      tierGovernor: tierGovernor(),
      workspaceGuard: { getInfo: () => ({}), checkWorkspace: vi.fn(async () => ({ clean: true })) },
      securityCheckpoint: checkpoint,
      worktreeIsolation: { getInfo: () => ({}), create, remove },
      executionLifecycle: lifecycle,
      evidenceCapture,
    });
    try {
      const result = await executor.execute(await approvedInput(executor));
      expect(result).toMatchObject({ success: true, worktree: { created: true, cleanedUp: true } });
      const internalPlanId = create.mock.calls[0][0].planId;
      expect(internalPlanId).toMatch(/^wf-scope-[a-f0-9]{64}$/u);
      expect(internalPlanId).not.toContain("tenant-a");
      expect(internalPlanId).not.toContain("alice");
      expect(internalPlanId).not.toContain("same-public-plan");
      expect(lifecycle.initialize).toHaveBeenCalledWith(internalPlanId, expect.objectContaining({
        publicPlanId: "same-public-plan",
        tenantId: "tenant-a",
        userId: "alice",
      }));
      expect(lifecycle.complete).toHaveBeenCalledWith(internalPlanId, "completed", expect.any(Object));
      expect(remove).toHaveBeenCalledWith(`wt-${internalPlanId}`);
      expect(captures).toHaveLength(7);
      expect(captures.every((capture) => capture.planId === internalPlanId)).toBe(true);
      expect(captures.every((capture) => capture.finish.mock.calls.length === 1)).toBe(true);
      expect(checkpoint.preExecutionCheck).toHaveBeenCalledTimes(1);
      expect(checkpoint.postExecutionCheck).toHaveBeenCalledTimes(1);
    } finally {
      await executor.close();
    }
  });

  it("marks the execution failed when isolated worktree cleanup fails", async () => {
    const executionDir = await temporaryRoot("workforce-worktree-cleanup-");
    const lifecycle = {
      getInfo: () => ({}),
      initialize: vi.fn(async () => ({ success: true })),
      start: vi.fn(async () => ({ success: true })),
      onAgentCompleted: vi.fn(async () => ({ success: true })),
      complete: vi.fn(async () => ({ success: true })),
      getStatus: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(),
    };
    const executor = createControlledExecutor({
      env: { WORKFORCE_EXECUTION_ENABLED: "true" },
      executionDir,
      tierGovernor: tierGovernor(),
      workspaceGuard: { getInfo: () => ({}), checkWorkspace: vi.fn(async () => ({ clean: true })) },
      securityCheckpoint: securityCheckpoint(),
      executionLifecycle: lifecycle,
      evidenceCapture: {
        getInfo: () => ({}),
        startCapture: () => ({ setOutput() { return this; }, async finish() { return { success: true }; } }),
      },
      worktreeIsolation: {
        getInfo: () => ({}),
        create: vi.fn(async () => ({ success: true, worktree: { worktreeId: "wt-cleanup" } })),
        remove: vi.fn(async () => ({ success: false, reason: "still mounted" })),
      },
    });
    try {
      const result = await executor.execute(await approvedInput(executor));
      expect(result).toMatchObject({
        success: false,
        executionStatus: "failed",
        worktree: { created: true, cleanedUp: false },
      });
      expect(result.errors).toContain("worktree_cleanup: still mounted");
      expect(lifecycle.complete).toHaveBeenCalledWith(expect.any(String), "failed", expect.any(Object));
    } finally {
      await executor.close();
    }
  });

  it("runs the default controlled path in a real worktree and leaves no registered worktree", async () => {
    const root = await temporaryRoot("workforce-controlled-real-");
    const repoRoot = join(root, "repo");
    const executionDir = join(root, "state");
    await mkdir(repoRoot, { recursive: true });
    await execFileAsync("git", ["init", "-q", "-b", "main"], { cwd: repoRoot });
    await execFileAsync("git", ["config", "user.email", "controlled@test"], { cwd: repoRoot });
    await execFileAsync("git", ["config", "user.name", "controlled-test"], { cwd: repoRoot });
    await writeFile(join(repoRoot, "README.md"), "# controlled execution test\n", "utf8");
    await execFileAsync("git", ["add", "."], { cwd: repoRoot });
    await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: repoRoot });

    const executor = createControlledExecutor({
      env: { WORKFORCE_EXECUTION_ENABLED: "true" },
      repoRoot,
      executionDir,
      tierGovernor: tierGovernor(),
    });
    try {
      const result = await executor.execute(await approvedInput(executor));
      expect(result).toMatchObject({
        success: true,
        executionStatus: "completed",
        worktree: { created: true, cleanedUp: true },
        safety: { secretScanPassed: true },
      });
      const worktreeList = await execFileAsync("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot });
      expect(worktreeList.stdout.match(/^worktree /gmu)).toHaveLength(1);
      const evidenceScopes = await readdir(join(executionDir, "evidence"));
      expect(evidenceScopes).toHaveLength(1);
      expect(await readdir(join(executionDir, "evidence", evidenceScopes[0]))).toHaveLength(7);
      expect(await readdir(join(executionDir, "security-audit"))).toHaveLength(1);
    } finally {
      await executor.close();
    }
  }, 20_000);
});

describe("lifecycle and evidence persistence isolation", () => {
  it("keeps lifecycle memory scoped to one backend instance", async () => {
    const firstRoot = await temporaryRoot("lifecycle-first-");
    const secondRoot = await temporaryRoot("lifecycle-second-");
    const first = createExecutionLifecycle({ lifecycleDir: firstRoot }) as any;
    const second = createExecutionLifecycle({ lifecycleDir: secondRoot }) as any;
    await first.initialize("same-plan", { owner: "first" });
    await second.initialize("same-plan", { owner: "second" });
    await first.start("same-plan");

    await expect(first.getStatus("same-plan")).resolves.toMatchObject({ status: "running" });
    await expect(second.getStatus("same-plan")).resolves.toMatchObject({ status: "pending" });
    expect(await readdir(firstRoot)).toEqual([expect.stringMatching(/^plan-[a-f0-9]{64}\.json$/u)]);

    await writeFile(createLifecycleStatePath(firstRoot, "same-plan"), "{corrupt", "utf8");
    const restarted = createExecutionLifecycle({ lifecycleDir: firstRoot }) as any;
    await expect(restarted.getStatus("same-plan"))
      .rejects.toMatchObject({ code: "WORKFORCE_LIFECYCLE_STATE_INVALID" });

    const unavailablePath = join(firstRoot, "occupied-file");
    await writeFile(unavailablePath, "occupied", "utf8");
    const unavailable = createExecutionLifecycle({ lifecycleDir: unavailablePath }) as any;
    await expect(unavailable.initialize("plan-unavailable", {})).rejects.toBeTruthy();
    expect(unavailable.listActive()).toMatchObject({ count: 0, executions: [] });
  });

  it("atomically persists bounded evidence with sensitive text redacted", async () => {
    const evidenceDir = await temporaryRoot("workforce-evidence-");
    const capture = (createTaskEvidenceCapture({ evidenceDir }) as any).startCapture({
      planId: "plan-1",
      agentId: "agent-1",
      goal: "Use sk-secretvalue123456 safely",
      context: { apiKey: "nvapi-secretvalue123456", note: "Bearer abcdefghijklmnop" },
    });
    capture.recordAiCall({
      provider: "fake",
      prompt: "authorization=abcdefghijklmnop",
      response: "ghp_abcdefghijklmnop",
    });
    capture.setOutput({ summary: "password=abcdefghijklmnop" });
    await capture.finish();

    const files = await readdir(join(evidenceDir, "plan-1"));
    expect(files).toEqual(["agent-1.json"]);
    const persisted = await readFile(join(evidenceDir, "plan-1", "agent-1.json"), "utf8");
    expect(persisted).not.toContain("secretvalue123456");
    expect(persisted).not.toContain("abcdefghijklmnop");
    expect(persisted).toContain("****");
  });

  it("hashes audit filenames, serializes writers, and fails closed on corrupt state", async () => {
    const root = await temporaryRoot("workforce-security-audit-");
    const auditLogDir = join(root, "audit");
    const checkpoint = createSecurityReviewCheckpoint({ auditLogDir }) as any;
    const planId = "../../escape-attempt";
    await Promise.all(Array.from({ length: 8 }, (_, index) => checkpoint.preExecutionCheck({
      planId,
      agentId: `agent-${index}`,
      goal: "safe goal",
      context: {},
    })));

    const files = await readdir(auditLogDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^plan-[a-f0-9]{64}\.json$/u);
    await expect(checkpoint.getAuditLog(planId)).resolves.toMatchObject({ entryCount: 8 });

    const logPath = createSecurityAuditLogPath(auditLogDir, planId);
    await writeFile(logPath, "{corrupt", "utf8");
    await expect(checkpoint.preExecutionCheck({
      planId,
      agentId: "agent-corrupt",
      goal: "safe goal",
      context: {},
    })).rejects.toMatchObject({ code: "WORKFORCE_SECURITY_AUDIT_CORRUPT" });

    const unavailablePath = join(root, "not-a-directory");
    await writeFile(unavailablePath, "occupied", "utf8");
    const unavailable = createSecurityReviewCheckpoint({ auditLogDir: unavailablePath }) as any;
    await expect(unavailable.preExecutionCheck({
      planId: "plan-unavailable",
      agentId: "agent",
      goal: "safe goal",
      context: {},
    })).rejects.toBeTruthy();
  });
});
