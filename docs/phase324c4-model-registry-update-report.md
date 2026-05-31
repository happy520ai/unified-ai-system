# Phase324C-4 Model Registry Update Report

- mode: apply
- targetFile: apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json
- beforeSelectableModels: 10
- afterSelectableModels: 12
- beforeSmokePassedModels: 10
- afterSmokePassedModels: 12
- addedSelectableModels: `google/gemma-3n-e2b-it`, `google/gemma-3n-e4b-it`
- rejectedModels: `google/codegemma-7b`, `google/gemma-2-2b-it`, `google/gemma-3-27b-it`
- selectableGateLogicModified: false
- chatGatewayModified: false
- providerClientModified: false

## Rollback

- Remove only the records added by Phase324C-4 from phase-313a-model-verification-state.json.
- Do not remove deepseek-ai/deepseek-v4-pro or earlier selectable models.
- Re-run verify:phase313a-model-usability-matrix.

