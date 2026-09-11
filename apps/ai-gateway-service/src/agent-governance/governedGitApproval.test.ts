// @test-isolation process
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  prepareGovernedApprovalParameters,
  verifyGovernedGitApprovalParameters,
} from "./governedGitApproval.ts";
import { createAgentApprovalStore } from "./agentApprovalStore.ts";
import { createGitCreatePRTool, createGitPushTool } from "../tools/gitRemoteTools.js";

function git(cwd: string, args: string[]) {
  return String(execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })).trim();
}

async function createRepository() {
  const root = await mkdtemp(join(tmpdir(), "governed-git-approval-"));
  git(root, ["init"]);
  git(root, ["config", "user.email", "approval-test@example.invalid"]);
  git(root, ["config", "user.name", "Approval Test"]);
  git(root, ["branch", "-M", "main"]);
  await writeFile(join(root, "README.md"), "first\n", "utf8");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-m", "first"]);
  git(root, ["remote", "add", "origin", "https://github.com/example/review-repo.git"]);
  return root;
}

function configureLocalGitHubRemote(root: string, branch: string) {
  const bare = join(root, ".test-pr-remote.git");
  const publicUrl = "https://github.com/example/review-repo.git";
  git(root, ["init", "--bare", bare]);
  git(root, ["push", bare, `${branch}:refs/heads/${branch}`]);

  const readRemoteHead = (ref: string) => {
    try {
      const commit = git(root, ["--git-dir", bare, "rev-parse", ref]);
      return `${commit}\t${ref}`;
    } catch {
      throw Object.assign(new Error("synthetic remote ref missing"), { status: 2 });
    }
  };
  const approvalGitRunner = (cwd: string, args: string[]) => {
    if (args[0] === "ls-remote" && args[3] === publicUrl) return readRemoteHead(args[4]);
    return git(cwd, args);
  };
  const toolGitRunner = (rawArgs: string[] | string, cwd: string) => {
    const args = Array.isArray(rawArgs) ? rawArgs : String(rawArgs).trim().split(/\s+/u).filter(Boolean);
    if (args[0] === "push" && args[1] === publicUrl) {
      return git(cwd, ["push", bare, args[2]]);
    }
    if (args[0] === "ls-remote" && args[3] === publicUrl) return readRemoteHead(args[4]);
    return git(cwd, args);
  };
  const governedTransportFactory = () => ({
    pushExact(target: string, commit: string, targetBranch: string) {
      return toolGitRunner(["push", target, `${commit}:refs/heads/${targetBranch}`], root);
    },
    readRemoteHead(target: string, targetBranch: string) {
      return toolGitRunner(["ls-remote", "--exit-code", "--heads", target, `refs/heads/${targetBranch}`], root)
        .trim().split(/\s+/u)[0]?.toLowerCase();
    },
    close() {},
  });
  return { bare, publicUrl, approvalGitRunner, toolGitRunner, governedTransportFactory };
}

describe("governed Git approval envelopes", () => {
  it("materializes a review-safe push target and invalidates it when HEAD or remote changes", async () => {
    const root = await createRepository();
    try {
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_push",
        params: {},
        workingDirectory: root,
      });
      expect(prepared.review).toMatchObject({
        reviewable: true,
        effectType: "git:push",
        remote: { name: "origin", target: "example/review-repo" },
        source: { branch: "main", commit: expect.stringMatching(/^[a-f0-9]{40,64}$/u) },
        destination: { branch: "main" },
        options: { setUpstream: false, forceMode: "none" },
      });
      expect(JSON.stringify(prepared.review)).not.toContain("secret-value");
      const approvalStore = createAgentApprovalStore({
        storePath: join(root, "approval-probe.json"),
        secret: "governed-git-review-store-secret-0123456789",
      });
      const stored = await approvalStore.create({
        agentId: "agt_git_review",
        tenantId: "tenant_a",
        toolName: "git_push",
        arguments: prepared.params,
        review: { ...prepared.review!, policyHash: `sha256:${"e".repeat(64)}` },
      });
      expect(stored.review).toMatchObject({ reviewable: true, effectType: "git:push" });
      expect(verifyGovernedGitApprovalParameters({
        toolName: "git_push",
        params: prepared.params,
        workingDirectory: root,
      })).toEqual({ ok: true });

      await writeFile(join(root, "README.md"), "second\n", "utf8");
      git(root, ["add", "README.md"]);
      git(root, ["commit", "-m", "second"]);
      expect(verifyGovernedGitApprovalParameters({
        toolName: "git_push",
        params: prepared.params,
        workingDirectory: root,
      })).toMatchObject({ ok: false, code: "GIT_APPROVAL_TARGET_STALE" });

      const refreshed = prepareGovernedApprovalParameters({
        toolName: "git_push",
        params: {},
        workingDirectory: root,
      });
      git(root, ["remote", "set-url", "--push", "origin", "https://github.com/example/other.git"]);
      expect(verifyGovernedGitApprovalParameters({
        toolName: "git_push",
        params: refreshed.params,
        workingDirectory: root,
      })).toMatchObject({ ok: false, code: "GIT_APPROVAL_TARGET_STALE" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects PR text that cannot be shown verbatim to the approver", async () => {
    const root = await createRepository();
    try {
      const remote = configureLocalGitHubRemote(root, "main");
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: {
          title: "Release token=should-not-leak",
          body: "Authorization: Bearer body-secret-value\nDetailed change notes",
          draft: true,
        },
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      });
      expect(prepared.review).toMatchObject({
        reviewable: false,
        effectType: "github:pull-request-create",
      });
      const publicReview = JSON.stringify(prepared.review);
      expect(publicReview).not.toContain("should-not-leak");
      expect(publicReview).not.toContain("body-secret-value");
      expect(verifyGovernedGitApprovalParameters({
        toolName: "git_create_pr",
        params: prepared.params,
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      })).toMatchObject({ ok: false, code: "GIT_APPROVAL_ENVELOPE_REQUIRED" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("shows and authenticates the complete bounded PR title and body", async () => {
    const root = await createRepository();
    try {
      const remote = configureLocalGitHubRemote(root, "main");
      const body = "Detailed change notes\n\n- Tests passed\n- Rollback documented";
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Reviewed release notes", body, draft: true },
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      });
      expect(prepared.review).toMatchObject({
        reviewable: true,
        effectType: "github:pull-request-create",
        remote: { target: "example/review-repo" },
        pullRequest: {
          repository: "example/review-repo",
          title: "Reviewed release notes",
          body,
          bodyHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
          bodyBytes: Buffer.byteLength(body, "utf8"),
        },
      });
      const approvalStore = createAgentApprovalStore({
        storePath: join(root, "pr-approval-probe.json"),
        secret: "governed-git-pr-review-store-secret-0123456789",
      });
      const stored = await approvalStore.create({
        agentId: "agt_pr_review",
        tenantId: "tenant_a",
        toolName: "git_create_pr",
        arguments: prepared.params,
        review: { ...prepared.review!, policyHash: `sha256:${"f".repeat(64)}` },
      });
      expect(stored.review.pullRequest).toMatchObject({ title: "Reviewed release notes", body });
      await expect(approvalStore.create({
        agentId: "agt_pr_review",
        tenantId: "tenant_a",
        toolName: "git_create_pr",
        arguments: { ...prepared.params, body: "different public body" },
        review: { ...prepared.review!, policyHash: `sha256:${"f".repeat(64)}` },
      })).rejects.toMatchObject({ name: "GovernanceApprovalStoreCorrupt" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps a PR unreviewable when fetch and push targets differ", async () => {
    const root = await createRepository();
    try {
      git(root, ["remote", "set-url", "--push", "origin", "https://github.com/example/other-repo.git"]);
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Target mismatch", body: "Safe visible body" },
        workingDirectory: root,
      });
      expect(prepared.review).toMatchObject({
        reviewable: false,
        effectType: "github:pull-request-create",
      });
      expect(verifyGovernedGitApprovalParameters({
        toolName: "git_create_pr",
        params: prepared.params,
        workingDirectory: root,
      })).toMatchObject({ ok: false, code: "GIT_APPROVAL_ENVELOPE_REQUIRED" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps governed Git effects unreviewable when local or global URL rewriting changes the target", async () => {
    const root = await createRepository();
    try {
      const bare = join(root, ".rewrite-target.git");
      const publicUrl = "https://github.com/example/review-repo.git";
      git(root, ["init", "--bare", bare]);
      git(root, ["config", `url.${pathToFileURL(bare).href}.insteadOf`, publicUrl]);
      expect(prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Unsafe rewritten target", body: "Visible body" },
        workingDirectory: root,
      }).review).toMatchObject({ reviewable: false });
      expect(prepareGovernedApprovalParameters({
        toolName: "git_push",
        params: {},
        workingDirectory: root,
      }).review).toMatchObject({ reviewable: false });

      git(root, ["config", "--unset-all", `url.${pathToFileURL(bare).href}.insteadOf`]);
      const globalConfig = join(root, "synthetic-global.gitconfig");
      git(root, ["config", "--file", globalConfig, `url.${pathToFileURL(bare).href}.pushInsteadOf`, publicUrl]);
      const globalRunner = (cwd: string, args: string[]) => String(execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: "1" },
      })).trim();
      expect(prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Unsafe global rewrite", body: "Visible body" },
        workingDirectory: root,
        gitRunner: globalRunner,
      }).review).toMatchObject({ reviewable: false });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects SSH and scp remotes before the governed transport or external-effect fence can run", async () => {
    const root = await createRepository();
    try {
      for (const remoteTarget of [
        "ssh://git@github.com/example/review-repo.git",
        "git@github.com:example/review-repo.git",
      ]) {
        git(root, ["remote", "set-url", "origin", remoteTarget]);
        const prepared = prepareGovernedApprovalParameters({
          toolName: "git_push",
          params: {},
          workingDirectory: root,
        });
        expect(prepared.review).toMatchObject({ reviewable: false, effectType: "git:push" });

        const governedTransportFactory = vi.fn();
        const commitExternalEffect = vi.fn();
        const tool = createGitPushTool(root, { governedTransportFactory }) as any;
        const result = await tool.execute(prepared.params, {
          agentGovernance: { agentId: "agt_ssh_rejected", tenantId: "tenant_a" },
          commitExternalEffect,
        });
        expect(result).toMatchObject({ success: false, code: "GIT_APPROVAL_ENVELOPE_REQUIRED" });
        expect(commitExternalEffect).not.toHaveBeenCalled();
        expect(governedTransportFactory).not.toHaveBeenCalled();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects publication credential families and only permits whole explicit fixture values", async () => {
    const root = await createRepository();
    try {
      const remote = configureLocalGitHubRemote(root, "main");
      const suspiciousBodies = [
        `Slack token xoxb-111111111111-${"S".repeat(24)}`,
        `Stripe token sk_live_${"T".repeat(24)}`,
        `npm token npm_${"N".repeat(36)}`,
        `GitHub token ghp_${"A".repeat(36)}`,
        `GitLab token glpat-${"B".repeat(24)}`,
        `AWS_ACCESS_KEY_ID=AKIA${"C".repeat(16)}`,
        `AWS_SECRET_ACCESS_KEY=${"D".repeat(40)}`,
        "-----BEGIN PRIVATE KEY-----\nsynthetic fixture\n-----END PRIVATE KEY-----",
        "https://operator:synthetic-password@example.invalid/path",
        `OpenAI key sk-livetest${"E".repeat(20)}`,
      ];
      for (const body of suspiciousBodies) {
        expect(prepareGovernedApprovalParameters({
          toolName: "git_create_pr",
          params: { title: "Credential detector probe", body },
          workingDirectory: root,
          gitRunner: remote.approvalGitRunner,
        }).review).toMatchObject({ reviewable: false });
      }
      expect(prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Explicit fixture", body: "API_KEY=YOUR_API_KEY_HERE" },
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      }).review).toMatchObject({ reviewable: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it("keeps force and upstream mutation unreviewable", async () => {
    const root = await createRepository();
    try {
      for (const params of [{ force: true }, { setUpstream: true }]) {
        expect(prepareGovernedApprovalParameters({
          toolName: "git_push",
          params,
          workingDirectory: root,
        }).review).toMatchObject({ reviewable: false, effectType: "git:push" });
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("executes git_create_pr from the sealed explicit repo/head/base envelope with a fake gh runner", async () => {
    const root = await createRepository();
    try {
      git(root, ["checkout", "-b", "feature/reviewed-pr"]);
      await writeFile(join(root, "feature.txt"), "feature\n", "utf8");
      git(root, ["add", "feature.txt"]);
      git(root, ["commit", "-m", "feature"]);
      const remote = configureLocalGitHubRemote(root, "feature/reviewed-pr");
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Reviewed PR", body: "Full approved body", base: "main", draft: true },
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      });
      expect(prepared.review).toMatchObject({ reviewable: true });
      const controlledHead = prepared.review?.pullRequest?.headBranch;
      expect(controlledHead).toMatch(/^agent-governance\/pr-[a-f0-9]{24}$/u);
      const order: string[] = [];
      const runGh = vi.fn((args: string[]) => {
        order.push("gh");
        expect(args).toEqual([
          "pr", "create",
          "--repo", "example/review-repo",
          "--head", controlledHead,
          "--title", "Reviewed PR",
          "--body", "Full approved body",
          "--base", "main",
          "--draft",
        ]);
        return "https://github.com/example/review-repo/pull/1\n";
      });
      const tool = createGitCreatePRTool(root, {
        checkGhAvailable: () => true,
        runGh,
        runGit: remote.toolGitRunner,
        approvalGitRunner: remote.approvalGitRunner,
        governedTransportFactory: remote.governedTransportFactory,
      }) as any;
      const commitExternalEffect = vi.fn(async () => { order.push("commit"); });
      const result = await tool.execute(prepared.params, {
        agentGovernance: { agentId: "agt_pr", tenantId: "tenant_a" },
        commitExternalEffect,
      });
      expect(result).toMatchObject({
        success: true,
        title: "Reviewed PR",
        base: "main",
        head: controlledHead,
        draft: true,
        url: "https://github.com/example/review-repo/pull/1",
      });
      expect(order).toEqual(["commit", "gh"]);
      expect(runGh).toHaveBeenCalledOnce();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("isolates PR publication from a URL rewrite installed after the external-effect fence", async () => {
    const root = await createRepository();
    try {
      git(root, ["checkout", "-b", "feature/rewrite-race"]);
      await writeFile(join(root, "rewrite.txt"), "feature\n", "utf8");
      git(root, ["add", "rewrite.txt"]);
      git(root, ["commit", "-m", "rewrite feature"]);
      const remote = configureLocalGitHubRemote(root, "feature/rewrite-race");
      const swapped = join(root, ".rewrite-swapped.git");
      git(root, ["init", "--bare", swapped]);
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Rewrite race", body: "Visible body", base: "main" },
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      });
      expect(prepared.review).toMatchObject({ reviewable: true });
      const runGh = vi.fn(() => "https://github.com/example/review-repo/pull/3\n");
      const tool = createGitCreatePRTool(root, {
        checkGhAvailable: () => true,
        runGh,
        runGit: remote.toolGitRunner,
        approvalGitRunner: remote.approvalGitRunner,
        governedTransportFactory: remote.governedTransportFactory,
      }) as any;
      const result = await tool.execute(prepared.params, {
        agentGovernance: { agentId: "agt_pr", tenantId: "tenant_a" },
        commitExternalEffect: async () => {
          git(root, ["config", `url.${pathToFileURL(swapped).href}.insteadOf`, remote.publicUrl]);
        },
      });
      expect(result).toMatchObject({
        success: true,
        url: "https://github.com/example/review-repo/pull/3",
      });
      expect(runGh).toHaveBeenCalledOnce();
      const controlledHead = prepared.review?.pullRequest?.headBranch;
      expect(git(root, ["--git-dir", remote.bare, "rev-parse", `refs/heads/${controlledHead}`]))
        .toBe(git(root, ["rev-parse", "HEAD"]));
      expect(() => git(root, ["--git-dir", swapped, "rev-parse", `refs/heads/${controlledHead}`])).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("pushes to the sealed canonical target even if the remote alias changes after the fence commit", async () => {
    const root = await createRepository();
    try {
      const approvedRemote = join(root, ".approved-remote.git");
      const swappedRemote = join(root, ".swapped-remote.git");
      git(root, ["init", "--bare", approvedRemote]);
      git(root, ["init", "--bare", swappedRemote]);
      git(root, ["remote", "set-url", "origin", approvedRemote]);
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_push",
        params: {},
        workingDirectory: root,
      });
      expect(prepared.review).toMatchObject({ reviewable: true });
      const tool = createGitPushTool(root) as any;
      const result = await tool.execute(prepared.params, {
        agentGovernance: { agentId: "agt_push", tenantId: "tenant_a" },
        async commitExternalEffect() {
          git(root, ["remote", "set-url", "origin", swappedRemote]);
        },
      });
      expect(result).toMatchObject({ success: true, branch: "main" });
      const commit = git(root, ["rev-parse", "HEAD"]);
      expect(git(root, ["--git-dir", approvedRemote, "rev-parse", "refs/heads/main"])).toBe(commit);
      expect(() => git(root, ["--git-dir", swappedRemote, "rev-parse", "refs/heads/main"])).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("isolates git_push from a URL rewrite installed after the external-effect fence", async () => {
    const root = await createRepository();
    try {
      const approvedRemote = join(root, ".approved-rewrite-remote.git");
      const swappedRemote = join(root, ".swapped-rewrite-remote.git");
      git(root, ["init", "--bare", approvedRemote]);
      git(root, ["init", "--bare", swappedRemote]);
      git(root, ["remote", "set-url", "origin", approvedRemote]);
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_push",
        params: {},
        workingDirectory: root,
      });
      expect(prepared.review).toMatchObject({ reviewable: true });
      const tool = createGitPushTool(root) as any;
      const result = await tool.execute(prepared.params, {
        agentGovernance: { agentId: "agt_push", tenantId: "tenant_a" },
        async commitExternalEffect() {
          git(root, [
            "config",
            `url.${pathToFileURL(swappedRemote).href}.insteadOf`,
            pathToFileURL(approvedRemote).href,
          ]);
        },
      });
      expect(result).toMatchObject({ success: true, branch: "main" });
      const commit = git(root, ["rev-parse", "HEAD"]);
      expect(git(root, ["--git-dir", approvedRemote, "rev-parse", "refs/heads/main"])).toBe(commit);
      expect(() => git(root, ["--git-dir", swappedRemote, "rev-parse", "refs/heads/main"])).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports an uncertain PR outcome when the controlled remote head changes during creation", async () => {
    const root = await createRepository();
    try {
      git(root, ["checkout", "-b", "feature/uncertain-pr"]);
      await writeFile(join(root, "uncertain.txt"), "feature\n", "utf8");
      git(root, ["add", "uncertain.txt"]);
      git(root, ["commit", "-m", "uncertain feature"]);
      const remote = configureLocalGitHubRemote(root, "feature/uncertain-pr");
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Uncertain PR", base: "main" },
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      });
      const controlledHead = prepared.review?.pullRequest?.headBranch;
      const baseCommit = git(root, ["rev-parse", "main"]);
      const tool = createGitCreatePRTool(root, {
        checkGhAvailable: () => true,
        runGh: () => {
          git(root, ["--git-dir", remote.bare, "update-ref", `refs/heads/${controlledHead}`, baseCommit]);
          return "https://github.com/example/review-repo/pull/2\n";
        },
        runGit: remote.toolGitRunner,
        approvalGitRunner: remote.approvalGitRunner,
        governedTransportFactory: remote.governedTransportFactory,
      }) as any;
      const result = await tool.execute(prepared.params, {
        agentGovernance: { agentId: "agt_pr", tenantId: "tenant_a" },
        commitExternalEffect: async () => {},
      });
      expect(result).toMatchObject({
        success: false,
        status: "unknown",
        code: "GIT_PR_HEAD_OUTCOME_UNCERTAIN",
        outcomeUnknown: true,
        url: "https://github.com/example/review-repo/pull/2",
        reconciliation: {
          required: true,
          retrySafe: false,
          phase: "post-create-reconciliation",
          repository: "example/review-repo",
          headBranch: controlledHead,
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks a dispatched gh failure as outcome-unknown and forbids blind retry", async () => {
    const root = await createRepository();
    try {
      git(root, ["checkout", "-b", "feature/gh-timeout"]);
      await writeFile(join(root, "timeout.txt"), "feature\n", "utf8");
      git(root, ["add", "timeout.txt"]);
      git(root, ["commit", "-m", "timeout feature"]);
      const remote = configureLocalGitHubRemote(root, "feature/gh-timeout");
      const prepared = prepareGovernedApprovalParameters({
        toolName: "git_create_pr",
        params: { title: "Timeout PR", body: "Fully reviewed body", base: "main" },
        workingDirectory: root,
        gitRunner: remote.approvalGitRunner,
      });
      const tool = createGitCreatePRTool(root, {
        checkGhAvailable: () => true,
        runGh: () => { throw new Error("synthetic transport timeout"); },
        runGit: remote.toolGitRunner,
        approvalGitRunner: remote.approvalGitRunner,
        governedTransportFactory: remote.governedTransportFactory,
      }) as any;
      const result = await tool.execute(prepared.params, {
        agentGovernance: { agentId: "agt_pr", tenantId: "tenant_a" },
        commitExternalEffect: async () => {},
      });
      expect(result).toMatchObject({
        success: false,
        status: "unknown",
        code: "GIT_PR_CREATE_OUTCOME_UNCERTAIN",
        outcomeUnknown: true,
        reconciliation: {
          required: true,
          retrySafe: false,
          phase: "pr-create",
          repository: "example/review-repo",
          expectedCommit: prepared.review?.source?.commit,
        },
      });
      expect(JSON.stringify(result)).not.toContain("synthetic transport timeout");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
