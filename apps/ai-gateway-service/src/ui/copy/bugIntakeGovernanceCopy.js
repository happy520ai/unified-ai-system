export const bugIntakeGovernanceCopy = {
  title: "Bug Intake 与修复治理",
  subtitle: "最终 UI 锁定后，所有问题先进入 issue ledger。P0/P1 只做计划和阻断建议，未批准前不执行修复。",
  severity: [
    "P0：secret 泄露、读取原始敏感配置、误 deploy/release/tag/artifact、默认 /chat 或 /chat-gateway/execute 断裂、数据丢失。",
    "P1：核心 UI 不可用、核心 routing 不可用、rollback/safe mode 或 provider gate 断裂。",
    "P2：UX 摩擦、routing 质量、evidence 混淆、评分或 fallback 弱点。",
    "P3：copy、docs、布局 polish、轻微 panel 清晰度。"
  ],
  rules: [
    "每个 fix 必须有 issueId、evidenceRef、rollback plan 和 regression command。",
    "P0/P1、Provider、secret、chat、deploy、selectable 相关修复必须单独授权。",
    "本阶段只生成候选，不默认应用 runtime 修复。"
  ]
};
