import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, writeFile, readFile, lstat, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, parse } from "node:path";

import { createGitWorktree } from "../src/sandbox-executor/git-worktree.js";
import { SandboxExecutor } from "../src/sandbox-executor/index.js";

const temporaryRoots = new Set();

async function createRepository() {
  const repoRoot = await mkdtemp(join(tmpdir(), "forge-worktree-security-"));
  temporaryRoots.add(repoRoot);
  execFileSync("git", ["init", "--quiet"], { cwd: repoRoot, stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "forge-security@example.invalid"], { cwd: repoRoot, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "Forge Security Test"], { cwd: repoRoot, stdio: "pipe" });
  await writeFile(join(repoRoot, "README.md"), "fixture\n", "utf8");
  execFileSync("git", ["add", "README.md"], { cwd: repoRoot, stdio: "pipe" });
  execFileSync("git", ["commit", "--quiet", "-m", "fixture"], { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
}

afterEach(async () => {
  await Promise.all([...temporaryRoots].map(async (root) => {
    await rm(root, { recursive: true, force: true });
    temporaryRoots.delete(root);
  }));
});

describe("git worktree security boundary", () => {
  it("rejects traversal, absolute, separator, and reserved task ids before deleting anything", async () => {
    const repoRoot = await createRepository();
    const sentinel = join(repoRoot, "outside-sentinel", "proof.txt");
    await mkdir(join(repoRoot, "outside-sentinel"), { recursive: true });
    await writeFile(sentinel, "must-survive", "utf8");
    const manager = createGitWorktree({
      repoRoot,
      worktreeRoot: ".forge-worktrees",
      autoCleanupOnExit: false,
    });

    const maliciousIds = [
      "../outside-sentinel",
      "..\\outside-sentinel",
      "nested/task",
      "nested\\task",
      resolve(repoRoot, "absolute-task"),
      "a..b",
      "NUL",
      "",
    ];
    for (const id of maliciousIds) {
      await assert.rejects(manager.create({ id }), /path-safe identifier|reserved on Windows/);
    }

    assert.equal(await readFile(sentinel, "utf8"), "must-survive");
    assert.equal(manager.getStats().created, 0);
  });

  it("creates only below the configured root and proves path and git metadata removal", async () => {
    const repoRoot = await createRepository();
    const manager = createGitWorktree({
      repoRoot,
      worktreeRoot: ".forge-worktrees",
      autoCleanupOnExit: false,
    });

    const record = await manager.create({ id: "safe-task-1" });
    const expectedRoot = await realpath(resolve(repoRoot, ".forge-worktrees"));
    assert.equal(record.path, join(expectedRoot, "safe-task-1"));
    assert.ok((await lstat(record.path)).isDirectory());

    assert.equal(await manager.remove("safe-task-1"), true);
    await assert.rejects(lstat(record.path), { code: "ENOENT" });
    const listed = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(listed.includes(record.path), false);
    assert.deepEqual(manager.getStats(), {
      created: 1,
      removed: 1,
      cleanedExpired: 0,
      failedCreates: 0,
      failedRemoves: 0,
      active: 0,
    });
  });

  it("does not report success when locked git metadata survives fallback directory removal", async () => {
    const repoRoot = await createRepository();
    const manager = createGitWorktree({
      repoRoot,
      worktreeRoot: ".forge-worktrees",
      autoCleanupOnExit: false,
    });
    const record = await manager.create({ id: "locked-task" });
    execFileSync("git", ["worktree", "lock", "--reason", "security-test", record.path], {
      cwd: repoRoot,
      stdio: "pipe",
    });

    await assert.rejects(
      manager.remove("locked-task"),
      /git metadata still registers worktree after cleanup/,
    );
    await assert.rejects(lstat(record.path), { code: "ENOENT" });
    assert.equal(manager.get("locked-task")?.id, "locked-task");
    assert.equal(manager.getStats().removed, 0);
    assert.equal(manager.getStats().failedRemoves, 1);
  });

  it("rejects repository and filesystem roots as cleanup roots", async () => {
    const repoRoot = await createRepository();
    assert.throws(
      () => createGitWorktree({ repoRoot, worktreeRoot: ".", autoCleanupOnExit: false }),
      /must not be the repository or filesystem root/,
    );
    assert.throws(
      () => createGitWorktree({ repoRoot, worktreeRoot: parse(repoRoot).root, autoCleanupOnExit: false }),
      /must not be the repository or filesystem root/,
    );
  });

  it("retains a worktree when container quiescence cannot be proven", async () => {
    const repoRoot = await createRepository();
    const backend = {
      type: "test-container",
      attest: async () => ({
        networkIsolation: true,
        readOnlyRoot: true,
        nonRootUser: true,
        noNewPrivileges: true,
        capabilitiesDropped: true,
        processTreeKill: true,
        resourceLimits: true,
      }),
      run: async () => ({
        exitCode: -1,
        stdout: "",
        stderr: "forced cleanup uncertainty",
        duration: 1,
        killed: true,
        killReason: "container cleanup uncertain",
        peakMemoryMB: 0,
        cleanupUncertain: true,
      }),
    };
    const executor = new SandboxExecutor({
      level: "worktree",
      allowedPaths: [repoRoot],
      backend,
    });

    const result = await executor.execute("echo isolated", {
      cwd: repoRoot,
      taskId: "retain-uncertain",
    });

    assert.equal(result.cleanupUncertain, true);
    assert.match(result.stderr, /SANDBOX_WORKTREE_RETAINED/);
    assert.ok((await lstat(join(repoRoot, ".forge-worktrees", "retain-uncertain"))).isDirectory());
  });

  it("disables repository hooks before host-side worktree checkout", async () => {
    const repoRoot = await createRepository();
    const hookPath = join(repoRoot, ".git", "hooks", "post-checkout");
    await writeFile(hookPath, "#!/bin/sh\nprintf hook-fired > hook-fired\n", "utf8");
    await chmod(hookPath, 0o755);
    const manager = createGitWorktree({ repoRoot, worktreeRoot: ".forge-worktrees" });

    const record = await manager.create({ id: "hook-proof" });
    await assert.rejects(lstat(join(record.path, "hook-fired")), { code: "ENOENT" });
    await manager.remove("hook-proof");
  });

  it("refuses repository checkout filters and duplicate active task ids", async () => {
    const repoRoot = await createRepository();
    execFileSync("git", ["config", "--local", "filter.unsafe.clean", "node unsafe-filter.js"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const filtered = createGitWorktree({ repoRoot, worktreeRoot: ".forge-worktrees" });
    await assert.rejects(filtered.create({ id: "filter-proof" }), /executable checkout configuration/);

    execFileSync("git", ["config", "--local", "--remove-section", "filter.unsafe"], {
      cwd: repoRoot,
      stdio: "pipe",
    });
    const manager = createGitWorktree({ repoRoot, worktreeRoot: ".forge-worktrees-2" });
    await manager.create({ id: "unique-active" });
    await assert.rejects(manager.create({ id: "unique-active" }), /already active/);
    await manager.remove("unique-active");
  });

  it("keeps worktree managers and mounts scoped to each canonical repository", async () => {
    const repoA = await createRepository();
    const repoB = await createRepository();
    const workspaces = [];
    const backend = {
      type: "test-container",
      attest: async () => ({
        networkIsolation: true,
        readOnlyRoot: true,
        nonRootUser: true,
        noNewPrivileges: true,
        capabilitiesDropped: true,
        processTreeKill: true,
        resourceLimits: true,
      }),
      run: async ({ workspace }) => {
        workspaces.push(workspace);
        return {
          exitCode: 0, stdout: "ok", stderr: "", duration: 1,
          killed: false, killReason: null, peakMemoryMB: 0,
          cleanupUncertain: false,
        };
      },
    };
    const executor = new SandboxExecutor({
      level: "worktree",
      allowedPaths: [repoA, repoB],
      backend,
    });

    assert.equal((await executor.execute("echo a", { cwd: repoA, taskId: "repo-a-task" })).exitCode, 0);
    assert.equal((await executor.execute("echo b", { cwd: repoB, taskId: "repo-b-task" })).exitCode, 0);
    assert.equal(workspaces.length, 2);
    assert.ok(workspaces[0].startsWith(await realpath(repoA)));
    assert.ok(workspaces[1].startsWith(await realpath(repoB)));
  });
});
