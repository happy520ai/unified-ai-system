# Phase392A Yiyi Demo FAQ Pack

This FAQ pack gives the presenter safe, commercial-ready answers for the Yiyi guided demo.

## 依依是什么？

依依是 Mission Companion，负责把 Mission Control 的模式、安全边界、证据链和演示节奏讲清楚。
## 这为什么不是普通 Chatbot？

演示重点是 Agent-managed AI Mission Control：模式选择、安全护盾、红队攻防、证据回放和大脑状态，而不是单次问答。
## Normal / God / Tianshu 有什么差异？

Normal 展示直接聊天概念，God 展示多角色评审视角，Tianshu 展示任务理解、路径规划和 fallback 的调度感；当前均为 dry-run preview。
## Security Shield 的价值是什么？

它把 prompt injection、secret leak、provider gate、approval gate 等风险可视化，帮助用户理解系统如何先挡风险。
## Red Team Playground 有什么商业展示价值？

它让攻击被拦截这件事变得可见、可玩、可讲解，展示系统不是只靠口头承诺安全。
## Evidence Replay 为什么重要？

它把 evidenceId、trace、blockedActions、fallbackReason 等信息组织成可复核链路，建立演示可信度。
## 为什么模型大脑默认关闭？

这是安全默认值。真实 provider test 需要 Phase384 的明确 provider/model/credential/request/cost 授权。
## 什么时候能做真实模型测试？

只有当用户明确给出 allowProviderCall=true、providerRefs、credentialRefs、modelRefs、maxRequests 和成本上限后，才可进入 Phase384 具体测试。
## 这是否已经生产可用？

不能这么声称。当前是本地商业 Demo 包，未 deploy、未 release、未生产 GA。
## 还需要什么人工复核？

仍建议做人工录屏复核、跨浏览器复核、销售话术彩排，以及如需真实模型测试则单独走 Phase384 授权。

# Objection Handling

## 客户要求现场调用真实 provider

当前演示保持 no-provider-call。可以记录为 Phase384 授权需求，待 provider/model/credential/request/cost 边界明确后再测试。
## 客户要求展示 API Key

不能展示密钥明文。系统只展示安全状态、credentialRef 或 masked 状态。
## 客户要求立即部署或发布

本阶段不 deploy、不 release。可以进入独立部署准备阶段，但不能把 demo 包说成生产上线。
## 客户问是否能生成账单

本演示不生成真实 invoice，不执行 billing。只能讲安全边界和未来商业化接口方向。
