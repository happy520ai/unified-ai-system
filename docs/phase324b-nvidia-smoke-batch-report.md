# Phase324B NVIDIA Smoke Batch Report

- phase: Phase324B
- generatedAt: 2026-05-06T12:43:19.434Z
- providerId: nvidia
- plannedModelCount: 5
- processedModelCount: 5
- smokePassedCount: 2
- smokeFailedCount: 3
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324CCount: 2
- nonNvidiaCallsDetected: false
- secretExposureDetected: false
- selectableGateModified: false
- chatDropdownModified: false

## 本轮实际 smoke 模型

- `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- `nvidia/nemotron-3-nano-30b-a3b`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/nemotron-mini-4b-instruct`
- `nvidia/nvidia-nemotron-nano-9b-v2`

## 逐模型结果

### nvidia/llama-3.3-nemotron-super-49b-v1.5

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 200
- errorCode: nvidia_http_error
- latencyMs: 3360
- evidenceId: phase324b-nvidia_llama_3_3_nemotron_super_49b_v1_5-20260506124310
- evidencePath: apps/ai-gateway-service/evidence/phase324b/nvidia_llama_3_3_nemotron_super_49b_v1_5.json
- selectableRecommendation: not_eligible
- notes: Provider responded but the smoke did not complete successfully; keep non-selectable until a later verified phase.

### nvidia/nemotron-3-nano-30b-a3b

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 200
- errorCode: nvidia_http_error
- latencyMs: 402
- evidenceId: phase324b-nvidia_nemotron_3_nano_30b_a3b-20260506124312
- evidencePath: apps/ai-gateway-service/evidence/phase324b/nvidia_nemotron_3_nano_30b_a3b.json
- selectableRecommendation: not_eligible
- notes: Provider responded but the smoke did not complete successfully; keep non-selectable until a later verified phase.

### nvidia/nemotron-3-super-120b-a12b

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 974
- evidenceId: phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314
- evidencePath: apps/ai-gateway-service/evidence/phase324b/nvidia_nemotron_3_super_120b_a12b.json
- selectableRecommendation: eligible_after_phase324c
- notes: Real NVIDIA call completed with non-empty assistant text; Phase324C may review selectable eligibility.

### nvidia/nemotron-mini-4b-instruct

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 428
- evidenceId: phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- evidencePath: apps/ai-gateway-service/evidence/phase324b/nvidia_nemotron_mini_4b_instruct.json
- selectableRecommendation: eligible_after_phase324c
- notes: Real NVIDIA call completed with non-empty assistant text; Phase324C may review selectable eligibility.

### nvidia/nvidia-nemotron-nano-9b-v2

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 200
- errorCode: nvidia_http_error
- latencyMs: 1267
- evidenceId: phase324b-nvidia_nvidia_nemotron_nano_9b_v2-20260506124319
- evidencePath: apps/ai-gateway-service/evidence/phase324b/nvidia_nvidia_nemotron_nano_9b_v2.json
- selectableRecommendation: not_eligible
- notes: Provider responded but the smoke did not complete successfully; keep non-selectable until a later verified phase.

## Phase324C 候选

- eligible_for_phase324c_selectable_review: `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-mini-4b-instruct`
- not_eligible_for_phase324c: `nvidia/llama-3.3-nemotron-super-49b-v1.5`, `nvidia/nemotron-3-nano-30b-a3b`, `nvidia/nvidia-nemotron-nano-9b-v2`

## 边界说明

- 本轮只调用 NVIDIA。
- 本轮未修改 selectable gate、Chat 下拉、/chat-gateway/execute、Chat send、consolePage.js、apiClient.js、httpServer.js。
- smoke_passed 只用于新增 evidence，不在本轮自动进入 selectable。
- Phase324C 才允许基于完整 evidence 做 selectable review。

