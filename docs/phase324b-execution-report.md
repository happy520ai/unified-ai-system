# Phase324B Execution Report

## 本轮执行范围

- 新增独立 NVIDIA-only smoke batch 工具。
- 对固定 5 个 priority candidates 执行真实 NVIDIA smoke。
- 仅新增 Phase324B evidence / docs，不回写 registry / selectable。

## 实际修改文件

- `tools/phase324b/run-phase324b-nvidia-smoke-batch.mjs`
- `apps/ai-gateway-service/evidence/phase324b/*.json`
- `docs/phase324b-nvidia-smoke-batch-result.json`
- `docs/phase324b-nvidia-smoke-batch-report.md`
- `docs/phase324b-model-smoke-evidence-index.json`
- `docs/phase324b-execution-report.md`

## 安全边界确认

- 调用了 NVIDIA API: true
- 调用了非 NVIDIA API: false
- 修改生产代码: false
- 修改 selectable gate: false
- 新模型进入 Chat 下拉: false
- secret 输出风险: false

## 5 个模型 smoke 结果

- `nvidia/llama-3.3-nemotron-super-49b-v1.5`: smoke_failed, providerCalled=true, completionVerified=false, evidenceId=phase324b-nvidia_llama_3_3_nemotron_super_49b_v1_5-20260506124310
- `nvidia/nemotron-3-nano-30b-a3b`: smoke_failed, providerCalled=true, completionVerified=false, evidenceId=phase324b-nvidia_nemotron_3_nano_30b_a3b-20260506124312
- `nvidia/nemotron-3-super-120b-a12b`: smoke_passed, providerCalled=true, completionVerified=true, evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314
- `nvidia/nemotron-mini-4b-instruct`: smoke_passed, providerCalled=true, completionVerified=true, evidenceId=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- `nvidia/nvidia-nemotron-nano-9b-v2`: smoke_failed, providerCalled=true, completionVerified=false, evidenceId=phase324b-nvidia_nvidia_nemotron_nano_9b_v2-20260506124319

## Phase324C 推荐列表

- eligible_for_phase324c_selectable_review: nvidia/nemotron-3-super-120b-a12b, nvidia/nemotron-mini-4b-instruct
- not_eligible_for_phase324c: nvidia/llama-3.3-nemotron-super-49b-v1.5, nvidia/nemotron-3-nano-30b-a3b, nvidia/nvidia-nemotron-nano-9b-v2

## 风险与回滚说明

- 本轮风险集中在真实 NVIDIA 模型可用性、超时、404、限流与空响应，不涉及主链代码切换。
- 失败模型保持不可选，后续若要复测应在新阶段继续，不在本轮修改 selectable。
- 回滚方式仅需删除 Phase324B 新增 evidence / docs / tool；不需要 git reset 或 git clean。

## 是否建议封板

- 建议: 是
- 原因: 5 个固定候选均已被安全处理并生成独立 evidence；是否通过由真实结果决定，但本轮边界与记录完整。

