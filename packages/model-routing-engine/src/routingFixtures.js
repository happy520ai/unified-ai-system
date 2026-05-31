export const ROUTING_FIXTURES = Object.freeze([
  { taskId: "fixture-001", userTask: "用中文回答：什么是模型路由？", mode: "auto", constraints: { preferChinese: true, preferLowLatency: true }, context: { estimatedInputTokens: 120 }, safety: {} },
  { taskId: "fixture-002", userTask: "Fix this JavaScript bug and explain the patch.", mode: "auto", constraints: { preferCoding: true }, context: { estimatedInputTokens: 900 }, safety: {} },
  { taskId: "fixture-003", userTask: "总结这份长上下文项目记录并提炼风险。", mode: "auto", constraints: { preferLongContext: true }, context: { estimatedInputTokens: 18000, requiresLongContext: true }, safety: {} },
  { taskId: "fixture-004", userTask: "对这个架构方案做多模型审查，找出高风险问题。", mode: "god", constraints: { preferReasoning: true }, context: { estimatedInputTokens: 2400 }, safety: {} },
  { taskId: "fixture-005", userTask: "规划一个复杂的三阶段商业化交付路线。", mode: "tianshu", constraints: { preferReasoning: true, preferChinese: true }, context: { estimatedInputTokens: 3200 }, safety: {} },
  { taskId: "fixture-006", userTask: "低成本优先回答一个短问题。", mode: "normal", constraints: { preferLowCost: true }, context: { estimatedInputTokens: 100 }, safety: {} },
  { taskId: "fixture-007", userTask: "低延迟优先，快速给出排查方向。", mode: "normal", constraints: { preferLowLatency: true }, context: { estimatedInputTokens: 300 }, safety: {} },
  { taskId: "fixture-008", userTask: "以 JSON 输出字段 schema 和校验结果。", mode: "auto", constraints: {}, context: { estimatedInputTokens: 800, requiresJson: true }, safety: {} },
  { taskId: "fixture-009", userTask: "模拟 provider fallback：主模型不可用时如何降级。", mode: "auto", constraints: { preferReasoning: true }, context: { estimatedInputTokens: 1000 }, safety: {} },
  { taskId: "fixture-010", userTask: "高风险 blocked model exclusion regression.", mode: "god", constraints: { preferReasoning: true }, context: { estimatedInputTokens: 600 }, safety: {} },
]);
