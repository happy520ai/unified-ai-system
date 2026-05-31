# Phase324B-6 NVIDIA Smoke Batch Report

## Preview Summary

- safeCandidateCount: 52
- plannedSmokeCount: 5

## Run Summary

- processedCount: 5
- smokePassedCount: 4
- smokeFailedCount: 1
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324C5Count: 4

## Results

### google/gemma-4-31b-it

- finalStatus: smoke_passed
- providerCalled: true
- httpStatus: 200
- errorCode: none
- evidenceId: phase324b6-google_gemma_4_31b_it-20260506155542
- selectableRecommendation: eligible_after_phase324c5

### google/gemma-7b

- finalStatus: smoke_failed
- providerCalled: true
- httpStatus: 410
- errorCode: nvidia_http_error
- evidenceId: phase324b6-google_gemma_7b-20260506155543
- selectableRecommendation: not_eligible

### meta/llama-3.2-1b-instruct

- finalStatus: smoke_passed
- providerCalled: true
- httpStatus: 200
- errorCode: none
- evidenceId: phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- selectableRecommendation: eligible_after_phase324c5

### meta/llama-3.2-3b-instruct

- finalStatus: smoke_passed
- providerCalled: true
- httpStatus: 200
- errorCode: none
- evidenceId: phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- selectableRecommendation: eligible_after_phase324c5

### meta/llama-4-maverick-17b-128e-instruct

- finalStatus: smoke_passed
- providerCalled: true
- httpStatus: 200
- errorCode: none
- evidenceId: phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- selectableRecommendation: eligible_after_phase324c5

## Boundary

- Passed models can only enter future Phase324C-5 review.
- This phase did not modify selectable metadata or Chat dropdown.
- Rollback is limited to B-6 evidence/report/index files.

