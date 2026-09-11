/** Git worktrees owned by this Workforce manager; public records are receipts. */
import { randomUUID } from "node:crypto";
import { mkdir, lstat, realpath } from "node:fs/promises";
import { resolve, relative, isAbsolute, parse } from "node:path";
import { createWorkforceGit } from "./workforceGit.ts";

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ownedManagers = new WeakMap();
const WORKTREE_ID = /^wf-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const IDENTITY_KEYS = ["repositoryRoot", "worktreeRoot", "worktreeDirectory", "gitFile"];
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
async function identity(path, file = false) {
  const state = await lstat(path, { bigint: true });
  if (state.isSymbolicLink() || (file ? !state.isFile() || state.nlink !== 1n : !state.isDirectory())
    || state.ino <= 0n || normalized(await realpath(path)) !== normalized(path)) throw new Error("Owned worktree identity is unavailable.");
  return Object.freeze({ dev: state.dev.toString(), ino: state.ino.toString() });
}
function validIdentities(value) {
  return value && Object.keys(value).sort().join("|") === [...IDENTITY_KEYS].sort().join("|")
    && IDENTITY_KEYS.every(key => value[key] && Object.keys(value[key]).sort().join("|") === "dev|ino"
      && typeof value[key].dev === "string" && /^(0|[1-9][0-9]{0,39})$/.test(value[key].dev)
      && typeof value[key].ino === "string" && /^[1-9][0-9]{0,39}$/.test(value[key].ino));
}
function sameIdentities(left, right) {
  return validIdentities(left) && validIdentities(right) && IDENTITY_KEYS.every(key => left[key].dev === right[key].dev && left[key].ino === right[key].ino);
}

/** A server-only point-in-time proof. JSON or a lookalike manager cannot mint it.
 * @param {unknown} manager
 * @param {string} worktreeId
 * @param {{planId: string, baselineRevision: string}} expected
 */
export async function assertOwnedWorkforceWorktree(manager, worktreeId, expected) {
  const verify = manager && typeof manager === "object" ? ownedManagers.get(manager)?.verify : undefined;
  if (!verify || typeof worktreeId !== "string" || !expected || typeof expected !== "object"
    || Object.keys(expected).sort().join("\0") !== "baselineRevision\0planId"
    || typeof expected.planId !== "string" || !expected.planId
    || typeof expected.baselineRevision !== "string" || !/^[a-f0-9]{40}$/.test(expected.baselineRevision)) {
    throw new Error("Workforce worktree ownership or baseline is invalid.");
  }
  return verify(worktreeId, Object.freeze({ planId: expected.planId, baselineRevision: expected.baselineRevision }));
}

/** Server-only reconciliation; the callback must recheck the authoritative original task and current authorization.
 * No worktree is created, removed, copied, or rewritten by this operation.
 * @param {unknown} manager
 * @param {{worktreeId:string,planId:string,branch:string,baselineRevision:string,createdAt:string,identities:object}} expected
 * @param {()=>Promise<unknown>} assertAuthorized
 */
export async function restoreOwnedWorkforceWorktree(manager, expected, assertAuthorized) {
  const restore = manager && typeof manager === "object" ? ownedManagers.get(manager)?.restore : undefined;
  if (!restore || typeof assertAuthorized !== "function" || !expected || typeof expected !== "object"
    || Object.keys(expected).sort().join("|") !== "baselineRevision|branch|createdAt|identities|planId|worktreeId"
    || !WORKTREE_ID.test(expected.worktreeId) || typeof expected.planId !== "string" || !expected.planId
    || typeof expected.branch !== "string" || !expected.branch || expected.branch.startsWith("-") || /[\0\r\n]/.test(expected.branch)
    || !/^[a-f0-9]{40}$/.test(expected.baselineRevision) || typeof expected.createdAt !== "string" || !Number.isFinite(Date.parse(expected.createdAt))
    || !validIdentities(expected.identities)) throw new Error("Original worktree reconciliation requires a server capability and exact receipt.");
  const identities = Object.freeze(Object.fromEntries(IDENTITY_KEYS.map(key => [key, Object.freeze({ ...expected.identities[key] })])));
  return restore(Object.freeze({ ...expected, identities }), assertAuthorized);
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
  const rootIdentities = async () => {
    const repository = await lstat(repoRoot, { bigint: true });
    if (!repository.isDirectory() || repository.isSymbolicLink()) throw new Error("Repository root is not a real directory.");
    const result = { repositoryRoot: await identity(await realpath(repoRoot)), worktreeRoot: await identity(await ownedRoot()) };
    if (result.repositoryRoot.dev === result.worktreeRoot.dev && result.repositoryRoot.ino === result.worktreeRoot.ino) {
      throw new Error("Worktree root must not be the repository root.");
    }
    return result;
  };
  const identities = async path => Object.freeze({ ...await rootIdentities(),
    worktreeDirectory: await identity(path), gitFile: await identity(resolve(path, ".git"), true) });
  /** @param {{worktreeId:string,planId:string,branch:string,sourceBranch:string,path:string,createdAt:string,status:string}} record */
  const receipt = record => Object.freeze({ worktreeId: record.worktreeId, planId: record.planId, branch: record.branch,
    sourceBranch: record.sourceBranch, path: record.path, createdAt: record.createdAt, status: record.status });
  const manager = {
    getInfo() {
      return { module: "worktreeIsolation", version: "1.0.0", repoRoot, worktreeRoot, maxAge,
        activeWorktrees: [...worktrees.values()].filter(record => record.status === "active").length,
        description: "Git Worktree 隔离模块：为每个任务创建独立的工作目录" };
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
          const beforeRoots = await rootIdentities();
          const path = resolve(root, id);
          assertDescendant(root, path);
          if (await pathState(path)) throw new Error("Candidate directory already exists.");
          await git.run(["worktree", "add", "-b", branchName, path, commit], 60_000);
          // Keep ownership metadata if post-creation identity attestation fails; it must not become an untracked orphan.
          const provisional = { worktreeId: id, planId, branch: branchName, sourceBranch, path,
            createdAt: new Date().toISOString(), status: "unknown", identities: null };
          worktrees.set(id, Object.freeze(provisional));
          const captured = await identities(path);
          if (["repositoryRoot", "worktreeRoot"].some(key => beforeRoots[key].dev !== captured[key].dev || beforeRoots[key].ino !== captured[key].ino)) {
            throw new Error("Creation roots changed during Git worktree creation.");
          }
          const record = Object.freeze({ worktreeId: id, planId, branch: branchName, sourceBranch,
            path, createdAt: provisional.createdAt, status: "active", identities: captured });
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
        if (record.status !== "active" || !validIdentities(record.identities)) {
          return { success: false, code: "WORKTREE_REMOVE_FAILED", worktreeId,
            reason: "Original directory identity is unconfirmed; owned metadata is retained for operator review." };
        }
        try {
          const root = await ownedRoot();
          assertDescendant(root, record.path);
          const state = await pathState(record.path);
          if (state && (state.isSymbolicLink() || normalized(await realpath(record.path)) !== normalized(record.path))) {
            throw new Error("Owned worktree path was replaced.");
          }
          if (await registered(record.path)) {
            if (!state) throw new Error("Registered worktree is missing; ownership requires review.");
            if (!sameIdentities(await identities(record.path), record.identities)) throw new Error("Original worktree directories were replaced.");
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
  const verifyRecord = async (record, expected) => {
    if (!record || record.status !== "active" || record.planId !== expected.planId) throw new Error("Workforce worktree ownership is unavailable.");
    const root = await ownedRoot();
    assertDescendant(root, record.path);
    const state = await pathState(record.path);
    if (!state?.isDirectory() || state.isSymbolicLink()
      || normalized(await realpath(record.path)) !== normalized(record.path)
      || !await registered(record.path)) throw new Error("Owned worktree path or registration changed.");
    const worktreeGit = createWorkforceGit(record.path);
    await worktreeGit.assertSafe();
    const ref = (await worktreeGit.run(["symbolic-ref", "--quiet", "HEAD"])).stdout.trim();
    const baselineRevision = (await worktreeGit.run(["rev-parse", "--verify", "HEAD"])).stdout.trim();
    if (ref !== `refs/heads/${record.branch}` || baselineRevision !== expected.baselineRevision) {
      throw new Error("Owned worktree branch or approved baseline changed.");
    }
    const currentIdentities = await identities(record.path);
    if (!sameIdentities(record.identities, currentIdentities)) throw new Error("Original worktree directories were replaced.");
    return Object.freeze({ worktreeId: record.worktreeId, planId: record.planId, path: record.path, branch: record.branch,
      baselineRevision, repositoryRoot: await realpath(repoRoot), createdAt: record.createdAt, identities: currentIdentities });
  };
  ownedManagers.set(manager, {
    verify: (worktreeId, expected) => exclusive(() => verifyRecord(worktrees.get(worktreeId), expected)),
    restore: (expected, assertAuthorized) => exclusive(async () => {
      await assertAuthorized(); await git.assertSafe();
      const root = await ownedRoot(), path = resolve(root, expected.worktreeId);
      assertDescendant(root, path);
      if (worktrees.has(expected.worktreeId)) throw new Error("This manager already owns the worktree.");
      if (!sameIdentities(await identities(path), expected.identities)) throw new Error("Original worktree directories were replaced.");
      const entries = (await git.run(["worktree", "list", "--porcelain", "-z"])).stdout.split("\0\0").map(block => block.split("\0"));
      const registeredEntries = entries.filter(fields => fields.some(field => field.startsWith("worktree ") && normalized(field.slice(9)) === normalized(path)));
      if (registeredEntries.length !== 1 || !registeredEntries[0].includes("HEAD " + expected.baselineRevision)
        || !registeredEntries[0].includes("branch refs/heads/" + expected.branch)) throw new Error("Original worktree registration changed.");
      const worktreeGit = createWorkforceGit(path); await worktreeGit.assertSafe();
      const common = await realpath(resolve(repoRoot, (await git.run(["rev-parse", "--git-common-dir"])).stdout.trim()));
      if (normalized(await realpath(resolve(path, (await worktreeGit.run(["rev-parse", "--git-common-dir"])).stdout.trim()))) !== normalized(common)) {
        throw new Error("Original worktree repository changed.");
      }
      const record = Object.freeze({ worktreeId: expected.worktreeId, planId: expected.planId, branch: expected.branch,
        sourceBranch: expected.baselineRevision, path, createdAt: expected.createdAt, status: "active", identities: expected.identities });
      const proof = await verifyRecord(record, expected);
      await assertAuthorized();
      if (!sameIdentities(await identities(path), expected.identities)) throw new Error("Original worktree directories changed during reconciliation.");
      worktrees.set(expected.worktreeId, record); return proof;
    }),
  });
  return manager;
}
