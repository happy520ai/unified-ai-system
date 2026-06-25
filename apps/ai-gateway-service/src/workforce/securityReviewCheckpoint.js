/**
 * securityReviewCheckpoint.js
 * 
 * 安全审查检查点模块
 * 
 * 功能：
 * - 在每个 Agent 执行前后进行安全检查
 * - 检查项：
 *   - 输出中是否包含 API Key 或密钥
 *   - 是否尝试访问禁止的路径（.ssh, .aws 等）
 *   - 是否尝试执行危险命令
 *   - 输出大小是否异常（>1MB 可能表示数据泄露）
 *   - 是否尝试修改 .git 配置
 * - 检查结果：pass / warn / block
 * - block 时阻止执行并记录安全事件
 * - 所有检查结果记录到审计日志
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CHECK_RESULT,
  FORBIDDEN_PATHS,
  DANGEROUS_COMMANDS,
  DEFAULT_AUDIT_LOG_DIR,
  MAX_OUTPUT_SIZE_BYTES,
  checkForSecrets,
  checkForForbiddenPaths,
  checkForDangerousCommands,
  createAuditEntry,
  writeAuditLog,
} from "./securityReviewCheckpointHelpers.js";

// 重新导出枚举值供外部使用
export { CHECK_RESULT };

/**
 * 创建安全审查检查点
 * @param {object} [options] - 配置选项
 * @param {string} [options.auditLogDir] - 审计日志目录
 * @param {boolean} [options.strictMode] - 严格模式（warn 升级为 block）
 * @param {string[]} [options.additionalForbiddenPaths] - 额外的禁止路径
 * @param {string[]} [options.additionalDangerousCommands] - 额外的危险命令
 * @returns {object} 安全审查检查点实例
 */
export function createSecurityReviewCheckpoint(options = {}) {
  const auditLogDir = options.auditLogDir || DEFAULT_AUDIT_LOG_DIR;
  const strictMode = options.strictMode !== false;

  // 合并自定义禁止路径
  const allForbiddenPaths = [
    ...FORBIDDEN_PATHS,
    ...(options.additionalForbiddenPaths || []).map((p) => new RegExp(p, "i")),
  ];

  // 合并自定义危险命令
  const allDangerousCommands = [
    ...DANGEROUS_COMMANDS,
    ...(options.additionalDangerousCommands || []).map((p) => new RegExp(p, "i")),
  ];

  return {
    /**
     * 获取模块信息
     */
    getInfo() {
      return {
        module: "securityReviewCheckpoint",
        version: "1.0.0",
        auditLogDir,
        strictMode,
        forbiddenPathPatterns: allForbiddenPaths.length,
        dangerousCommandPatterns: allDangerousCommands.length,
        description: "安全审查检查点模块：Agent 执行前后的安全检查",
      };
    },

    /**
     * Agent 执行前的安全检查
     * @param {object} params - 检查参数
     * @param {string} params.planId - 计划 ID
     * @param {string} params.agentId - Agent ID
     * @param {string} params.goal - 任务目标
     * @param {object} [params.context] - 任务上下文
     * @returns {Promise<object>} 检查结果
     */
    async preExecutionCheck({ planId, agentId, goal, context = {} }) {
      const checks = [];
      let overallResult = CHECK_RESULT.PASS;

      // 检查 1：目标文本中是否包含敏感信息
      const goalSecretCheck = checkForSecrets(String(goal || ""), "goal");
      checks.push(goalSecretCheck);
      if (goalSecretCheck.result === CHECK_RESULT.BLOCK) {
        overallResult = CHECK_RESULT.BLOCK;
      } else if (goalSecretCheck.result === CHECK_RESULT.WARN && overallResult !== CHECK_RESULT.BLOCK) {
        overallResult = CHECK_RESULT.WARN;
      }

      // 检查 2：上下文中是否包含敏感路径
      if (context) {
        const contextStr = JSON.stringify(context);
        const pathCheck = checkForForbiddenPaths(contextStr, allForbiddenPaths);
        checks.push(pathCheck);
        if (pathCheck.result === CHECK_RESULT.BLOCK) {
          overallResult = CHECK_RESULT.BLOCK;
        }
      }

      // 检查 3：上下文中是否包含危险命令
      if (context) {
        const contextStr = JSON.stringify(context);
        const cmdCheck = checkForDangerousCommands(contextStr, allDangerousCommands);
        checks.push(cmdCheck);
        if (cmdCheck.result === CHECK_RESULT.BLOCK) {
          overallResult = CHECK_RESULT.BLOCK;
        }
      }

      // 严格模式下 warn 升级为 block
      if (strictMode && overallResult === CHECK_RESULT.WARN) {
        overallResult = CHECK_RESULT.BLOCK;
      }

      // 记录审计日志
      const auditEntry = createAuditEntry({
        planId,
        agentId,
        checkpoint: "pre_execution",
        result: overallResult,
        checks,
      });
      await writeAuditLog(auditLogDir, planId, auditEntry);

      return {
        success: true,
        result: overallResult,
        blocked: overallResult === CHECK_RESULT.BLOCK,
        planId,
        agentId,
        checkpoint: "pre_execution",
        checks,
        message: overallResult === CHECK_RESULT.PASS
          ? "安全检查通过"
          : overallResult === CHECK_RESULT.WARN
            ? "安全检查存在警告"
            : "安全检查未通过，执行已被阻止",
      };
    },

    /**
     * Agent 执行后的安全检查
     * @param {object} params - 检查参数
     * @param {string} params.planId - 计划 ID
     * @param {string} params.agentId - Agent ID
     * @param {object} [params.output] - Agent 输出
     * @param {string} [params.outputText] - Agent 输出文本
     * @param {string[]} [params.commandsRun] - 执行的命令列表
     * @param {string[]} [params.filesChanged] - 变更的文件列表
     * @returns {Promise<object>} 检查结果
     */
    async postExecutionCheck({ planId, agentId, output = {}, outputText = "", commandsRun = [], filesChanged = [] }) {
      const checks = [];
      let overallResult = CHECK_RESULT.PASS;

      // 检查 1：输出中是否包含 API Key 或密钥
      const outputStr = outputText || JSON.stringify(output);
      const secretCheck = checkForSecrets(outputStr, "output");
      checks.push(secretCheck);
      upgradeResult(secretCheck.result);

      // 检查 2：变更文件中是否包含敏感路径
      for (const file of filesChanged) {
        const pathCheck = checkForForbiddenPaths(file, allForbiddenPaths);
        if (pathCheck.result !== CHECK_RESULT.PASS) {
          checks.push({ ...pathCheck, file });
          upgradeResult(pathCheck.result);
        }
      }

      // 检查 3：执行的命令中是否包含危险命令
      for (const cmd of commandsRun) {
        const cmdCheck = checkForDangerousCommands(cmd, allDangerousCommands);
        if (cmdCheck.result !== CHECK_RESULT.PASS) {
          checks.push({ ...cmdCheck, command: cmd });
          upgradeResult(cmdCheck.result);
        }
      }

      // 检查 4：输出大小是否异常
      const outputSize = Buffer.byteLength(outputStr, "utf8");
      if (outputSize > MAX_OUTPUT_SIZE_BYTES) {
        checks.push({
          name: "output_size",
          result: CHECK_RESULT.WARN,
          message: `输出大小异常: ${(outputSize / 1024 / 1024).toFixed(2)}MB（可能表示数据泄露）`,
          details: { sizeBytes: outputSize, limitBytes: MAX_OUTPUT_SIZE_BYTES },
        });
        upgradeResult(CHECK_RESULT.WARN);
      } else {
        checks.push({
          name: "output_size",
          result: CHECK_RESULT.PASS,
          message: `输出大小正常: ${(outputSize / 1024).toFixed(1)}KB`,
        });
      }

      // 检查 5：是否尝试修改 .git 配置
      const gitConfigChanges = filesChanged.filter((f) => /\.git\/(config|hooks)/.test(f));
      if (gitConfigChanges.length > 0) {
        checks.push({
          name: "git_config_modification",
          result: CHECK_RESULT.BLOCK,
          message: `检测到 .git 配置修改: ${gitConfigChanges.join(", ")}`,
          details: { files: gitConfigChanges },
        });
        upgradeResult(CHECK_RESULT.BLOCK);
      }

      // 严格模式下 warn 升级为 block
      if (strictMode && overallResult === CHECK_RESULT.WARN) {
        overallResult = CHECK_RESULT.BLOCK;
      }

      // 记录审计日志
      const auditEntry = createAuditEntry({
        planId,
        agentId,
        checkpoint: "post_execution",
        result: overallResult,
        checks,
      });
      await writeAuditLog(auditLogDir, planId, auditEntry);

      return {
        success: true,
        result: overallResult,
        blocked: overallResult === CHECK_RESULT.BLOCK,
        planId,
        agentId,
        checkpoint: "post_execution",
        checks,
        outputSizeBytes: outputSize,
        message: overallResult === CHECK_RESULT.PASS
          ? "安全检查通过"
          : overallResult === CHECK_RESULT.WARN
            ? "安全检查存在警告"
            : "安全检查未通过，结果已被标记",
      };

      // 内部辅助：升级整体结果
      function upgradeResult(checkResult) {
        if (checkResult === CHECK_RESULT.BLOCK) {
          overallResult = CHECK_RESULT.BLOCK;
        } else if (checkResult === CHECK_RESULT.WARN && overallResult !== CHECK_RESULT.BLOCK) {
          overallResult = CHECK_RESULT.WARN;
        }
      }
    },

    /**
     * 查询指定计划的审计日志
     * @param {string} planId - 计划 ID
     * @returns {Promise<object>} 审计日志
     */
    async getAuditLog(planId) {
      try {
        const logPath = resolve(auditLogDir, `${planId.trim()}.json`);
        const content = await readFile(logPath, "utf8");
        const entries = JSON.parse(content);
        return {
          success: true,
          planId: planId.trim(),
          entryCount: Array.isArray(entries) ? entries.length : 0,
          entries: Array.isArray(entries) ? entries : [],
        };
      } catch (error) {
        if (error?.code === "ENOENT") {
          return { success: true, planId: planId.trim(), entryCount: 0, entries: [] };
        }
        throw error;
      }
    },

    /**
     * 对任意文本执行安全扫描（不记录审计日志）
     * @param {string} text - 待扫描文本
     * @returns {object} 扫描结果
     */
    scan(text) {
      const checks = [];
      let overallResult = CHECK_RESULT.PASS;

      const secretCheck = checkForSecrets(text, "scan");
      checks.push(secretCheck);

      const pathCheck = checkForForbiddenPaths(text, allForbiddenPaths);
      checks.push(pathCheck);

      const cmdCheck = checkForDangerousCommands(text, allDangerousCommands);
      checks.push(cmdCheck);

      for (const check of checks) {
        if (check.result === CHECK_RESULT.BLOCK) {
          overallResult = CHECK_RESULT.BLOCK;
          break;
        }
        if (check.result === CHECK_RESULT.WARN && overallResult !== CHECK_RESULT.BLOCK) {
          overallResult = CHECK_RESULT.WARN;
        }
      }

      return {
        result: overallResult,
        checks,
      };
    },

    // 导出枚举值供外部使用
    CHECK_RESULT,
  };
}
