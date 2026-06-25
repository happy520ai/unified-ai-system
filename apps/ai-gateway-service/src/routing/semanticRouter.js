// =============================================================================
// semanticRouter.js — 语义路由引擎
// 根据查询意图、复杂度、成本自动选最优模型
// =============================================================================

/**
 * 任务类型定义
 */
const TASK_TYPES = {
  SIMPLE_CHAT:     { complexity: 1, preferredModels: ["gpt-4o-mini", "deepseek-chat", "glm-4-flash"], costWeight: 0.8 },
  CODE_GENERATION: { complexity: 3, preferredModels: ["claude-sonnet-4", "gpt-4o", "deepseek-coder"], costWeight: 0.4 },
  TRANSLATION:     { complexity: 2, preferredModels: ["gpt-4o-mini", "deepseek-chat", "qwen-turbo"], costWeight: 0.7 },
  SUMMARIZATION:   { complexity: 2, preferredModels: ["gpt-4o-mini", "deepseek-chat", "qwen-turbo"], costWeight: 0.7 },
  REASONING:       { complexity: 4, preferredModels: ["claude-sonnet-4", "gpt-4o", "deepseek-reasoner"], costWeight: 0.3 },
  CREATIVE:        { complexity: 3, preferredModels: ["claude-sonnet-4", "gpt-4o", "qwen-max"], costWeight: 0.5 },
  MATH:            { complexity: 4, preferredModels: ["deepseek-reasoner", "gpt-4o", "claude-sonnet-4"], costWeight: 0.3 },
  KNOWLEDGE_QA:    { complexity: 2, preferredModels: ["gpt-4o-mini", "deepseek-chat", "qwen-plus"], costWeight: 0.6 },
  LONG_CONTEXT:    { complexity: 3, preferredModels: ["gemini-2.0-flash", "gpt-4o", "claude-sonnet-4"], costWeight: 0.5 },
  VISION:          { complexity: 3, preferredModels: ["gpt-4o", "gemini-2.0-flash", "claude-sonnet-4"], costWeight: 0.4 },
};

/**
 * 意图关键词映射
 */
const INTENT_KEYWORDS = {
  CODE_GENERATION: [
    /写代码|编写代码|写程序|实现一个|写一个函数|编写函数|代码实现/i,
    /write code|implement|create a function|code a|build a/i,
    /def |class |function |import |const |let |var |async /i,
  ],
  TRANSLATION: [
    /翻译|translate|译成|译为|转换为.*语言/i,
    /翻成中文|翻成英文|翻译成/i,
  ],
  SUMMARIZATION: [
    /总结|摘要|概括|summarize|summary|简述|归纳/i,
  ],
  REASONING: [
    /分析|推理|论证|为什么|解释原因|analyze|reason|explain why|逻辑/i,
    /证明|推导|推演|derive|prove/i,
  ],
  CREATIVE: [
    /写诗|写故事|创作|创意|compose|create a story|write a poem|创意写作/i,
    /想象|虚构|imagine|fiction/i,
  ],
  MATH: [
    /计算|数学|方程|公式|calculate|math|equation|formula|求解/i,
    /\d+[\+\-\*\/\^]\d+|积分|微分|概率|统计/i,
  ],
  KNOWLEDGE_QA: [
    /什么是|是什么|谁是|定义|what is|who is|define|解释概念/i,
    /知识|knowledge|历史|history/i,
  ],
  LONG_CONTEXT: [
    /长文|长篇|论文|文档|document|论文|article|全文/i,
  ],
  VISION: [
    /图片|图像|看图|识别图片|image|picture|photo|视觉/i,
  ],
};

/**
 * 创建语义路由引擎
 * @param {Object} options
 * @returns {Object}
 */
export function createSemanticRouter(options = {}) {
  const availableModels = options.availableModels ?? [];
  const costTracker = options.costTracker;

  /**
   * 分类查询意图
   * @param {string} query
   * @returns {Object} { taskType, confidence, keywords }
   */
  function classifyIntent(query) {
    if (!query || typeof query !== "string") {
      return { taskType: "SIMPLE_CHAT", confidence: 0.5, keywords: [] };
    }

    const scores = {};
    const matchedKeywords = {};

    for (const [taskType, patterns] of Object.entries(INTENT_KEYWORDS)) {
      scores[taskType] = 0;
      matchedKeywords[taskType] = [];

      for (const pattern of patterns) {
        const matches = query.match(pattern);
        if (matches) {
          scores[taskType] += matches.length;
          matchedKeywords[taskType].push(matches[0]);
        }
      }
    }

    // 找到得分最高的任务类型
    let bestType = "SIMPLE_CHAT";
    let bestScore = 0;
    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    // 计算置信度
    const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);
    const confidence = totalScore > 0 ? bestScore / totalScore : 0.5;

    // 检查是否需要视觉模型
    if (query.includes("[image]") || query.includes("<image>")) {
      bestType = "VISION";
    }

    // 检查是否是长上下文
    if (query.length > 10000) {
      bestType = "LONG_CONTEXT";
    }

    return {
      taskType: bestType,
      confidence: Math.min(1, confidence + 0.3), // 保底置信度
      keywords: matchedKeywords[bestType] ?? [],
      complexity: TASK_TYPES[bestType]?.complexity ?? 2,
    };
  }

  /**
   * 选择最优模型
   * @param {string} query
   * @param {Object} constraints - { maxCostUsd, preferredProvider, excludeModels }
   * @returns {Object} { model, provider, taskType, reason }
   */
  function route(query, constraints = {}) {
    const intent = classifyIntent(query);
    const taskConfig = TASK_TYPES[intent.taskType] ?? TASK_TYPES.SIMPLE_CHAT;

    // 过滤可用模型
    let candidates = taskConfig.preferredModels.filter((m) => {
      if (constraints.excludeModels?.includes(m)) return false;
      return true;
    });

    // 如果有可用模型列表，交叉匹配
    if (availableModels.length > 0) {
      const available = availableModels.map((m) => normalizeModelName(m));
      candidates = candidates.filter((m) => available.includes(m));
    }

    // 如果没有候选，使用默认
    if (candidates.length === 0) {
      candidates = ["gpt-4o-mini"];
    }

    // 根据约束选择
    let selectedModel = candidates[0];

    // 如果有成本约束，选最便宜的
    if (constraints.maxCostUsd && costTracker) {
      for (const model of candidates) {
        const cost = costTracker.calculateCost({ model, inputTokens: 1000, outputTokens: 500 });
        if (cost.totalCostUsd <= constraints.maxCostUsd) {
          selectedModel = model;
          break;
        }
      }
    }

    // 如果有 Provider 偏好
    if (constraints.preferredProvider) {
      const preferred = candidates.find((m) => m.includes(constraints.preferredProvider));
      if (preferred) selectedModel = preferred;
    }

    return {
      model: selectedModel,
      taskType: intent.taskType,
      confidence: intent.confidence,
      complexity: intent.complexity,
      reason: `Intent: ${intent.taskType} (confidence: ${(intent.confidence * 100).toFixed(0)}%), selected: ${selectedModel}`,
      alternatives: candidates.filter((m) => m !== selectedModel).slice(0, 3),
    };
  }

  /**
   * 获取支持的任务类型
   */
  function getSupportedTaskTypes() {
    return Object.entries(TASK_TYPES).map(([name, config]) => ({
      name,
      complexity: config.complexity,
      preferredModels: config.preferredModels,
      costWeight: config.costWeight,
    }));
  }

  /**
   * 获取路由统计
   */
  function getStats() {
    return {
      supportedTaskTypes: Object.keys(TASK_TYPES).length,
      availableModels: availableModels.length,
      intentKeywords: Object.values(INTENT_KEYWORDS).reduce((s, p) => s + p.length, 0),
    };
  }

  return { classifyIntent, route, getSupportedTaskTypes, getStats };
}

function normalizeModelName(model) {
  if (!model) return "";
  const parts = model.split("/");
  return parts[parts.length - 1].toLowerCase();
}
