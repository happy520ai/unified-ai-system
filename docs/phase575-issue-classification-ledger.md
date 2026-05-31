# Phase575 Issue Classification Ledger

## Counts

- P0 blocker: 0
- P1 high: 0
- P2 medium: 0
- P3 low: 0

## Classification Basis

当前没有足够真实非 Codex 反馈，因此不创建真实问题项，不把 Codex 判断写成真人反馈。

## P0 Blocker Criteria

- 页面打不开
- sample dry-run 无法使用
- 人物模块重新出现
- secret 暴露
- provider 被误调用
- deploy / release / billing / invoice 被误触发
- `/chat` 或 `/chat-gateway/execute` 被破坏

## P1 High Criteria

- 多数试用者不知道从哪里开始
- 多数试用者不理解 sample dry-run
- 多数试用者误以为会真实调用 provider
- 多数试用者误以为需要 API Key
- 多数试用者误以为 billing / invoice / deploy 已启用
- 多数试用者无法理解 Tianshu 推荐原因

## P2 Medium Criteria

- sample task 帮助有限
- 三模式仍有理解成本
- Tianshu 价值仍不够突出
- Security Shield 仍偏技术化
- Evidence Replay 仍像 debug 面板
- 按钮仍有轻微焦虑
- 信息密度仍偏高

## P3 Low Criteria

- 文案微调
- 标题优化
- 步骤顺序建议
- 辅助说明补充
- 视觉层级建议

## Boundary

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- Yiyi / character remains hidden

