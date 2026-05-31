# Phase324C-5 Selectable Model Review

- Scope: review only Phase324B-6 smoke_passed allowlist models.
- `google/gemma-7b` is rejected because Phase324B-6 returned HTTP 410.
- No B-6 failed or non-allowlist model is eligible.

- previousSelectableModels: 12
- plannedSelectableModels: 16
- previousSmokePassedModels: 12
- plannedSmokePassedModels: 16

## Eligible

### google/gemma-4-31b-it

- evidenceId: phase324b6-google_gemma_4_31b_it-20260506155542
- evidencePath: apps/ai-gateway-service/evidence/phase324b6/google_gemma_4_31b_it.json
- latencyMs: 5182
- selectableRecommendation: eligible_after_phase324c5
- decisionReason: phase324b6_smoke_passed_evidence_complete

### meta/llama-3.2-1b-instruct

- evidenceId: phase324b6-meta_llama_3_2_1b_instruct-20260506155545
- evidencePath: apps/ai-gateway-service/evidence/phase324b6/meta_llama_3_2_1b_instruct.json
- latencyMs: 329
- selectableRecommendation: eligible_after_phase324c5
- decisionReason: phase324b6_smoke_passed_evidence_complete

### meta/llama-3.2-3b-instruct

- evidenceId: phase324b6-meta_llama_3_2_3b_instruct-20260506155547
- evidencePath: apps/ai-gateway-service/evidence/phase324b6/meta_llama_3_2_3b_instruct.json
- latencyMs: 463
- selectableRecommendation: eligible_after_phase324c5
- decisionReason: phase324b6_smoke_passed_evidence_complete

### meta/llama-4-maverick-17b-128e-instruct

- evidenceId: phase324b6-meta_llama_4_maverick_17b_128e_instruct-20260506155549
- evidencePath: apps/ai-gateway-service/evidence/phase324b6/meta_llama_4_maverick_17b_128e_instruct.json
- latencyMs: 510
- selectableRecommendation: eligible_after_phase324c5
- decisionReason: phase324b6_smoke_passed_evidence_complete

## Rejected

### google/gemma-7b

- finalStatus: smoke_failed
- httpStatus: 410
- errorCode: nvidia_http_error
- evidenceId: phase324b6-google_gemma_7b-20260506155543
- evidencePath: apps/ai-gateway-service/evidence/phase324b6/google_gemma_7b.json
- decisionReason: phase324b6_http_410_not_eligible

## Boundary

- Chat main chain was not touched.
- Selectable gate logic was not touched.
- Only Phase324C-5 apply may update Phase313A verification metadata.

