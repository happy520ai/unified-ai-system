# Phase326G Tianshu Planner Dry-Run Report

- scenariosProcessed: 5
- providerCallsMade: false
- nonNvidiaProviderCallsMade: false
- secretValueExposed: false

## Results

### codingTaskScenario

- taskClassification: coding
- executionMode: single_model
- selectedModels: user-configured-coding-model
- rejectionReason: none

### dataAnalysisTaskScenario

- taskClassification: data_analysis
- executionMode: multi_model
- selectedModels: user-configured-data-model, user-configured-reasoning-model
- rejectionReason: none

### longContextTaskScenario

- taskClassification: long_context
- executionMode: single_model
- selectedModels: user-configured-long-context-model
- rejectionReason: none

### noEligibleModelScenario

- taskClassification: image_understanding
- executionMode: reject
- selectedModels: none
- rejectionReason: no_eligible_model

### godModeEscalationScenario

- taskClassification: safety_sensitive
- executionMode: god_mode_review
- selectedModels: user-configured-reasoning-model, user-configured-coding-model
- rejectionReason: none

