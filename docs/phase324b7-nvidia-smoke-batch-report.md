# Phase324B-7 NVIDIA Smoke Batch Report

## Preview Summary

- safeCandidateCount: 47
- plannedSmokeCount: 5

## Run Summary

- processedCount: 5
- smokePassedCount: 1
- smokeFailedCount: 4
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324C6Count: 1

## Results

### microsoft/phi-3-medium-128k-instruct

- finalStatus: smoke_failed
- providerCalled: true
- httpStatus: 410
- errorCode: nvidia_http_error
- evidenceId: phase324b7-microsoft_phi_3_medium_128k_instruct-20260506164709
- selectableRecommendation: not_eligible

### microsoft/phi-4-mini-flash-reasoning

- finalStatus: smoke_failed
- providerCalled: true
- httpStatus: 410
- errorCode: nvidia_http_error
- evidenceId: phase324b7-microsoft_phi_4_mini_flash_reasoning-20260506164710
- selectableRecommendation: not_eligible

### microsoft/trellis

- finalStatus: smoke_failed
- providerCalled: true
- httpStatus: 404
- errorCode: nvidia_http_error
- evidenceId: phase324b7-microsoft_trellis-20260506164712
- selectableRecommendation: not_eligible

### minimaxai/minimax-m2.5

- finalStatus: smoke_failed
- providerCalled: true
- httpStatus: n/a
- errorCode: nvidia_request_timeout
- evidenceId: phase324b7-minimaxai_minimax_m2_5-20260506164758
- selectableRecommendation: not_eligible

### minimaxai/minimax-m2.7

- finalStatus: smoke_passed
- providerCalled: true
- httpStatus: 200
- errorCode: none
- evidenceId: phase324b7-minimaxai_minimax_m2_7-20260506164801
- selectableRecommendation: eligible_after_phase324c6

## Boundary

- Passed models can only enter future Phase324C-6 review.
- This phase did not modify selectable metadata or Chat dropdown.
- Rollback is limited to B-7 evidence/report/index files.

