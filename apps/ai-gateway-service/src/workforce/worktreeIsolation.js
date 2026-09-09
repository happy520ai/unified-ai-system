/** Git worktrees owned by this Workforce manager; public records are receipts. */
import { randomUUID } from "node:crypto";
import { mkdir, lstat, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, parse } from "node:path";
import { createWorkforceGit } from "./workforceGit.ts";

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const normalized = (path) => process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
async function pathState(path) {
  try { return await lstat(path); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}
function assertDescendant(root, path) {
  const rel = relative(root, path);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
    throw new Error("Worktree path is outside the owned root.");
  }
}

export function createWorktreeIsolation(options = {}) {
  const repoRoot = resolve(options.repoRoot || process.cwd());
  const worktreeRoot = options.worktreeRoot || ".worktrees";
  const configuredRoot = resolve(repoRoot, worktreeRoot);
  if ([repoRoot, parse(configuredRoot).root].some((path) => normalized(path) === normalized(configuredRoot))) {
    throw new Error("Worktree root must not be the repository or filesystem root.");
  }
  const maxAge = options.maxAge || DEFAULT_MAX_AGE_MS;
  const git = createWorkforceGit(repoRoot);
  const worktrees = new Map();
  const removedWorktreeHeads = new Map();
  let canonicalRoot;
  let pending = Promise.resolve();
  /** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
  function exclusive(operation) {
    const result = pending.then(operation);
    pending = result.then(() => undefined, () => undefined);
    return result;
  }
  async function ownedRoot(create = false) {
    if (create) await mkdir(configuredRoot, { recursive: true, mode: 0o700 });
    const state = await pathState(configuredRoot);
    if (!state?.isDirectory() || state.isSymbolicLink()) throw new Error("Worktree root is missing or replaced.");
    const actual = await realpath(configuredRoot);
    if (canonicalRoot && normalized(actual) !== normalized(canonicalRoot)) throw new Error("Worktree root changed.");
    canonicalRoot ??= actual;
    return canonicalRoot;
  }
  async function registered(path) {
    const { stdout } = await git.run(["worktree", "list", "--porcelain", "-z"]);
    return stdout.split("\0").some((line) => line.startsWith("worktree ") && normalized(line.slice(9)) === normalized(path));
  }
  async function branchExists(branch) {
    try { await git.run(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]); return true; }
    catch (error) { if (error?.code === 1) return false; throw error; }
  }
  const receipt = (record) => Object.freeze({ ...record });
  const manager = {
    getInfo() {
      return { module: "worktreeIsolation", version: "1.0.0", repoRoot, worktreeRoot, maxAge,
        activeWorktrees: worktrees.size, description: "Git Worktree 隔离模块：为每个任务创建独立的工作目录" };
    },
    /** @param {{planId: string, branch?: string, newBranch?: string}} params */
    async create({ planId, branch, newBranch }) {
      if (!planId || typeof planId !== "string") throw new Error("planId 是必填项");
      return exclusive(async () => {
        try {
          await git.assertSafe();
          const sourceBranch = branch ?? "HEAD";
          if (typeof sourceBranch !== "string" || !sourceBranch || sourceBranch.startsWith("-") || /[\0\r\n]/.test(sourceBranch)) {
            throw new Error("Invalid source ref.");
          }
          const id = `wf-${randomUUID()}`;
          const branchName = newBranch ?? `workforce/${id}`;
          if (typeof branchName !== "string" || branchName.startsWith("-") || /[\0\r\n]/.test(branchName)) throw new Error("Invalid new branch.");
          await git.run(["check-ref-format", `refs/heads/${branchName}`]);
          if (await branchExists(branchName)) throw new Error("Candidate branch already exists.");
          const { stdout } = await git.run(["rev-parse", "--verify", "--end-of-options", `${sourceBranch}^{commit}`]);
          const commit = stdout.trim();
          if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Source commit could not be resolved.");
          const root = await ownedRoot(true);
          const path = resolve(root, id);
          assertDescendant(root, path);
          if (await pathState(path)) throw new Error("Candidate directory already exists.");
          await git.run(["worktree", "add", "-b", branchName, path, commit], 60_000);
          const record = Object.freeze({ worktreeId: id, planId, branch: branchName, sourceBranch,
            path, createdAt: new Date().toISOString(), status: "active" });
          worktrees.set(id, record);
          return { success: true, worktree: receipt(record), message: `Worktree 已创建: ${path}` };
        } catch {
          return { success: false, code: "WORKTREE_CREATE_FAILED", reason: "Cannot safely create the isolated worktree. Check the source ref, new branch and Git configuration.", planId };
        }
      });
    },
    async remove(worktreeId, removeOptions = {}) {
      return exclusive(async () => {
        const record = worktrees.get(worktreeId);
        if (!record) return { success: false, reason: "未找到指定的 worktree 记录" };
        try {
          const root = await ownedRoot();
          assertDescendant(root, record.path);
          const state = await pathState(record.path);
          if (state && (state.isSymbolicLink() || normalized(await realpath(record.path)) !== normalized(record.path))) {
            throw new Error("Owned worktree path was replaced.");
          }
          if (await registered(record.path)) {
            if (!state) throw new Error("Registered worktree is missing; ownership requires review.");
            const worktreeGit = createWorkforceGit(record.path);
            const ref = (await worktreeGit.run(["symbolic-ref", "--quiet", "HEAD"])).stdout.trim();
            if (ref !== `refs/heads/${record.branch}`) throw new Error("Worktree branch changed.");
            const expectedHead = (await worktreeGit.run(["rev-parse", "--verify", "HEAD"])).stdout.trim();
            if (!/^[a-f0-9]{40,64}$/.test(expectedHead)) throw new Error("Worktree HEAD is invalid.");
            await git.run(["worktree", "remove", "--force", "--", record.path], 60_000);
            removedWorktreeHeads.set(worktreeId, expectedHead);
          }
          if (await pathState(record.path) || await registered(record.path)) throw new Error("Worktree removal could not be verified.");
          const preserveBranch = removeOptions?.preserveBranch === true;
          if (!preserveBranch && await branchExists(record.branch)) {
            const expectedHead = removedWorktreeHeads.get(worktreeId);
            if (!expectedHead) throw new Error("No owned removal proves the branch may be deleted.");
            const { stdout } = await git.run(["worktree", "list", "--porcelain", "-z"]);
            if (stdout.split("\0").includes(`branch refs/heads/${record.branch}`)) throw new Error("Candidate branch is in use.");
            // Compare-and-delete prevents a stale cleanup record from deleting
            // a ref that moved after the owned worktree was removed.
            await git.run(["update-ref", "-d", `refs/heads/${record.branch}`, expectedHead]);
          }
          if (!preserveBranch && await branchExists(record.branch)) throw new Error("Candidate branch removal could not be verified.");
          worktrees.delete(worktreeId);
          removedWorktreeHeads.delete(worktreeId);
          return { success: true, worktreeId, branch: record.branch, branchPreserved: preserveBranch,
            message: `Worktree 已移除: ${record.path}` };
        } catch {
          return { success: false, code: "WORKTREE_REMOVE_FAILED", worktreeId,
            reason: "The owned worktree or branch could not be safely removed; its record is retained for recovery." };
        }
      });
    },
    async removeByPlanId(planId) {
      const records = [...worktrees.values()].filter((record) => record.planId === planId);
      const results = [];
      for (const record of records) results.push(await manager.remove(record.worktreeId));
      return { success: results.every((result) => result.success), planId,
        removedCount: results.filter((result) => result.success).length, results };
    },
    list() {
      return { success: true, count: worktrees.size, worktrees: [...worktrees.values()].map(receipt) };
    },
    getStatus(worktreeId) {
      const record = worktrees.get(worktreeId);
      return record ? { success: true, worktree: receipt(record) } : { success: false, reason: "未找到指定的 worktree 记录" };
    },
    async cleanup(maxAgeMs) {
      const age = maxAgeMs ?? maxAge;
      if (!Number.isFinite(age) || age < 0) throw new Error("Invalid worktree expiry age.");
      const now = Date.now();
      const expired = [...worktrees.values()].filter((record) => now - Date.parse(record.createdAt) > age);
      const results = [];
      for (const record of expired) results.push(await manager.remove(record.worktreeId));
      return { success: results.every((result) => result.success), expiredCount: expired.length,
        totalCleaned: results.filter((result) => result.success).length, results };
    },
  };
  return manager;
}
