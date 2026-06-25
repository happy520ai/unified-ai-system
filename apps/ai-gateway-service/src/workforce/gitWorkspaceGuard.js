/**
 * gitWorkspaceGuard.js
 * 
 * Git 工作区检查模块
 * 
 * 功能：
 * - 检查当前 git 工作区是否干净（无未提交更改）
 * - 检查是否在正确的分支上
 * - 如果工作区不干净，阻止执行并报告哪些文件有更改
 * - 使用 child_process 调用 git 命令
 * - 提供 force 选项跳过检查（需显式确认）
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// 默认超时：30秒
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * 创建 Git 工作区守卫
 * @param {object} [options] - 配置选项
 * @param {string} [options.cwd] - 工作目录路径
 * @param {string} [options.requiredBranch] - 要求的分支名称
 * @param {boolean} [options.strictMode] - 严格模式（默认 true）
 * @returns {object} Git 工作区守卫实例
 */
export function createGitWorkspaceGuard(options = {}) {
  const cwd = options.cwd || process.cwd();
  const requiredBranch = options.requiredBranch || null;
  const strictMode = options.strictMode !== false;

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "gitWorkspaceGuard",
        version: "1.0.0",
        cwd,
        requiredBranch,
        strictMode,
        description: "Git 工作区检查模块：确保执行前工作区处于安全状态",
      };
    },

    /**
     * 执行完整的 Git 工作区检查
     * @param {object} [checkOptions] - 检查选项
     * @param {boolean} [checkOptions.force] - 强制跳过检查（需确认）
     * @param {string} [checkOptions.forceReason] - 强制跳过原因
     * @param {string} [checkOptions.branch] - 临时覆盖所需分支
     * @returns {Promise<object>} 检查结果
     */
    async check(checkOptions = {}) {
      // 强制跳过检查
      if (checkOptions.force) {
        if (!checkOptions.forceReason) {
          return {
            success: false,
            clean: false,
            blocked: true,
            reason: "强制跳过检查必须提供 forceReason",
          };
        }
        return {
          success: true,
          clean: true,
          blocked: false,
          forceSkipped: true,
          forceReason: String(checkOptions.forceReason).trim(),
          warning: "Git 工作区检查已被强制跳过，执行安全性不由本模块保证",
        };
      }

      const checks = [];
      let overallClean = true;

      // 检查 1：是否是 Git 仓库
      const isGitRepo = await checkIsGitRepository(cwd);
      checks.push({
        name: "isGitRepository",
        passed: isGitRepo.passed,
        message: isGitRepo.message,
        required: true,
      });
      if (!isGitRepo.passed) {
        return createBlockedResult(checks, "当前目录不是 Git 仓库");
      }

      // 检查 2：工作区是否干净
      const workspaceStatus = await checkWorkspaceStatus(cwd);
      checks.push({
        name: "cleanWorkspace",
        passed: workspaceStatus.passed,
        message: workspaceStatus.message,
        required: true,
        details: workspaceStatus.details,
      });
      if (!workspaceStatus.passed) {
        overallClean = false;
      }

      // 检查 3：分支检查
      const branchName = checkOptions.branch || requiredBranch;
      if (branchName) {
        const branchCheck = await checkCurrentBranch(cwd, branchName);
        checks.push({
          name: "correctBranch",
          passed: branchCheck.passed,
          message: branchCheck.message,
          required: strictMode,
          details: branchCheck.details,
        });
        if (!branchCheck.passed && strictMode) {
          overallClean = false;
        }
      }

      // 检查 4：是否有未追踪的大文件
      const untrackedCheck = await checkUntrackedFiles(cwd);
      checks.push({
        name: "untrackedFiles",
        passed: untrackedCheck.passed,
        message: untrackedCheck.message,
        required: false,
        details: untrackedCheck.details,
      });

      if (!overallClean) {
        return createBlockedResult(checks, "Git 工作区不干净，请先提交或暂存所有更改");
      }

      return {
        success: true,
        clean: true,
        blocked: false,
        checks,
        message: "Git 工作区检查通过",
      };
    },

    /**
     * 获取当前 Git 状态摘要
     * @returns {Promise<object>} Git 状态摘要
     */
    async getGitStatus() {
      try {
        const { stdout: branchOut } = await execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
        const { stdout: statusOut } = await execGit(cwd, ["status", "--porcelain"]);
        const { stdout: logOut } = await execGit(cwd, ["log", "--oneline", "-5"]);

        return {
          success: true,
          branch: branchOut.trim(),
          dirtyFiles: statusOut.trim() ? statusOut.trim().split("\n") : [],
          recentCommits: logOut.trim() ? logOut.trim().split("\n") : [],
          isClean: !statusOut.trim(),
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          message: "无法获取 Git 状态信息",
        };
      }
    },
  };
}

// ---- 内部检查函数 ----

/**
 * 检查是否为 Git 仓库
 */
async function checkIsGitRepository(cwd) {
  try {
    await execGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return { passed: true, message: "当前目录是 Git 仓库" };
  } catch {
    return { passed: false, message: "当前目录不是 Git 仓库" };
  }
}

/**
 * 检查工作区是否干净
 */
async function checkWorkspaceStatus(cwd) {
  try {
    const { stdout } = await execGit(cwd, ["status", "--porcelain"]);
    const lines = stdout.trim() ? stdout.trim().split("\n") : [];

    if (lines.length === 0) {
      return {
        passed: true,
        message: "工作区干净，无未提交更改",
        details: { modifiedFiles: [], stagedFiles: [], untrackedFiles: [] },
      };
    }

    // 分类文件状态
    const modifiedFiles = [];
    const stagedFiles = [];
    const untrackedFiles = [];

    for (const line of lines) {
      const status = line.slice(0, 2).trim();
      const file = line.slice(3).trim();

      if (status === "??") {
        untrackedFiles.push(file);
      } else if (status.startsWith("M") || status.startsWith("D") || status.startsWith("R")) {
        if (line[0] !== " ") {
          stagedFiles.push(file);
        }
        if (line[1] !== " " && line[1] !== "") {
          modifiedFiles.push(file);
        }
      } else {
        stagedFiles.push(file);
      }
    }

    return {
      passed: false,
      message: `工作区不干净：${lines.length} 个文件有更改`,
      details: {
        modifiedFiles,
        stagedFiles,
        untrackedFiles,
        totalDirty: lines.length,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `检查工作区状态失败: ${error.message}`,
      details: { error: error.message },
    };
  }
}

/**
 * 检查当前分支
 */
async function checkCurrentBranch(cwd, expectedBranch) {
  try {
    const { stdout } = await execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const currentBranch = stdout.trim();

    if (currentBranch === expectedBranch) {
      return {
        passed: true,
        message: `当前分支正确: ${currentBranch}`,
        details: { currentBranch, expectedBranch },
      };
    }

    return {
      passed: false,
      message: `当前分支为 ${currentBranch}，期望分支为 ${expectedBranch}`,
      details: { currentBranch, expectedBranch },
    };
  } catch (error) {
    return {
      passed: false,
      message: `检查分支失败: ${error.message}`,
      details: { error: error.message },
    };
  }
}

/**
 * 检查未追踪文件
 */
async function checkUntrackedFiles(cwd) {
  try {
    const { stdout } = await execGit(cwd, ["ls-files", "--others", "--exclude-standard"]);
    const files = stdout.trim() ? stdout.trim().split("\n") : [];

    if (files.length === 0) {
      return {
        passed: true,
        message: "无未追踪文件",
        details: { untrackedFiles: [], count: 0 },
      };
    }

    return {
      passed: true, // 未追踪文件不是阻塞条件
      message: `存在 ${files.length} 个未追踪文件`,
      details: { untrackedFiles: files.slice(0, 50), count: files.length },
    };
  } catch (error) {
    return {
      passed: true,
      message: `检查未追踪文件失败: ${error.message}`,
      details: { error: error.message },
    };
  }
}

// ---- 辅助函数 ----

/**
 * 执行 git 命令
 */
async function execGit(cwd, args) {
  return execFileAsync("git", args, {
    cwd,
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });
}

/**
 * 创建阻塞结果
 */
function createBlockedResult(checks, reason) {
  return {
    success: true,
    clean: false,
    blocked: true,
    reason,
    checks,
    recommendation: "请先提交或暂存所有更改后再执行 Workforce 计划",
  };
}
