# Phase1301A Neural Fabric Feasibility Whitepaper

## 1. 目的

本白皮书定义 Neural Fabric 在 PME AI Gateway / PME Mission Control 里的位置、边界、不可做事项和长期路线。

本阶段只做文档化定义，不引入 runtime，不接 `/chat`，不接 `/chat-gateway/execute`，不调用 Provider，不读取 secret。

## 2. Neural Fabric 的定义

Neural Fabric 在这里不是一个新 Provider，也不是一个新的模型，不是一个执行引擎，更不是一个绕过现有网关的隐式通道。

它更适合被定义为 PME 内部的概念层、策略层和能力编排语义层，用来回答下面这些问题：

- 这个能力属于哪个 capability bucket。
- 这个模型或动作是否允许进入普通 Chat。
- 这个动作需要什么验证状态和证据。
- 这个能力未来是否可以进入受控的路由或任务编排。

换句话说，Neural Fabric 负责“如何描述、分类、约束和解释能力”，不负责“直接执行能力”。

## 3. 在 PME 中的位置

Neural Fabric 处在产品语义层，介于“用户意图”和“具体执行面”之间，但它不直接替代执行面。

在 PME 里，它更像下面这几层之间的协调边界：

- 上游：用户意图、任务说明、产品目标
- 中层：模型能力、验证状态、可选性、证据链、策略约束
- 下游：Chat Gateway、任务工具、UI 展示、审计和回放

它可以帮助 PME 形成统一语言，但不能变成一个黑箱总开关。

## 4. 允许承担的职责

Neural Fabric 未来可以负责：

- 定义 capability taxonomy。
- 统一模型能力标签。
- 统一 selectable gate 解释语义。
- 统一 evidence 结构和阶段状态。
- 统一“为什么不能调用”的说明。
- 统一“为什么可调用”的说明。
- 为未来的路由建议提供只读语义输入。

这些职责都应以“可解释、可审计、可回退”为前提。

## 5. 不可做事项

Neural Fabric 在 PME 中不可做：

- 不能直接发起 Provider 调用。
- 不能读取或打印 secret。
- 不能读取 `.env` 明文。
- 不能接管 `/chat` 默认链路。
- 不能接管 `/chat-gateway/execute` 默认链路。
- 不能绕过 selectable gate。
- 不能把 unverified 模型标成 selectable。
- 不能把 non-chat 模型放进普通 Chat 下拉。
- 不能伪造 completionVerified。
- 不能伪造 evidenceId。
- 不能把失败模型写成成功。
- 不能把设计层概念冒充成已落地 runtime。

如果未来某个提案需要其中任何一项，就不再属于本白皮书范围，必须重新开新阶段。

## 6. 可行性判断

结论是：**作为设计层和治理层，Neural Fabric 可行；作为当前 runtime 主链能力，不可直接落地。**

可行的原因：

- PME 已经有模型库、验证状态、证据链和安全边界这些基础材料。
- PME 已经区分了 Chat 模型与任务工具模型。
- PME 已经要求 selectable gate、evidence、verificationStatus 这些硬约束。

不可直接落地的原因：

- 当前阶段没有 runtime 变更。
- 当前阶段没有 Provider 调用。
- 当前阶段没有 `/chat` 或 `/chat-gateway/execute` 连接。
- 当前阶段没有新的执行契约。

所以这一步只能先做定义，再做分层，最后才谈受控集成。

## 7. 长期路线

建议把 Neural Fabric 的长期路线分成 5 层：

### 7.1 概念层

先统一术语、边界和不变量。

目标：

- 统一什么是 Neural Fabric。
- 统一什么不是 Neural Fabric。
- 统一它和 PME 的关系。

### 7.2 语义层

把模型、任务、证据、策略、状态抽成稳定字段。

目标：

- capability bucket 稳定化。
- verificationStatus 稳定化。
- selectable 语义稳定化。
- evidence 语义稳定化。

### 7.3 只读编排层

先做建议，不做自动执行。

目标：

- 解释为什么推荐某个模型。
- 解释为什么拒绝某个模型。
- 解释为什么某个任务必须进入 manual review。

### 7.4 受控执行层

只有在独立批准后，才考虑把 Neural Fabric 接到受控的任务编排或路由建议链路。

目标：

- 明确执行边界。
- 明确回退路径。
- 明确证据要求。

### 7.5 产品化层

最后才考虑把它变成 PME 的稳定产品能力。

目标：

- 用户看得懂。
- 运维看得懂。
- 审计看得懂。
- 出问题能回退。

## 8. 失败条件

以下情况说明 Neural Fabric 还不能进入下一层：

- 语义定义不稳定。
- 证据结构不稳定。
- selectable gate 解释不稳定。
- 仍需要隐式 Provider 调用。
- 仍需要 secret 才能工作。
- 仍依赖 `/chat` 默认链路改造。
- 仍依赖绕过现有安全边界。

只要命中一条，就说明路线需要降级回设计层。

## 9. 结论

Neural Fabric 在 PME 里最合理的位置，是“能力语义和治理层”。

它适合先作为白皮书、术语表、策略边界和未来路线图存在。
它不适合在本阶段直接变成 runtime、Provider 调用器或 Chat 默认链路。

本阶段结论：**可行，但仅限设计层；当前不进入执行层。**

## 10. Result Artifact

- Evidence JSON: `apps/ai-gateway-service/evidence/phase1301a/neural-fabric-feasibility-result.json`
- Scope: docs only
- Runtime changes: none
- Provider calls: none
- Secret reads: none

