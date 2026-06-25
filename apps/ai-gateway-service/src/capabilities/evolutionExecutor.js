// =============================================================================
// 管线进化执行器 (Pipeline Evolution Executor)
// =============================================================================

import {
  now,
  withTimeout,
  createFailureResult,
} from "./selfEvolutionPipelineUtils.js";
import {
  stepCompile,
  stepGenerate,
  stepSyntaxCheck,
  stepSafetyCheck,
  stepTestVerify,
  stepApprovalGate,
  stepRegister,
} from "./pipelineSteps.js";

/**
 * 执行完整的自进化管线
 * 从用户输入到可调用神经元的全流程
 *
 * @param {string} intakeText - 用户输入的需求描述（自然语言）
 * @param {Object} evolveOptions - 进化选项
 * @param {Object} context - 管线上下文
 * @returns {Promise<Object>} 进化结果
 */
export async function executeEvolution(intakeText, evolveOptions, context) {
  const {
    compiler,
    codeGenerator,
    registry,
    autoApprove,
    approvalFn,
    generatedCodeDir,
    historyManager,
  } = context;

  const startTime = Date.now();
  const steps = [];
  let spec = null;
  let codeResult = null;

  /**
   * 辅助函数：添加步骤记录
   */
  function addStep(stepName, status, result, error = null) {
    steps.push({
      step: stepName,
      status,
      result: result || null,
      error: error || null,
      timestamp: now(),
    });
  }

  try {
    // ===================================================================
    // Step 1: AI 理解需求
    // ===================================================================
    try {
      spec = await withTimeout(
        stepCompile(intakeText, {
          capabilityId: evolveOptions.capabilityId,
          type: evolveOptions.type,
          ...(evolveOptions.compilerHints || {}),
        }, compiler),
        30000,
        "step:compile",
      );
      addStep("compile", "done", spec);
    } catch (compileError) {
      addStep("compile", "fail", null, compileError.message);
      return createFailureResult("compile", compileError, steps, startTime);
    }

    // ===================================================================
    // Step 2: 生成代码
    // ===================================================================
    try {
      codeResult = await withTimeout(
        stepGenerate(spec, generatedCodeDir, codeGenerator),
        30000,
        "step:generate",
      );
      addStep("generate", "done", {
        filePath: codeResult.filePath,
        codeHash: codeResult.codeHash,
        codeLength: codeResult.code?.length || 0,
      });
    } catch (genError) {
      addStep("generate", "fail", null, genError.message);
      return createFailureResult("generate", genError, steps, startTime, spec);
    }

    // ===================================================================
    // Step 3: 语法检查
    // ===================================================================
    let syntaxResult;
    try {
      syntaxResult = await withTimeout(
        stepSyntaxCheck(codeResult.filePath, codeGenerator),
        15000,
        "step:syntax_check",
      );
      addStep("syntax_check", syntaxResult.valid ? "pass" : "fail", syntaxResult);

      if (!syntaxResult.valid) {
        return createFailureResult("syntax_check", new Error(syntaxResult.error), steps, startTime, spec, codeResult);
      }
    } catch (syntaxError) {
      addStep("syntax_check", "fail", null, syntaxError.message);
      return createFailureResult("syntax_check", syntaxError, steps, startTime, spec, codeResult);
    }

    // ===================================================================
    // Step 4: 安全检查
    // ===================================================================
    let safetyResult;
    if (evolveOptions.skipSafety) {
      safetyResult = { safe: true, findings: [], skipped: true, scannedAt: now() };
      addStep("safety_check", "skipped", safetyResult);
    } else {
      safetyResult = stepSafetyCheck(codeResult.code, {
        allowedPatterns: evolveOptions.allowedSafetyPatterns,
      }, codeGenerator);
      addStep("safety_check", safetyResult.safe ? "pass" : "fail", safetyResult);

      if (!safetyResult.safe) {
        return createFailureResult("safety_check", new Error("Safety check found critical issues"), steps, startTime, spec, codeResult);
      }
    }

    // ===================================================================
    // Step 5: 测试验证
    // ===================================================================
    let testResult;
    if (evolveOptions.skipTests) {
      testResult = { passed: true, checks: [], skipped: true, verifiedAt: now() };
      addStep("test_verify", "skipped", testResult);
    } else {
      try {
        testResult = await withTimeout(
          stepTestVerify(spec, codeResult.filePath, codeGenerator),
          30000,
          "step:test_verify",
        );
        addStep("test_verify", testResult.passed ? "pass" : "fail", testResult);

        if (!testResult.passed) {
          return createFailureResult("test_verify", new Error(testResult.details), steps, startTime, spec, codeResult);
        }
      } catch (testError) {
        addStep("test_verify", "fail", null, testError.message);
        return createFailureResult("test_verify", testError, steps, startTime, spec, codeResult);
      }
    }

    // ===================================================================
    // Step 6: 审批门控
    // ===================================================================
    let approvalResult;
    try {
      approvalResult = await withTimeout(
        stepApprovalGate(spec, safetyResult, autoApprove, approvalFn),
        10000,
        "step:approval_gate",
      );
      addStep("approval_gate", approvalResult.approved ? "pass" : "fail", approvalResult);

      if (!approvalResult.approved) {
        return createFailureResult(
          "approval_gate",
          new Error(approvalResult.reason),
          steps,
          startTime,
          spec,
          codeResult,
        );
      }
    } catch (approvalError) {
      addStep("approval_gate", "fail", null, approvalError.message);
      return createFailureResult("approval_gate", approvalError, steps, startTime, spec, codeResult);
    }

    // ===================================================================
    // Step 7: 注册到技能表
    // ===================================================================
    let registrationResult;
    try {
      registrationResult = await withTimeout(
        stepRegister(spec, codeResult, registry),
        15000,
        "step:register",
      );
      addStep("register", registrationResult.success ? "done" : "fail", registrationResult);

      if (!registrationResult.success) {
        return createFailureResult(
          "register",
          new Error(registrationResult.message || registrationResult.error),
          steps,
          startTime,
          spec,
          codeResult,
        );
      }
    } catch (registerError) {
      addStep("register", "fail", null, registerError.message);
      return createFailureResult("register", registerError, steps, startTime, spec, codeResult);
    }

    // ===================================================================
    // 全部完成
    // ===================================================================
    const durationMs = Date.now() - startTime;

    const successResult = {
      success: true,
      capabilityId: spec.capabilityId,
      skillId: spec.capabilityId,
      type: spec.type,
      version: spec.version || "1.0.0",
      filePath: codeResult.filePath,
      codeHash: codeResult.codeHash,
      steps,
      durationMs,
      completedAt: now(),
    };

    // 记录进化历史
    await historyManager.addRecord(successResult);

    return successResult;

  } catch (unexpectedError) {
    return createFailureResult("unexpected", unexpectedError, steps, startTime, spec, codeResult);
  }
}
