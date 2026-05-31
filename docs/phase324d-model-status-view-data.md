# Phase324D Model Status View Data

- generatedAt: 2026-05-06T13:35:21.870Z
- totalModels: 148
- selectableModels: 9
- smokePassedModels: 9
- failedModels: 9
- unverifiedModels: 125
- providerScope: NVIDIA-only
- futureProvidersEnabled: false

## Selectable Models

| modelId | status | selectable | capability | evidenceId | reason |
| --- | --- | --- | --- | --- | --- |
| abacusai/dracarys-llama-3.1-70b-instruct | smoke_passed | true | chat | phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555 |  |
| meta/llama-3.1-70b-instruct | smoke_passed | true | chat | phase324b2-meta_llama_3_1_70b_instruct-20260506130559 |  |
| meta/llama-3.1-8b-instruct | smoke_passed | true | chat | phase324b2-meta_llama_3_1_8b_instruct-20260506130631 |  |
| meta/llama-3.3-70b-instruct | smoke_passed | true | chat | phase324b2-meta_llama_3_3_70b_instruct-20260506130650 |  |
| microsoft/phi-4-mini-instruct | smoke_passed | true | chat | phase324b3-microsoft_phi_4_mini_instruct-20260506130704 |  |
| nvidia/llama-3.1-nemotron-nano-8b-v1 | smoke_passed | true | reasoning_chat | phase-313a-model-usability-matrix |  |
| nvidia/llama-3.3-nemotron-super-49b-v1 | smoke_passed | true | reasoning_chat | phase-313a-model-usability-matrix |  |
| nvidia/nemotron-3-super-120b-a12b | smoke_passed | true | reasoning_chat | phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314 |  |
| nvidia/nemotron-mini-4b-instruct | smoke_passed | true | reasoning_chat | phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316 |  |

## Failed Models

| modelId | status | selectable | capability | evidenceId | reason |
| --- | --- | --- | --- | --- | --- |
| meta/llama2-70b | smoke_failed | false | chat | phase324b2-meta_llama2_70b-20260506130652 | httpStatus=404; assistantTextPresent=false; not eligible for selectable |
| meta/llama3-8b | smoke_failed | false | chat | phase324b3-meta_llama3_8b-20260506130700 | httpStatus=404; assistantTextPresent=false; not eligible for selectable |
| microsoft/phi-3-mini-4k-instruct | smoke_failed | false | chat | phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702 | httpStatus=410; assistantTextPresent=false; not eligible for selectable |
| mistralai/mistral-7b-instruct | smoke_failed | false | reasoning_chat | phase324b3-mistralai_mistral_7b_instruct-20260506130705 | httpStatus=404; assistantTextPresent=false; not eligible for selectable |
| mistralai/mistral-7b-instruct-v0.3 | smoke_failed | false | reasoning_chat | phase324b3-mistralai_mistral_7b_instruct_v0_3-20260506130707 | httpStatus=404; assistantTextPresent=false; not eligible for selectable |
| nvidia/llama-3.1-nemotron-ultra-253b-v1 | smoke_failed | false | reasoning_chat | phase-313a-model-usability-matrix | NVIDIA call did not complete successfully (HTTP 404). |
| nvidia/llama-3.3-nemotron-super-49b-v1.5 | smoke_failed | false | reasoning_chat | phase324b-nvidia_llama_3_3_nemotron_super_49b_v1_5-20260506124310 | completionVerified=false; assistantTextPresent=false; not eligible for selectable |
| nvidia/nemotron-3-nano-30b-a3b | smoke_failed | false | reasoning_chat | phase324b-nvidia_nemotron_3_nano_30b_a3b-20260506124312 | completionVerified=false; assistantTextPresent=false; not eligible for selectable |
| nvidia/nvidia-nemotron-nano-9b-v2 | smoke_failed | false | reasoning_chat | phase324b-nvidia_nvidia_nemotron_nano_9b_v2-20260506124319 | completionVerified=false; assistantTextPresent=false; not eligible for selectable |

## Model Status Rows Sample

| modelId | status | selectable | capability | evidenceId | reason |
| --- | --- | --- | --- | --- | --- |
| abacusai/dracarys-llama-3.1-70b-instruct | smoke_passed | true | chat | phase324b2-abacusai_dracarys_llama_3_1_70b_instruct-20260506130555 |  |
| bytedance/seed-oss-36b-instruct | unverified | false | chat |  | unverified; no valid smoke evidence |
| deepseek-ai/deepseek-v3.1-terminus | unverified | false | reasoning_chat |  | unverified; no valid smoke evidence |
| deepseek-ai/deepseek-v3.2 | unverified | false | reasoning_chat |  | unverified; no valid smoke evidence |
| deepseek-ai/deepseek-v4-flash | unverified | false | reasoning_chat |  | unverified; no valid smoke evidence |
| deepseek-ai/deepseek-v4-pro | unverified | false | reasoning_chat |  | unverified; no valid smoke evidence |
| google/codegemma-7b | unverified | false | code |  | unverified; no valid smoke evidence |
| google/gemma-2-2b-it | unverified | false | chat |  | unverified; no valid smoke evidence |
| google/gemma-3-27b-it | unverified | false | chat |  | unverified; no valid smoke evidence |
| google/gemma-3n-e2b-it | unverified | false | chat |  | unverified; no valid smoke evidence |
| google/gemma-3n-e4b-it | unverified | false | chat |  | unverified; no valid smoke evidence |
| google/gemma-4-31b-it | unverified | false | chat |  | unverified; no valid smoke evidence |
| google/gemma-7b | unverified | false | chat |  | unverified; no valid smoke evidence |
| google/paligemma | unverified | false | vision |  | unverified; no valid smoke evidence |
| hive/ai-generated-image-detection | unverified | false | multimodal |  | unverified; no valid smoke evidence |
| hive/deepfake-image-detection | unverified | false | multimodal |  | unverified; no valid smoke evidence |
| ipd/proteinmpnn | unverified | false | biology |  | unverified; no valid smoke evidence |
| ipd/rfdiffusion | unverified | false | biology |  | unverified; no valid smoke evidence |
| meta/esm2-650m | unverified | false | biology |  | unverified; no valid smoke evidence |
| meta/esmfold | unverified | false | biology |  | unverified; no valid smoke evidence |
| meta/llama-3.1-70b-instruct | smoke_passed | true | chat | phase324b2-meta_llama_3_1_70b_instruct-20260506130559 |  |
| meta/llama-3.1-8b-instruct | smoke_passed | true | chat | phase324b2-meta_llama_3_1_8b_instruct-20260506130631 |  |
| meta/llama-3.2-11b-vision-instruct | unverified | false | multimodal |  | unverified; no valid smoke evidence |
| meta/llama-3.2-1b-instruct | unverified | false | chat |  | unverified; no valid smoke evidence |
| meta/llama-3.2-3b-instruct | unverified | false | chat |  | unverified; no valid smoke evidence |
| meta/llama-3.2-90b-vision-instruct | unverified | false | multimodal |  | unverified; no valid smoke evidence |
| meta/llama-3.3-70b-instruct | smoke_passed | true | chat | phase324b2-meta_llama_3_3_70b_instruct-20260506130650 |  |
| meta/llama-4-maverick-17b-128e-instruct | unverified | false | chat |  | unverified; no valid smoke evidence |
| meta/llama-guard-4-12b | unverified | false | safety |  | unverified; no valid smoke evidence |
| meta/llama2-70b | smoke_failed | false | chat | phase324b2-meta_llama2_70b-20260506130652 | httpStatus=404; assistantTextPresent=false; not eligible for selectable |
| meta/llama3-8b | smoke_failed | false | chat | phase324b3-meta_llama3_8b-20260506130700 | httpStatus=404; assistantTextPresent=false; not eligible for selectable |
| microsoft/phi-3-medium-128k-instruct | unverified | false | chat |  | unverified; no valid smoke evidence |
| microsoft/phi-3-mini-4k-instruct | smoke_failed | false | chat | phase324b3-microsoft_phi_3_mini_4k_instruct-20260506130702 | httpStatus=410; assistantTextPresent=false; not eligible for selectable |
| microsoft/phi-4-mini-flash-reasoning | unverified | false | reasoning_chat |  | unverified; no valid smoke evidence |
| microsoft/phi-4-mini-instruct | smoke_passed | true | chat | phase324b3-microsoft_phi_4_mini_instruct-20260506130704 |  |
| microsoft/phi-4-multimodal-instruct | unverified | false | multimodal |  | unverified; no valid smoke evidence |
| microsoft/trellis | unverified | false | chat |  | unverified; no valid smoke evidence |
| minimaxai/minimax-m2.5 | unverified | false | chat |  | unverified; no valid smoke evidence |
| minimaxai/minimax-m2.7 | unverified | false | chat |  | unverified; no valid smoke evidence |
| mistralai/devstral-2-123b-instruct-2512 | unverified | false | code |  | unverified; no valid smoke evidence |

## Safety

- apiCalled: false
- envRead: false
- verificationMetadataModified: false
- selectableGateModified: false
- chatGatewayModified: false
