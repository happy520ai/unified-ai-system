# Phase324B-2 NVIDIA Smoke Batch Report

- batchId: phase324b2
- generatedAt: 2026-05-06T13:06:52.561Z
- plannedModelCount: 5
- processedModelCount: 5
- smokePassedCount: 4
- smokeFailedCount: 1
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324C2Count: 4
- selectableGateModified: false
- chatDropdownModified: false

## Models

### abacusai/dracarys-llama-3.1-70b-instruct

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 1011
- evidenceId: phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/abacusai_dracarys_llama_3_1_70b_instruct.json
- selectableRecommendation: eligible_after_phase324c2

### meta/llama-3.1-70b-instruct

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 2143
- evidenceId: phase324b2-meta_llama_3_1_70b_instruct-20260506130559
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/meta_llama_3_1_70b_instruct.json
- selectableRecommendation: eligible_after_phase324c2

### meta/llama-3.1-8b-instruct

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 30503
- evidenceId: phase324b2-meta_llama_3_1_8b_instruct-20260506130631
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/meta_llama_3_1_8b_instruct.json
- selectableRecommendation: eligible_after_phase324c2

### meta/llama-3.3-70b-instruct

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 18410
- evidenceId: phase324b2-meta_llama_3_3_70b_instruct-20260506130650
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/meta_llama_3_3_70b_instruct.json
- selectableRecommendation: eligible_after_phase324c2

### meta/llama2-70b

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- errorCode: nvidia_http_error
- latencyMs: 80
- evidenceId: phase324b2-meta_llama2_70b-20260506130652
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/meta_llama2_70b.json
- selectableRecommendation: not_eligible

