# Phase326L God Selector + Tianshu Capability Index Integration Dry-run Design

## Goal

Phase326L connects the Phase326I God Mode participant selector dry-run with the Phase326J Tianshu capability index dry-run. The connection is simulated only.

## Flow

1. Load Phase326I participant selector dry-run output.
2. Load Phase326J capability index dry-run output.
3. Load Phase326F/G baseline God/Tianshu dry-run results.
4. Classify scenario task type.
5. Rank capability index candidates.
6. Select dry-run participants for God Mode scenarios.
7. Produce integratedPlannerDecision, godModeEscalationDecision, selectedParticipantsFromCapabilityIndex, rejectedModels, fallbackPlan, and auditTrace.

## Boundary

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- runtime remains dry_run_without_provider_call
- no God Mode runtime
- no Tianshu runtime
