# Phase324B-4 NVIDIA Smoke Batch Report

- phase: Phase324B-4
- batchId: phase324b4
- generatedAt: 2026-05-06T15:14:31.398Z
- providerId: nvidia
- plannedModelCount: 5
- processedModelCount: 5
- smokePassedCount: 1
- smokeFailedCount: 4
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324C3Count: 1
- nonNvidiaCallsDetected: false
- secretExposureDetected: false
- selectableGateModified: false
- chatDropdownModified: false
- phase313VerificationStateModified: false

## Planned Models

- `bytedance/seed-oss-36b-instruct`
- `deepseek-ai/deepseek-v3.1-terminus`
- `deepseek-ai/deepseek-v3.2`
- `deepseek-ai/deepseek-v4-flash`
- `deepseek-ai/deepseek-v4-pro`

## Per Model Results

### bytedance/seed-oss-36b-instruct

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 200
- errorCode: nvidia_http_error
- latencyMs: 8574
- evidenceId: phase324b4-bytedance_seed_oss_36b_instruct-20260506151339
- evidencePath: apps/ai-gateway-service/evidence/phase324b4/bytedance_seed_oss_36b_instruct.json
- selectableRecommendation: not_eligible

### deepseek-ai/deepseek-v3.1-terminus

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 410
- errorCode: nvidia_http_error
- latencyMs: 96
- evidenceId: phase324b4-deepseek_ai_deepseek_v3_1_terminus-20260506151340
- evidencePath: apps/ai-gateway-service/evidence/phase324b4/deepseek_ai_deepseek_v3_1_terminus.json
- selectableRecommendation: not_eligible

### deepseek-ai/deepseek-v3.2

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 410
- errorCode: nvidia_http_error
- latencyMs: 96
- evidenceId: phase324b4-deepseek_ai_deepseek_v3_2-20260506151342
- evidencePath: apps/ai-gateway-service/evidence/phase324b4/deepseek_ai_deepseek_v3_2.json
- selectableRecommendation: not_eligible

### deepseek-ai/deepseek-v4-flash

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: n/a
- errorCode: nvidia_request_timeout
- latencyMs: 45012
- evidenceId: phase324b4-deepseek_ai_deepseek_v4_flash-20260506151428
- evidencePath: apps/ai-gateway-service/evidence/phase324b4/deepseek_ai_deepseek_v4_flash.json
- selectableRecommendation: not_eligible

### deepseek-ai/deepseek-v4-pro

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 930
- evidenceId: phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431
- evidencePath: apps/ai-gateway-service/evidence/phase324b4/deepseek_ai_deepseek_v4_pro.json
- selectableRecommendation: eligible_after_phase324c3

## Phase324C-3 Review Candidates

- eligible_for_phase324c3_selectable_review: `deepseek-ai/deepseek-v4-pro`
- not_eligible_for_phase324c3: `bytedance/seed-oss-36b-instruct`, `deepseek-ai/deepseek-v3.1-terminus`, `deepseek-ai/deepseek-v3.2`, `deepseek-ai/deepseek-v4-flash`

## Boundary

- This phase only generated Phase324B-4 NVIDIA smoke evidence.
- No selectable metadata was updated.
- No Chat dropdown, Chat send, /chat-gateway/execute, httpServer.js, or provider client code was modified.
- Smoke-passed models require a separate Phase324C-3 selectable review before any Chat dropdown change.

