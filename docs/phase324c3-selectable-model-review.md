# Phase324C-3 Selectable Model Review

- generatedAt: 2026-05-06T15:29:19.818Z
- eligibleModelCount: 1
- rejectedModelCount: 4
- evidenceMissing: false
- evidenceModelMismatch: false

## Eligible Model

### deepseek-ai/deepseek-v4-pro

- evidenceId: phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431
- evidencePath: apps/ai-gateway-service/evidence/phase324b4/deepseek_ai_deepseek_v4_pro.json
- finalStatus: smoke_passed
- providerCalled: true
- completionVerified: true
- assistantTextPresent: true
- httpStatus: 200
- capabilityBucket: reasoning_chat
- requiresSpecialPayload: false
- updatePlan: verificationStatus=smoke_passed; evidenceId=phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431; providerCalled=true; endpointUsed=chat_completions; failureCode=null; failureReason=null

## Rejected Models

### bytedance/seed-oss-36b-instruct

- evidenceId: phase324b4-bytedance_seed_oss_36b_instruct-20260506151339
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 200
- errorCode: nvidia_http_error
- rejectionReason: completionVerified=false; assistantTextPresent=false

### deepseek-ai/deepseek-v3.1-terminus

- evidenceId: phase324b4-deepseek_ai_deepseek_v3_1_terminus-20260506151340
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 410
- errorCode: nvidia_http_error
- rejectionReason: completionVerified=false; assistantTextPresent=false; httpStatus=410

### deepseek-ai/deepseek-v3.2

- evidenceId: phase324b4-deepseek_ai_deepseek_v3_2-20260506151342
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: 410
- errorCode: nvidia_http_error
- rejectionReason: completionVerified=false; assistantTextPresent=false; httpStatus=410

### deepseek-ai/deepseek-v4-flash

- evidenceId: phase324b4-deepseek_ai_deepseek_v4_flash-20260506151428
- finalStatus: smoke_failed
- providerCalled: true
- completionVerified: false
- assistantTextPresent: false
- httpStatus: n/a
- errorCode: nvidia_request_timeout
- rejectionReason: completionVerified=false; assistantTextPresent=false; nvidia_request_timeout

## Selectable Update Plan

- Only `deepseek-ai/deepseek-v4-pro` will be updated in `phase-313a-model-verification-state.json`.
- The four failed Phase324B-4 models stay non-selectable.
- No selectable gate logic, Chat Gateway code, provider client, or UI code is modified.

