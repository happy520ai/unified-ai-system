export const ownerTrialFeedbackCopy = {
  title: "Owner 真实手动试用反馈",
  subtitle: "这里只接收 owner 本人填写的手动试用结果。Codex 自测、浏览器 smoke、外部 tester 都不会被算作 owner feedback。",
  statusMissing: "等待 owner 填写 local-self-use/v1/owner-trial/owner-feedback.input.json",
  statusReady: "已检测到 owner 反馈输入，等待真实性校验。",
  guide: [
    "按第一屏、主 CTA、Normal、God、Tianshu、Provider/Evidence/Diagnostics、Local self-use、Issue ledger、Daily journal、Seven-day soak entry 顺序试用。",
    "记录真实卡点，不需要迎合系统。",
    "没有截图也可以提交，但必须说明 noEvidenceReason。"
  ],
  boundaries: [
    "不会调用真实 Provider。",
    "不会读取或显示 API Key / secret / auth.json。",
    "不会改 /chat 或 /chat-gateway/execute 默认行为。",
    "不会把缺失反馈伪造成已完成。"
  ]
};
