# Phase324B-2+B-3 Execution Report

- batch2Executed: true
- batch3Executed: true
- totalProcessedModels: 10
- smokePassedCount: 5
- smokeFailedCount: 5
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- selectableGateModified: false
- chatDropdownModified: false
- phase313VerificationStateModified: false
- nonNvidiaCallsDetected: false
- secretExposureDetected: false

## Batch 2 Models

- `abacusai/dracarys-llama-3.1-70b-instruct`: smoke_passed, evidenceId=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555
- `meta/llama-3.1-70b-instruct`: smoke_passed, evidenceId=phase324b2-meta_llama_3_1_70b_instruct-20260506130559
- `meta/llama-3.1-8b-instruct`: smoke_passed, evidenceId=phase324b2-meta_llama_3_1_8b_instruct-20260506130631
- `meta/llama-3.3-70b-instruct`: smoke_passed, evidenceId=phase324b2-meta_llama_3_3_70b_instruct-20260506130650
- `meta/llama2-70b`: smoke_failed, evidenceId=phase324b2-meta_llama2_70b-20260506130652

## Batch 3 Models

- `meta/llama3-8b`: smoke_failed, evidenceId=phase324b3-meta_llama3_8b-20260506130700
- `microsoft/phi-3-mini-4k-instruct`: smoke_failed, evidenceId=phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702
- `microsoft/phi-4-mini-instruct`: smoke_passed, evidenceId=phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- `mistralai/mistral-7b-instruct`: smoke_failed, evidenceId=phase324b3-mistralai_mistral_7b_instruct-20260506130705
- `mistralai/mistral-7b-instruct-v0.3`: smoke_failed, evidenceId=phase324b3-mistralai_mistral_7b_instruct_v0_3-20260506130707

## Phase324C-2 Candidates

- eligible_for_phase324c2_selectable_review: `abacusai/dracarys-llama-3.1-70b-instruct`, `meta/llama-3.1-70b-instruct`, `meta/llama-3.1-8b-instruct`, `meta/llama-3.3-70b-instruct`, `microsoft/phi-4-mini-instruct`
- not_eligible_for_phase324c2: `meta/llama2-70b`, `meta/llama3-8b`, `microsoft/phi-3-mini-4k-instruct`, `mistralai/mistral-7b-instruct`, `mistralai/mistral-7b-instruct-v0.3`

## Boundary

- This phase only generated new NVIDIA smoke evidence.
- No selectable metadata was updated.
- Phase324C-2 is required before any newly passed model can enter the selectable verified set.

