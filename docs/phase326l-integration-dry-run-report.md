# Phase326L God Selector + Tianshu Capability Index Integration Dry-run Report

- scenariosProcessed: 5
- providerCallsMade: false
- nonNvidiaProviderCallsMade: false
- secretValueExposed: false
- missingSources: none

## tianshuSingleModelSelectionScenario

- taskClassification: general_reasoning
- selectedModels: user-configured-coding-model, user-configured-reasoning-model
- selectedParticipants: mock-supervisor, mock-critic, mock-coder
- godModeEscalated: false

## tianshuEscalatesToGodModeScenario

- taskClassification: safety_sensitive
- selectedModels: user-configured-coding-model, user-configured-reasoning-model, user-configured-long-context-model
- selectedParticipants: mock-supervisor, mock-critic, mock-coder
- godModeEscalated: true

## godModeUsesCapabilityIndexScenario

- taskClassification: general_reasoning
- selectedModels: user-configured-coding-model, user-configured-reasoning-model, user-configured-long-context-model
- selectedParticipants: mock-supervisor, mock-critic, mock-coder
- godModeEscalated: true

## insufficientEligibleModelsScenario

- taskClassification: general_reasoning
- selectedModels: none
- selectedParticipants: none
- godModeEscalated: false

## highRiskModelRejectedScenario

- taskClassification: safety_sensitive
- selectedModels: none
- selectedParticipants: none
- godModeEscalated: false

