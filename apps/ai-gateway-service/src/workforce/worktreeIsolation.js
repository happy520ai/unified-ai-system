/**
 * worktreeIsolation.js
 * 
 * Git Worktree 隔离模块
 * 
 * 功能：
 * - 为每个 Workforce 任务创建独立的 git worktree
 * - worktree 路径：.worktrees/{planId}-{timestamp}/
 * - 创建时从指定分支 checkout
 * - 任务完成后自动清理 worktree
 * - 支持并发隔离（多个任务同时在不同 worktree 中执行）
 * - 提供 cleanup 方法清理过期的 worktree
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";

const execFileAsync = promisify(execFile);

// 默认超时：60秒
const DEFAULT_TIMEOUT_MS = 60_000;

// 默认 worktree 根目录
const DEFAULT_WORKTREE_ROOT = ".worktrees";

// worktree 最大存活时间：24小时
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * 创建 Worktree 隔离管理器
 * @param {object} [options] - 配置选项
 * @param {string} [options.repoRoot] - Git 仓库根目录
 * @param {string} [options.worktreeRoot] - worktree 存放根目录
 * @param {number} [options.maxAge] - worktree 最大存活时间（毫秒）
 * @returns {object} Worktree 隔离管理器实例
 */
export function createWorktreeIsolation(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const worktreeRoot = options.worktreeRoot || DEFAULT_WORKTREE_ROOT;
  const maxAge = options.maxAge || DEFAULT_MAX_AGE_MS;

  // 已创建的 worktree 记录（内存中维护）
  const worktrees = new Map();

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "worktreeIsolation",
        version: "1.0.0",
        repoRoot,
        worktreeRoot,
        maxAge,
        activeWorktrees: worktrees.size,
        description: "Git Worktree 隔离模块：为每个任务创建独立的工作目录",
      };
    },

    /**
     * 为指定计划创建独立的 worktree
     * @param {object} params - 创建参数
     * @param {string} params.planId - 计划 ID
     * @param {string} [params.branch] - 源分支名称（默认使用当前 HEAD）
     * @param {string} [params.newBranch] - 新分支名称（默认自动生成）
     * @returns {Promise<object>} 创建结果
     */
    async create({ planId, branch, newBranch }) {
      if (!planId || typeof planId !== "string") {
        throw new Error("planId 是必填项");
      }

      const timestamp = Date.now();
      // Security: sanitize planId for git branch name (alphanumeric, dash, underscore only)
      const sanitizedPlanId = String(planId).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
      const safeBranchName = newBranch || `workforce/${sanitizedPlanId}-${timestamp}`;
      const worktreePath = resolve(repoRoot, worktreeRoot, `${planId}-${timestamp}`);

      // 确保 worktree 根目录存在
      await mkdir(resolve(repoRoot, worktreeRoot), { recursive: true });

      try {
        // 构建 git worktree add 命令
        const args = ["worktree", "add"];
        if (branch) {
          args.push("-b", safeBranchName, worktreePath, branch);
        } else {
          args.push("-b", safeBranchName, worktreePath, "HEAD");
        }

        await execFileAsync("git", args, {
          cwd: repoRoot,
          timeout: DEFAULT_TIMEOUT_MS,
        });

        // 记录 worktree 信息
        const record = {
          worktreeId: `wt_${planId}_${timestamp}`,
          planId,
          branch: safeBranchName,
          sourceBranch: branch || "HEAD",
          path: worktreePath,
          createdAt: new Date().toISOString(),
          status: "active",
        };
        worktrees.set(record.worktreeId, record);

        return {
          success: true,
          worktree: record,
          message: `Worktree 已创建: ${worktreePath}`,
        };
      } catch (error) {
        return {
          success: false,
          reason: `创建 worktree 失败: ${error.message}`,
          planId,
          worktreePath,
        };
      }
    },

    /**
     * 移除指定 worktree
     * @param {string} worktreeId - Worktree ID
     * @returns {Promise<object>} 移除结果
     */
    async remove(worktreeId) {
      const record = worktrees.get(worktreeId);
      if (!record) {
        return {
          success: false,
          reason: "未找到指定的 worktree 记录",
        };
      }

      try {
        // 使用 git worktree remove 清理
        await execFileAsync("git", ["worktree", "remove", record.path, "--force"], {
          cwd: repoRoot,
          timeout: DEFAULT_TIMEOUT_MS,
        });
      } catch {
        // 如果 git 命令失败，尝试直接删除目录
        try {
          await rm(record.path, { recursive: true, force: true });
        } catch {
          // 目录可能已不存在
        }
      }

      // 清理分支
      try {
        await execFileAsync("git", ["branch", "-D", record.branch], {
          cwd: repoRoot,
          timeout: DEFAULT_TIMEOUT_MS,
        });
      } catch {
        // 分支可能已不存在或已被使用
      }

      record.status = "removed";
      record.removedAt = new Date().toISOString();
      worktrees.delete(worktreeId);

      return {
        success: true,
        worktreeId,
        message: `Worktree 已移除: ${record.path}`,
      };
    },

    /**
     * 根据 planId 移除所有关联的 worktree
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 移除结果
     */
    async removeByPlanId(planId) {
      const toRemove = [...worktrees.entries()].filter(
        ([, record]) => record.planId === planId,
      );

      const results = [];
      for (const [id] of toRemove) {
        results.push(await this.remove(id));
      }

      return {
        success: true,
        planId,
        removedCount: results.filter((r) => r.success).length,
        results,
      };
    },

    /**
     * 列出所有活跃的 worktree
     * @returns {object} worktree 列表
     */
    list() {
      const active = [...worktrees.values()].filter((w) => w.status === "active");
      return {
        success: true,
        count: active.length,
        worktrees: active,
      };
    },

    /**
     * 查询指定 worktree 的状态
     * @param {string} worktreeId - Worktree ID
     * @returns {object} worktree 状态
     */
    getStatus(worktreeId) {
      const record = worktrees.get(worktreeId);
      if (!record) {
        return { success: false, reason: "未找到指定的 worktree 记录" };
      }
      return {
        success: true,
        worktree: record,
      };
    },

    /**
     * 清理过期的 worktree
     * @param {number} [maxAgeMs] - 覆盖默认的最大存活时间
     * @returns {Promise<object>} 清理结果
     */
    async cleanup(maxAgeMs) {
      const effectiveMaxAge = maxAgeMs || maxAge;
      const now = Date.now();
      const expired = [];

      for (const [id, record] of worktrees) {
        if (record.status !== "active") continue;
        const age = now - new Date(record.createdAt).getTime();
        if (age > effectiveMaxAge) {
          expired.push(id);
        }
      }

      const results = [];
      for (const id of expired) {
        results.push(await this.remove(id));
      }

      // 额外清理：扫描文件系统中遗留的 worktree 目录
      try {
        const rootPath = resolve(repoRoot, worktreeRoot);
        const entries = await readdir(rootPath).catch(() => []);
        for (const entry of entries) {
          const entryPath = join(rootPath, entry);
          try {
            const stats = await stat(entryPath);
            const age = now - stats.mtimeMs;
            if (age > effectiveMaxAge) {
              // 尝试通过 git 移除
              try {
                await execFileAsync("git", ["worktree", "remove", entryPath, "--force"], {
                  cwd: repoRoot,
                  timeout: DEFAULT_TIMEOUT_MS,
                });
              } catch {
                await rm(entryPath, { recursive: true, force: true }).catch(() => {});
              }
              results.push({ success: true, path: entryPath, cleanedFromDisk: true });
            }
          } catch {
            // 忽略
          }
        }
      } catch {
        // worktree 根目录不存在时忽略
      }

      // 执行 git worktree prune 清理过期记录
      try {
        await execFileAsync("git", ["worktree", "prune"], {
          cwd: repoRoot,
          timeout: DEFAULT_TIMEOUT_MS,
        });
      } catch {
        // 忽略
      }

      return {
        success: true,
        expiredCount: expired.length,
        totalCleaned: results.length,
        results,
      };
    },
  };
}
