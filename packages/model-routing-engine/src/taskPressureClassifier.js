import { normalizeRoutingInput } from "./modelRoutingContract.js";

const CODING_HINTS = ["code", "bug", "fix", "refactor", "代码", "修复", "报错", "函数"];
const PLANNING_HINTS = ["plan", "architecture", "roadmap", "方案", "规划", "架构", "阶段"];
const RISK_HINTS = ["security", "risk", "audit", "review", "安全", "审查", "风险", "合规"];
const JSON_HINTS = ["json", "schema", "结构化", "字段"];

export function classifyTaskPressure(input = {}) {
  const normalized = normalizeRoutingInput(input);
  const text = normalized.userTask.toLowerCase();
  const estimatedTokens = normalized.context.estimatedInputTokens;
  const tokenPressure = normalized.context.requiresLongContext || estimatedTokens >= 12000 ? "high" : estimatedTokens >= 4000 ? "medium" : "low";
  const contextPressure = tokenPressure;
  const reasoningPressure = normalized.constraints.preferReasoning || hasAny(text, PLANNING_HINTS) || normalized.mode === "tianshu" ? "high" : hasAny(text, JSON_HINTS) ? "medium" : "low";
  const latencyPressure = normalized.constraints.preferLowLatency || text.length < 80 ? "high" : "medium";
  const costPressure = normalized.constraints.preferLowCost || normalized.constraints.maxEstimatedCostUsd === 0 ? "high" : "medium";
  const reliabilityPressure = normalized.mode === "god" || hasAny(text, RISK_HINTS) ? "high" : normalized.context.requiresJson ? "medium" : "low";
  const codingPressure = normalized.constraints.preferCoding || hasAny(text, CODING_HINTS) ? "high" : "low";
  const modeRecommendation = chooseMode(normalized, {
    tokenPressure,
    reasoningPressure,
    reliabilityPressure,
    codingPressure,
  });

  return {
    phase: "Phase802",
    taskPressureClassifierReady: true,
    tokenPressure,
    costPressure,
    latencyPressure,
    reasoningPressure,
    reliabilityPressure,
    contextPressure,
    codingPressure,
    modeRecommendation,
    providerCallsMade: false,
    secretRead: false,
  };
}

function chooseMode(input, pressure) {
  if (input.mode !== "auto") return input.mode;
  if (pressure.reliabilityPressure === "high") return "god";
  if (pressure.reasoningPressure === "high" || pressure.tokenPressure === "high") return "tianshu";
  return "normal";
}

function hasAny(text, hints) {
  return hints.some((hint) => text.includes(hint));
}
