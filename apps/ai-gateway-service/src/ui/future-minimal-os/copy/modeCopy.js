export const modeCopy = {
  defaultRecommendedMode: "Tianshu",
  modes: {
    Normal: {
      name: "Normal",
      plainName: "普通问题",
      summary: "单模型、低成本、低延迟，适合边界清楚的小任务。",
      recommendedFor: "快速"
    },
    God: {
      name: "God",
      plainName: "重要判断",
      summary: "多 reviewer 复核，适合需要更稳判断和风险权衡的问题。",
      recommendedFor: "复核"
    },
    Tianshu: {
      name: "Tianshu",
      plainName: "复杂任务",
      summary: "Planner / executor 思路，适合多步骤、需要证据链的任务。",
      recommendedFor: "推荐"
    }
  },
  recommendation: {
    prefix: "系统建议",
    safePreviewOnly: "仅生成安全预案",
    normalWhy: "任务比较直接，可以先给出轻量方案。",
    godWhy: "任务包含风险或取舍，先做复核更稳。",
    tianshuWhy: "任务包含多步信息，先规划再执行更稳。"
  }
};
