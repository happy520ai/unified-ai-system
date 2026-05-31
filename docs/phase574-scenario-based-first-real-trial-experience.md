# Phase574 Scenario-Based First Real Trial Experience

## 基线

Phase574 基于 Phase573R 后的纯 AI Gateway / Mission Control 可见界面继续推进。人物、伴生、avatar、character、Guided Showcase、floating avatar 入口保持隐藏。

Phase573 因缺少真实非 Codex 多人反馈仍未封板；本阶段不收集或伪造真人反馈，只补齐试用者“从哪里开始体验”的 dry-run 链路。

## 本阶段目标

新增一个低风险、无 provider 调用的 sample task 体验入口，让试用者可以按一条完整链路理解 Mission Control：

1. 看到 sample task。
2. 理解 Mission Control 如何判断任务意图。
3. 看到推荐模式为 Tianshu。
4. 理解 Normal / God / Tianshu 的差异。
5. 理解 Security Shield 为什么判定 guarded。
6. 理解 Provider / CredentialRef 为什么不会真实调用。
7. 看到 Evidence Replay preview 和本地 trace。
8. 知道下一步如何选择模式。

## 新增体验入口

入口标题为“试用一个任务”，挂载在 Mission Control 首屏区域。

Sample task：

> 我有一个复杂需求，需要判断应该用单模型直聊、多模型互审，还是任务规划模式来处理。

入口动作使用锚点定位，不绑定真实 provider 行为：

- 开始 sample dry-run
- 查看三模式如何判断
- 查看安全盾如何拦截风险
- 查看 Evidence Replay

## Dry-Run 边界

本阶段所有结果均为本地 dry-run preview：

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- 不需要 API Key
- 不生成真实模型输出
- 不修改 `/chat`
- 不修改 `/chat-gateway/execute`
- 不修改 provider runtime
- 不修改 selectable gate

## Dry-Run 链路

结果区展示：

- Step 1：用户任务
- Step 2：Mission Understanding
- Step 3：Recommended Mode
- Step 4：Security Shield
- Step 5：Provider / CredentialRef
- Step 6：Evidence Replay
- Step 7：Next Step

推荐模式为 Tianshu，因为 sample task 的核心是先规划、拆解、选择模型组合与执行路线。

## 验收

Phase574 verifier 使用真实 Chromium 打开 `/ui?phase574=real-browser`，截图并保存 DOM snapshot。验收要求包括：

- sample task 入口可见
- dry-run / no-provider-call / no-secret / no-deploy / no-billing / no-invoice 可见
- Mission Understanding / Recommended Mode / Security Shield / Provider / CredentialRef / Evidence Replay preview / Next Step 可见
- Normal / God / Tianshu 差异可见
- 人物模块关键词不可见
- 危险按钮不可见
- 误导生产文案不可见

