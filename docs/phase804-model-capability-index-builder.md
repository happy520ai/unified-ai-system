# Phase804 Model Capability Index Builder

## Goal

Build a routing-safe capability index from local model library evidence only.

## Verified facts

- selectableModelCount=17
- smokePassedModelCount=17
- runtimeCandidateCount=17

## Boundaries

- credential_missing/cataloged models are excluded from runtime candidates

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
