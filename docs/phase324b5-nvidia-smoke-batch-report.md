# Phase324B-5 NVIDIA Smoke Batch Report

- phase: Phase324B-5
- batchId: phase324b5
- generatedAt: 2026-05-06T15:33:08.843Z
- providerId: nvidia
- plannedModelCount: 5
- processedModelCount: 5
- smokePassedCount: 2
- smokeFailedCount: 3
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324C4Count: 2
- nonNvidiaCallsDetected: false
- secretExposureDetected: false
- selectableGateModified: false
- chatDropdownModified: false
- phase313VerificationStateModified: false

## Planned Models

- `google/codegemma-7b`
- `google/gemma-2-2b-it`
- `google/gemma-3-27b-it`
- `google/gemma-3n-e2b-it`
- `google/gemma-3n-e4b-it`

## Per Model Results

### google/codegemma-7b

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- errorCode: nvidia_http_error
- latencyMs: 460
- evidenceId: phase324b5-google_codegemma_7b-20260506153300
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_codegemma_7b.json
- selectableRecommendation: not_eligible

### google/gemma-2-2b-it

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 422
- errorCode: nvidia_http_error
- latencyMs: 339
- evidenceId: phase324b5-google_gemma_2_2b_it-20260506153302
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_2_2b_it.json
- selectableRecommendation: not_eligible

### google/gemma-3-27b-it

- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 400
- errorCode: nvidia_http_error
- latencyMs: 59
- evidenceId: phase324b5-google_gemma_3_27b_it-20260506153303
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_3_27b_it.json
- selectableRecommendation: not_eligible

### google/gemma-3n-e2b-it

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 1112
- evidenceId: phase324b5-google_gemma_3n_e2b_it-20260506153306
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_3n_e2b_it.json
- selectableRecommendation: eligible_after_phase324c4

### google/gemma-3n-e4b-it

- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- errorCode: none
- latencyMs: 817
- evidenceId: phase324b5-google_gemma_3n_e4b_it-20260506153308
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_3n_e4b_it.json
- selectableRecommendation: eligible_after_phase324c4

## Phase324C-4 Review Candidates

- eligible_for_phase324c4_selectable_review: `google/gemma-3n-e2b-it`, `google/gemma-3n-e4b-it`
- not_eligible_for_phase324c4: `google/codegemma-7b`, `google/gemma-2-2b-it`, `google/gemma-3-27b-it`

## Boundary

- This phase only generated Phase324B-5 NVIDIA smoke evidence.
- No selectable metadata was updated.
- No Chat dropdown, Chat send, /chat-gateway/execute, httpServer.js, provider client, or model-library code was modified.
- Smoke-passed models require a separate Phase324C-4 selectable review before any Chat dropdown change.

