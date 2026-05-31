# Phase575 Sample Dry-run First Multi-Human Trial

## 当前状态

Phase574 已封板，Mission Control 已新增“试用一个任务”入口，并通过真实 Chromium 验证。sample dry-run 链路已存在：

用户任务 -> Mission Understanding -> 推荐 Tianshu -> Security Shield -> Provider / CredentialRef -> Evidence Replay -> Next Step。

Phase575 的目标是让 2-3 位真实非 Codex 内部试用者完成这条链路，并独立填写反馈。本阶段只接收和分类真实人类反馈，不直接修改 UI。

## 当前阻断

截至本报告生成时，尚未收到至少 2 位真实非 Codex 内部试用者反馈。

因此 Phase575 当前状态为 blocked：

- completed=false
- recommended_sealed=false
- blocker=sample_dry_run_non_codex_feedback_count_below_minimum

这不是产品 UI 失败，而是真实反馈数量未满足验收条件。

## 试用者要求

- 至少 2 位真实非 Codex 内部试用者
- 目标 3 位
- 每人独立体验
- 每人独立填写反馈
- 不允许 Codex 代填
- 不允许把 Codex 判断伪装成真人反馈

每位试用者必须先完成：

1. 打开 Mission Control。
2. 找到“试用一个任务”。
3. 点击或查看 sample dry-run。
4. 看完 Mission Understanding。
5. 看完 Recommended Mode。
6. 看完 Security Shield。
7. 看完 Provider / CredentialRef。
8. 看完 Evidence Replay。
9. 看完 Next Step。

## 必须保持的边界

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- Yiyi / character remains hidden
- 不输入真实 API Key
- 不调用 OpenAI / Claude / OpenRouter / MiMo / NVIDIA
- 不修改 `/chat`
- 不修改 `/chat-gateway/execute`
- 不修改 provider runtime
- 不修改 selectable gate
- 不声称 workspace clean

