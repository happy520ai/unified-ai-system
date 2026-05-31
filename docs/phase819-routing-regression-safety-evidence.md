# Phase819 Routing Regression / Safety Evidence

## Goal

Record routing safety exclusions and dry-run-only regression evidence.

## Verified facts

- blockedHighRiskModelsExcluded=true
- failedModelsExcluded=true
- credentialMissingModelsExcludedFromRuntime=true
- selectableCandidateUsedForDryRunOnly=true

## Boundaries

- providerCallsMade=false
- secretRead=false

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/routing-regression-safety-evidence.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
