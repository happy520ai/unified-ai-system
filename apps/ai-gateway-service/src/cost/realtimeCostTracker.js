// =============================================================================
// realtimeCostTracker.js — 实时成本追踪引擎
// 与 Provider 响应中的 usage 字段联动，实时计算成本，预算告警
// =============================================================================

/**
 * 主流模型 Token 定价（USD per 1M tokens）
 */
const MODEL_PRICING = Object.freeze({
  // OpenAI
  "gpt-4o":              { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":         { input: 0.15,  output: 0.60 },
  "gpt-4-turbo":         { input: 10.00, output: 30.00 },
  "gpt-3.5-turbo":       { input: 0.50,  output: 1.50 },
  // Anthropic
  "claude-sonnet-4":     { input: 3.00,  output: 15.00 },
  "claude-3.5-haiku":    { input: 0.80,  output: 4.00 },
  "claude-3-opus":       { input: 15.00, output: 75.00 },
  // Google
  "gemini-2.0-flash":    { input: 0.10,  output: 0.40 },
  "gemini-1.5-pro":      { input: 1.25,  output: 5.00 },
  // DeepSeek
  "deepseek-chat":       { input: 0.14,  output: 0.28 },
  "deepseek-reasoner":   { input: 0.55,  output: 2.19 },
  // 通义千问
  "qwen-turbo":          { input: 0.05,  output: 0.10 },
  "qwen-plus":           { input: 0.40,  output: 1.20 },
  "qwen-max":            { input: 2.40,  output: 9.60 },
  // 智谱 GLM
  "glm-4-flash":         { input: 0.00,  output: 0.00 },
  "glm-4-air":           { input: 0.07,  output: 0.07 },
  // NVIDIA
  "llama-3.3-70b":       { input: 0.00,  output: 0.00 },  // 免费
  // 默认
  "_default":            { input: 1.00,  output: 3.00 },
});

/**
 * 创建实时成本追踪器
 * @param {Object} options
 * @returns {Object}
 */
export function createRealtimeCostTracker(options = {}) {
  const customPricing = options.customPricing ?? {};
  const pricing = { ...MODEL_PRICING, ...customPricing };

  // 预算配置
  const budgets = {
    daily: options.dailyBudgetUsd ?? 100,
    monthly: options.monthlyBudgetUsd ?? 3000,
    perRequest: options.perRequestBudgetUsd ?? 1.0,
  };

  // 告警阈值（百分比）
  const alertThresholds = options.alertThresholds ?? [50, 75, 90, 100];

  // 成本记录
  const costRecords = [];
  const MAX_RECORDS = 100000;
  const alertCallbacks = [];
  const alertedThresholds = new Set();

  /**
   * 计算请求成本
   * @param {Object} params - { model, inputTokens, outputTokens }
   * @returns {Object} { inputCostUsd, outputCostUsd, totalCostUsd }
   */
  function calculateCost({ model, inputTokens = 0, outputTokens = 0 }) {
    const modelKey = normalizeModelName(model);
    const p = pricing[modelKey] ?? pricing["_default"];

    const inputCostUsd = (inputTokens / 1_000_000) * p.input;
    const outputCostUsd = (outputTokens / 1_000_000) * p.output;
    const totalCostUsd = inputCostUsd + outputCostUsd;

    return {
      inputCostUsd: round6(inputCostUsd),
      outputCostUsd: round6(outputCostUsd),
      totalCostUsd: round6(totalCostUsd),
      pricing: { input: p.input, output: p.output, currency: "USD/1M tokens" },
    };
  }

  /**
   * 记录一次请求的成本
   * @param {Object} entry - { requestId, model, provider, inputTokens, outputTokens, cached }
   * @returns {Object} 成本记录
   */
  function recordCost(entry) {
    const cost = calculateCost({
      model: entry.model,
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
    });

    // 缓存命中时输入 token 免费
    if (entry.cached) {
      cost.inputCostUsd = 0;
      cost.totalCostUsd = cost.outputCostUsd;
    }

    const record = {
      requestId: entry.requestId,
      timestamp: Date.now(),
      model: entry.model,
      provider: entry.provider,
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
      cached: entry.cached ?? false,
      ...cost,
    };

    costRecords.push(record);
    if (costRecords.length > MAX_RECORDS) costRecords.shift();

    // 预算检查
    checkBudgets(record);

    return record;
  }

  /**
   * 检查预算告警
   */
  function checkBudgets(record) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const dailyCost = costRecords
      .filter((r) => r.timestamp >= todayStart)
      .reduce((s, r) => s + r.totalCostUsd, 0);
    const monthlyCost = costRecords
      .filter((r) => r.timestamp >= monthStart)
      .reduce((s, r) => s + r.totalCostUsd, 0);

    // 单次请求告警
    if (record.totalCostUsd > budgets.perRequest) {
      triggerAlert("per_request_exceeded", {
        cost: record.totalCostUsd,
        budget: budgets.perRequest,
        model: record.model,
        requestId: record.requestId,
      });
    }

    // 日预算告警
    const dailyPercent = (dailyCost / budgets.daily) * 100;
    for (const threshold of alertThresholds) {
      const key = `daily_${threshold}`;
      if (dailyPercent >= threshold && !alertedThresholds.has(key)) {
        alertedThresholds.add(key);
        triggerAlert("daily_budget_threshold", {
          threshold,
          currentCost: dailyCost,
          budget: budgets.daily,
          percent: dailyPercent,
        });
      }
    }

    // 月预算告警
    const monthlyPercent = (monthlyCost / budgets.monthly) * 100;
    for (const threshold of alertThresholds) {
      const key = `monthly_${threshold}`;
      if (monthlyPercent >= threshold && !alertedThresholds.has(key)) {
        alertedThresholds.add(key);
        triggerAlert("monthly_budget_threshold", {
          threshold,
          currentCost: monthlyCost,
          budget: budgets.monthly,
          percent: monthlyPercent,
        });
      }
    }
  }

  function triggerAlert(type, data) {
    for (const cb of alertCallbacks) {
      try { cb({ type, data, timestamp: Date.now() }); } catch (err) { console.error("[realtimeCostTracker]:", err?.message || err); }
    }
  }

  /**
   * 注册告警回调
   */
  function onAlert(callback) {
    alertCallbacks.push(callback);
  }

  /**
   * 获取成本摘要
   * @param {string} period - "today" | "month" | "all"
   * @returns {Object}
   */
  function getCostSummary(period = "today") {
    const now = Date.now();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    let filtered = costRecords;
    if (period === "today") filtered = costRecords.filter((r) => r.timestamp >= todayStart);
    if (period === "month") filtered = costRecords.filter((r) => r.timestamp >= monthStart);

    const totalCost = filtered.reduce((s, r) => s + r.totalCostUsd, 0);
    const totalInputTokens = filtered.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutputTokens = filtered.reduce((s, r) => s + r.outputTokens, 0);
    const cachedRequests = filtered.filter((r) => r.cached).length;

    // 按模型分组
    const byModel = {};
    for (const r of filtered) {
      const m = r.model ?? "unknown";
      if (!byModel[m]) byModel[m] = { requests: 0, cost: 0, tokens: 0 };
      byModel[m].requests++;
      byModel[m].cost += r.totalCostUsd;
      byModel[m].tokens += r.inputTokens + r.outputTokens;
    }

    // 按 Provider 分组
    const byProvider = {};
    for (const r of filtered) {
      const p = r.provider ?? "unknown";
      if (!byProvider[p]) byProvider[p] = { requests: 0, cost: 0, tokens: 0 };
      byProvider[p].requests++;
      byProvider[p].cost += r.totalCostUsd;
      byProvider[p].tokens += r.inputTokens + r.outputTokens;
    }

    return {
      period,
      totalRequests: filtered.length,
      totalCostUsd: round6(totalCost),
      totalInputTokens,
      totalOutputTokens,
      cachedRequests,
      cacheRate: filtered.length > 0 ? cachedRequests / filtered.length : 0,
      avgCostPerRequest: filtered.length > 0 ? round6(totalCost / filtered.length) : 0,
      byModel,
      byProvider,
      budgets: {
        daily: { limit: budgets.daily, spent: round6(getDailyCost()), percent: round2((getDailyCost() / budgets.daily) * 100) },
        monthly: { limit: budgets.monthly, spent: round6(getMonthlyCost()), percent: round2((getMonthlyCost() / budgets.monthly) * 100) },
      },
    };
  }

  function getDailyCost() {
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    return costRecords.filter((r) => r.timestamp >= todayStart).reduce((s, r) => s + r.totalCostUsd, 0);
  }

  function getMonthlyCost() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return costRecords.filter((r) => r.timestamp >= monthStart).reduce((s, r) => s + r.totalCostUsd, 0);
  }

  /**
   * 获取支持的模型定价
   */
  function getPricing() {
    return Object.fromEntries(
      Object.entries(pricing).filter(([k]) => k !== "_default").map(([k, v]) => [
        k,
        { ...v, unit: "USD per 1M tokens" },
      ])
    );
  }

  /**
   * 获取健康状态
   */
  function getHealth() {
    return {
      status: "ready",
      totalRecords: costRecords.length,
      dailyCost: round6(getDailyCost()),
      monthlyCost: round6(getMonthlyCost()),
      dailyBudget: budgets.daily,
      monthlyBudget: budgets.monthly,
      dailyPercent: round2((getDailyCost() / budgets.daily) * 100),
      monthlyPercent: round2((getMonthlyCost() / budgets.monthly) * 100),
      supportedModels: Object.keys(pricing).length - 1,
    };
  }

  return {
    calculateCost,
    recordCost,
    onAlert,
    getCostSummary,
    getPricing,
    getHealth,
    budgets,
  };
}

function normalizeModelName(model) {
  if (!model) return "_default";
  // 去掉 provider 前缀 (e.g., "openai/gpt-4o" -> "gpt-4o")
  const parts = model.split("/");
  return parts[parts.length - 1].toLowerCase();
}

function round6(n) { return Math.round(n * 1000000) / 1000000; }
function round2(n) { return Math.round(n * 100) / 100; }
