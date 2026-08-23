import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createExecutionApprovalGate } from "./executionApprovalGate.js";

const execFileAsync = promisify(execFile);

const workDir = mkdtempSync(join(tmpdir(), "uai-gates-"));
const repoRoot = join(workDir, "repo");
const worktreeRoot = join(workDir, "worktrees");

afterAll(() => {
  // 先注销 worktree 再删目录，避免残留元数据。
  rmSync(workDir, { recursive: true, force: true });
});

describe("worktreeIsolation gate (real git worktrees)", () => {
  let isolation;

  beforeAll(async () => {
    mkdirSync(repoRoot, { recursive: true });
    await execFileAsync("git", ["init", "-q", "-b", "main"], { cwd: repoRoot });
    await execFileAsync("git", ["config", "user.email", "gates@test"], { cwd: repoRoot });
    await execFileAsync("git", ["config", "user.name", "gates-test"], { cwd: repoRoot });
    writeFileSync(join(repoRoot, "README.md"), "# gate test repo\n");
    await execFileAsync("git", ["add", "."], { cwd: repoRoot });
    await execFileAsync("git", ["commit", "-q", "-m", "init"], { cwd: repoRoot });
    isolation = createWorktreeIsolation({ repoRoot, worktreeRoot });
  });

  it("creates a real isolated worktree on a new branch and removes it cleanly", async () => {
    const created = await isolation.create({ planId: "plan-gate-1" });
    expect(created.success).toBe(true);
    expect(existsSync(created.worktree.path)).toBe(true);
    expect(created.worktree.branch).toBeTruthy();

    const branches = await execFileAsync("git", ["branch", "--list", created.worktree.branch], { cwd: repoRoot });
    expect(branches.stdout).toContain(created.worktree.branch);

    const removed = await isolation.remove(created.worktree.worktreeId);
    expect(removed.success).toBe(true);
    expect(existsSync(created.worktree.path)).toBe(false);
  });

  it("reports honest module info", () => {
    const info = isolation.getInfo();
    expect(info.module).toBe("worktreeIsolation");
    expect(info.repoRoot).toBe(repoRoot);
  });
});

describe("executionApprovalGate gate (approve → check → consume)", () => {
  function createGate() {
    return createExecutionApprovalGate({
      storePath: join(workDir, `approvals-${Date.now()}-${Math.random().toString(36).slice(2)}.json`),
    });
  }

  it("approves, checks, and single-consumes an execution approval", async () => {
    const gate = createGate();
    const digest = createHash("sha256").update("plan-gate-2-body").digest("hex");
    const approval = await gate.approve({
      planId: "plan-gate-2",
      userId: "owner",
      planDigest: digest,
      approvedScopes: ["task:deploy"],
    });
    expect(approval.success).toBe(true);
    expect(approval.approval.approvalId).toMatch(/^appr_/);
    expect(approval.approval.status).toBe("approved");

    const check = await gate.check({ planId: "plan-gate-2", userId: "owner", planDigest: digest, requiredScopes: ["task:deploy"] });
    expect(check.approved).toBe(true);

    const consumed = await gate.consume({ planId: "plan-gate-2", userId: "owner", planDigest: digest, requiredScopes: ["task:deploy"] });
    expect(consumed.approved).toBe(true);

    const replay = await gate.check({ planId: "plan-gate-2", userId: "owner", planDigest: digest, requiredScopes: ["task:deploy"] });
    expect(replay.approved).toBe(false);
  });

  it("rejects mismatched digests and revoked approvals", async () => {
    const gate = createGate();
    const digest = createHash("sha256").update("plan-gate-3-body").digest("hex");
    const otherDigest = createHash("sha256").update("other-body").digest("hex");
    await gate.approve({ planId: "plan-gate-3", userId: "owner", planDigest: digest, approvedScopes: ["task:deploy"] });
    const mismatch = await gate.check({ planId: "plan-gate-3", userId: "owner", planDigest: otherDigest, requiredScopes: ["task:deploy"] });
    expect(mismatch.approved).toBe(false);

    await gate.revoke("plan-gate-3", "owner", "changed my mind");
    const revoked = await gate.check({ planId: "plan-gate-3", userId: "owner", planDigest: digest, requiredScopes: ["task:deploy"] });
    expect(revoked.approved).toBe(false);
  });
});
