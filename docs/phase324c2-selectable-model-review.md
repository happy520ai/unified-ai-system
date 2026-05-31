# Phase324C-2 Selectable Model Review

- generatedAt: 2026-05-06T13:17:06.477Z
- eligibleModelCount: 5
- rejectedModelCount: 5
- evidenceMissing: false
- evidenceModelMismatch: false

## eligibleModels

### abacusai/dracarys-llama-3.1-70b-instruct

- evidenceId: phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/abacusai_dracarys_llama_3_1_70b_instruct.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- capabilityBucket: chat
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null

### meta/llama-3.1-70b-instruct

- evidenceId: phase324b2-meta_llama_3_1_70b_instruct-20260506130559
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/meta_llama_3_1_70b_instruct.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- capabilityBucket: chat
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b2-meta_llama_3_1_70b_instruct-20260506130559; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null

### meta/llama-3.1-8b-instruct

- evidenceId: phase324b2-meta_llama_3_1_8b_instruct-20260506130631
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/meta_llama_3_1_8b_instruct.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- capabilityBucket: chat
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b2-meta_llama_3_1_8b_instruct-20260506130631; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null

### meta/llama-3.3-70b-instruct

- evidenceId: phase324b2-meta_llama_3_3_70b_instruct-20260506130650
- evidencePath: apps/ai-gateway-service/evidence/phase324b2/meta_llama_3_3_70b_instruct.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- capabilityBucket: chat
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b2-meta_llama_3_3_70b_instruct-20260506130650; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null

### microsoft/phi-4-mini-instruct

- evidenceId: phase324b3-microsoft_phi_4_mini_instruct-20260506130704
- evidencePath: apps/ai-gateway-service/evidence/phase324b3/microsoft_phi_4_mini_instruct.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- capabilityBucket: chat
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b3-microsoft_phi_4_mini_instruct-20260506130704; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null

## rejectedModels

### meta/llama2-70b

- evidenceId: phase324b2-meta_llama2_70b-20260506130652
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- rejectionReason: httpStatus=404; assistantTextPresent=false; not eligible for selectable

### meta/llama3-8b

- evidenceId: phase324b3-meta_llama3_8b-20260506130700
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- rejectionReason: httpStatus=404; assistantTextPresent=false; not eligible for selectable

### microsoft/phi-3-mini-4k-instruct

- evidenceId: phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 410
- rejectionReason: httpStatus=410; assistantTextPresent=false; not eligible for selectable

### mistralai/mistral-7b-instruct

- evidenceId: phase324b3-mistralai_mistral_7b_instruct-20260506130705
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- rejectionReason: httpStatus=404; assistantTextPresent=false; not eligible for selectable

### mistralai/mistral-7b-instruct-v0.3

- evidenceId: phase324b3-mistralai_mistral_7b_instruct_v0_3-20260506130707
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 404
- rejectionReason: httpStatus=404; assistantTextPresent=false; not eligible for selectable

## selectable update plan

- 只更新 5 个 eligible provider-slot 模型在 `phase-313a-model-verification-state.json` 中的 verified metadata。
- 写入字段：`verificationStatus`、`lastVerifiedAt`、`lastSmokeMode`、`lastSmokeResult`、`failureCode`、`failureReason`、`providerCalled`、`endpointUsed`、`evidenceId`。
- 5 个 rejected models 维持不可选。
- 不修改 selectable gate 逻辑，不修改 Chat Gateway，不修改 provider client。

