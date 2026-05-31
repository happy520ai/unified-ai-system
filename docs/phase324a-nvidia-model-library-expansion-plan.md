# Phase324A NVIDIA Model Library Expansion Plan

Generated: 2026-05-06

## 1. 当前模型库基线

- provider slots 已存在：
  - `nvidia`
  - `openai`
  - `claude`
  - `openrouter`
  - `mimo`
  - `local`
- 当前真实外部 provider 仍只有 NVIDIA。
- 当前 verified chat models 只有 2 个：
  - `nvidia/llama-3.1-nemotron-nano-8b-v1`
  - `nvidia/llama-3.3-nemotron-super-49b-v1`
- Phase313A evidence 基线显示 NVIDIA provider-slot records 为 148 条。
- 本轮基于当前静态源码和本地 evidence 可只读复建 104 条 registry records。
- selectable gate 保持不变：
  - `smoke_passed`
  - 无 `blocked / deprecated / manual_review_required`
  - capability bucket 明确
  - 有 `evidenceId`
  - 未验证模型不得进入 Chat 下拉

## 2. Phase324A 本轮结论

- 本轮只做只读盘点。
- 本轮未调用 NVIDIA。
- 本轮未修改 registry。
- 本轮未修改 Chat 下拉。
- 本轮未修改 `/chat-gateway/execute`。
- 本轮未修改 selectable gate。
- 本轮明确区分两种口径：
  - Phase313A 运营基线：148 条 NVIDIA provider-slot records
  - 当前静态源码可复建：104 条 records

## 3. Phase324B smoke batch 目标

- 第一批新增目标：5 个左右 priority candidates。
- 稳定后目标：扩到 10-20 个 verified chat models。
- 每批不要过大，第一批建议 5，最大不超过 10。
- 每批必须保留独立 evidence。

## 4. Phase324B smoke 成功标准

每个模型至少需要：

- real NVIDIA provider call
- `providerCalled=true`
- `completionVerified=true`
- `assistantText` 非空
- response envelope 合法
- latency / error 信息记录
- `evidenceId`
- 不输出 key
- 不把 dry-run 当成功

## 5. Phase324B smoke 失败分类

- `nvidia_api_key_missing`
- `provider_http_error`
- `timeout`
- `model_not_available`
- `completion_empty`
- `completion_unverified`
- `schema_invalid`
- `manual_review_required`

## 6. Selectable gate 规则保持

- 只有 `smoke_passed` 才可进 Chat 下拉。
- `blocked / deprecated / manual-review` 不能进。
- `unknown capability` 不能进。
- 无 `evidenceId` 不能进。
- 非 NVIDIA 不在本轮 selectable 扩容范围。

## 7. 不碰多 Provider 的原因

- 当前 capabilitySafeExecutionRouter 仍应保持 non-NVIDIA blocked / future slot 边界。
- 多 provider 真实调用必须另开阶段。
- 当前 provider slot 不能等同于当前真实产品能力。
- Phase324A / 324B / 324C 先把 NVIDIA verified set 做稳，再谈多 provider。

## 8. Phase324B 第一批建议

优先 smoke 这 5 个 NVIDIA publisher 自有候选：

- `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- `nvidia/nemotron-3-nano-30b-a3b`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/nemotron-mini-4b-instruct`
- `nvidia/nvidia-nemotron-nano-9b-v2`

原因：

- 都属于 `nvidia/*`
- 都是 `reasoning_chat`
- 当前为 `unverified`
- 不属于 deprecated / blocked / smoke_failed
- 不依赖 special payload
- 不属于 embedding / rerank / multimodal / biology / video 等非 Chat 主线

## 9. 已知不应纳入第一批的模型

- `nvidia/llama-3.1-nemotron-ultra-253b-v1`
  - 已知 `smoke_failed`
  - 失败码：`nvidia_http_error`
  - 当前不应作为 priority candidate

## 10. 后续 Phase 建议

- Phase324B：NVIDIA smoke batch 工具与第一批真实 smoke
- Phase324C：基于 smoke_passed 更新 selectable verified set
- Phase324D：模型库 UI 显示失败原因 / evidence / capability
- Phase324E：再评估多 provider，但不是现在
