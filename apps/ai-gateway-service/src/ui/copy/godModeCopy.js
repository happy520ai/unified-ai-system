export const godModeCopy = {
  summary: "God 适合重要问题：让两个视角先审查，再给出合成答案。",
  participantLabel: "审查视角",
  supervisorLabel: "汇总视角",
  maxParticipantsLabel: "最多审查数",
  autoSelectLabel: "自动选择合适审查视角",
  introLines: [
    "适合风险判断、路线取舍、质量复核。",
    "当前只做安全预览，不调用真实 Provider，不代表人工 review。"
  ],
  inputLabel: "重要问题",
  inputPlaceholder: "输入需要谨慎判断的问题，例如：这次发布前还有哪些风险？",
  conflictTitle: "审查摘要",
  conflictLines: [
    "reviewerA: pending",
    "reviewerB: pending",
    "synthesis: pending",
    "fallbackReason: none",
  ],
  transparencyTitle: "汇总说明",
  transparencyLines: [
    "finalAnswer: pending",
    "decisionBasis: []",
    "uncertainty: preview only",
    "warnings: no provider call",
  ],
  sendLabel: "预览 God 方案",
};
