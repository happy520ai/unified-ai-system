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
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, normalize, sep } from "node:path";
import { buildTool, createInputSchema } from "../claude-code-patterns/toolCore.js";
import {
  readGovernedGitEnvelope,
  verifyGovernedGitApprovalParameters,
} from "../agent-governance/governedGitApproval.ts";

const DEFAULT_GIT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 50_000;
const ISOLATED_CREDENTIAL_HELPERS = new Set([
  "manager", "manager-core", "wincred", "osxkeychain", "libsecret",
  "cache", "store", "netrc", "oauth",
]);

/**
 * Build a short-lived bare repository whose only local configuration is an
 * allowlisted credential-helper policy. System/global config and every
 * inherited GIT_* override are removed. Git URL rewrite rules in the governed
 * workspace therefore cannot affect the actual push or reconciliation call.
 */
export function createIsolatedGovernedGitTransport({
  sourceRepository,
  commit,
  credentialHelpers = [],
  credentialUseHttpPath = false,
}) {
  const transportRoot = mkdtempSync(join(tmpdir(), "governed-git-transport-"));
  const bareRepository = join(transportRoot, "objects.git");
  const emptyGlobalConfig = join(transportRoot, "global.gitconfig");
  writeFileSync(emptyGlobalConfig, "", { encoding: "utf8", flag: "wx", mode: 0o600 });
  const env = createIsolatedGitEnvironment(emptyGlobalConfig);
  let closed = false;

  const run = (args) => {
    if (closed) throw new Error("The isolated governed Git transport is closed.");
    return String(execFileSync("git", args, {
      cwd: transportRoot,
      encoding: "utf8",
      timeout: DEFAULT_GIT_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }) || "").trim();
  };

  try {
    run(["init", "--bare", "--quiet", bareRepository]);
    for (const helper of credentialHelpers) {
      if (!isAllowlistedIsolatedCredentialHelper(helper)) {
        throw new Error("The sealed Git credential helper is not allowlisted for isolated transport.");
      }
      run(["--git-dir", bareRepository, "config", "--add", "credential.helper", helper]);
    }
    if (credentialUseHttpPath === true) {
      run(["--git-dir", bareRepository, "config", "credential.useHttpPath", "true"]);
    }
    run([
      "--git-dir", bareRepository,
      "fetch", "--quiet", "--no-tags", "--no-write-fetch-head", "--no-recurse-submodules",
      "--", resolve(sourceRepository), commit,
    ]);
    run(["--git-dir", bareRepository, "cat-file", "-e", `${commit}^{commit}`]);
  } catch (error) {
    closed = true;
    safeRemoveIsolatedTransport(transportRoot);
    throw error;
  }

  return {
    pushExact(remoteTarget, exactCommit, branch) {
      return run([
        "--git-dir", bareRepository,
        "push", "--porcelain", "--", remoteTarget, `${exactCommit}:refs/heads/${branch}`,
      ]);
    },
    readRemoteHead(remoteTarget, branch) {
      const output = run([
        "--git-dir", bareRepository,
        "ls-remote", "--exit-code", "--heads", "--", remoteTarget, `refs/heads/${branch}`,
      ]);
      const rows = output.split(/\r?\n/u).filter(Boolean);
      if (rows.length !== 1) throw new Error("The governed remote head is missing or ambiguous.");
      const [remoteCommit, ref, ...extra] = rows[0].trim().split(/\s+/u);
      if (extra.length > 0 || ref !== `refs/heads/${branch}` || !/^[a-f0-9]{40,64}$/iu.test(remoteCommit)) {
        throw new Error("The governed remote head response is malformed.");
      }
      return remoteCommit.toLowerCase();
    },
    close() {
      if (closed) return;
      closed = true;
      safeRemoveIsolatedTransport(transportRoot);
    },
  };
}

function createIsolatedGitEnvironment(emptyGlobalConfig) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^GIT_/iu.test(key) || key === "SSH_ASKPASS" || key === "SSH_ASKPASS_REQUIRE") delete env[key];
  }
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_SYSTEM = emptyGlobalConfig;
  env.GIT_CONFIG_GLOBAL = emptyGlobalConfig;
  env.GIT_TERMINAL_PROMPT = "0";
  env.GCM_INTERACTIVE = "Never";
  return env;
}

function isAllowlistedIsolatedCredentialHelper(value) {
  if (typeof value !== "string") return false;
  const tokens = value.trim().split(/\s+/u);
  if (!ISOLATED_CREDENTIAL_HELPERS.has(tokens[0]?.toLowerCase())) return false;
  return tokens.slice(1).every((token) => /^--?[A-Za-z0-9][A-Za-z0-9._=-]{0,127}$/u.test(token));
}

function safeRemoveIsolatedTransport(transportRoot) {
  const resolvedRoot = resolve(transportRoot);
  const resolvedTemp = resolve(tmpdir());
  if (resolvedRoot === resolvedTemp || !resolvedRoot.startsWith(`${resolvedTemp}${sep}`)
    || !resolve(resolvedRoot).includes("governed-git-transport-")) return;
  try { rmSync(resolvedRoot, { recursive: true, force: true }); } catch { /* best-effort private temp cleanup */ }
}

// ============================================================
// git_push
// ============================================================

export function createGitPushTool(defaultCwd, dependencies = {}) {
  const governedTransportFactory = dependencies.governedTransportFactory ?? createIsolatedGovernedGitTransport;
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
    externalEffectType: "git:push",
    externalEffectRequiresFence: true,

    async execute(params, context) {
      const cwd = resolveSafeCwd(defaultCwd);

      let governedEnvelope = null;
      if (context?.agentGovernance) {
        const verified = verifyGovernedGitApprovalParameters({
          toolName: "git_push",
          params,
          workingDirectory: defaultCwd,
        });
        if (!verified.ok) return { success: false, code: verified.code, error: verified.message };
        governedEnvelope = readGovernedGitEnvelope(params);
      }

      if (params.remote) {
        const check = validateGitRef(params.remote, "remote");
        if (!check.valid) return { success: false, error: check.error };
      }
      if (params.branch) {
        const check = validateGitRef(params.branch, "branch");
        if (!check.valid) return { success: false, error: check.error };
      }

      const remote = governedEnvelope?.privateExecution?.remoteTarget
        ?? governedEnvelope?.review.remote?.name
        ?? params.remote
        ?? "origin";
      const branch = governedEnvelope?.review.destination?.branch
        ?? params.branch
        ?? runGit("rev-parse --abbrev-ref HEAD", cwd).trim();

      // Safety: block force push to main/master by default
      if (params.force && (branch === "main" || branch === "master")) {
        return {
          success: false,
          error: `Force push to ${branch} is blocked for safety. Use a feature branch instead.`,
        };
      }

      const args = ["push"];
      if (governedEnvelope) {
        const commit = governedEnvelope.review.source?.commit;
        if (!commit) return { success: false, code: "GIT_APPROVAL_ENVELOPE_REQUIRED", error: "Approved commit is missing." };
        args.push(remote, `${commit}:refs/heads/${branch}`);
      } else {
        if (params.setUpstream) args.push("-u");
        if (params.force) args.push("--force");
        args.push(remote, branch);
      }

      try {
        await context.commitExternalEffect();
        if (governedEnvelope) {
          const commit = governedEnvelope.review.source?.commit;
          const transport = governedTransportFactory({
            sourceRepository: cwd,
            commit,
            credentialHelpers: governedEnvelope.privateExecution?.credentialHelpers ?? [],
            credentialUseHttpPath: governedEnvelope.privateExecution?.credentialUseHttpPath === true,
          });
          let pushStarted = false;
          try {
            pushStarted = true;
            const output = transport.pushExact(remote, commit, branch);
            const published = transport.readRemoteHead(remote, branch);
            if (published !== commit.toLowerCase()) throw new Error("published head mismatch");
            return {
              success: true,
              remote,
              branch,
              force: false,
              output: output.trim(),
            };
          } catch {
            if (pushStarted) {
              try {
                if (transport.readRemoteHead(remote, branch) === commit.toLowerCase()) {
                  return { success: true, remote, branch, force: false, output: "reconciled exact approved push" };
                }
              } catch { /* outcome remains uncertain */ }
              return {
                success: false,
                status: "unknown",
                code: "GIT_APPROVED_PUSH_OUTCOME_UNCERTAIN",
                error: "The exact approved Git push could not be reconciled after dispatch.",
                outcomeUnknown: true,
                branch,
              };
            }
            throw new Error("The isolated governed Git transport could not be prepared.");
          } finally {
            transport.close();
          }
        }
        const output = runGit(args.join(" "), cwd);
        return {
          success: true,
          remote,
          branch,
          force: params.force || false,
          output: output.trim(),
        };
      } catch (error) {
        if (governedEnvelope) {
          return {
            success: false,
            code: "GIT_APPROVED_PUSH_FAILED",
            error: "The exact approved Git push did not complete successfully.",
            branch,
          };
        }
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

export function createGitCreatePRTool(defaultCwd, dependencies = {}) {
  const checkGhAvailable = dependencies.checkGhAvailable ?? (() => {
    execFileSync("gh", ["--version"], { encoding: "utf-8", timeout: 5000, stdio: "pipe" });
    return true;
  });
  const runGhCommand = dependencies.runGh ?? runGh;
  const runGitCommand = dependencies.runGit ?? runGit;
  const approvalGitRunner = dependencies.approvalGitRunner;
  const governedTransportFactory = dependencies.governedTransportFactory ?? createIsolatedGovernedGitTransport;
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
    externalEffectType: "github:pull-request-create",
    externalEffectRequiresFence: true,

    async execute(params, context) {
      const cwd = resolveSafeCwd(params.directory || defaultCwd);

      let governedEnvelope = null;
      if (context?.agentGovernance) {
        const verified = verifyGovernedGitApprovalParameters({
          toolName: "git_create_pr",
          params,
          workingDirectory: defaultCwd,
          ...(approvalGitRunner ? { gitRunner: approvalGitRunner } : {}),
        });
        if (!verified.ok) return { success: false, code: verified.code, error: verified.message };
        governedEnvelope = readGovernedGitEnvelope(params);
      }

      // Detect base branch
      let base = governedEnvelope?.review.destination?.branch ?? params.base;
      if (!base) {
        try {
          base = runGitCommand("symbolic-ref refs/remotes/origin/HEAD", cwd).replace("refs/remotes/origin/", "").trim();
        } catch {
          // fallback: try main, then master
          try { runGitCommand("rev-parse --verify main", cwd); base = "main"; } catch {
            try { runGitCommand("rev-parse --verify master", cwd); base = "master"; } catch {
              base = "main";
            }
          }
        }
      }

      const currentBranch = governedEnvelope?.privateExecution?.prHeadBranch
        ?? governedEnvelope?.review.source?.branch
        ?? runGitCommand("rev-parse --abbrev-ref HEAD", cwd).trim();
      if (currentBranch === base) {
        return { success: false, error: `Cannot create PR: current branch '${currentBranch}' is the same as base '${base}'.` };
      }

      // Check if gh is available
      try {
        runGitCommand("--version", cwd); // sanity check
        if (checkGhAvailable() !== true) throw new Error("gh unavailable");
      } catch {
        return { success: false, error: "GitHub CLI (gh) is not installed or not in PATH. Install it with: brew install gh / winget install GitHub.cli" };
      }

      const reviewedPullRequest = governedEnvelope?.review.pullRequest ?? null;
      if (governedEnvelope && (!reviewedPullRequest
        || typeof reviewedPullRequest.title !== "string"
        || typeof reviewedPullRequest.body !== "string")) {
        return {
          success: false,
          code: "GIT_APPROVAL_ENVELOPE_REQUIRED",
          error: "The complete approved PR title and body are missing.",
        };
      }
      // Governed publication uses only the complete public text rendered in the
      // operator review. It never falls back to mutable request parameters.
      const executionTitle = reviewedPullRequest?.title ?? params.title.slice(0, 200);
      const executionBody = reviewedPullRequest?.body ?? (params.body ? params.body.slice(0, 5000) : "");
      const executionDraft = reviewedPullRequest?.draft ?? (params.draft === true);

      // Build gh pr create arguments (no shell quoting needed — execFileSync handles it)
      const ghArgs = ["pr", "create"];
      if (reviewedPullRequest?.repository) {
        ghArgs.push("--repo", reviewedPullRequest.repository);
        ghArgs.push("--head", currentBranch);
      }
      ghArgs.push("--title", executionTitle);
      if (executionBody) {
        ghArgs.push("--body", executionBody);
      }
      ghArgs.push("--base", base);
      if (executionDraft) ghArgs.push("--draft");

      let headPublicationStarted = false;
      let prCreationStarted = false;
      let fenceCommitted = false;
      let governedTransport = null;
      try {
        await context.commitExternalEffect();
        fenceCommitted = true;
        if (governedEnvelope) {
          const target = governedEnvelope.privateExecution?.remoteTarget;
          const commit = governedEnvelope.review.source?.commit;
          const headBranch = governedEnvelope.privateExecution?.prHeadBranch;
          if (!target || !commit || !headBranch) {
            return { success: false, code: "GIT_APPROVAL_ENVELOPE_REQUIRED", error: "Approved PR head is missing." };
          }
          governedTransport = governedTransportFactory({
            sourceRepository: cwd,
            commit,
            credentialHelpers: governedEnvelope.privateExecution?.credentialHelpers ?? [],
            credentialUseHttpPath: governedEnvelope.privateExecution?.credentialUseHttpPath === true,
          });
          headPublicationStarted = true;
          try {
            governedTransport.pushExact(target, commit, headBranch);
          } catch {
            // Reconcile below. A failed client command can still have reached the
            // remote, so the command exception alone is not a definitive result.
          }
          try {
            const published = governedTransport.readRemoteHead(target, headBranch);
            if (published !== commit.toLowerCase()) throw new Error("published head mismatch");
          } catch {
            return governedPrOutcomeUnknown({
              envelope: governedEnvelope,
              code: "GIT_PR_HEAD_PUBLICATION_OUTCOME_UNCERTAIN",
              error: "The exact approved commit could not be reconciled on the controlled PR head.",
              phase: "head-publication",
            });
          }
        }
        if (governedEnvelope) prCreationStarted = true;
        const output = runGhCommand(ghArgs, cwd);

        const prUrl = (output || "").trim();
        if (governedEnvelope) {
          const target = governedEnvelope.privateExecution?.remoteTarget;
          const commit = governedEnvelope.review.source?.commit;
          const headBranch = governedEnvelope.privateExecution?.prHeadBranch;
          try {
            const published = governedTransport.readRemoteHead(target, headBranch);
            if (!commit || published !== commit.toLowerCase()) throw new Error("published head mismatch");
          } catch {
            return governedPrOutcomeUnknown({
              envelope: governedEnvelope,
              code: "GIT_PR_HEAD_OUTCOME_UNCERTAIN",
              error: "The PR may exist, but its controlled head could not be reconfirmed after creation.",
              phase: "post-create-reconciliation",
              url: prUrl || null,
            });
          }
        }
        return {
          success: true,
          title: executionTitle,
          base,
          head: currentBranch,
          draft: executionDraft,
          url: prUrl || null,
        };
      } catch (error) {
        if (governedEnvelope && prCreationStarted) {
          return governedPrOutcomeUnknown({
            envelope: governedEnvelope,
            code: "GIT_PR_CREATE_OUTCOME_UNCERTAIN",
            error: "The PR creation command failed after dispatch; reconcile the remote before any retry.",
            phase: "pr-create",
          });
        }
        if (governedEnvelope && headPublicationStarted) {
          return governedPrOutcomeUnknown({
            envelope: governedEnvelope,
            code: "GIT_PR_HEAD_PUBLICATION_OUTCOME_UNCERTAIN",
            error: "The controlled PR head publication could not be reconciled.",
            phase: "head-publication",
          });
        }
        if (governedEnvelope && fenceCommitted) {
          return {
            success: false,
            code: "GIT_PR_ISOLATED_TRANSPORT_FAILED",
            error: "The isolated governed Git transport could not be prepared; no Git or GitHub external command was dispatched.",
            outcomeUnknown: false,
          };
        }
        if (governedEnvelope) {
          return {
            success: false,
            code: "GIT_PR_EXTERNAL_EFFECT_FENCE_FAILED",
            error: "The PR external-effect fence could not be committed; no Git or GitHub command was dispatched.",
            outcomeUnknown: false,
          };
        }
        return {
          success: false,
          error: error.message,
          title: executionTitle,
          base,
          head: currentBranch,
        };
      } finally {
        governedTransport?.close?.();
      }
    },
  });
}

function governedPrOutcomeUnknown({ envelope, code, error, phase, url = null }) {
  const pullRequest = envelope?.review?.pullRequest;
  return {
    success: false,
    status: "unknown",
    code,
    error,
    outcomeUnknown: true,
    url,
    reconciliation: {
      required: true,
      retrySafe: false,
      phase,
      repository: pullRequest?.repository ?? null,
      headBranch: pullRequest?.headBranch ?? null,
      baseBranch: pullRequest?.baseBranch ?? null,
      expectedCommit: envelope?.review?.source?.commit ?? null,
      guidance: "Inspect the repository PR list and controlled head before any retry.",
    },
  };
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
      stdio: ["ignore", "pipe", "pipe"],
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
      stdio: ["ignore", "pipe", "pipe"],
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
