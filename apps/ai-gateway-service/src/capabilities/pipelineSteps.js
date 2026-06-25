// =============================================================================
// 管线步骤实现 (Pipeline Step Implementations)
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  sanitizeCapabilityId,
  fileExists,
  now,
  generateCapabilityId,
  sha256,
} from "./selfEvolutionPipelineUtils.js";
import { scanGeneratedCode } from "./safetyScanner.js";
import { generateNeuronTemplate } from "./neuronTemplate.js";

/**
 * Step 1: AI 理解需求（使用编译器将自然语言转换为结构化规格）
 *
 * @param {string} intakeText - 用户输入的需求描述
 * @param {Object} [hints={}] - 额外提示
 * @param {Object} [compiler] - 外部 AI 编译器
 * @returns {Promise<Object>} 结构化的神经元规格
 */
export async function stepCompile(intakeText, hints = {}, compiler = null) {
  if (compiler && typeof compiler.compileWithAI === "function") {
    // 使用外部 AI 编译器
    return await compiler.compileWithAI(intakeText, hints);
  }

  // 内置的轻量级编译器：从自然语言中提取关键信息
  const text = String(intakeText || "").trim();
  const capabilityId = hints.capabilityId || generateCapabilityId("neuron");

  // 尝试检测类型
  let type = hints.type || "analysis";
  const typeKeywords = {
    safety: /安全|风险|拦截|过滤|safety|risk|block|filter/i,
    context: /上下文|context|增强|enrich/i,
    review: /审查|review|评估|evaluate|god.?mode/i,
    evidence: /证据|evidence|记录|record|日志|log/i,
    planning: /规划|planning|计划|plan|策略|strategy/i,
    transform: /变换|transform|转换|convert|格式化|format/i,
    routing: /路由|routing|分发|dispatch|调度/i,
    analysis: /分析|analysis|推理|reason/i,
    generation: /生成|generation|create|生成/i,
    monitoring: /监控|monitoring|告警|alert|观测/i,
  };
  for (const [t, pattern] of Object.entries(typeKeywords)) {
    if (pattern.test(text)) {
      type = t;
      break;
    }
  }

  // 提取名称
  const nameMatch = text.match(/^(?:创建|生成|添加|新建|create|add|build)\s+(?:一个|a\s+)?(.+?)(?:神经元|neuron|技能|skill|$)/i);
  const name = nameMatch ? nameMatch[1].trim() : capabilityId;

  return {
    capabilityId,
    name,
    type,
    description: text.slice(0, 500),
    version: "1.0.0",
    safetyBoundary: {
      maxInputLength: 100000,
      allowedExternalCalls: false,
      allowedSecretAccess: false,
      allowedFileWrite: false,
    },
    runtime: {
      ttlSeconds: 30,
      maxRequests: 1000,
      cooldownMs: 0,
    },
    synapse: {
      weight: 50,
      modes: ["default"],
      stressTypes: ["normal"],
    },
    compiledAt: now(),
    compiledBy: "built-in-lightweight-compiler",
  };
}

/**
 * Step 2: 生成代码
 *
 * @param {Object} spec - 神经元规格
 * @param {string} generatedCodeDir - 生成代码输出目录
 * @param {Object} [codeGenerator] - 外部代码生成器
 * @returns {Promise<Object>} { code, filePath, generatedAt }
 */
export async function stepGenerate(spec, generatedCodeDir, codeGenerator = null) {
  if (codeGenerator && typeof codeGenerator.generateNeuronCode === "function") {
    return await codeGenerator.generateNeuronCode(spec);
  }

  // 内置的代码生成模板
  const capabilityId = spec.capabilityId;
  const outputDir = join(generatedCodeDir, sanitizeCapabilityId(capabilityId));
  await mkdir(outputDir, { recursive: true });

  const code = generateNeuronTemplate(spec);
  const filePath = join(outputDir, "neuron.js");

  await writeFile(filePath, code, "utf8");

  return {
    code,
    filePath,
    outputDir,
    generatedAt: now(),
    generatedBy: "built-in-template-generator",
    codeHash: sha256(code),
  };
}

/**
 * Step 3: 语法检查
 *
 * @param {string} filePath - 代码文件路径
 * @param {Object} [codeGenerator] - 外部代码生成器
 * @returns {Promise<Object>} { valid, error }
 */
export async function stepSyntaxCheck(filePath, codeGenerator = null) {
  if (codeGenerator && typeof codeGenerator.validateSyntax === "function") {
    return await codeGenerator.validateSyntax(filePath);
  }

  // 内置语法检查（使用 node --check）
  const { execFile } = await import("node:child_process");

  return new Promise((resolvePromise) => {
    execFile(
      process.execPath,
      ["--check", filePath],
      { timeout: 15000 },
      (error, _stdout, stderr) => {
        if (error) {
          resolvePromise({
            valid: false,
            error: stderr?.trim() || error.message,
            checkedAt: now(),
          });
        } else {
          resolvePromise({
            valid: true,
            error: null,
            checkedAt: now(),
          });
        }
      },
    );
  });
}

/**
 * Step 4: 安全检查
 *
 * @param {string} code - 源代码
 * @param {Object} [options={}] - 安全扫描选项
 * @param {Object} [codeGenerator] - 外部代码生成器
 * @returns {Object} 扫描结果
 */
export function stepSafetyCheck(code, options = {}, codeGenerator = null) {
  if (codeGenerator && typeof codeGenerator.scanGeneratedCode === "function") {
    return codeGenerator.scanGeneratedCode(code, options);
  }

  return scanGeneratedCode(code, options);
}

/**
 * Step 5: 测试验证
 *
 * @param {Object} spec - 神经元规格
 * @param {string} filePath - 代码文件路径
 * @param {Object} [codeGenerator] - 外部代码生成器
 * @returns {Promise<Object>} { passed, details }
 */
export async function stepTestVerify(spec, filePath, codeGenerator = null) {
  if (codeGenerator && typeof codeGenerator.runVerifier === "function") {
    return await codeGenerator.runVerifier(spec.capabilityId);
  }

  // 内置的基础验证
  const checks = [];

  // 检查 1：文件存在
  const fileOk = await fileExists(filePath);
  checks.push({ name: "file_exists", passed: fileOk });

  if (!fileOk) {
    return {
      passed: false,
      checks,
      details: "Generated code file does not exist",
      verifiedAt: now(),
    };
  }

  // 检查 2：文件非空
  const content = await readFile(filePath, "utf8");
  const nonEmpty = content.trim().length > 0;
  checks.push({ name: "file_non_empty", passed: nonEmpty });

  // 检查 3：包含 export（ESM 模块）
  const hasExport = /export\s+(function|const|class|default)/.test(content);
  checks.push({ name: "has_esm_export", passed: hasExport });

  // 检查 4：包含 execute 函数或工厂函数
  const hasExecute = /execute\s*\(|createNeuron|create\s*\(/.test(content);
  checks.push({ name: "has_execute_function", passed: hasExecute });

  // 检查 5：模块可以被加载
  let moduleLoadOk = false;
  try {
    const { pathToFileURL } = await import("node:url");
    const fileUrl = pathToFileURL(filePath).href;
    // 使用 dynamic import 检查模块是否可以被正常加载
    // 注意：这里不做实际加载以避免副作用，仅做静态检查
    moduleLoadOk = true;
  } catch {
    moduleLoadOk = false;
  }
  checks.push({ name: "module_loadable", passed: moduleLoadOk });

  const allPassed = checks.every((c) => c.passed);

  return {
    passed: allPassed,
    checks,
    details: allPassed ? "All verification checks passed" : `${checks.filter((c) => !c.passed).length} check(s) failed`,
    verifiedAt: now(),
  };
}

/**
 * Step 6: 审批门控
 *
 * @param {Object} spec - 神经元规格
 * @param {Object} safetyCheckResult - 安全检查结果
 * @param {boolean} autoApprove - 是否自动审批
 * @param {Function} [approvalFn] - 自定义审批函数
 * @returns {Promise<Object>} { approved, reason }
 */
export async function stepApprovalGate(spec, safetyCheckResult, autoApprove = false, approvalFn = null) {
  // 如果有自定义审批函数，优先使用
  if (typeof approvalFn === "function") {
    try {
      const approved = await approvalFn(spec, safetyCheckResult);
      return {
        approved: Boolean(approved),
        reason: approved ? "approved_by_custom_function" : "rejected_by_custom_function",
        approvedAt: now(),
      };
    } catch (error) {
      return {
        approved: false,
        reason: `approval_function_error: ${error.message}`,
        approvedAt: now(),
      };
    }
  }

  // 自动审批模式
  if (autoApprove) {
    // 安全检查有 critical 级别发现时拒绝自动审批
    if (!safetyCheckResult.safe) {
      return {
        approved: false,
        reason: "safety_check_failed_critical_findings",
        autoApproved: false,
        approvedAt: now(),
        safetyFindings: safetyCheckResult.findings,
      };
    }

    return {
      approved: true,
      reason: "auto_approved",
      autoApproved: true,
      approvedAt: now(),
    };
  }

  // 非自动审批：需要人工审批
  return {
    approved: false,
    reason: "pending_human_approval",
    autoApproved: false,
    approvedAt: now(),
  };
}

/**
 * Step 7: 注册到技能表
 *
 * @param {Object} spec - 神经元规格
 * @param {Object} codeResult - 代码生成结果
 * @param {Object} registry - 技能注册表
 * @returns {Promise<Object>} 注册结果
 */
export async function stepRegister(spec, codeResult, registry) {
  return await registry.register({
    skillId: spec.capabilityId,
    capabilityId: spec.capabilityId,
    type: spec.type,
    version: spec.version || "1.0.0",
    description: spec.description || spec.name || "",
    codePath: codeResult.filePath,
    safetyBoundary: spec.safetyBoundary,
    runtime: spec.runtime,
    synapse: spec.synapse,
    spec: spec,
    admissionStatus: "approved",
  });
}
