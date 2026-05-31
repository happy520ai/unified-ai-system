export const ownerBossViewCopy = Object.freeze({
  osMark: "AI Gateway Workbench / 小天总控",
  heroQuestion: "把今天要处理的事交给小天",
  heroSubtitle:
    "这是你的真实可用总控。聊天、知识库、本地动作、三模式任务和受控 Provider Bridge 已经放到一个简单入口里；生产部署和公开发布已排除。",
  localOnlyBoundary: "非生产真实可用",
  localOnlyDetail: "本地动作可执行；Provider 只走 credentialRef 受控桥；不读取密钥明文。",
  taskInputLabel: "今天让小天帮你做什么？",
  taskInputPlaceholder: "例如：帮我检查系统状态，整理今天任务，并告诉我下一步该做什么。",
  taskInputHelp: "输入后按 Enter，或点击下面主按钮。",
  primaryAction: "启动总控检查",
  primaryActionHint: "检查本地能力、任务闭环、Provider Bridge 和桌面一键启动。",
  waitingFeedback:
    "未开始。点击主按钮后，小天会显示真实可用状态、阻塞项和下一步。",
  feedbackStates: ["待命", "本地动作", "三模式", "Provider Bridge", "下一步"],
  completedTitle: "本地动作已就绪",
  completedKicker: "可执行",
  completedItems: [
    "桌面一键启动已更新。",
    "真实本地文件动作已通过。",
    "不会扫描桌面其他文件。",
  ],
  problemsTitle: "三模式任务已就绪",
  problemsKicker: "任务闭环",
  problemsItems: [
    "Normal 可做直接任务闭环。",
    "God 可生成并比较多个方案。",
    "Tianshu 可推荐安全路线。",
  ],
  nextTitle: "Provider Bridge 受控就绪",
  nextKicker: "真实调用边界",
  nextItems: [
    "credentialRef-only 桥已就绪。",
    "真实 one-shot 仍需 credentialRef 成功。",
    "失败不会伪装成通过。",
  ],
  dailyReportTitle: "真实可用状态",
  dailyReportIntro:
    "这份状态只保留你需要知道的结果：哪些已经能用、哪些仍受控、哪些明确不做。",
  dailyReportItems: [
    "本地动作：真实执行就绪。",
    "三模式任务：真实闭环就绪。",
    "Provider Bridge：受控执行就绪，真实 one-shot 仍需 credentialRef 成功。",
    "生产部署和公开发布已排除。",
    "密钥读取：未发生。",
  ],
  readinessItems: [
    {
      label: "桌面一键启动已更新",
      value: "可直接打开本地总控",
      tone: "success",
    },
    {
      label: "本地动作已就绪",
      value: "文件创建类任务可真实执行",
      tone: "success",
    },
    {
      label: "三模式任务已就绪",
      value: "Normal / God / Tianshu 可闭环",
      tone: "success",
    },
    {
      label: "Provider Bridge 受控就绪",
      value: "真实 one-shot 仍需 credentialRef 成功",
      tone: "warn",
    },
    {
      label: "生产部署和公开发布已排除",
      value: "本轮不声称生产或发布就绪",
      tone: "neutral",
    },
  ],
  advancedSummary: "高级模式：查看工程细节",
  advancedIntro:
    "下面是给开发和排查用的内容。默认收起，老板日常不需要看。",
});
