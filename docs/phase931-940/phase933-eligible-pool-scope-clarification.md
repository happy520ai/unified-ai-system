# Phase933 Eligible Pool Scope Clarification

## Goal

Clarify that Phase916-930 selectable count 2 is the strict NVIDIA eligible test pool, not global selectable shrinkage.

## Facts

- globalSelectableModelBaseline=17
- phase916930EligibleTestPoolCount=2
- unauthorizedSelectableShrinkage=false

## Boundaries

- No selectable mutation.
- No global model library status changes.

## Outputs

- apps/ai-gateway-service/evidence/phase931_940/eligible-pool-scope-clarification-result.json

## Non-claims

- This phase does not call Providers or add new Provider requests.
- This phase does not modify selectable state.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase does not claim human review, production traffic, or seven-day soak completion.
