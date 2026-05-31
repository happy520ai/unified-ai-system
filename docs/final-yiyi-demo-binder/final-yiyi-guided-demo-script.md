# Final Yiyi Guided Demo Script

## 30 秒开场

这是一个 Agent-managed AI Mission Control，不是普通 Chatbot。依依不是聊天皮肤，而是 Mission Companion：她负责把模式、风险、证据和边界讲清楚。今天看到的是 guided demo，默认 dry-run，默认不调用 provider，不读取 secret，不 deploy，也不声称 production GA。

## 依依开场台词

“欢迎来到 Mission Control。我会带你走一轮依依商业演示：这是一套 guided demo，默认不调用 provider、不读取 secret、不 deploy，所有关键画面都有本地 evidence 可以回看。”

## 3 分钟快速演示版

1. 开场：Mission Control + 依依 + Safety Boundary Bar。
2. Guided Showcase stepper：说明这是引导式演示，不会阻塞主 UI。
3. Normal Mode：展示普通聊天入口的概念，但当前只做 preview。
4. God Mode：展示 Reviewer / Critic / Risk Scout / Supervisor 的协同感。
5. Tianshu：展示任务理解、能力匹配、路径规划、fallback。
6. Security Shield + Red Team：展示危险请求被拦截。
7. Evidence Replay：展示 evidenceId、blockedActions、fallbackReason。
8. Yiyi Brain Status：强调 model brain disabled by default。
9. 结尾：总结高级感、可玩性、安全感，但仍是 internal guided demo。

## 8 分钟完整演示版

### 1. 系统定位

- 这套系统是 Agent-managed AI Mission Control。
- 不是把多个模型塞进一个普通聊天窗口。
- 核心卖点是模式、护盾、证据和调度心智可视化。

### 2. 依依是谁

- 依依是 Mission Companion。
- 她负责解释系统状态、风险边界和 evidence。
- 她的陪伴感来自可解释、稳定和有节奏的引导，而不是夸大能力。

### 3. Normal / God / Tianshu

- Normal Mode：普通模式，展示直接聊天入口的概念。
- God Mode：多角色审视与风控视角，突出“不是单模型一把梭”。
- Tianshu：调度与路径规划视角，突出“任务理解 + 能力匹配 + fallback”。

### 4. Security Shield 演示

- 讲清 prompt injection、secret leak、provider gate、approval gate。
- 强调可见化，而不是口头说“我们很安全”。

### 5. Red Team Block 演示

- 请求 API key、绕过审批、强制 deploy 等都被拦截。
- 被展示的是 blocked result，不是危险动作执行结果。

### 6. Evidence Replay 演示

- 展示 evidenceId、trace、blockedActions、fallbackReason、replay posture。
- 强调“可复核”，不是“相信我”。

### 7. Yiyi Brain Status

- 当前 model brain disabled by default。
- 当前 provider call disabled by default。
- 真实 provider test 归属于 Phase384，必须显式授权。

### 8. 结尾总结

- 高级：不是普通 chatbot，而是可视化任务总控。
- 好玩：三模式、红队、证据回放让体验更有参与感。
- 稳定：默认 dry-run，不依赖真实 provider 才能讲清能力。
- 安全：no secret、no provider call、no deploy 有明确边界。

## 技术评审讲法

- 先讲系统边界，再讲 UI 能力，再讲 evidence。
- 强调 browser smoke、screenshot index、trace map、blocked action evidence。
- 明确当前不修改默认 chat 主链，不接真实 provider runtime。

## 销售演示讲法

- 先用“不是普通 Chatbot”打开差异。
- 再讲 Yiyi 作为 Mission Companion 的陪伴感与解释力。
- 然后展示 God / Tianshu 的高级感。
- 最后用 Security Shield 和 Evidence Replay 建立信任。

## Security Shield 演示话术

“我们不是把安全写进一段文案里，而是把 provider gate、approval gate、secret boundary 直接做成可以看见的演示面。”

## Red Team Block 演示话术

“这里不是表演危险动作，而是表演系统如何把危险动作挡住，并留下能复核的 evidence。”

## Evidence Replay 演示话术

“每个关键画面后面都有 trace、blocked action 和 fallback 说明，所以这套 Demo 的可信度来自 evidence，不来自口头承诺。”

## Yiyi Brain 状态说明

- model brain disabled by default
- no provider call by default
- mock / dry-run posture
- real provider test requires explicit authorization

## 结尾总结

这套 Final Binder 对外表达的是：依依已经具备一套高级、安全、可玩、可复核的商业演示形态，但它仍然不是 production GA，也没有默认打开真实 provider。