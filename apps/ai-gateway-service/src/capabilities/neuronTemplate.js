// =============================================================================
// 神经元代码生成模板 (Neuron Code Generation Templates)
// =============================================================================

import { now } from "./selfEvolutionPipelineUtils.js";

/**
 * 根据规格生成神经元代码的内置模板
 *
 * @param {Object} spec - 神经元规格
 * @returns {string} ESM 模块代码
 */
export function generateNeuronTemplate(spec) {
  const type = spec.type || "analysis";
  const name = spec.name || spec.capabilityId || "unnamed-neuron";
  const description = (spec.description || "").replace(/`/g, "'").replace(/\n/g, " ").slice(0, 200);
  const capabilityId = spec.capabilityId || "unknown";

  // 根据类型选择不同的执行逻辑模板
  const executeBody = generateExecuteBody(type, spec);

  return `// =============================================================================
// 神经元: ${name}
// 类型: ${type}
// 能力 ID: ${capabilityId}
// 描述: ${description}
// 生成时间: ${now()}
// 由自进化管线自动生成 (self-evolution-pipeline)
// =============================================================================

/**
 * 神经元工厂函数
 * @param {Object} [config={}] - 运行时配置
 * @returns {Object} 神经元实例
 */
export function createNeuron(config = {}) {
  const neuronId = ${JSON.stringify(capabilityId)};
  const neuronType = ${JSON.stringify(type)};

  return {
    id: neuronId,
    type: neuronType,

    /**
     * 执行神经元逻辑
     * @param {*} input - 输入数据
     * @param {Object} context - 执行上下文
     * @returns {Object} 执行结果
     */
    async execute(input, context = {}) {
${executeBody}
    },

    /**
     * 获取神经元元信息
     * @returns {Object}
     */
    getInfo() {
      return {
        id: neuronId,
        type: neuronType,
        description: ${JSON.stringify(description)},
        createdAt: ${JSON.stringify(now())},
        config,
      };
    },
  };
}

// 默认导出工厂函数
export default createNeuron;
`;
}

/**
 * 根据神经元类型生成 execute 方法体
 * @param {string} type - 神经元类型
 * @param {Object} spec - 神经元规格
 * @returns {string} 代码字符串
 */
function generateExecuteBody(type, spec) {
  switch (type) {
    case "safety":
      return `      // 安全分类神经元：对输入进行风险评估
      const inputText = typeof input === "string" ? input : JSON.stringify(input);
      const riskIndicators = [];

      // 检测常见风险模式
      if (/暴力|攻击|hack|attack|exploit/i.test(inputText)) {
        riskIndicators.push("potential_malicious_intent");
      }
      if (/密码|password|secret|token|key/i.test(inputText)) {
        riskIndicators.push("sensitive_data_reference");
      }
      if (inputText.length > 50000) {
        riskIndicators.push("unusually_long_input");
      }

      const riskLevel = riskIndicators.length >= 2 ? "high"
        : riskIndicators.length === 1 ? "medium"
        : "low";

      return {
        riskLevel,
        riskIndicators,
        blocked: riskLevel === "high",
        timestamp: new Date().toISOString(),
      };`;

    case "context":
      return `      // 上下文优化神经元：增强请求上下文信息
      const enriched = {
        originalInput: input,
        contextAdded: {
          timestamp: new Date().toISOString(),
          source: "context-neuron",
          mode: context.mode || "default",
        },
      };

      return {
        enrichedContext: enriched,
        additions: ["timestamp", "source", "mode"],
        timestamp: new Date().toISOString(),
      };`;

    case "review":
      return `      // 审查评估神经元：评估模型选择是否合适
      const selection = input || {};
      const suggestions = [];

      // 如果任务复杂度高但选择了轻量模型，建议升级
      const taskComplexity = selection.complexity || "medium";
      const modelTier = selection.modelTier || "standard";

      if (taskComplexity === "high" && modelTier === "standard") {
        suggestions.push({
          type: "upgrade",
          reason: "High complexity task may benefit from a more capable model",
          suggestedTier: "premium",
        });
      }

      return {
        reviewPassed: suggestions.filter(s => s.type === "block").length === 0,
        suggestions,
        suggestUpgrade: suggestions.some(s => s.type === "upgrade"),
        timestamp: new Date().toISOString(),
      };`;

    case "evidence":
      return `      // 证据记录神经元：记录请求和响应的关键信息
      const response = input || {};

      return {
        recorded: true,
        evidence: {
          responsePreview: typeof response === "string"
            ? response.slice(0, 500)
            : JSON.stringify(response).slice(0, 500),
          recordedAt: new Date().toISOString(),
          neuronId: ${JSON.stringify(spec.capabilityId || "evidence-neuron")},
        },
        timestamp: new Date().toISOString(),
      };`;

    case "planning":
      return `      // 规划决策神经元：分析任务并生成执行计划建议
      const taskInput = typeof input === "string" ? input : JSON.stringify(input);
      const plan = [];

      // 基于关键词的简单任务分解
      if (/多步|multi.?step|流程|workflow/i.test(taskInput)) {
        plan.push("decompose_into_subtasks");
      }
      if (/比较|compare|vs/i.test(taskInput)) {
        plan.push("parallel_evaluation");
      }

      return {
        plan,
        estimatedSteps: plan.length || 1,
        timestamp: new Date().toISOString(),
      };`;

    case "transform":
      return `      // 数据变换神经元：对输入数据进行格式转换或标准化
      const data = input;
      let transformed = data;

      // 字符串输入尝试解析为 JSON
      if (typeof data === "string") {
        try {
          transformed = JSON.parse(data);
        } catch {
          transformed = { raw: data };
        }
      }

      return {
        transformed,
        originalType: typeof data,
        transformedType: typeof transformed,
        timestamp: new Date().toISOString(),
      };`;

    case "routing":
      return `      // 路由优化神经元：优化路由决策
      const routingInput = input || {};

      return {
        suggestedRoute: routingInput.defaultRoute || "standard",
        confidence: 0.8,
        enhancements: [],
        timestamp: new Date().toISOString(),
      };`;

    case "analysis":
      return `      // 分析推理神经元：对输入进行深度分析
      const analysisInput = typeof input === "string" ? input : JSON.stringify(input);

      return {
        analysis: {
          inputLength: analysisInput.length,
          hasCodeBlock: /\`\`\`/.test(analysisInput),
          hasQuestion: /\\?|？/.test(analysisInput),
          language: /[\\u4e00-\\u9fa5]/.test(analysisInput) ? "zh" : "en",
        },
        timestamp: new Date().toISOString(),
      };`;

    case "generation":
      return `      // 内容生成神经元：辅助生成内容
      return {
        generated: true,
        content: null,
        note: "Generation neurons delegate to LLM providers for actual content generation",
        timestamp: new Date().toISOString(),
      };`;

    case "monitoring":
      return `      // 监控告警神经元：监控执行指标
      const metrics = input || {};

      return {
        monitored: true,
        metrics: {
          executionTime: metrics.executionMs || 0,
          successRate: metrics.successRate || 1.0,
          alertTriggered: false,
        },
        timestamp: new Date().toISOString(),
      };`;

    default:
      return `      // 通用神经元：默认处理逻辑
      return {
        processed: true,
        inputType: typeof input,
        result: null,
        note: "No specialized logic for type '${type}', using default handler",
        timestamp: new Date().toISOString(),
      };`;
  }
}
