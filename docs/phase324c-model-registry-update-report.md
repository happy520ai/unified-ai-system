# Phase324C Model Registry Update Report

- mode: apply
- targetFile: apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json
- modifiedModelCount: 2
- modifiedModels: `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-mini-4b-instruct`
- rejectedModelsStayedNonSelectable: `nvidia/llama-3.3-nemotron-super-49b-v1.5`, `nvidia/nemotron-3-nano-30b-a3b`, `nvidia/nvidia-nemotron-nano-9b-v2`
- selectableGateLogicModified: false
- chatDropdownCodeModified: false
- chatGatewayModified: false
- providerClientModified: false

## 修改前后字段摘要

### nvidia/nemotron-3-super-120b-a12b

- evidenceId: phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314
- before.verificationStatus: missing
- after.verificationStatus: smoke_passed
- before.evidenceId: none
- after.evidenceId: phase324b-nvidia_nemotron_3_super_120b_a12b-20260506124314
- before.providerCalled: false
- after.providerCalled: true
- before.failureCode: none
- after.failureCode: none

### nvidia/nemotron-mini-4b-instruct

- evidenceId: phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- before.verificationStatus: missing
- after.verificationStatus: smoke_passed
- before.evidenceId: none
- after.evidenceId: phase324b-nvidia_nemotron_mini_4b_instruct-20260506124316
- before.providerCalled: false
- after.providerCalled: true
- before.failureCode: none
- after.failureCode: none

