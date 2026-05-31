# Phase324C-5 Model Registry Update Report

- mode: apply
- targetFile: apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json
- beforeSelectableModels: 12
- afterSelectableModels: 16
- beforeSmokePassedModels: 12
- afterSmokePassedModels: 16
- addedSelectableModels: `google/gemma-4-31b-it`, `meta/llama-3.2-1b-instruct`, `meta/llama-3.2-3b-instruct`, `meta/llama-4-maverick-17b-128e-instruct`
- rejectedModels: `google/gemma-7b`
- googleGemma7bRejectedReason: phase324b6_http_410_not_eligible
- selectableGateLogicModified: false
- chatGatewayModified: false
- providerClientModified: false

## Rollback

- Remove only the records added by Phase324C-5 from phase-313a-model-verification-state.json.
- Do not remove the previous 12 selectable models.
- Re-run verify:phase313a-model-usability-matrix.

