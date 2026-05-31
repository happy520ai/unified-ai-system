# Phase324C Selectable Model Review

- generatedAt: 2026-05-06T12:54:23.858Z
- eligibleModelCount: 2
- rejectedModelCount: 3
- evidenceMissing: false
- evidenceModelMismatch: false

## eligibleModels

### nvidia/nemotron-3-super-120b-a12b

- evidenceId: phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314
- evidencePath: apps/ai-gateway-service/evidence/phase324b/nvidia_nemotron_3_super_120b_a12b.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- capabilityBucket: reasoning_chat
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314; providerCalled=true; failureCode=null; failureReason=null

### nvidia/nemotron-mini-4b-instruct

- evidenceId: phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- evidencePath: apps/ai-gateway-service/evidence/phase324b/nvidia_nemotron_mini_4b_instruct.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- capabilityBucket: reasoning_chat
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316; providerCalled=true; failureCode=null; failureReason=null

## rejectedModels

### nvidia/llama-3.3-nemotron-super-49b-v1.5

- evidenceId: phase324b-nvidia_llama_3_3_nemotron_super_49b_v1_5-20260506124310
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- rejectionReason: completionVerified=false; assistantTextPresent=false; not eligible for selectable

### nvidia/nemotron-3-nano-30b-a3b

- evidenceId: phase324b-nvidia_nemotron_3_nano_30b_a3b-20260506124312
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- rejectionReason: completionVerified=false; assistantTextPresent=false; not eligible for selectable

### nvidia/nvidia-nemotron-nano-9b-v2

- evidenceId: phase324b-nvidia_nvidia_nemotron_nano_9b_v2-20260506124319
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- rejectionReason: completionVerified=false; assistantTextPresent=false; not eligible for selectable

## selectable update plan

- 只更新 2 个 eligible NVIDIA 模型在 `phase-313a-model-verification-state.json` 中的 verified metadata。
- 写入字段：`verificationStatus`、`lastVerifiedAt`、`lastSmokeMode`、`lastSmokeResult`、`failureCode`、`failureReason`、`providerCalled`、`endpointUsed`、`evidenceId`。
- 不修改 3 个 rejected models。
- 不修改 selectable gate 逻辑，不修改 Chat Gateway，不修改 provider client。

