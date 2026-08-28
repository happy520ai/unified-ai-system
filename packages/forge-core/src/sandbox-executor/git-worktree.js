/**
 * git-worktree.js — Forge-core Git Worktree 隔离模块
 *
 * 为 Forge 任务执行提供隔离的 Git 工作树环境。
 * 每个任务在自己的 worktree 中运行,避免并发冲突。
 *
 * 设计参考: apps/ai-gateway-service/src/workforce/worktreeIsolation.js
 * 适配 Forge-core 的模块风格(无类继承,工厂函数导出)
 */

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, rm, readdir, readFile, lstat, realpath } from "node:fs/promises";
import { resolve, join, relative, isAbsolute, parse } from "node:path";

const execFileAsync = promisify(execFile);

// 默认超时:60 秒
const DEFAULT_TIMEOUT_MS = 60_000;

// 默认 worktree 根目录
const DEFAULT_WORKTREE_ROOT = ".worktrees";

// worktree 最大存活时间:24 小时
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const SAFE_TASK_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function validateTaskId(id) {
  if (typeof id !== "string" || !SAFE_TASK_ID.test(id) || id.includes("..") || id.endsWith(".")) {
    throw new Error("git-worktree task id must be a 1-128 character path-safe identifier");
  }
  if (WINDOWS_RESERVED_NAME.test(id)) {
    throw new Error("git-worktree task id is reserved on Windows");
  }
  return id;
}

function normalizePathForComparison(value) {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function assertStrictDescendant(root, candidate, label = "worktree path") {
  const rel = relative(root, candidate);
  if (!rel || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
    throw new Error(`${label} escapes the configured worktree root`);
  }
}

async function getPathState(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function removePathAndVerify(path, root) {
  assertStrictDescendant(root, path);
  if (await getPathState(path)) {
    await rm(path, { recursive: true, force: true });
  }
  if (await getPathState(path)) {
    throw new Error(`worktree cleanup could not prove removal of ${path}`);
  }
}

/**
 * 执行 git 命令
 * @param {string[]} args - git 参数
 * @param {string} cwd - 工作目录
 * @param {number} timeoutMs - 超时毫秒
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function runGit(args, cwd, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const env = Object.create(null);
  for (const key of ["PATH", "Path", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "LANG", "LC_ALL"]) {
    if (typeof process.env[key] === "string" && process.env[key]) env[key] = process.env[key];
  }
  env.GIT_CONFIG_NOSYSTEM = "1";
  env.GIT_CONFIG_GLOBAL = process.platform === "win32" ? "NUL" : "/dev/null";
  env.GIT_TERMINAL_PROMPT = "0";
  return execFileAsync("git", args, { cwd, env, timeout: timeoutMs });
}

/**
 * 简单异步互斥锁 — 防止并发创建/删除 worktree 导致 git 竞态
 */
function createMutex() {
  let locked = false;
  const queue = [];
  return {
    async acquire() {
      if (!locked) {
        locked = true;
        return;
      }
      await new Promise((resolveFn) => queue.push(resolveFn));
      locked = true;
    },
    release() {
      locked = false;
      const next = queue.shift();
      if (next) next();
    },
  };
}

/**
 * 创建 Git Worktree 隔离管理器
 *
 * @param {Object} [options={}] - 配置选项
 * @param {string} [options.repoRoot] - Git 仓库根目录(默认 process.cwd())
 * @param {string} [options.worktreeRoot] - worktree 存放根目录(默认 .worktrees)
 * @param {number} [options.maxAge] - worktree 最大存活时间毫秒(默认 24h)
 * @param {number} [options.timeoutMs] - git 命令超时毫秒(默认 60s)
 * @param {boolean} [options.autoCleanupOnExit=false] - Deprecated; destructive exit hooks are disabled
 * @returns {Object} Worktree 管理器实例
 */
export function createGitWorktree(options = {}) {
  // ── Private fields(闭包封装)──
  const repoRoot = resolve(options.repoRoot || process.cwd());
  const worktreeRoot = options.worktreeRoot || DEFAULT_WORKTREE_ROOT;
  const configuredWorktreeRoot = resolve(repoRoot, worktreeRoot);
  if (normalizePathForComparison(configuredWorktreeRoot) === normalizePathForComparison(repoRoot)
    || normalizePathForComparison(configuredWorktreeRoot) === normalizePathForComparison(parse(configuredWorktreeRoot).root)) {
    throw new Error("git-worktree root must not be the repository or filesystem root");
  }
  const maxAge = options.maxAge || DEFAULT_MAX_AGE_MS;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  // Exit handlers cannot prove canonical paths or Git metadata cleanup and can
  // race filesystem replacement. Cleanup is therefore explicit and verified.
  void options.autoCleanupOnExit;
  let canonicalWorktreeRoot = null;
  const disabledHooksPath = resolve(repoRoot, ".git", `.forge-disabled-hooks-${randomUUID()}`);
  const safeGitPrefix = [
    "-c", `core.hooksPath=${disabledHooksPath}`,
    "-c", "core.fsmonitor=false",
    "-c", "core.untrackedCache=false",
    "-c", "protocol.file.allow=never",
  ];

  async function safeRunGit(args, cwd = repoRoot) {
    return runGit([...safeGitPrefix, ...args], cwd, timeoutMs);
  }

  async function assertNoCheckoutPrograms() {
    try {
      const configured = await safeRunGit([
        "config", "--local", "--name-only", "--get-regexp",
        "^(filter\\.|core\\.(attributesfile|fsmonitor)$)",
      ]);
      if (configured.stdout.trim()) {
        throw new Error(`git-worktree refuses executable checkout configuration: ${configured.stdout.trim().split(/\r?\n/).join(", ")}`);
      }
    } catch (error) {
      if (error?.code !== 1) throw error;
    }

    const { stdout } = await safeRunGit(["ls-files", "--", ".gitattributes", "**/.gitattributes"]);
    const attributePaths = stdout.split(/\r?\n/).filter(Boolean);
    const infoAttributes = resolve(repoRoot, ".git", "info", "attributes");
    for (const path of [...attributePaths.map((entry) => resolve(repoRoot, entry)), infoAttributes]) {
      let content;
      try { content = await readFile(path, "utf8"); }
      catch (error) { if (error?.code === "ENOENT") continue; throw error; }
      if (content.split(/\r?\n/).some((line) => !line.trimStart().startsWith("#") && /(?:^|\s)filter\s*=/.test(line))) {
        throw new Error(`git-worktree refuses checkout filters from ${path}`);
      }
    }
  }

  // 已创建的 worktree 记录(内存中维护)
  const worktrees = new Map();

  // 统计计数器
  const stats = {
    created: 0,
    removed: 0,
    cleanedExpired: 0,
    failedCreates: 0,
    failedRemoves: 0,
  };

  // 互斥锁:防止并发 git 操作竞态
  const mutex = createMutex();

  /**
   * 确保 worktree 根目录存在
   */
  async function ensureWorktreeRoot() {
    await mkdir(configuredWorktreeRoot, { recursive: true, mode: 0o700 });
    const currentCanonicalRoot = await realpath(configuredWorktreeRoot);
    if (canonicalWorktreeRoot === null) {
      canonicalWorktreeRoot = currentCanonicalRoot;
    } else if (normalizePathForComparison(currentCanonicalRoot) !== normalizePathForComparison(canonicalWorktreeRoot)) {
      throw new Error("git-worktree root changed after manager initialization");
    }
    return canonicalWorktreeRoot;
  }

  /**
   * 检查路径是否存在
   */
  async function exists(p) {
    return (await getPathState(p)) !== null;
  }

  async function isGitWorktreeRegistered(path) {
    const { stdout } = await safeRunGit(["worktree", "list", "--porcelain"]);
    const expected = normalizePathForComparison(path);
    return stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith("worktree "))
      .some((line) => normalizePathForComparison(line.slice("worktree ".length)) === expected);
  }

  async function assertWorktreeRemoved(record) {
    if (await getPathState(record.path)) {
      throw new Error(`worktree directory still exists after cleanup: ${record.path}`);
    }
    if (await isGitWorktreeRegistered(record.path)) {
      throw new Error(`git metadata still registers worktree after cleanup: ${record.path}`);
    }
  }

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "git-worktree",
        version: "1.0.0",
        repoRoot,
        worktreeRoot,
        maxAge,
        activeWorktrees: worktrees.size,
        description: "Git Worktree 隔离模块:为每个 Forge 任务创建独立的工作目录",
      };
    },

    /**
     * 创建一个新的 worktree
     *
     * @param {Object} params
     * @param {string} params.id - 任务/分支 ID
     * @param {string} [params.baseBranch] - 基分支(默认当前 HEAD)
     * @param {string} [params.branchName] - 新分支名(默认 forge/{id})
     * @returns {Promise<Object>} worktree 信息 { id, path, branch, createdAt }
     */
    async create({ id, baseBranch, branchName } = {}) {
      validateTaskId(id);

      // 如果已存在,返回已有的
      if (worktrees.has(id)) {
        throw new Error(`git-worktree task id is already active: ${id}`);
      }

      await mutex.acquire();
      try {
        if (worktrees.has(id)) {
          throw new Error(`git-worktree task id is already active: ${id}`);
        }
        await assertNoCheckoutPrograms();
        const root = await ensureWorktreeRoot();
        const branch = branchName || `forge/${id}`;
        const wtPath = resolve(root, id);
        assertStrictDescendant(root, wtPath);

        // 如果目录已存在,先清理
        if (await exists(wtPath)) {
          await removePathAndVerify(wtPath, root);
        }

        // 创建 worktree
        const gitArgs = ["worktree", "add", "-b", branch];
        if (baseBranch) {
          gitArgs.push(wtPath, baseBranch);
        } else {
          gitArgs.push(wtPath);
        }

        let branchOwned = true;
        try {
          await safeRunGit(gitArgs);
        } catch (err) {
          // 如果分支已存在,尝试不创建新分支
          if (err.stderr && err.stderr.includes("already exists")) {
            branchOwned = false;
            await safeRunGit(["worktree", "add", wtPath, branch]);
          } else {
            stats.failedCreates++;
            throw new Error(`Failed to create worktree: ${err.message}`);
          }
        }

        const record = {
          id,
          path: wtPath,
          branch,
          branchOwned,
          createdAt: Date.now(),
        };
        worktrees.set(id, record);
        stats.created++;

        return record;
      } finally {
        mutex.release();
      }
    },

    /**
     * 获取 worktree 信息
     * @param {string} id - worktree ID
     * @returns {Object|null}
     */
    get(id) {
      return worktrees.get(id) || null;
    },

    /**
     * 列出所有活跃的 worktree
     * @returns {Object[]}
     */
    list() {
      return Array.from(worktrees.values());
    },

    /**
     * 删除指定的 worktree
     * @param {string} id - worktree ID
     * @param {boolean} [deleteBranch] - 是否同时删除本管理器创建的分支
     * @returns {Promise<boolean>} 是否成功删除
     */
    async remove(id, deleteBranch) {
      const record = worktrees.get(id);
      if (!record) {
        return false;
      }

      await mutex.acquire();
      try {
        const root = await ensureWorktreeRoot();
        assertStrictDescendant(root, record.path);

        // git worktree remove
        try {
          await safeRunGit(["worktree", "remove", record.path, "--force"]);
        } catch (gitRemoveError) {
          // 如果 git 删除失败,尝试手动删除目录
          try {
            await removePathAndVerify(record.path, root);
            await safeRunGit(["worktree", "prune", "--expire", "now"]);
          } catch (fallbackError) {
            throw new Error(`Failed to remove worktree after git cleanup failed: ${fallbackError.message}`, {
              cause: gitRemoveError,
            });
          }
        }

        await assertWorktreeRemoved(record);

        // 可选:删除分支
        if ((deleteBranch ?? record.branchOwned) && record.branchOwned) {
          try {
            await safeRunGit(["branch", "-D", record.branch]);
          } catch (branchError) {
            throw new Error(`Failed to delete worktree branch ${record.branch}: ${branchError.message}`);
          }
        }

        worktrees.delete(id);
        stats.removed++;
        return true;
      } catch (err) {
        stats.failedRemoves++;
        throw err;
      } finally {
        mutex.release();
      }
    },

    /**
     * 在指定 worktree 中执行 git 命令
     * @param {string} id - worktree ID
     * @param {string[]} args - git 参数
     * @returns {Promise<{stdout: string, stderr: string}>}
     */
    async exec(id, args) {
      const record = worktrees.get(id);
      if (!record) {
        throw new Error(`Worktree '${id}' not found`);
      }
      return safeRunGit(args, record.path);
    },

    /**
     * 清理过期的 worktree(超过 maxAge)
     * @returns {Promise<number>} 清理的数量
     */
    async cleanupExpired() {
      const now = Date.now();
      let cleaned = 0;
      const orphanPathsRemoved = [];

      for (const [id, record] of worktrees) {
        if (now - record.createdAt > maxAge) {
          await this.remove(id);
          cleaned++;
        }
      }

      // 也清理磁盘上孤儿 worktree 目录
      const root = await ensureWorktreeRoot();
      const entries = await readdir(root);
      for (const entry of entries) {
        const entryPath = resolve(root, entry);
        assertStrictDescendant(root, entryPath, "orphan worktree path");
        const entryStat = await lstat(entryPath);
        if ((entryStat.isDirectory() || entryStat.isSymbolicLink()) && now - entryStat.mtimeMs > maxAge) {
          await removePathAndVerify(entryPath, root);
          orphanPathsRemoved.push(entryPath);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        await safeRunGit(["worktree", "prune", "--expire", "now"]);
        for (const removedPath of orphanPathsRemoved) {
          if (await isGitWorktreeRegistered(removedPath)) {
            throw new Error(`cleanup left stale git metadata for ${removedPath}`);
          }
        }
      }

      stats.cleanedExpired += cleaned;
      return cleaned;
    },

    /**
     * 清理所有 worktree
     * @returns {Promise<number>} 清理的数量
     */
    async removeAll() {
      const ids = Array.from(worktrees.keys());
      let cleaned = 0;
      for (const id of ids) {
        if (await this.remove(id)) {
          cleaned++;
        }
      }
      return cleaned;
    },

    /**
     * 获取 worktree 的 Git 状态
     * @param {string} id - worktree ID
     * @returns {Promise<Object>} { branch, clean, modified, untracked }
     */
    async getStatus(id) {
      const record = worktrees.get(id);
      if (!record) {
        throw new Error(`Worktree '${id}' not found`);
      }

      const { stdout } = await safeRunGit(["status", "--porcelain"], record.path);
      const lines = stdout.trim().split("\n").filter(Boolean);

      let modified = 0;
      let untracked = 0;
      for (const line of lines) {
        const flag = line.charAt(0);
        if (flag === "?") {
          untracked++;
        } else if (flag === "M" || flag === "A" || flag === "D" || flag === "R") {
          modified++;
        }
      }

      return {
        branch: record.branch,
        path: record.path,
        clean: lines.length === 0,
        modified,
        untracked,
      };
    },

    /**
     * 获取统计信息
     * @returns {Object} { created, removed, cleanedExpired, failedCreates, failedRemoves, active }
     */
    getStats() {
      return {
        ...stats,
        active: worktrees.size,
      };
    },
  };
}

// 默认导出工厂函数
export default createGitWorktree;
