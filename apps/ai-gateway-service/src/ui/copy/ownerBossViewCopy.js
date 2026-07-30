export const ownerBossViewCopy = Object.freeze({
  osMark: "OPEN AI CONTROL PLANE",
  heroQuestion: "让模型、智能体与工具协同工作",
  heroSubtitle:
    "通过一个本地优先入口连接聊天、知识、Agent 协作、模型路由与受控自动化，并让人始终保有最终决定权。",
  localOnlyBoundary: "LOCAL-FIRST / GOVERNED",
  localOnlyDetail: "默认假模型，无密钥可运行；真实 Provider 必须显式配置和授权。",
  taskInputLabel: "你希望系统完成什么？",
  taskInputPlaceholder: "例如：分析任务、检索知识、选择模型，并给出可审计的执行计划。",
  taskInputHelp: "输入后按 Enter，或点击下面主按钮。",
  primaryAction: "运行网关检查",
  primaryActionHint: "验证健康、路由、Agent 协作、知识与治理边界。",
  waitingFeedback:
    "待命。运行检查后，这里会显示可用能力、明确边界和下一步。",
  feedbackStates: ["待命", "网关", "智能体", "治理", "下一步"],
  completedTitle: "本地优先入口",
  completedKicker: "无需密钥",
  completedItems: [
    "默认假模型可直接运行。",
    "健康、界面和聊天链路可验证。",
    "数据与配置由运行者掌控。",
  ],
  problemsTitle: "智能协同链路",
  problemsKicker: "可组合",
  problemsItems: [
    "多模型路由与适配器。",
    "Agent 计划、角色与任务队列。",
    "知识检索与上下文塑形。",
  ],
  nextTitle: "治理进入执行路径",
  nextKicker: "人类掌权",
  nextItems: [
    "真实调用需要显式授权。",
    "预算、证据与回滚保持可见。",
    "失败与未验证状态不会被隐藏。",
  ],
  dailyReportTitle: "当前公开能力",
  dailyReportIntro:
    "这份状态区分已经可验证的能力、仍需配置的路径，以及尚未获得独立证据的目标。",
  dailyReportItems: [
    "本地启动：无需 Provider 密钥。",
    "网关聊天：默认通过本地假模型验证。",
    "真实 Provider：由用户配置并显式启用。",
    "生产、L5 与 AGI：仍需独立评估证据。",
    "安全原则：不暴露密钥明文。",
  ],
  readinessItems: [
    {
      label: "无密钥本地启动",
      value: "默认假模型可运行",
      tone: "success",
    },
    {
      label: "多模型网关",
      value: "路由与适配器已接入",
      tone: "success",
    },
    {
      label: "Agent 协作",
      value: "计划、角色与任务队列",
      tone: "success",
    },
    {
      label: "治理边界",
      value: "授权、预算、证据与回滚",
      tone: "warn",
    },
    {
      label: "生产、L5 与 AGI",
      value: "仍需独立验证",
      tone: "neutral",
    },
  ],
  advancedSummary: "高级模式：查看架构与运行细节",
  advancedIntro:
    "下面是面向开发、评估与故障排查的详细运行视图，默认保持收起。",
});
