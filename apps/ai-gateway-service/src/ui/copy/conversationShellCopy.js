/**
 * v5 ConversationShell Copy — 对话壳文案
 * 全中文，无技术术语。用于 ConversationShell 组件的静态文案。
 */

export const conversationShellCopy = {
  placeholder: "说点什么…",
  sendLabel: "发送",
  moreLabel: "⋯ 更多",
  closeDrawerLabel: "收起",
  loadingText: "正在加载系统状态…",

  suggestions: {
    dailyReport: "看看今天日报",
    pendingApprovals: "审批那几项",
    workforceStatus: "员工在干嘛",
  },

  // 气泡角色标签（用户可见）
  roleLabels: {
    user: "你",
    system: "系统",
    assistant: "助手",
  },

  // 禁止在第一屏出现的术语（守卫用，spec §5.6）
  forbiddenTerms: [
    "Provider",
    "God Mode",
    "Tianshu",
    "CredentialRef",
    "NVIDIA",
    "API Key",
    "Token",
    "endpoint",
    "dry-run",
    "worktree",
    "Phase",
    "pgvector",
    "embedding",
    "sandboxed",
    "evidence",
    "trace",
    "verifier",
    "fallback",
    "route",
    "latency",
  ],

  // 术语替换表：将禁止术语替换为中文等价表述
  termReplacements: {
    "Provider": "模型服务",
    "God Mode": "严谨模式",
    "Tianshu": "规划模式",
    "CredentialRef": "连接配置",
    "NVIDIA": "模型服务",
    "API Key": "连接密钥",
    "dry-run": "预览模式",
    "fallback": "备用方案",
    "route": "路径",
    "latency": "响应速度",
  },
};
