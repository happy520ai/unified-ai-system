// =============================================================================
// 自进化管线编排器 (Self-Evolution Pipeline Orchestrator)
//
// 将完整的神经元生成流程串联起来：
// 用户输入 → AI理解 → 规格生成 → 代码生成 → 语法检查 → 安全检查 →
// 测试验证 → 审批门控 → 注册 → 可调用
//
// 依赖模块：
// - aiNeurogenesisCompiler  : AI 需求理解与规格编译
// - neuronCodeGenerator     : 神经元代码生成与验证
// - liveSkillRegistry       : 真实技能注册表
// - neuronRuntimeExecutor   : 神经元运行时执行器
// =============================================================================

import { rm, mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  sanitizeCapabilityId,
  now,
  withTimeout,
} from "./selfEvolutionPipelineUtils.js";
import { createEvolutionHistoryManager } from "./evolutionHistoryManager.js";
import { scanGeneratedCode } from "./safetyScanner.js";
import { executeEvolution } from "./evolutionExecutor.js";
import {
  stepCompile,
  stepGenerate,
  stepSyntaxCheck,
  stepSafetyCheck,
  stepTestVerify,
  stepApprovalGate,
  stepRegister,
} from "./pipelineSteps.js";

// ---------------------------------------------------------------------------
// 路径常量
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const GENERATED_CODE_DIR = join(ROOT, "capabilities", "_generated");
const EVOLUTION_HISTORY_DIR = join(ROOT, ".data", "capabilities", "evolution-history");

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const PIPELINE_VERSION = "self-evolution-pipeline-v1";
const PIPELINE_TIMEOUT_MS = 120000;

const EVOLUTION_STEPS = [
  "compile", "generate", "syntax_check", "safety_check",
  "test_verify", "approval_gate", "register",
];

// ---------------------------------------------------------------------------
// 工厂函数：创建自进化管线编排器
// ---------------------------------------------------------------------------

/**
 * 创建自进化管线编排器实例
 *
 * @param {Object} [options={}] - 配置选项
 * @param {Object} [options.compiler] - AI 神经发生编译器
 * @param {Object} [options.codeGenerator] - 神经元代码生成器
 * @param {Object} options.registry - 真实技能注册表（必需）
 * @param {Object} [options.executor] - 神经元运行时执行器
 * @param {boolean} [options.autoApprove=false] - 是否自动通过审批门控
 * @param {Function} [options.approvalFn] - 自定义审批函数
 * @param {string} [options.generatedCodeDir] - 生成代码的输出目录
 * @param {number} [options.pipelineTimeoutMs] - 管线总超时
 * @returns {Object} 管线编排器 API 对象
 */
export function createSelfEvolutionPipeline(options = {}) {
  const compiler = options.compiler || null;
  const codeGenerator = options.codeGenerator || null;
  const registry = options.registry;
  const executor = options.executor || null;
  const autoApprove = options.autoApprove !== undefined ? options.autoApprove : false;
  const approvalFn = options.approvalFn || null;
  const generatedCodeDir = options.generatedCodeDir || GENERATED_CODE_DIR;
  const pipelineTimeoutMs = options.pipelineTimeoutMs || PIPELINE_TIMEOUT_MS;

  if (!registry) {
    throw new Error("[selfEvolutionPipeline] registry option is required (provide a LiveSkillRegistry instance)");
  }

  const historyManager = createEvolutionHistoryManager();

  /** 管线上下文，传给 evolutionExecutor */
  const context = {
    compiler,
    codeGenerator,
    registry,
    autoApprove,
    approvalFn,
    generatedCodeDir,
    historyManager,
  };

  // -------------------------------------------------------------------------
  // 公开 API
  // -------------------------------------------------------------------------

  const api = {
    version: PIPELINE_VERSION,

    /**
     * 执行完整的自进化管线
     */
    async evolve(intakeText, evolveOptions = {}) {
      return await executeEvolution(intakeText, evolveOptions, context);
    },

    async listEvolutions(options = {}) {
      return await historyManager.listRecords(options);
    },

    async getEvolution(capabilityId) {
      return await historyManager.getRecord(capabilityId);
    },

    async getEvolutionStats() {
      return await historyManager.getStats();
    },

    async rollback(capabilityId, rollbackOptions = {}) {
      const startTime = Date.now();
      const reason = rollbackOptions.reason || "manual_rollback";

      const record = await historyManager.getRecord(capabilityId);
      const revokeResult = await registry.revoke(capabilityId, reason);

      let codeDeleted = false;
      if (rollbackOptions.deleteCode) {
        const codeDir = join(generatedCodeDir, sanitizeCapabilityId(capabilityId));
        try {
          await rm(codeDir, { recursive: true, force: true });
          codeDeleted = true;
        } catch {
          // 目录可能不存在
        }
      }

      if (record) {
        record.rolledBack = true;
        record.rolledBackAt = now();
        record.rollbackReason = reason;

        await mkdir(EVOLUTION_HISTORY_DIR, { recursive: true });
        const detailPath = join(EVOLUTION_HISTORY_DIR, `${capabilityId}.json`);
        await writeFile(detailPath, JSON.stringify(record, null, 2), "utf8");
      }

      return {
        success: revokeResult.success || revokeResult.error === "already_revoked",
        capabilityId,
        revoked: revokeResult.success,
        codeDeleted,
        reason,
        durationMs: Date.now() - startTime,
        completedAt: now(),
      };
    },

    getConfig() {
      return {
        version: PIPELINE_VERSION,
        hasCompiler: compiler !== null,
        hasCodeGenerator: codeGenerator !== null,
        hasExecutor: executor !== null,
        autoApprove,
        hasCustomApprovalFn: approvalFn !== null,
        generatedCodeDir,
        pipelineTimeoutMs,
        steps: EVOLUTION_STEPS,
      };
    },

    async getStatus() {
      const stats = await historyManager.getStats();
      return {
        status: "ready",
        config: api.getConfig(),
        history: stats,
        timestamp: now(),
      };
    },

    async executeStep(stepName, input) {
      switch (stepName) {
        case "compile":
          return await stepCompile(input.text || input, input.hints || {}, compiler);
        case "generate":
          return await stepGenerate(input, generatedCodeDir, codeGenerator);
        case "syntax_check":
          return await stepSyntaxCheck(input.filePath || input, codeGenerator);
        case "safety_check":
          return stepSafetyCheck(input.code || input, input.options || {}, codeGenerator);
        case "test_verify":
          return await stepTestVerify(input.spec || input, input.filePath, codeGenerator);
        case "approval_gate":
          return await stepApprovalGate(input.spec || input, input.safetyCheck || {}, autoApprove, approvalFn);
        case "register":
          return await stepRegister(input.spec || input, input.codeResult || input, registry);
        default:
          throw new Error(`Unknown pipeline step: "${stepName}". Valid steps: ${EVOLUTION_STEPS.join(", ")}`);
      }
    },

    scanCode(code, scanOptions = {}) {
      return scanGeneratedCode(code, scanOptions);
    },

    async evolveBatch(intakeTexts, batchOptions = {}) {
      const results = [];
      let successCount = 0;
      let failCount = 0;
      const batchStart = Date.now();

      for (const text of intakeTexts) {
        try {
          const result = await withTimeout(
            api.evolve(text, batchOptions),
            pipelineTimeoutMs,
            "evolve batch item",
          );
          results.push(result);
          if (result.success) successCount++;
          else failCount++;
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            intakeText: text.slice(0, 100),
          });
          failCount++;
        }
      }

      return {
        total: intakeTexts.length,
        successCount,
        failCount,
        results,
        batchDurationMs: Date.now() - batchStart,
        completedAt: now(),
      };
    },

    /**
     * 反馈循环：记录神经元执行结果，失败时触发重新进化
     *
     * @param {string} capabilityId - 神经元 ID
     * @param {object} executionResult - { success, output, error, durationMs }
     * @returns {Promise<object>} 反馈处理结果
     */
    async recordFeedback(capabilityId, executionResult) {
      const record = await historyManager.getRecord(capabilityId);
      if (!record) {
        return { recorded: false, reason: "neuron_not_found" };
      }

      // 初始化反馈统计
      if (!record.feedback) {
        record.feedback = { totalExecutions: 0, successes: 0, failures: 0, lastExecutedAt: null };
      }

      record.feedback.totalExecutions++;
      if (executionResult.success) {
        record.feedback.successes++;
      } else {
        record.feedback.failures++;
      }
      record.feedback.lastExecutedAt = now();

      // 计算失败率
      const failureRate = record.feedback.failures / record.feedback.totalExecutions;
      record.feedback.failureRate = failureRate;

      // 持久化更新
      const detailPath = join(EVOLUTION_HISTORY_DIR, `${capabilityId}.json`);
      await mkdir(EVOLUTION_HISTORY_DIR, { recursive: true });
      await writeFile(detailPath, JSON.stringify(record, null, 2), "utf8");

      // 高失败率自动降级
      const FAILURE_THRESHOLD = 0.5;
      const MIN_EXECUTIONS = 3;
      if (failureRate > FAILURE_THRESHOLD && record.feedback.totalExecutions >= MIN_EXECUTIONS) {
        try {
          await registry.revoke(capabilityId, `auto_degraded: failure rate ${Math.round(failureRate * 100)}% over ${record.feedback.totalExecutions} executions`);
          record.feedback.autoDegraded = true;
          await writeFile(detailPath, JSON.stringify(record, null, 2), "utf8");
          return {
            recorded: true,
            autoDegraded: true,
            failureRate,
            message: `Neuron ${capabilityId} auto-degraded: ${Math.round(failureRate * 100)}% failure rate`,
          };
        } catch {
          // 降级失败不阻塞
        }
      }

      return {
        recorded: true,
        autoDegraded: false,
        failureRate,
        totalExecutions: record.feedback.totalExecutions,
      };
    },
  };

  return api;
}
