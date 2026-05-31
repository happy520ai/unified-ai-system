# Phase324C-6 Selectable Model Review

- Scope: review only Phase324B-7 smoke_passed allowlist model.
- Allowed model: `minimaxai/minimax-m2.7`.
- B-7 failed models stay rejected and are not added to selectable.

- previousSelectableModels: 16
- plannedSelectableModels: 17
- previousSmokePassedModels: 16
- plannedSmokePassedModels: 17

## Eligible

### minimaxai/minimax-m2.7

- evidenceId: phase324b7-minimaxai_minimax_m2_7-20260506164801
- evidencePath: apps/ai-gateway-service/evidence/phase324b7/minimaxai_minimax_m2_7.json
- latencyMs: 1479
- selectableRecommendation: eligible_after_phase324c6
- decisionReason: phase324b7_smoke_passed_evidence_complete

## Rejected

### microsoft/phi-3-medium-128k-instruct

- finalStatus: smoke_failed
- httpStatus: 410
- errorCode: nvidia_http_error
- evidenceId: phase324b7-microsoft_phi_3_medium_128k_instruct-20260506164709
- evidencePath: apps/ai-gateway-service/evidence/phase324b7/microsoft_phi_3_medium_128k_instruct.json
- decisionReason: phase324b7_http_410_not_eligible

### microsoft/phi-4-mini-flash-reasoning

- finalStatus: smoke_failed
- httpStatus: 410
- errorCode: nvidia_http_error
- evidenceId: phase324b7-microsoft_phi_4_mini_flash_reasoning-20260506164710
- evidencePath: apps/ai-gateway-service/evidence/phase324b7/microsoft_phi_4_mini_flash_reasoning.json
- decisionReason: phase324b7_http_410_not_eligible

### microsoft/trellis

- finalStatus: smoke_failed
- httpStatus: 404
- errorCode: nvidia_http_error
- evidenceId: phase324b7-microsoft_trellis-20260506164712
- evidencePath: apps/ai-gateway-service/evidence/phase324b7/microsoft_trellis.json
- decisionReason: phase324b7_http_404_not_eligible

### minimaxai/minimax-m2.5

- finalStatus: smoke_failed
- httpStatus: n/a
- errorCode: nvidia_request_timeout
- evidenceId: phase324b7-minimaxai_minimax_m2_5-20260506164758
- evidencePath: apps/ai-gateway-service/evidence/phase324b7/minimaxai_minimax_m2_5.json
- decisionReason: phase324b7_timeout_not_eligible

### google/gemma-7b

- finalStatus: smoke_failed
- httpStatus: 410
- errorCode: nvidia_http_error
- evidenceId: none
- evidencePath: apps/ai-gateway-service/evidence/phase324b6/google_gemma_7b.json
- decisionReason: phase324b6_http_410_not_eligible

## Boundary

- Chat main chain was not touched.
- Selectable gate logic was not touched.
- Only Phase324C-6 apply may update Phase313A verification metadata.

