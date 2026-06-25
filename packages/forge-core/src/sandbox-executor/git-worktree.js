/**
 * git-worktree.js — Forge-core Git Worktree 隔离模块
 *
 * 为 Forge 任务执行提供隔离的 Git 工作树环境。
 * 每个任务在自己的 worktree 中运行,避免并发冲突。
 *
 * 设计参考: apps/ai-gateway-service/src/workforce/worktreeIsolation.js
 * 适配 Forge-core 的模块风格(无类继承,工厂函数导出)
 */

import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm, readdir, stat, access } from "node:fs/promises";
import { rmSync } from "node:fs";
import { resolve, join } from "node:path";

const execFileAsync = promisify(execFile);

// 默认超时:60 秒
const DEFAULT_TIMEOUT_MS = 60_000;

// 默认 worktree 根目录
const DEFAULT_WORKTREE_ROOT = ".worktrees";

// worktree 最大存活时间:24 小时
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * 执行 git 命令
 * @param {string[]} args - git 参数
 * @param {string} cwd - 工作目录
 * @param {number} timeoutMs - 超时毫秒
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function runGit(args, cwd, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return execFileAsync("git", args, { cwd, timeout: timeoutMs });
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
 * @param {boolean} [options.autoCleanupOnExit=true] - 进程退出时自动清理
 * @returns {Object} Worktree 管理器实例
 */
export function createGitWorktree(options = {}) {
  // ── Private fields(闭包封装)──
  const repoRoot = resolve(options.repoRoot || process.cwd());
  const worktreeRoot = options.worktreeRoot || DEFAULT_WORKTREE_ROOT;
  const maxAge = options.maxAge || DEFAULT_MAX_AGE_MS;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const autoCleanupOnExit = options.autoCleanupOnExit !== false;

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

  let exitHandlerRegistered = false;
  let exitHandler = null;

  /**
   * 确保 worktree 根目录存在
   */
  async function ensureWorktreeRoot() {
    const absRoot = resolve(repoRoot, worktreeRoot);
    await mkdir(absRoot, { recursive: true });
    return absRoot;
  }

  /**
   * 检查路径是否存在
   */
  async function exists(p) {
    try {
      await access(p);
      return true;
    } catch {
      return false;
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
      if (!id) {
        throw new Error("git-worktree.create requires an 'id' parameter");
      }

      // 如果已存在,返回已有的
      if (worktrees.has(id)) {
        return worktrees.get(id);
      }

      await mutex.acquire();
      try {
        const root = await ensureWorktreeRoot();
        const branch = branchName || `forge/${id}`;
        const wtPath = join(root, id);

        // 如果目录已存在,先清理
        if (await exists(wtPath)) {
          await rm(wtPath, { recursive: true, force: true });
        }

        // 创建 worktree
        const gitArgs = ["worktree", "add", "-b", branch];
        if (baseBranch) {
          gitArgs.push(wtPath, baseBranch);
        } else {
          gitArgs.push(wtPath);
        }

        try {
          await runGit(gitArgs, repoRoot, timeoutMs);
        } catch (err) {
          // 如果分支已存在,尝试不创建新分支
          if (err.stderr && err.stderr.includes("already exists")) {
            await runGit(["worktree", "add", wtPath, branch], repoRoot, timeoutMs);
          } else {
            stats.failedCreates++;
            throw new Error(`Failed to create worktree: ${err.message}`);
          }
        }

        const record = {
          id,
          path: wtPath,
          branch,
          createdAt: Date.now(),
        };
        worktrees.set(id, record);
        stats.created++;

        // 注册进程退出清理钩子(仅一次)
        if (autoCleanupOnExit && !exitHandlerRegistered) {
          exitHandler = () => {
            // 同步清理:尽量删除 worktree 目录
            for (const rec of worktrees.values()) {
              try {
                execFileSync("git", ["worktree", "remove", rec.path, "--force"], { cwd: repoRoot, stdio: "ignore", timeout: 5000 });
              } catch {
                try { rmSync(rec.path, { recursive: true, force: true }); } catch { /* ignore */ }
              }
            }
          };
          process.on("exit", exitHandler);
          process.on("SIGINT", () => { if (exitHandler) exitHandler(); process.exit(0); });
          process.on("SIGTERM", () => { if (exitHandler) exitHandler(); process.exit(0); });
          exitHandlerRegistered = true;
        }

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
     * @param {boolean} [deleteBranch=false] - 是否同时删除分支
     * @returns {Promise<boolean>} 是否成功删除
     */
    async remove(id, deleteBranch = false) {
      const record = worktrees.get(id);
      if (!record) {
        return false;
      }

      await mutex.acquire();
      try {
        // git worktree remove
        try {
          await runGit(["worktree", "remove", record.path, "--force"], repoRoot, timeoutMs);
        } catch {
          // 如果 git 删除失败,尝试手动删除目录
          try {
            await rm(record.path, { recursive: true, force: true });
          } catch {
            // 忽略
          }
        }

        // 可选:删除分支
        if (deleteBranch) {
          try {
            await runGit(["branch", "-D", record.branch], repoRoot, timeoutMs);
          } catch {
            // 忽略分支删除失败
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
      return runGit(args, record.path, timeoutMs);
    },

    /**
     * 清理过期的 worktree(超过 maxAge)
     * @returns {Promise<number>} 清理的数量
     */
    async cleanupExpired() {
      const now = Date.now();
      let cleaned = 0;

      for (const [id, record] of worktrees) {
        if (now - record.createdAt > maxAge) {
          await this.remove(id, true);
          cleaned++;
        }
      }

      // 也清理磁盘上孤儿 worktree 目录
      try {
        const root = resolve(repoRoot, worktreeRoot);
        if (await exists(root)) {
          const entries = await readdir(root);
          for (const entry of entries) {
            const entryPath = join(root, entry);
            const entryStat = await stat(entryPath);
            if (entryStat.isDirectory() && now - entryStat.mtimeMs > maxAge) {
              await rm(entryPath, { recursive: true, force: true });
              cleaned++;
            }
          }
        }
      } catch {
        // 忽略磁盘清理错误
      }

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
        if (await this.remove(id, true)) {
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

      const { stdout } = await runGit(["status", "--porcelain"], record.path, timeoutMs);
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
