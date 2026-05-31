# Phase943 Eligible Model Pool Lock

## Goal

Lock the Round 2 eligible NVIDIA test pool without modifying selectable state.

## Facts

- globalSelectableModelBaseline=17
- round2EligiblePoolCount=2
- selectableModifiedThisPhase=false

## Boundaries

- No selectable mutation.
- Failed/high-risk/credential-missing models remain excluded.

## Outputs

- apps/ai-gateway-service/evidence/phase941_960/eligible-model-pool-lock-result.json

## Non-claims

- This phase is not production traffic, not human review, and not a seven-day soak.
- This phase does not modify selectable model state.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- When approval is missing, no Provider request is executed.
