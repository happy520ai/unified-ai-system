export const workforcePreviewCopy = Object.freeze({
  title: "Workforce 本地真实执行",
  subtitle: "把目标拆成角色、计划和本地任务队列；真实保存运行证据，Provider 和密钥仍受控。",
  boundaryBadges: ["本地执行", "Provider 受控", "不读取密钥", "不部署发布", "不提交推送"],
  status: [
    ["职位库", "基于 SOC / ISCO / O*NET / ESCO 种子清单进行角色匹配"],
    ["员工金字塔", "L0-L6 虚拟专家角色，用于本地编排和责任分配"],
    ["本地任务队列", "生成计划、保存计划、建立队列、逐项记录完成"],
    ["大脑接入边界", "Provider 受控；本地执行不会读取密钥或自动消耗模型额度"],
  ],
  pyramidLevels: [
    "L0 System Governor",
    "L1 Executive Council",
    "L2 Domain Chiefs",
    "L3 Principal Experts",
    "L4 Senior Specialists",
    "L5 Operators",
    "L6 Assistants",
  ],
  dryRunSummary: {
    task: "为 AI Gateway Workbench 规划一次本地真实 Workforce 执行，生成角色分工、任务队列和证据。",
    selected: "Product Manager, UX Researcher, AI Gateway Engineer",
    rejected: "Security Chief and QA remain candidates; provider and project mutation remain gated.",
    evidence: "phase1961a local real run evidence",
  },
});
