// =============================================================================
// liveSkillRegistry-methods.js
// API method implementations for the live skill registry.
// Each exported function receives a shared context object (ctx).
// =============================================================================

import {
  fileExists, syntaxCheck, withTimeout, sha256, now,
} from "./liveSkillRegistry-utils.js";
import { appendExecutionLog } from "./liveSkillRegistry-persistence.js";
import { validateSkillDefinition } from "./liveSkillRegistry-validation.js";

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

/**
 * 注册一个新的神经元技能包
 * @param {Object} ctx - 共享上下文
 * @param {Object} skillDefinition - 技能定义
 * @returns {Promise<Object>} 注册结果
 */
export async function registerSkill(ctx, skillDefinition) {
  const startTime = Date.now();

  // 1. 验证定义完整性
  const validation = validateSkillDefinition(skillDefinition);
  if (!validation.valid) {
    return {
      success: false,
      error: "validation_failed",
      details: validation.errors,
      durationMs: Date.now() - startTime,
    };
  }

  const data = await ctx.ensureLoaded();

  // 2. 检查重复 ID
  if (data.skills.some((s) => s.skillId === skillDefinition.skillId)) {
    return {
      success: false,
      error: "duplicate_skill_id",
      message: `Skill "${skillDefinition.skillId}" is already registered. Revoke or use a different ID.`,
      durationMs: Date.now() - startTime,
    };
  }

  // 3. 验证代码文件存在并做语法检查
  const absoluteCodePath = ctx.resolveCodePath(skillDefinition.codePath);
  if (!(await fileExists(absoluteCodePath))) {
    return {
      success: false,
      error: "code_file_not_found",
      message: `Code file not found: ${absoluteCodePath}`,
      durationMs: Date.now() - startTime,
    };
  }

  const syntaxResult = await syntaxCheck(absoluteCodePath);
  if (!syntaxResult.valid) {
    return {
      success: false,
      error: "syntax_error",
      message: `Syntax check failed for ${skillDefinition.codePath}`,
      details: syntaxResult.error,
      durationMs: Date.now() - startTime,
    };
  }

  // 4. 动态 import 代码文件并缓存工厂函数
  let loadResult;
  try {
    loadResult = await withTimeout(
      ctx.loadSkillModule(absoluteCodePath, skillDefinition.skillId),
      10000,
      `load skill module "${skillDefinition.skillId}"`,
    );
  } catch (loadError) {
    return {
      success: false,
      error: "module_load_failed",
      message: `Failed to load module for skill "${skillDefinition.skillId}": ${loadError.message}`,
      durationMs: Date.now() - startTime,
    };
  }

  // 5. 计算代码哈希（用于完整性校验）
  const { readFile } = await import("node:fs/promises");
  const codeContent = await readFile(absoluteCodePath, "utf8");
  const codeHash = sha256(codeContent);

  // 6. 构建注册条目
  const entry = {
    skillId: skillDefinition.skillId,
    capabilityId: skillDefinition.capabilityId || skillDefinition.skillId,
    type: skillDefinition.type,
    status: "active",
    version: skillDefinition.version || "1.0.0",
    description: skillDefinition.description || "",
    codePath: skillDefinition.codePath,
    codeHash,
    createdAt: now(),
    updatedAt: now(),
    admissionStatus: skillDefinition.admissionStatus || "approved",
    executionCount: 0,
    lastExecutedAt: null,
    avgExecutionMs: null,
    errorCount: 0,
    safetyBoundary: skillDefinition.safetyBoundary || {
      maxInputLength: 100000,
      allowedExternalCalls: false,
      allowedSecretAccess: false,
      allowedFileWrite: false,
    },
    runtime: skillDefinition.runtime || {
      ttlSeconds: 30,
      maxRequests: 1000,
      cooldownMs: 0,
    },
    synapse: skillDefinition.synapse || {
      weight: 50,
      modes: ["default"],
      stressTypes: ["normal"],
    },
    spec: skillDefinition.spec || null,
    moduleLoaded: loadResult.factory !== null,
  };

  // 7. 写入注册表
  data.skills.push(entry);
  await ctx.persist();

  return {
    success: true,
    skillId: entry.skillId,
    type: entry.type,
    version: entry.version,
    status: entry.status,
    codeHash: entry.codeHash,
    moduleLoaded: entry.moduleLoaded,
    durationMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// execute
// ---------------------------------------------------------------------------

/**
 * 执行指定技能
 * @param {Object} ctx - 共享上下文
 * @param {string} skillId - 技能 ID
 * @param {*} input - 输入数据
 * @param {Object} [context={}] - 执行上下文
 * @returns {Promise<Object>} 执行结果
 */
export async function executeSkill(ctx, skillId, input, context = {}) {
  const startTime = Date.now();

  // 1. 查找技能
  const skill = await ctx.findSkill(skillId);
  if (!skill) {
    return {
      success: false,
      error: "skill_not_found",
      message: `Skill "${skillId}" is not registered.`,
      durationMs: Date.now() - startTime,
    };
  }

  // 2. 检查状态
  if (skill.status !== "active") {
    return {
      success: false,
      error: "skill_not_active",
      message: `Skill "${skillId}" status is "${skill.status}". Only "active" skills can be executed.`,
      skillId,
      status: skill.status,
      durationMs: Date.now() - startTime,
    };
  }

  // 3. 检查安全边界
  const safetyBoundary = skill.safetyBoundary || {};
  if (safetyBoundary.maxInputLength && typeof input === "string" && input.length > safetyBoundary.maxInputLength) {
    return {
      success: false,
      error: "input_too_large",
      message: `Input length (${input.length}) exceeds max allowed (${safetyBoundary.maxInputLength}).`,
      skillId,
      durationMs: Date.now() - startTime,
    };
  }

  // 4. 检查运行时限制（请求数上限）
  const runtime = skill.runtime || {};
  if (runtime.maxRequests && skill.executionCount >= runtime.maxRequests) {
    return {
      success: false,
      error: "max_requests_exceeded",
      message: `Skill "${skillId}" has reached its max request limit (${runtime.maxRequests}).`,
      skillId,
      executionCount: skill.executionCount,
      durationMs: Date.now() - startTime,
    };
  }

  // 5. 加载并调用 neuron.execute(input, context)
  const absoluteCodePath = ctx.resolveCodePath(skill.codePath);
  let neuronInstance;

  try {
    const { factory, module: mod } = await ctx.loadSkillModule(absoluteCodePath, skillId);

    if (factory) {
      neuronInstance = await factory(skill.spec || {});
    } else if (mod && typeof mod.execute === "function") {
      neuronInstance = { execute: mod.execute };
    } else {
      return {
        success: false,
        error: "no_execute_function",
        message: `Skill "${skillId}" module does not export an execute function or a factory that creates one.`,
        skillId,
        durationMs: Date.now() - startTime,
      };
    }
  } catch (loadError) {
    await ctx.updateExecutionStats(skillId, Date.now() - startTime, false);
    return {
      success: false,
      error: "module_load_failed",
      message: `Failed to load skill module: ${loadError.message}`,
      skillId,
      durationMs: Date.now() - startTime,
    };
  }

  // 6. 执行（带超时保护）
  const ttlMs = Math.min(
    (runtime.ttlSeconds || 30) * 1000,
    ctx.defaultTimeoutMs,
  );

  let result;
  try {
    result = await withTimeout(
      neuronInstance.execute(input, context),
      ttlMs,
      `execute skill "${skillId}"`,
    );
  } catch (execError) {
    const executionMs = Date.now() - startTime;
    await ctx.updateExecutionStats(skillId, executionMs, false);

    await appendExecutionLog(ctx.executionLogPath, {
      timestamp: now(),
      skillId,
      type: skill.type,
      success: false,
      error: execError.message,
      executionMs,
      inputPreview: typeof input === "string" ? input.slice(0, 200) : JSON.stringify(input)?.slice(0, 200),
    });

    return {
      success: false,
      error: "execution_failed",
      message: execError.message,
      skillId,
      durationMs: executionMs,
    };
  }

  // 7. 记录执行统计
  const executionMs = Date.now() - startTime;
  await ctx.updateExecutionStats(skillId, executionMs, true);

  await appendExecutionLog(ctx.executionLogPath, {
    timestamp: now(),
    skillId,
    type: skill.type,
    success: true,
    executionMs,
    inputPreview: typeof input === "string" ? input.slice(0, 200) : JSON.stringify(input)?.slice(0, 200),
    resultPreview: JSON.stringify(result)?.slice(0, 500),
  });

  return {
    success: true,
    skillId,
    type: skill.type,
    result: result ?? null,
    executionMs,
  };
}

// ---------------------------------------------------------------------------
// revoke
// ---------------------------------------------------------------------------

/**
 * 吊销指定技能
 * @param {Object} ctx - 共享上下文
 * @param {string} skillId - 技能 ID
 * @param {string} [reason="manual_revocation"] - 吊销原因
 * @returns {Promise<Object>}
 */
export async function revokeSkill(ctx, skillId, reason = "manual_revocation") {
  const skill = await ctx.findSkill(skillId);
  if (!skill) {
    return { success: false, error: "skill_not_found", message: `Skill "${skillId}" is not registered.` };
  }
  if (skill.status === "revoked") {
    return { success: false, error: "already_revoked", message: `Skill "${skillId}" is already revoked.` };
  }

  skill.status = "revoked";
  skill.revokedAt = now();
  skill.revokeReason = reason;
  skill.updatedAt = now();
  ctx.factoryCache.delete(skillId);
  await ctx.persist();

  await appendExecutionLog(ctx.executionLogPath, {
    timestamp: now(), skillId, type: skill.type, action: "revoke", reason,
  });

  return { success: true, skillId, revokedAt: skill.revokedAt, reason };
}

// ---------------------------------------------------------------------------
// enable / disable
// ---------------------------------------------------------------------------

/**
 * 启用已被禁用的技能
 * @param {Object} ctx - 共享上下文
 * @param {string} skillId
 * @returns {Promise<Object>}
 */
export async function enableSkill(ctx, skillId) {
  const skill = await ctx.findSkill(skillId);
  if (!skill) {
    return { success: false, error: "skill_not_found", message: `Skill "${skillId}" is not registered.` };
  }
  if (skill.status === "revoked") {
    return { success: false, error: "skill_revoked", message: `Skill "${skillId}" has been revoked. Re-register to use it again.` };
  }
  if (skill.status === "active") {
    return { success: true, skillId, status: "active", message: "Skill is already active." };
  }

  skill.status = "active";
  skill.disabledAt = null;
  skill.disableReason = null;
  skill.updatedAt = now();
  await ctx.persist();
  return { success: true, skillId, status: "active" };
}

/**
 * 禁用技能（可恢复）
 * @param {Object} ctx - 共享上下文
 * @param {string} skillId
 * @param {string} [reason="manual_disable"]
 * @returns {Promise<Object>}
 */
export async function disableSkill(ctx, skillId, reason = "manual_disable") {
  const skill = await ctx.findSkill(skillId);
  if (!skill) {
    return { success: false, error: "skill_not_found", message: `Skill "${skillId}" is not registered.` };
  }
  if (skill.status === "revoked") {
    return { success: false, error: "skill_revoked", message: `Skill "${skillId}" has been revoked. Cannot disable a revoked skill.` };
  }
  if (skill.status === "disabled") {
    return { success: true, skillId, status: "disabled", message: "Skill is already disabled." };
  }

  skill.status = "disabled";
  skill.disabledAt = now();
  skill.disableReason = reason;
  skill.updatedAt = now();
  ctx.factoryCache.delete(skillId);
  await ctx.persist();
  return { success: true, skillId, status: "disabled", reason };
}

// ---------------------------------------------------------------------------
// getStats
// ---------------------------------------------------------------------------

/**
 * 获取注册表整体统计信息
 * @param {Object} ctx - 共享上下文
 * @returns {Promise<Object>}
 */
export async function getStats(ctx) {
  const data = await ctx.ensureLoaded();
  const skills = data.skills;
  const byType = {};
  const byStatus = {};
  let totalExecutions = 0;
  let totalErrors = 0;
  let totalActiveWithExecutions = 0;

  for (const s of skills) {
    byType[s.type] = (byType[s.type] || 0) + 1;
    byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    totalExecutions += s.executionCount || 0;
    totalErrors += s.errorCount || 0;
    if (s.status === "active" && s.executionCount > 0) totalActiveWithExecutions++;
  }

  return {
    totalSkills: skills.length,
    byType,
    byStatus,
    totalExecutions,
    totalErrors,
    activeWithExecutions: totalActiveWithExecutions,
    cachedModules: ctx.factoryCache.size,
    registryPath: ctx.registryPath,
    version: ctx.REGISTRY_VERSION,
    lastUpdated: data.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// healthCheck
// ---------------------------------------------------------------------------

/**
 * 注册表健康检查
 * @param {Object} ctx - 共享上下文
 * @returns {Promise<Object>}
 */
export async function healthCheck(ctx) {
  const checks = [];
  let healthy = true;

  const registryDirExists = await fileExists(ctx.dirnameFn(ctx.registryPath));
  checks.push({
    name: "registry_directory",
    status: registryDirExists ? "pass" : "warn",
    detail: registryDirExists ? "Registry directory exists" : "Registry directory not found (will be created on first write)",
  });

  const registryFileExists = await fileExists(ctx.registryPath);
  checks.push({
    name: "registry_file",
    status: registryFileExists ? "pass" : "info",
    detail: registryFileExists ? "Registry file is readable" : "Registry file does not exist yet (empty registry)",
  });

  const data = await ctx.ensureLoaded();
  let staleCacheCount = 0;
  for (const [skillId] of ctx.factoryCache) {
    const skill = data.skills.find((s) => s.skillId === skillId);
    if (!skill || skill.status !== "active") staleCacheCount++;
  }
  checks.push({
    name: "module_cache_consistency",
    status: staleCacheCount === 0 ? "pass" : "warn",
    detail: staleCacheCount === 0
      ? "All cached modules correspond to active skills"
      : `${staleCacheCount} cached modules are stale (skill revoked/disabled)`,
  });
  if (staleCacheCount > 0) healthy = false;

  let missingCodeFiles = 0;
  for (const skill of data.skills.filter((s) => s.status === "active")) {
    const absPath = ctx.resolveCodePath(skill.codePath);
    if (!(await fileExists(absPath))) missingCodeFiles++;
  }
  checks.push({
    name: "code_files_accessible",
    status: missingCodeFiles === 0 ? "pass" : "fail",
    detail: missingCodeFiles === 0
      ? "All active skill code files are accessible"
      : `${missingCodeFiles} active skill code files are missing`,
  });
  if (missingCodeFiles > 0) healthy = false;

  return {
    healthy,
    checks,
    totalSkills: data.skills.length,
    activeSkills: data.skills.filter((s) => s.status === "active").length,
    cachedModules: ctx.factoryCache.size,
    timestamp: now(),
  };
}
