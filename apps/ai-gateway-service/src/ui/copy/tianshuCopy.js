export const tianshuCopy = {
  summary: "Tianshu 适合复杂任务：先规划，再拆步骤，最后给出下一步。",
  taskPreviewLabel: "任务判断",
  taskPreviewPending: "taskClassification: pending",
  allowGodLabel: "需要时允许升级为 God 审查",
  introLine: "适合多步骤、跨阶段、需要路线判断的任务。当前只生成预览，不执行真实 Provider 调用。",
  inputLabel: "复杂任务",
  inputPlaceholder: "输入一个复杂任务，例如：帮我规划下一阶段 UI 修复和验证路线。",
  plannerTitle: "规划说明",
  plannerLines: [
    "plannerStatus: pending",
    "selectedSteps: []",
    "rejectedPaths: []",
    "capabilityMatch: []",
  ],
  fallbackTitle: "备用路径",
  fallbackLines: [
    "reason: pending",
    "nextActions: preview / refine / review",
    "provider warning: no provider call",
    "dryRunNotice: preview only",
  ],
  sendLabel: "预览 Tianshu 方案",
};
