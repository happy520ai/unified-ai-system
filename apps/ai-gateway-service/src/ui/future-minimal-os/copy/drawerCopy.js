export const drawerCopy = {
  title: "高级详情",
  subtitle: "需要排查时再展开",
  openLabel: "查看详情",
  closeLabel: "收起详情",
  groups: {
    provider: {
      title: "Provider / CredentialRef",
      body: "只说明未来会使用 credentialRef，不展示密钥。本阶段不会调用真实 Provider。"
    },
    evidence: {
      title: "Evidence Replay",
      body: "只展示预案证据结构，帮助理解推荐原因，不代表真实任务已经执行。"
    },
    security: {
      title: "Security Boundary",
      body: "本阶段不读 secret、不调用模型、不部署、不改变 /chat 或 /chat-gateway/execute。"
    },
    diagnostics: {
      title: "Diagnostics",
      body: "诊断信息默认隐藏，避免第一屏堆工程细节；需要排查时再展开。"
    }
  }
};
