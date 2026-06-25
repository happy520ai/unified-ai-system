/**
 * Git Remote Tools & Utilities — shared helpers for gitTools.js
 *
 * Contains:
 * - createGitPushTool: push commits to remote (requires approval)
 * - createGitCreatePRTool: create a Pull Request via GitHub CLI
 * - Shared utility functions: runGit, runGh, parseCliArgs, etc.
 *
 * @module gitRemoteTools
 */

import { execFileSync } from "node:child_process";
import { resolve, normalize } from "node:path";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";

const DEFAULT_GIT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 50_000;

// ============================================================
// git_push
// ============================================================

export function createGitPushTool(defaultCwd) {
  return buildTool({
    name: "git_push",
    description: "Push commits to a remote repository. This is a dangerous operation that requires explicit approval. Always verify with git_status and git_log before pushing.",
    inputSchema: createInputSchema({
      remote: { type: "string", description: "Remote name (default 'origin')." },
      branch: { type: "string", description: "Branch to push (default: current branch)." },
      setUpstream: { type: "boolean", description: "Set upstream tracking (-u flag, default false)." },
      force: { type: "boolean", description: "Force push (default false, DANGEROUS)." },
    }),
    requiredPermissions: ["git:remote"],
    isReadOnly: false,

    async execute(params) {
      const cwd = resolveSafeCwd(defaultCwd);

      if (params.remote) {
        const check = validateGitRef(params.remote, "remote");
        if (!check.valid) return { success: false, error: check.error };
      }
      if (params.branch) {
        const check = validateGitRef(params.branch, "branch");
        if (!check.valid) return { success: false, error: check.error };
      }

      const remote = params.remote || "origin";
      const branch = params.branch || runGit("rev-parse --abbrev-ref HEAD", cwd).trim();

      // Safety: block force push to main/master by default
      if (params.force && (branch === "main" || branch === "master")) {
        return {
          success: false,
          error: `Force push to ${branch} is blocked for safety. Use a feature branch instead.`,
        };
      }

      const args = ["push"];
      if (params.setUpstream) args.push("-u");
      if (params.force) args.push("--force");
      args.push(remote, branch);

      try {
        const output = runGit(args.join(" "), cwd);
        return {
          success: true,
          remote,
          branch,
          force: params.force || false,
          output: output.trim(),
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          remote,
          branch,
        };
      }
    },
  });
}

// ============================================================
// git_create_pr
// ============================================================

export function createGitCreatePRTool(defaultCwd) {
  return buildTool({
    name: "git_create_pr",
    description: "Create a Pull Request using the GitHub CLI (gh). Requires gh to be installed and authenticated. The current branch will be used as the head branch.",
    inputSchema: createInputSchema({
      title: { type: "string", description: "PR title (keep under 70 chars)" },
      body: { type: "string", description: "PR body/description (markdown supported)" },
      base: { type: "string", description: "Base branch to merge into (default: main or master)" },
      draft: { type: "boolean", description: "Create as draft PR (default: false)" },
      directory: { type: "string", description: "Working directory" },
    }, ["title"]),
    requiredPermissions: ["git:remote"],
    isReadOnly: false,

    async execute(params) {
      const cwd = resolveSafeCwd(params.directory || defaultCwd);

      // Detect base branch
      let base = params.base;
      if (!base) {
        try {
          base = runGit("symbolic-ref refs/remotes/origin/HEAD", cwd).replace("refs/remotes/origin/", "").trim();
        } catch {
          // fallback: try main, then master
          try { runGit("rev-parse --verify main", cwd); base = "main"; } catch {
            try { runGit("rev-parse --verify master", cwd); base = "master"; } catch {
              base = "main";
            }
          }
        }
      }

      const currentBranch = runGit("rev-parse --abbrev-ref HEAD", cwd).trim();
      if (currentBranch === base) {
        return { success: false, error: `Cannot create PR: current branch '${currentBranch}' is the same as base '${base}'.` };
      }

      // Check if gh is available
      try {
        runGit("--version", cwd); // sanity check
        execFileSync("gh", ["--version"], { encoding: "utf-8", timeout: 5000 });
      } catch {
        return { success: false, error: "GitHub CLI (gh) is not installed or not in PATH. Install it with: brew install gh / winget install GitHub.cli" };
      }

      // Build gh pr create arguments (no shell quoting needed — execFileSync handles it)
      const ghArgs = ["pr", "create"];
      ghArgs.push("--title", params.title.slice(0, 200));
      if (params.body) {
        ghArgs.push("--body", params.body.slice(0, 5000));
      }
      ghArgs.push("--base", base);
      if (params.draft) ghArgs.push("--draft");

      try {
        const output = runGh(ghArgs, cwd);

        const prUrl = (output || "").trim();
        return {
          success: true,
          title: params.title,
          base,
          head: currentBranch,
          draft: params.draft || false,
          url: prUrl || null,
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          title: params.title,
          base,
          head: currentBranch,
        };
      }
    },
  });
}

// ============================================================
// Utilities
// ============================================================

let gitAvailable = null;

export function checkGitAvailable() {
  if (gitAvailable !== null) return gitAvailable;
  try {
    execFileSync("git", ["--version"], { encoding: "utf8", timeout: 5000, stdio: "pipe" });
    gitAvailable = true;
  } catch {
    gitAvailable = false;
  }
  return gitAvailable;
}

export function isGitRepo(cwd) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd, encoding: "utf8", timeout: 5000, stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tokenise a git/gh argument string into an array, respecting
 * double-quoted and single-quoted segments.
 *
 * Example:
 *   parseCliArgs('commit -m "fix the bug" --author="Alice"')
 *   → ["commit", "-m", "fix the bug", "--author=Alice"]
 */
export function parseCliArgs(input) {
  if (Array.isArray(input)) return input;
  const str = String(input).trim();
  if (!str) return [];

  const tokens = [];
  let current = "";
  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === " " && !inDouble && !inSingle) {
      if (current.length > 0) { tokens.push(current); current = ""; }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

export function runGit(args, cwd) {
  if (!checkGitAvailable()) {
    throw new Error("Git is not installed or not in PATH. Install git first.");
  }
  // args must be an array of individual arguments — never a shell string
  const argList = Array.isArray(args) ? args : parseCliArgs(args);
  try {
    const result = execFileSync("git", argList, {
      cwd,
      encoding: "utf8",
      timeout: DEFAULT_GIT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return result || "";
  } catch (error) {
    const stderr = error.stderr?.toString() || error.message;
    throw new Error(`git ${argList[0] || "?"} failed: ${stderr.trim()}`);
  }
}

/**
 * Run a GitHub CLI (gh) command safely using execFileSync.
 * args must be an array — never a shell-interpolated string.
 */
export function runGh(args, cwd) {
  const argList = Array.isArray(args) ? args : parseCliArgs(args);
  try {
    const result = execFileSync("gh", argList, {
      cwd,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return result || "";
  } catch (error) {
    const stderr = error.stderr?.toString() || error.message;
    throw new Error(`gh ${argList[0] || "?"} failed: ${stderr.trim()}`);
  }
}

export function resolveSafeCwd(dir) {
  const resolved = resolve(dir);
  const normalized = normalize(resolved);
  return normalized;
}

/**
 * Validate a git ref / parameter value to prevent argument injection.
 * Rejects values starting with '-' (flag injection) or containing shell
 * metacharacters that could be abused for command injection.
 *
 * @param {*} value - The value to validate
 * @param {string} paramName - Name used in error messages
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateGitRef(value, paramName) {
  if (typeof value !== "string" || value.length === 0) {
    return { valid: true };
  }
  if (value.startsWith("-")) {
    return { valid: false, error: `Invalid git parameter: ${paramName} must not start with '-'` };
  }
  if (/[\x00;|&$`<>(){}!#\\"'\n\r]/.test(value)) {
    return { valid: false, error: `Invalid git parameter: ${paramName} contains disallowed characters` };
  }
  return { valid: true };
}

/**
 * Coerce a context-lines value to a safe integer clamped to [0, 999].
 *
 * @param {*} value - The raw value from params.contextLines
 * @returns {{ valid: true, value: number } | { valid: false, error: string }}
 */
export function sanitizeContextLines(value) {
  if (value == null) return { valid: true, value: null };
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) {
    return { valid: false, error: "Invalid git parameter: contextLines must be an integer" };
  }
  return { valid: true, value: Math.max(0, Math.min(num, 999)) };
}

export function validateBranchName(name) {
  // Git branch name rules (simplified)
  if (!name || /[\s~^:?*\[\\]/.test(name) || name.startsWith("-") || name.includes("..") || name.endsWith(".lock")) {
    throw new Error(`Invalid branch name: ${name}`);
  }
}

export { DEFAULT_GIT_TIMEOUT_MS, MAX_OUTPUT_CHARS };
