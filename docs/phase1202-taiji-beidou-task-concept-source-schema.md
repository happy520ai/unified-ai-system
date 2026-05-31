# Phase1202 Taiji / Beidou Task Concept Source Schema

Phase1202 是 Phase1201 之后的 schema 层。

它把自然语言任务拆成四类太极 / 北斗场输入源：

- positive sources: 任务目标、期望结果、用户想要什么。
- negative sources: 禁止方向、风险、不能做什么。
- constraint sources: 成本、安全、范围、技术边界。
- context sources: 已有模块、已有 evidence、已有 Phase 结果。

它只产生 candidate readout targets，不真实执行。

## Boundary

- 不调用 Provider。
- 不读 secret。
- 不改 /chat。
- 不改 /chat-gateway/execute。
- 不下载 GloVe。
- 不声明真实语义智能。
- 只做 synthetic dry-run。

## Readout Targets

Phase1202 输出 capabilityCandidates、phaseCandidates、executionPathCandidates。
这些候选只用于后续阶段设计，不代表运行时能力已接入。

## Preparation

Phase1202 为以下阶段做准备：

- Phase1203 Capability Candidate Readout Schema
- Phase1204 Main Chain Approval Design
- Phase1205 Provider Boundary Review
