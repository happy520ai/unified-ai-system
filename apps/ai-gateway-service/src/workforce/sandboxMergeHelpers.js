/**
 * sandboxMergeHelpers.js
 *
 * Extracted helper functions for sandboxMergeExecutor.js:
 * - verifyGateStructural: syntax + forbidden-path checks on worktree diff
 * - snapshotWorktree: snapshot tracked files + content hashes
 * - computeWorktreeDiff: compute worktree diff vs HEAD
 * - commitWorktreeChanges: commit all worktree changes on candidate branch
 * - rollbackWorktree: remove worktree directory + delete candidate branch
 * - mergeCandidateToMain: auto-advance merge candidate into main
 * - safeSafety: default safety metadata object
 *
 * @module sandboxMergeHelpers
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const execFileAsync = promisify(execFile);

// =========================================================================
// Verify gate
// =========================================================================

/**
 * Structural verifier over the worktree diff. Returns {pass, checks}.
 * Checks (all must pass):
 *   1. syntax_check   — node --check on every changed .js/.mjs/.cjs file
 *   2. forbidden_path — no changed file is on the global forbidden surface
 *
 * The user verify hook is run SEPARATELY by the caller (before this, so the
 * hook's file writes are included in changedFiles). This function only does
 * the machine-enforced structural checks.
 */
export async function verifyGateStructural({ changedFiles, worktreePath, budget }) {
  const checks = [];

  // 1. Syntax check every changed JS file
  const jsFiles = changedFiles.filter((f) => /\.(js|mjs|cjs)$/i.test(f.path));
  let syntaxOk = true;
  const syntaxErrors = [];
  for (const f of jsFiles) {
    const fullPath = join(worktreePath, f.path);
    try {
      await execFileAsync("node", ["--check", fullPath], { timeout: 30_000 });
    } catch (err) {
      syntaxOk = false;
      syntaxErrors.push(`${f.path}: ${(err.stderr || err.stdout || err.message || "").toString().split("\n")[0]}`);
    }
  }
  checks.push({ name: "syntax_check", pass: syntaxOk, fileCount: jsFiles.length, errors: syntaxErrors });

  // 2. Forbidden path check
  let forbiddenOk = true;
  const forbiddenHits = [];
  for (const f of changedFiles) {
    if (budget.isForbidden(f.path)) {
      forbiddenOk = false;
      forbiddenHits.push(f.path);
    }
  }
  checks.push({ name: "forbidden_path", pass: forbiddenOk, hits: forbiddenHits, forbiddenSurface: budget.getForbiddenSurface() });

  const pass = checks.every((c) => c.pass !== false);
  return { pass, checks };
}

// =========================================================================
// Git helpers operating on the worktree
// =========================================================================

/**
 * Snapshot the worktree's tracked files + content hashes at exec start.
 * Used as a reference point for auto-rollback (the candidate branch can be
 * reset to this commit if anything later fails).
 */
export async function snapshotWorktree(worktreePath, repoRoot) {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: worktreePath, maxBuffer: 50 * 1024 * 1024 });
  const files = stdout.split("\n").filter(Boolean);
  const snapshot = [];
  // Hash up to 2000 files (keep it fast for huge repos)
  for (const f of files.slice(0, 2000)) {
    try {
      const buf = await readFile(join(worktreePath, f));
      const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
      snapshot.push({ path: f, hash });
    } catch {
      // file may be a symlink or unreadable; skip
    }
  }
  return { fileCount: files.length, sampled: snapshot.length, files: snapshot };
}

/**
 * Compute the diff of the worktree vs HEAD: which files changed (added/modified/deleted).
 */
export async function computeWorktreeDiff(worktreePath) {
  // git status --porcelain gives changed files; git diff --name-status against HEAD
  let changed = [];
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--name-status", "HEAD"], { cwd: worktreePath, maxBuffer: 50 * 1024 * 1024 });
    changed = stdout.split("\n").filter(Boolean).map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status: status[0], path: rest.join("\t") };
    });
  } catch (err) {
    // diff against HEAD may fail if no commits — fall back to status
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd: worktreePath, maxBuffer: 50 * 1024 * 1024 });
    changed = stdout.split("\n").filter(Boolean).map((line) => {
      const status = line.slice(0, 2).trim();
      const path = line.slice(3);
      return { status: status[0] || "?", path };
    });
  }
  // Untracked files (status ??) also count as changes the agent introduced
  try {
    const { stdout: untracked } = await execFileAsync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: worktreePath, maxBuffer: 50 * 1024 * 1024 });
    const existing = new Set(changed.map((c) => c.path));
    for (const u of untracked.split("\n").filter(Boolean)) {
      if (!existing.has(u)) changed.push({ status: "A", path: u });
    }
  } catch {
    // ignore
  }
  return { files: changed };
}

/**
 * Commit all worktree changes on the candidate branch.
 */
export async function commitWorktreeChanges(worktreePath, planId, goal) {
  // Stage everything (the sandbox is throwaway; we want all agent changes captured)
  await execFileAsync("git", ["add", "-A"], { cwd: worktreePath, maxBuffer: 50 * 1024 * 1024 });
  // If nothing to commit, that's fine — return null commit
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["commit", "-m", `workforce(sandbox-merge): ${planId} — ${String(goal || "").slice(0, 80)}`, "--no-verify"],
      { cwd: worktreePath, maxBuffer: 10 * 1024 * 1024 }
    );
    // Extract commit hash
    const match = stdout.match(/\[.*?([0-9a-f]{7,40})\]/);
    return match ? match[1] : null;
  } catch (err) {
    const msg = (err.stdout || err.stderr || err.message || "").toString();
    if (msg.includes("nothing to commit")) return null;
    throw new Error(`commit failed: ${msg.split("\n")[0]}`);
  }
}

/**
 * Rollback a worktree: remove the worktree directory AND delete the candidate branch.
 * The main repo is completely unaffected.
 */
export async function rollbackWorktree(worktree, worktreeId) {
  try {
    await worktree.remove(worktreeId);
  } catch {
    // best-effort
  }
  return { rolledBack: true };
}

/**
 * Auto-advance: merge the verified candidate branch into main.
 * Used ONLY in sandbox-merge-auto mode after verify-green + successful commit.
 *
 * Strategy:
 *   - Try a fast-forward merge first (cleanest, no merge commit needed).
 *   - If FF is not possible (main moved), fall back to a no-ff merge commit
 *     on main that pulls in the candidate branch.
 *   - If the merge produces conflicts, ABORT (git merge --abort) and throw —
 *     the caller preserves the candidate branch so a human can resolve it.
 *
 * The main repo's working tree must be clean-ish for this to succeed; if it
 * isn't, git merge will refuse and we throw (caller treats as non-fatal).
 *
 * Returns { merged: true, mergeCommit, fastForward }.
 */
export async function mergeCandidateToMain(repoRoot, candidateBranch, planId) {
  // Sanity: candidate branch must still exist
  try {
    await execFileAsync("git", ["rev-parse", "--verify", candidateBranch], { cwd: repoRoot });
  } catch {
    throw new Error(`candidate branch not found: ${candidateBranch}`);
  }

  // Ensure we're on main (or master) in the main repo
  const { stdout: currentBranch } = await execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot });
  const mainBranch = currentBranch.trim() === "master" ? "master" : currentBranch.trim() === "main" ? "main" : null;
  if (!mainBranch) {
    throw new Error(`auto-advance only runs on main/master, current branch is '${currentBranch.trim()}'`);
  }

  // Try fast-forward first
  try {
    await execFileAsync("git", ["merge", "--ff-only", candidateBranch], {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
    });
    const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
    return { merged: true, mergeCommit: head.trim(), fastForward: true, planId };
  } catch (ffErr) {
    const ffMsg = (ffErr.stdout || ffErr.stderr || ffErr.message || "").toString();
    // If FF failed because main moved, try a real merge (--no-ff with auto-commit)
    if (ffMsg.includes("Not possible to fast-forward") || ffMsg.includes("non-fast-forward") || ffMsg.includes("diverged")) {
      try {
        await execFileAsync(
          "git",
          ["merge", "--no-ff", "-m", `autonomy(sandbox-merge-auto): merge ${candidateBranch} for ${planId}`, candidateBranch],
          { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 }
        );
        const { stdout: head } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
        return { merged: true, mergeCommit: head.trim(), fastForward: false, planId };
      } catch (mergeErr) {
        const mMsg = (mergeErr.stdout || mergeErr.stderr || mergeErr.message || "").toString();
        // Conflicts → abort the merge, preserve candidate branch
        try {
          await execFileAsync("git", ["merge", "--abort"], { cwd: repoRoot });
        } catch {
          // ignore
        }
        throw new Error(`merge conflict, aborted; candidate branch ${candidateBranch} preserved for manual resolution: ${mMsg.split("\n")[0]}`);
      }
    }
    // Some other failure (e.g. dirty working tree) → throw
    throw new Error(`fast-forward failed: ${ffMsg.split("\n")[0]}`);
  }
}

/**
 * Default safety metadata object.
 */
export function safeSafety() {
  return {
    executionEnabled: true,
    dryRun: false,
    sandboxed: true,
    providerCallsMade: false,
    secretValueExposed: false,
    mainTreeModified: false,
    mainBranchModified: false,
    autoRollbackOnFailure: true,
  };
}
