# Phase806 Normal Mode Selector

## Goal

Select one runtime-eligible smoke-passed selectable model for normal mode dry-run routing.

## Verified facts

- selectedModelId=abacusai/dracarys-llama-3.1-70b-instruct

## Boundaries

- selection is recommendation only
- providerCallsMade=false

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/normal-mode-selector-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
