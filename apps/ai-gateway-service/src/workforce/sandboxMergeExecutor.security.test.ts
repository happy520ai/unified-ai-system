import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createSandboxMergeExecutor } from "./sandboxMergeExecutor.js";

const execFileAsync = promisify(execFile);
const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function budget() {
  return {
    getInfo: () => ({ module: "test-budget" }),
    consume: vi.fn(async () => ({ allowed: true, remaining: 9 })),
    recordTrustEvent: vi.fn(async () => ({ success: true })),
    getUsage: vi.fn(async () => ({})),
    isForbidden: vi.fn(() => false),
    getForbiddenSurface: vi.fn(() => []),
  };
}

describe("sandbox merge execution boundaries", () => {
  it("uses the real security-check contract and blocks before worktree creation", async () => {
    const root = await mkdtemp(join(tmpdir(), "sandbox-security-block-"));
    cleanupPaths.push(root);
    const create = vi.fn();
    const executor = createSandboxMergeExecutor({
      repoRoot: root,
      executionDir: join(root, "state"),
      budget: budget(),
      worktreeIsolation: { getInfo: () => ({}), create, remove: vi.fn() },
      securityCheckpoint: {
        getInfo: () => ({}),
        preExecutionCheck: vi.fn(async () => ({ result: "block", findings: ["denied"] })),
        postExecutionCheck: vi.fn(),
      },
    });

    const result: any = await executor.execute({
      planId: "sandbox-blocked",
      executionScopeId: "wf-scope-blocked",
      goal: "blocked goal",
      userId: "alice",
      tenantId: "tenant-a",
    });
    expect(result).toMatchObject({ success: false, code: "security_pre_scan_blocked" });
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps a verified candidate branch after removing its real worktree", async () => {
    const root = await mkdtemp(join(tmpdir(), "sandbox-candidate-"));
    cleanupPaths.push(root);
    const repoRoot = join(root, "repo");
    const executionDir = join(root, "state");
    await mkdir(repoRoot, { recursive: true });
    await execFileAsync("git", ["init", "-q", "-b", "main"], { cwd: repoRoot });
    await execFileAsync("git", ["config", "user.email", "sandbox@test"], { cwd: repoRoot });
    await execFileAsync("git", ["config", "user.name", "sandbox-test"], { cwd: repoRoot });
    await writeFile(join(repoRoot, "README.md"), "# sandbox test\n", "utf8");
    await execFileAsync("git", ["add", "."], { cwd: repoRoot });
    await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: repoRoot });

    const executor = createSandboxMergeExecutor({
      repoRoot,
      executionDir,
      budget: budget(),
    });
    const result: any = await executor.execute({
      planId: "sandbox-candidate",
      executionScopeId: `wf-scope-${"a".repeat(64)}`,
      goal: "Create one verified candidate artifact",
      userId: "alice",
      tenantId: "tenant-a",
      autonomyMode: "sandbox-merge",
      verify: async ({ worktreePath }: { worktreePath: string }) => {
        await writeFile(join(worktreePath, "feature.js"), "export const feature = true;\n", "utf8");
        return { pass: true, checks: [{ name: "test-verifier", pass: true }] };
      },
    });

    expect(result).toMatchObject({
      success: true,
      executionStatus: "completed",
      executionId: `wf-scope-${"a".repeat(64)}`,
      worktree: { created: true, cleanedUp: true, rolledBack: false },
      candidate: { readyToMerge: true },
      safety: { secretScanPassed: true, mainBranchModified: false },
    });
    expect(result.candidate.commit).toMatch(/^[a-f0-9]{7,40}$/u);
    const branch = result.candidate.branch;
    const listed = await execFileAsync("git", ["branch", "--list", branch], { cwd: repoRoot });
    expect(listed.stdout).toContain(branch);
    const worktrees = await execFileAsync("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot });
    expect(worktrees.stdout.match(/^worktree /gmu)).toHaveLength(1);
    expect(await readdir(join(executionDir, "evidence", `wf-scope-${"a".repeat(64)}`))).toHaveLength(7);
    await execFileAsync("git", ["branch", "-D", branch], { cwd: repoRoot });
  }, 20_000);
});
