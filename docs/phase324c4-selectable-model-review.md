# Phase324C-4 Selectable Model Review

- Scope: review only Phase324B-5 smoke_passed models.
- B-5 failed models are not eligible.
- B-6 outputs are excluded from this phase.

- previousSelectableModels: 10
- plannedSelectableModels: 12
- previousSmokePassedModels: 10
- plannedSmokePassedModels: 12

## Eligible

### google/gemma-3n-e2b-it

- evidenceId: phase324b5-google_gemma_3n_e2b_it-20260506153306
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_3n_e2b_it.json
- latencyMs: 1112
- selectableRecommendation: eligible_after_phase324c4
- decisionReason: phase324b5_smoke_passed_evidence_complete

### google/gemma-3n-e4b-it

- evidenceId: phase324b5-google_gemma_3n_e4b_it-20260506153308
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_3n_e4b_it.json
- latencyMs: 817
- selectableRecommendation: eligible_after_phase324c4
- decisionReason: phase324b5_smoke_passed_evidence_complete

## Rejected

### google/codegemma-7b

- evidenceId: phase324b5-google_codegemma_7b-20260506153300
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_codegemma_7b.json
- finalStatus: smoke_failed
- httpStatus: 404
- errorCode: nvidia_http_error
- decisionReason: phase324b5_failed_model_forbidden

### google/gemma-2-2b-it

- evidenceId: phase324b5-google_gemma_2_2b_it-20260506153302
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_2_2b_it.json
- finalStatus: smoke_failed
- httpStatus: 422
- errorCode: nvidia_http_error
- decisionReason: phase324b5_failed_model_forbidden

### google/gemma-3-27b-it

- evidenceId: phase324b5-google_gemma_3_27b_it-20260506153303
- evidencePath: apps/ai-gateway-service/evidence/phase324b5/google_gemma_3_27b_it.json
- finalStatus: smoke_failed
- httpStatus: 400
- errorCode: nvidia_http_error
- decisionReason: phase324b5_failed_model_forbidden

## Boundary

- No B-6 result is reviewed.
- No failed B-5 model is selectable.
- No selectable gate, Chat Gateway, provider client, or UI code is touched.

