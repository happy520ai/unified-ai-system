# Phase801 Model Routing Contract

## Goal

Define the dry-run route input/output contract for task pressure and mode-based model routing.

## Verified facts

- defaultRuntimeEnabled=false
- dryRunOnly=true
- selectableAdmissionEnabled=false

## Boundaries

- providerCallsMade=false
- secretRead=false
- default chat behavior unchanged

## Outputs

- apps/ai-gateway-service/evidence/phase801_820/model-routing-contract-result.json

## Non-claims

- This phase is routing dry-run and recommendation only by default.
- This phase does not call providers or read secrets.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not add selectable models.
- Real route execution remains blocked until a future explicit approval gate.
