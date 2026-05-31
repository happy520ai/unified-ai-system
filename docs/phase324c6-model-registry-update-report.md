# Phase324C-6 Model Registry Update Report

- mode: apply
- targetFile: apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json
- beforeSelectableModels: 16
- afterSelectableModels: 17
- beforeSmokePassedModels: 16
- afterSmokePassedModels: 17
- addedSelectableModels: `minimaxai/minimax-m2.7`
- rejectedModels: `microsoft/phi-3-medium-128k-instruct`, `microsoft/phi-4-mini-flash-reasoning`, `microsoft/trellis`, `minimaxai/minimax-m2.5`, `google/gemma-7b`
- b7FailedModelsRejected:
  - microsoft/phi-3-medium-128k-instruct: phase324b7_http_410_not_eligible
  - microsoft/phi-4-mini-flash-reasoning: phase324b7_http_410_not_eligible
  - microsoft/trellis: phase324b7_http_404_not_eligible
  - minimaxai/minimax-m2.5: phase324b7_timeout_not_eligible
- selectableGateLogicModified: false
- chatGatewayModified: false
- providerClientModified: false

## Rollback

- Remove only `nvidia:minimaxai/minimax-m2.7` if it was added by Phase324C-6.
- Do not remove the previous 16 selectable models.
- Re-run verify:phase313a-model-usability-matrix.

