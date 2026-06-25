/**
 * Git Tools — Git 操作工具集
 *
 * 提供 7 个Git 操作工具,注册到 agentToolRegistry:
 * - git_status: 查看工作区状态
 * - git_diff: 查看文件差异
 * - git_log: 查看提交历史
 * - git_branch: 创建/切换/列出分支
 * - git_commit: 提交更改
 * - git_push: 推送到远程 (需审批)         → gitRemoteTools.js
 * - git_create_pr: 创建 Pull Request       → gitRemoteTools.js
 *
 * @module gitTools
 */

import { resolve } from "node:path";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";
import {
  createGitPushTool,
  createGitCreatePRTool,
  isGitRepo,
  checkGitAvailable,
  parseCliArgs,
  runGit,
  runGh,
  resolveSafeCwd,
  validateGitRef,
  sanitizeContextLines,
  validateBranchName,
  MAX_OUTPUT_CHARS,
} from "./gitRemoteTools.js";

/**
 * 创建所有 Git 工具。
 *
 * @param {Object} [options]
 * @param {string} [options.workingDirectory] - Git 仓库根目录
 * @returns {Object[]} buildTool 格式的工具定义数组
 */
export function createGitTools(options = {}) {
  const defaultCwd = options.workingDirectory || process.cwd();

  return [
    createGitStatusTool(defaultCwd),
    createGitDiffTool(defaultCwd),
    createGitLogTool(defaultCwd),
    createGitBranchTool(defaultCwd),
    createGitCommitTool(defaultCwd),
    createGitPushTool(defaultCwd),
    createGitCreatePRTool(defaultCwd),
  ];
}

// ============================================================
// git_status
// ============================================================

function createGitStatusTool(defaultCwd) {
  return buildTool({
    name: "git_status",
    description: "Show the working tree status. Returns modified, staged, untracked, and branch information.",
    inputSchema: createInputSchema({
      directory: { type: "string", description: "Working directory (defaults to repo root)." },
    }),
    requiredPermissions: ["git:read"],
    isReadOnly: true,

    async execute(params) {
      const cwd = resolveSafeCwd(params.directory || defaultCwd);
      if (!isGitRepo(cwd)) {
        return { success: false, error: `Not a git repository: ${cwd}`, code: "NOT_A_GIT_REPO" };
      }
      const porcelain = runGit("status --porcelain -b", cwd);
      const branch = runGit("rev-parse --abbrev-ref HEAD", cwd);

      // Parse porcelain output
      const modified = [];
      const staged = [];
      const untracked = [];
      let currentBranch = branch.trim();

      for (const line of porcelain.split("\n")) {
        if (!line.trim()) continue;
        const indexStatus = line[0];
        const workStatus = line[1];
        const filePath = line.slice(3);

        if (indexStatus === "?" && workStatus === "?") {
          untracked.push(filePath);
        } else {
          if (indexStatus !== " " && indexStatus !== "?") staged.push(filePath);
          if (workStatus !== " " && workStatus !== "?") modified.push(filePath);
        }
      }

      return {
        success: true,
        branch: currentBranch,
        modified,
        staged,
        untracked,
        isClean: modified.length === 0 && staged.length === 0 && untracked.length === 0,
        porcelain: porcelain.trim(),
      };
    },
  });
}

// ============================================================
// git_diff
// ============================================================

function createGitDiffTool(defaultCwd) {
  return buildTool({
    name: "git_diff",
    description: "Show differences between working tree and index, between commits, or between branches. Use this to review changes before committing.",
    inputSchema: createInputSchema({
      path: { type: "string", description: "Specific file or directory to diff (optional, defaults to all changes)." },
      staged: { type: "boolean", description: "Show staged changes (--cached) instead of unstaged." },
      base: { type: "string", description: "Base ref for comparison (branch, commit, tag). E.g., 'main', 'HEAD~1'." },
      contextLines: { type: "number", description: "Number of context lines (default 3)." },
    }),
    requiredPermissions: ["git:read"],
    isReadOnly: true,

    async execute(params) {
      const cwd = resolveSafeCwd(defaultCwd);
      if (!isGitRepo(cwd)) {
        return { success: false, error: `Not a git repository: ${cwd}`, code: "NOT_A_GIT_REPO" };
      }

      if (params.base) {
        const check = validateGitRef(params.base, "base");
        if (!check.valid) return { success: false, error: check.error };
      }
      if (params.contextLines != null) {
        const check = sanitizeContextLines(params.contextLines);
        if (!check.valid) return { success: false, error: check.error };
        params.contextLines = check.value;
      }

      const args = ["diff"];

      if (params.staged) args.push("--cached");
      if (params.base) args.push(params.base);
      if (params.contextLines != null) args.push(`-U${params.contextLines}`);

      // Stat summary first
      const statArgs = [...args, "--stat"];
      const stat = runGit(statArgs.join(" "), cwd);

      // Full diff (truncated if too long)
      if (params.path) args.push("--", params.path);
      let diff = runGit(args.join(" "), cwd);
      if (diff.length > MAX_OUTPUT_CHARS) {
        diff = diff.slice(0, MAX_OUTPUT_CHARS) + "\n... [diff truncated]";
      }

      return {
        success: true,
        stat: stat.trim(),
        diff: diff.trim(),
        staged: params.staged || false,
      };
    },
  });
}

// ============================================================
// git_log
// ============================================================

function createGitLogTool(defaultCwd) {
  return buildTool({
    name: "git_log",
    description: "Show commit history. Returns structured commit information including hash, author, date, and message.",
    inputSchema: createInputSchema({
      count: { type: "number", description: "Number of commits to show (default 10, max 50)." },
      branch: { type: "string", description: "Branch or ref to log (default HEAD)." },
      author: { type: "string", description: "Filter by author name or email." },
      since: { type: "string", description: "Show commits since date (e.g., '2024-01-01', '1 week ago')." },
      path: { type: "string", description: "Show commits affecting this path." },
    }),
    requiredPermissions: ["git:read"],
    isReadOnly: true,

    async execute(params) {
      const cwd = resolveSafeCwd(defaultCwd);
      if (!isGitRepo(cwd)) {
        return { success: false, error: `Not a git repository: ${cwd}`, code: "NOT_A_GIT_REPO" };
      }

      if (params.branch) {
        const check = validateGitRef(params.branch, "branch");
        if (!check.valid) return { success: false, error: check.error };
      }
      if (params.author) {
        const check = validateGitRef(params.author, "author");
        if (!check.valid) return { success: false, error: check.error };
      }
      if (params.since) {
        const check = validateGitRef(params.since, "since");
        if (!check.valid) return { success: false, error: check.error };
      }

      const count = Math.min(params.count || 10, 50);
      const format = "--pretty=format:%H|%an|%ae|%ai|%s";

      const args = ["log", format, "-n", String(count)];
      if (params.branch) args.push(params.branch);
      if (params.author) args.push(`--author=${params.author}`);
      if (params.since) args.push(`--since=${params.since}`);
      if (params.path) { args.push("--"); args.push(params.path); }

      const output = runGit(args, cwd);

      const commits = output.split("\n")
        .filter((line) => line.includes("|"))
        .map((line) => {
          const [hash, author, email, date, ...messageParts] = line.split("|");
          return {
            hash: hash?.trim() || "",
            author: author?.trim() || "",
            email: email?.trim() || "",
            date: date?.trim() || "",
            message: messageParts.join("|").trim(),
          };
        });

      return { success: true, count: commits.length, commits };
    },
  });
}

// ============================================================
// git_branch
// ============================================================

function createGitBranchTool(defaultCwd) {
  return buildTool({
    name: "git_branch",
    description: "List, create, or switch branches. Use for branch management operations.",
    inputSchema: createInputSchema({
      action: {
        type: "string",
        description: "Action to perform.",
        enum: ["list", "create", "switch", "delete"],
      },
      name: { type: "string", description: "Branch name (required for create/switch/delete)." },
      baseBranch: { type: "string", description: "Base branch for new branch creation (default: current HEAD)." },
    }, ["action"]),
    requiredPermissions: ["git:write"],
    isReadOnly: false,

    async execute(params) {
      const cwd = resolveSafeCwd(defaultCwd);

      switch (params.action) {
        case "list": {
          const local = runGit("branch --format=%(refname:short)", cwd);
          const current = runGit("rev-parse --abbrev-ref HEAD", cwd).trim();
          return {
            success: true,
            action: "list",
            current,
            branches: local.split("\n").filter(Boolean),
          };
        }

        case "create": {
          if (!params.name) return { success: false, error: "Branch name is required." };
          validateBranchName(params.name);
          const base = params.baseBranch || "HEAD";
          runGit(`branch ${params.name} ${base}`, cwd);
          return { success: true, action: "create", branch: params.name, base };
        }

        case "switch": {
          if (!params.name) return { success: false, error: "Branch name is required." };
          runGit(`checkout ${params.name}`, cwd);
          return { success: true, action: "switch", branch: params.name };
        }

        case "delete": {
          if (!params.name) return { success: false, error: "Branch name is required." };
          const current = runGit("rev-parse --abbrev-ref HEAD", cwd).trim();
          if (current === params.name) {
            return { success: false, error: "Cannot delete the currently checked out branch." };
          }
          runGit(`branch -d ${params.name}`, cwd);
          return { success: true, action: "delete", branch: params.name };
        }

        default:
          return { success: false, error: `Unknown action: ${params.action}` };
      }
    },
  });
}

// ============================================================
// git_commit
// ============================================================

function createGitCommitTool(defaultCwd) {
  return buildTool({
    name: "git_commit",
    description: "Stage files and create a commit. Always review changes with git_diff before committing.",
    inputSchema: createInputSchema({
      message: { type: "string", description: "Commit message. Should be descriptive and follow conventional commits format." },
      files: {
        type: "array",
        description: "Specific files to stage. If omitted, stages all modified files (git add -A).",
        items: { type: "string" },
      },
      allowEmpty: { type: "boolean", description: "Allow creating an empty commit (default false)." },
    }, ["message"]),
    requiredPermissions: ["git:write"],
    isReadOnly: false,

    async execute(params) {
      const cwd = resolveSafeCwd(defaultCwd);

      if (!params.message?.trim()) {
        return { success: false, error: "Commit message is required." };
      }

      // Stage files
      if (Array.isArray(params.files) && params.files.length > 0) {
        for (const file of params.files) {
          // Validate file path is within working directory
          const resolved = resolve(cwd, file);
          if (!resolved.startsWith(cwd)) {
            return { success: false, error: `File path escapes working directory: ${file}` };
          }
          runGit(`add -- ${file}`, cwd);
        }
      } else {
        runGit("add -A", cwd);
      }

      // Check if there's anything to commit
      const status = runGit("status --porcelain", cwd);
      if (!status.trim() && !params.allowEmpty) {
        return { success: false, error: "No changes to commit. Use allowEmpty=true for empty commits." };
      }

      // Create commit — pass message as array arg to avoid parseCliArgs injection
      const commitArgs = ["commit", "-m", params.message];
      if (params.allowEmpty) commitArgs.push("--allow-empty");
      runGit(commitArgs, cwd);

      // Get the new commit hash
      const hash = runGit("rev-parse HEAD", cwd).trim();

      return {
        success: true,
        hash,
        message: params.message,
        filesStaged: Array.isArray(params.files) ? params.files : ["all"],
      };
    },
  });
}

// Re-export utilities for backward compatibility
export { isGitRepo, checkGitAvailable, parseCliArgs, runGh };
