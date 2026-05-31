# Phase324B-3 NVIDIA Smoke Batch Report

- batchId: phase324b3
- generatedAt: 2026-05-06T13:07:07.227Z
- plannedModelCount: 5
- processedModelCount: 5
- smokePassedCount: 1
- smokeFailedCount: 4
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324C2Count: 1
- selectableGateModified: false
- chatDropdownModified: false

## Models

### meta/llama3-8b

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- errorCode: nvidia_http_error
- latencyMs: 314
- evidenceId: phase324b3-meta_llama3_8b-20260506130700
- evidencePath: apps/ai-gateway-service/evidence/phase324b3/meta_llama3_8b.json
- selectableRecommendation: not_eligible

### microsoft/phi-3-mini-4k-instruct

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 410
- errorCode: nvidia_http_error
- latencyMs: 50
- evidenceId: phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702
- evidencePath: apps/ai-gateway-service/evidence/phase324b3/microsoft_phi_3_mini_4k_instruct.json
- selectableRecommendation: not_eligible

### microsoft/phi-4-mini-instruct

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 446
- evidenceId: phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- evidencePath: apps/ai-gateway-service/evidence/phase324b3/microsoft_phi_4_mini_instruct.json
- selectableRecommendation: eligible_after_phase324c2

### mistralai/mistral-7b-instruct

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- errorCode: nvidia_http_error
- latencyMs: 50
- evidenceId: phase324b3-mistralai_mistral_7b_instruct-20260506130705
- evidencePath: apps/ai-gateway-service/evidence/phase324b3/mistralai_mistral_7b_instruct.json
- selectableRecommendation: not_eligible

### mistralai/mistral-7b-instruct-v0.3

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- errorCode: nvidia_http_error
- latencyMs: 76
- evidenceId: phase324b3-mistralai_mistral_7b_instruct_v0_3-20260506130707
- evidencePath: apps/ai-gateway-service/evidence/phase324b3/mistralai_mistral_7b_instruct_v0_3.json
- selectableRecommendation: not_eligible

