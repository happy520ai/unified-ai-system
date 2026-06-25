// =============================================================================
// AI 驱动的自然语言神经发生编译器 (AI Neurogenesis Compiler)
//
// 与旧版 deterministic 编译器不同，这个编译器：
// 1. 调用网关自身的 AI 能力（通过 /chat/auto）来深度理解用户需求
// 2. 从用户输入中提取：能力类型、适用场景、输入输出规格、安全约束、依赖关系
// 3. 生成结构化的 CapabilitySpec，供后续代码生成器使用
//
// 当 AI 调用失败时，自动回退到旧版 deterministic 编译器
// =============================================================================

import { compileNaturalLanguageCapability } from "@unified-ai-system/taiji-beidou-engine/src/naturalLanguageNeurogenesisCompiler.js";
import {
  normalizeCapabilityId,
  createCapabilityNeuronManifest,
  createSafetyBoundary,
  createRuntimePolicy,
} from "@unified-ai-system/taiji-beidou-engine/src/capabilityNeuronManifest.js";
import {
  COMPILER_VERSION,
  buildAnalysisPrompt,
  callGatewayAI,
  extractJsonFromResponse,
  deterministicClassify,
} from "./aiNeurogenesisCompilerHelpers.js";

// ---------------------------------------------------------------------------
// CapabilitySpec 合并与构建
// ---------------------------------------------------------------------------

/**
 * 将 AI 分析结果与 deterministic 分类合并为完整的 CapabilitySpec
 *
 * @param {string} intakeText - 用户原始需求
 * @param {object|null} aiAnalysis - AI 返回的结构化分析（可能为 null）
 * @param {object} deterministicResult - deterministic 分类结果
 * @param {object} options - 用户传入的额外选项
 * @returns {object} 完整的 CapabilitySpec
 */
function buildCapabilitySpec(intakeText, aiAnalysis, deterministicResult, options = {}) {
  const capabilityId = normalizeCapabilityId(
    options.capabilityId || intakeText || "capability-neuron"
  );

  // 以 AI 分析为主，deterministic 为补充
  const useAI = aiAnalysis !== null;

  // 能力类型：优先使用 AI 分析，回退到 deterministic
  const type = options.type || aiAnalysis?.capabilityType || deterministicResult.type;

  // 压力类型：合并两者的结果（去重）
  const aiPressureTypes = Array.isArray(aiAnalysis?.pressureTypes) ? aiAnalysis.pressureTypes : [];
  const mergedPressureTypes = [...new Set([...aiPressureTypes, ...deterministicResult.pressureTypes])];

  // 适用模式：合并两者的结果（去重）
  const aiModes = Array.isArray(aiAnalysis?.applicableModes) ? aiAnalysis.applicableModes : [];
  const mergedModes = [...new Set([...aiModes, ...deterministicResult.modes])];

  // 安全约束
  const safetyConstraints = Array.isArray(aiAnalysis?.safetyConstraints)
    ? aiAnalysis.safetyConstraints
    : [
        "不能访问密钥或凭证",
        "不能调用外部网络 API",
        "不能读取或修改文件系统",
        "不能执行系统命令",
      ];

  // 复杂度评估
  const complexity = aiAnalysis?.estimatedComplexity || "simple";

  // 运行提示
  const runtimeHints = aiAnalysis?.runtimeHints || {};

  // 构建最终的 CapabilitySpec（兼容旧版 capability-spec.json 格式）
  const spec = {
    // === 元数据 ===
    compilerVersion: COMPILER_VERSION,
    deterministic: !useAI,
    modelCallsMade: useAI,
    compiledAt: new Date().toISOString(),

    // === 基本信息 ===
    capabilityId,
    displayName: options.displayName || aiAnalysis?.displayName || `${type} Capability Neuron`,
    description: aiAnalysis?.description || `从自然语言编译的能力规格: ${intakeText}`,
    intakeText,
    type,

    // === 输入输出规格 ===
    inputs: aiAnalysis?.inputs || {
      input: { type: "string", description: "主输入", required: true },
    },
    outputs: aiAnalysis?.outputs || {
      result: { type: "object", description: "处理结果" },
    },

    // === 运行配置 ===
    requestedRuntime: "dry_run",
    runtime: createRuntimePolicy({
      ttlSeconds: runtimeHints.ttlSeconds || (complexity === "complex" ? 600 : 300),
      maxRequests: runtimeHints.maxRequests || 3,
      maxTokenBudget: runtimeHints.maxTokenBudget || 4000,
    }),

    // === 安全边界 ===
    safetyBoundary: createSafetyBoundary({
      // 默认全部禁止，遵循最小权限原则
    }),

    // === 安全约束列表 ===
    safetyConstraints,

    // === 突触连接 ===
    pressureTypes: mergedPressureTypes,
    modes: mergedModes,
    dependencies: options.dependencies || aiAnalysis?.suggestedDependencies || [],

    // === 复杂度与示例 ===
    estimatedComplexity: complexity,
    exampleUsage: aiAnalysis?.exampleUsage || null,

    // === 产物清单 ===
    requiredArtifacts: [
      "manifest",
      "scaffoldPlan",
      "fixture",
      "verifier",
      "evidence",
      "rollback",
      "neuronCode",
    ],
  };

  return spec;
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * 使用 AI 编译自然语言需求为结构化的 CapabilitySpec
 *
 * 核心流程：
 * 1. 调用网关自身的 AI 能力（/chat/auto）来深度理解用户需求
 * 2. 从 AI 返回中提取结构化的能力分析
 * 3. 将 AI 分析与 deterministic 分类合并为完整 CapabilitySpec
 * 4. AI 调用失败时回退到旧版 deterministic 编译器
 *
 * @param {string} intakeText - 用户的自然语言需求描述
 * @param {object} [options={}] - 编译选项
 * @param {string} [options.capabilityId] - 手动指定的能力ID
 * @param {string} [options.displayName] - 手动指定的显示名称
 * @param {string} [options.type] - 手动指定的能力类型
 * @param {string[]} [options.dependencies] - 手动指定的依赖
 * @param {boolean} [options.skipAI=false] - 是否跳过 AI 调用（直接使用 deterministic）
 * @returns {Promise<object>} 完整的 CapabilitySpec
 */
export async function compileWithAI(intakeText, options = {}) {
  const text = String(intakeText || "").trim();

  if (!text) {
    throw new Error("compileWithAI: intakeText 不能为空");
  }

  // ── Step 1: Deterministic 基础分类（始终执行，作为 baseline 和 fallback）──
  const deterministicResult = deterministicClassify(text);

  // ── Step 2: 调用 AI 进行深度分析 ──
  let aiAnalysis = null;

  if (!options.skipAI) {
    const prompt = buildAnalysisPrompt(text);
    const aiResponse = await callGatewayAI(prompt, "standard");

    if (aiResponse.success && aiResponse.content) {
      aiAnalysis = extractJsonFromResponse(aiResponse.content);

      // 如果 AI 返回了有效 JSON，进行基础字段校验
      if (aiAnalysis && typeof aiAnalysis === "object") {
        // 确保关键字段存在
        if (!aiAnalysis.capabilityType) {
          aiAnalysis.capabilityType = deterministicResult.type;
        }
        if (!aiAnalysis.pressureTypes || !Array.isArray(aiAnalysis.pressureTypes)) {
          aiAnalysis.pressureTypes = deterministicResult.pressureTypes;
        }
        if (!aiAnalysis.applicableModes || !Array.isArray(aiAnalysis.applicableModes)) {
          aiAnalysis.applicableModes = deterministicResult.modes;
        }
      }
    }
    // 如果 AI 调用失败或返回无法解析的内容，aiAnalysis 保持 null
  }

  // ── Step 3: 合并 AI 分析 + deterministic 分类，构建完整 CapabilitySpec ──
  const spec = buildCapabilitySpec(text, aiAnalysis, deterministicResult, options);

  return spec;
}

/**
 * 同步版本的 deterministic-only 编译（不发起 AI 调用）
 * 适用于需要快速分类、不需要完整 spec 的场景
 *
 * @param {string} intakeText - 用户的自然语言需求描述
 * @param {object} [options={}] - 编译选项
 * @returns {object} 旧版格式的 capability spec
 */
export function compileDeterministic(intakeText, options = {}) {
  return compileNaturalLanguageCapability(intakeText, options);
}

/**
 * 批量编译多个自然语言需求
 *
 * @param {string[]} intakes - 自然语言需求数组
 * @param {object} [options={}] - 编译选项
 * @returns {Promise<object[]>} CapabilitySpec 数组
 */
export async function compileBatchWithAI(intakes, options = {}) {
  if (!Array.isArray(intakes) || intakes.length === 0) {
    return [];
  }

  const results = [];
  for (let i = 0; i < intakes.length; i++) {
    const spec = await compileWithAI(intakes[i], {
      ...options,
      capabilityId: options.capabilityId || `neuron-${i + 1}-${intakes[i].slice(0, 30)}`,
    });
    results.push(spec);
  }
  return results;
}

/**
 * 从 CapabilitySpec 生成完整的 Manifest（兼容旧版 manifest 格式）
 *
 * @param {object} capabilitySpec - compileWithAI 返回的 CapabilitySpec
 * @returns {object} 完整的 capability neuron manifest
 */
export function specToManifest(capabilitySpec) {
  return createCapabilityNeuronManifest({
    capabilityId: capabilitySpec.capabilityId,
    displayName: capabilitySpec.displayName,
    description: capabilitySpec.description,
    intakeText: capabilitySpec.intakeText,
    type: capabilitySpec.type,
    status: "draft",
    runtime: capabilitySpec.runtime,
    safety: capabilitySpec.safetyBoundary,
    inputs: capabilitySpec.inputs,
    outputs: capabilitySpec.outputs,
    synapse: {
      pressureTypes: capabilitySpec.pressureTypes,
      modes: capabilitySpec.modes,
      dependencies: capabilitySpec.dependencies,
      weight: 0.5,
    },
  });
}
